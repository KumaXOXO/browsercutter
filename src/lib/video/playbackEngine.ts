// src/lib/video/playbackEngine.ts
// Extracted from VideoPreview.tsx to stay under the 300-LOC project limit.
//
// Playback state machine:
//
//  isPlaying=false ──────────────────────────────────────────────────┐
//        │                                                            │
//  setIsPlaying(true)                                                 │
//        │                                                            │
//        ▼                                                            │
//  [Resolve startSeg or gap]                                          │
//   ├─ empty timeline ──────────────────────── setIsPlaying(false) ──┤
//   ├─ audio-only ──── playWhenReady(audio) ── tickAudioOnly RAF ────┤
//   ├─ gap before first seg ── tick (gap mode) ── swap at segStart ──┤
//   └─ has video ──── playWhenReady(video) ─── tick RAF ─────────────┤
//                              │ segment end (no gap) → swap ────────┤
//                              │ segment end (gap) → gap mode ───────┤
//                              │ no next seg                         │
//                              └─────────────── setIsPlaying(false) ─┘

import type { Segment, Clip, Transition, TransitionType, TimelineTrack } from '../../types'

function videoIndices(tracks: TimelineTrack[]): Set<number> {
  return new Set(tracks.filter((t) => t.type === 'video' && !t.hidden).map((t) => t.trackIndex))
}
function audioIndices(tracks: TimelineTrack[]): Set<number> {
  return new Set(tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex))
}

// Returns the topmost segment (by track array position, i.e. upper tracks first)
// covering the given timeline position. Used to enforce display hierarchy.
function findTopSegmentAtTime(
  time: number,
  segments: Segment[],
  tracks: TimelineTrack[],
  vIdx: Set<number>,
): Segment | null {
  const candidates = segments.filter(
    (s) => vIdx.has(s.trackIndex) && !s.hidden &&
      time >= s.startOnTimeline &&
      time < s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1),
  )
  return candidates.sort((a, b) =>
    tracks.findIndex((t) => t.trackIndex === a.trackIndex) -
    tracks.findIndex((t) => t.trackIndex === b.trackIndex),
  )[0] ?? null
}

import { applyTransitionStyles } from './transitionStyles'

// playWhenReady — calls media.play() once the element is buffered enough.
// Returns a cancel function that cleans up any pending event listeners.
export function playWhenReady(
  media: HTMLMediaElement,
  onFail: () => void,
  abortRef: { cancelled: boolean },
): () => void {
  const tryPlay = () => {
    if (abortRef.cancelled) return
    media.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('[VideoPreview] play() failed:', err, 'src:', media.src.slice(0, 60))
      onFail()
    })
  }
  if (media.readyState >= 3) {
    tryPlay()
    return () => {}
  }
  let onReady: (() => void) | null = null
  const onError = () => {
    if (!abortRef.cancelled) {
      const me = (media as HTMLVideoElement).error
      console.error('[VideoPreview] media error:', me?.code, me?.message, 'src:', media.src.slice(0, 60))
      onFail()
    }
  }
  media.addEventListener('error', onError, { once: true })
  const schedule = (event: 'canplaythrough' | 'canplay') => {
    if (onReady) {
      media.removeEventListener('canplaythrough', onReady)
      media.removeEventListener('canplay', onReady)
    }
    onReady = () => { media.removeEventListener('error', onError); onReady = null; tryPlay() }
    media.addEventListener(event, onReady, { once: true })
  }
  schedule('canplay')
  const timer = setTimeout(() => schedule('canplay'), 3000)
  return () => {
    clearTimeout(timer)
    if (onReady) {
      media.removeEventListener('canplaythrough', onReady)
      media.removeEventListener('canplay', onReady)
      onReady = null
    }
    media.removeEventListener('error', onError)
  }
}

export interface VideoTickParams {
  videoRef: { current: HTMLVideoElement | null }
  audioRef: { current: HTMLAudioElement }
  segmentsRef: { current: Segment[] }
  clipsRef: { current: Clip[] }
  tracksRef: { current: TimelineTrack[] }
  activeSegRef: { current: Segment | null }
  objectUrlRef: { current: string | null }
  stallCountRef: { current: number }
  rafRef: { current: number }
  cancelPlayRef: { current: () => void }
  playAbortRef: { current: { cancelled: boolean } }
  masterVolumeRef: { current: number }
  transitionVideoRef: { current: HTMLVideoElement | null }
  transitionUrlRef: { current: string | null }
  transitionsRef: { current: Transition[] }
  loopRegionRef: { current: { start: number; end: number } | null }
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
  // If playhead starts in a gap before this segment, begin in gap mode immediately
  initialGapTarget?: Segment | null
  initialPlayheadPosition?: number
}

const OVERLAY_TRANSITIONS: TransitionType[] = ['dissolve', 'wipe', 'slide', 'zoom']

export function startVideoTick(params: VideoTickParams): void {
  const {
    videoRef, audioRef, segmentsRef, clipsRef, tracksRef, activeSegRef,
    objectUrlRef, stallCountRef, rafRef, cancelPlayRef, playAbortRef,
    masterVolumeRef, transitionVideoRef, transitionUrlRef, transitionsRef,
    loopRegionRef,
    setPlayheadPosition, setIsPlaying,
  } = params

  // --- Gap mode state (closure-local, reset on each startVideoTick call) ---
  let inGap = false
  let gapRealStart = 0
  let gapPlayheadStart = 0
  let gapNextSeg: Segment | null = null

  // Start in gap mode if the caller detected the playhead is between segments
  if (params.initialGapTarget) {
    inGap = true
    gapRealStart = performance.now()
    gapPlayheadStart = params.initialPlayheadPosition ?? 0
    gapNextSeg = params.initialGapTarget
  }

  const tick = () => {
    const video = videoRef.current

    // ────────────────────────────────────────────────────────────────
    // Gap mode: playhead is between two segments — show black, wait
    // ────────────────────────────────────────────────────────────────
    if (inGap) {
      const elapsed = (performance.now() - gapRealStart) / 1000
      const pos = gapPlayheadStart + elapsed
      setPlayheadPosition(pos)

      // Loop region during gap
      const loop = loopRegionRef.current
      if (loop && pos >= loop.end) {
        inGap = false; gapNextSeg = null
        const vIdx2 = videoIndices(tracksRef.current)
        const loopStartSeg = findTopSegmentAtTime(loop.start, segmentsRef.current, tracksRef.current, vIdx2)
        if (loopStartSeg && video) {
          const loopClip = clipsRef.current.find((c) => c.id === loopStartSeg.clipId)
          if (loopClip?.file) {
            const prevUrl = objectUrlRef.current
            const url = URL.createObjectURL(loopClip.file)
            objectUrlRef.current = url
            video.src = url
            if (prevUrl) URL.revokeObjectURL(prevUrl)
            video.currentTime = loopStartSeg.inPoint + (loop.start - loopStartSeg.startOnTimeline) * Math.max(0.01, loopStartSeg.speed ?? 1)
            video.volume = Math.min(1, (loopStartSeg.volume ?? 1) * masterVolumeRef.current)
            video.playbackRate = loopStartSeg.speed ?? 1
            video.muted = loopStartSeg.muted ?? false
            playAbortRef.current = { cancelled: false }
            cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
            activeSegRef.current = loopStartSeg
            stallCountRef.current = 0
            // Seek audio track to loop start position
            const aIdxGap = audioIndices(tracksRef.current)
            const audioLoopSegGap = segmentsRef.current.find(
              (s) => aIdxGap.has(s.trackIndex) && !s.muted &&
                loop.start >= s.startOnTimeline &&
                loop.start < s.startOnTimeline + (s.outPoint - s.inPoint),
            )
            if (audioLoopSegGap && !audioRef.current.paused) {
              audioRef.current.currentTime = audioLoopSegGap.inPoint + (loop.start - audioLoopSegGap.startOnTimeline)
            }
            rafRef.current = requestAnimationFrame(tick)
            return
          }
        }
        setIsPlaying(false); return
      }

      // Reached the start of the next segment — exit gap mode
      if (gapNextSeg && pos >= gapNextSeg.startOnTimeline) {
        const ns = gapNextSeg
        inGap = false; gapNextSeg = null
        const nextClip = clipsRef.current.find((c) => c.id === ns.clipId)
        if (!nextClip?.file || !video) { setIsPlaying(false); return }
        const prevUrl2 = objectUrlRef.current
        const url = URL.createObjectURL(nextClip.file)
        objectUrlRef.current = url
        video.src = url
        if (prevUrl2) URL.revokeObjectURL(prevUrl2)
        video.currentTime = ns.inPoint
        video.volume = Math.min(1, (ns.volume ?? 1) * masterVolumeRef.current)
        video.playbackRate = ns.speed ?? 1
        video.muted = ns.muted ?? false
        video.style.opacity = '1'
        playAbortRef.current = { cancelled: false }
        cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
        activeSegRef.current = ns
        stallCountRef.current = 0
      }

      rafRef.current = requestAnimationFrame(tick)
      return
    }

    // ────────────────────────────────────────────────────────────────
    // Normal mode
    // ────────────────────────────────────────────────────────────────
    const seg = activeSegRef.current
    if (!seg || !video) return

    const rawTime = video.currentTime
    const vIdx = videoIndices(tracksRef.current)
    const aIdx = audioIndices(tracksRef.current)

    // Stall detection: ignore if video is actively seeking to avoid false positives
    if (rawTime < seg.inPoint) {
      if (!video.paused && !video.seeking) {
        stallCountRef.current += 1
        if (stallCountRef.current > 60) {
          stallCountRef.current = 0
          setIsPlaying(false)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    stallCountRef.current = 0

    const currentPlayhead = seg.startOnTimeline + (rawTime - seg.inPoint) / Math.max(0.01, seg.speed ?? 1)
    setPlayheadPosition(currentPlayhead)

    // ── Priority check: if a higher-priority track segment now covers the playhead,
    // switch to it immediately. This ensures the display hierarchy is always correct
    // and prevents the playhead from ever jumping backwards.
    const correctSeg = findTopSegmentAtTime(currentPlayhead, segmentsRef.current, tracksRef.current, vIdx)
    const correctClip = correctSeg ? clipsRef.current.find((c) => c.id === correctSeg.clipId) : null
    if (correctSeg && correctSeg.id !== seg.id && correctClip?.type !== 'image' && correctClip?.file) {
      cancelPlayRef.current()
      // Clear any in-progress transition overlay
      if (transitionUrlRef.current && transitionVideoRef.current) {
        URL.revokeObjectURL(transitionUrlRef.current)
        transitionUrlRef.current = null
        transitionVideoRef.current.pause()
        transitionVideoRef.current.src = ''
        transitionVideoRef.current.style.display = 'none'
        video.style.opacity = '1'
        video.style.transform = ''
        video.style.clipPath = ''
      }
      const seekTime = correctSeg.inPoint +
        (currentPlayhead - correctSeg.startOnTimeline) * Math.max(0.01, correctSeg.speed ?? 1)
      if (correctClip.id === seg.clipId && objectUrlRef.current) {
        video.currentTime = seekTime
        video.volume = Math.min(1, (correctSeg.volume ?? 1) * masterVolumeRef.current)
        video.playbackRate = correctSeg.speed ?? 1
        video.muted = correctSeg.muted ?? false
        playAbortRef.current = { cancelled: false }
        const abort = playAbortRef.current
        video.play().catch((err: unknown) => {
          if (abort.cancelled) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setIsPlaying(false)
        })
        cancelPlayRef.current = () => { abort.cancelled = true }
      } else {
        const prevUrl3 = objectUrlRef.current
        const url = URL.createObjectURL(correctClip.file)
        objectUrlRef.current = url
        video.style.opacity = '1'
        video.src = url
        if (prevUrl3) URL.revokeObjectURL(prevUrl3)
        video.currentTime = seekTime
        video.volume = Math.min(1, (correctSeg.volume ?? 1) * masterVolumeRef.current)
        video.playbackRate = correctSeg.speed ?? 1
        video.muted = correctSeg.muted ?? false
        playAbortRef.current = { cancelled: false }
        cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
      }
      activeSegRef.current = correctSeg
      stallCountRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    // Loop region: when playhead passes the end, seek back to start
    const loop = loopRegionRef.current
    if (loop && currentPlayhead >= loop.end) {
      const loopStartSeg = findTopSegmentAtTime(loop.start, segmentsRef.current, tracksRef.current, vIdx)

      if (loopStartSeg) {
        const loopClip = clipsRef.current.find((c) => c.id === loopStartSeg.clipId)
        if (loopClip?.file) {
          cancelPlayRef.current()
          if (loopStartSeg.id !== seg.id) {
            const prevUrl4 = objectUrlRef.current
            const url = URL.createObjectURL(loopClip.file)
            objectUrlRef.current = url
            video.src = url
            if (prevUrl4) URL.revokeObjectURL(prevUrl4)
          }
          const seekTime = loopStartSeg.inPoint + (loop.start - loopStartSeg.startOnTimeline) * Math.max(0.01, loopStartSeg.speed ?? 1)
          video.currentTime = seekTime
          video.volume = Math.min(1, (loopStartSeg.volume ?? 1) * masterVolumeRef.current)
          video.playbackRate = loopStartSeg.speed ?? 1
          video.muted = loopStartSeg.muted ?? false
          playAbortRef.current = { cancelled: false }
          cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
          activeSegRef.current = loopStartSeg
          stallCountRef.current = 0
          // Seek audio track to loop start position so it loops in sync with video
          const audioLoopSeg = segmentsRef.current.find(
            (s) => aIdx.has(s.trackIndex) && !s.muted &&
              loop.start >= s.startOnTimeline &&
              loop.start < s.startOnTimeline + (s.outPoint - s.inPoint),
          )
          if (audioLoopSeg && !audioRef.current.paused) {
            audioRef.current.currentTime = audioLoopSeg.inPoint + (loop.start - audioLoopSeg.startOnTimeline)
          }
          rafRef.current = requestAnimationFrame(tick)
          return
        }
      }
    }

    // Sync audio track
    const audioSeg = segmentsRef.current.find(
      (s) => aIdx.has(s.trackIndex) && !s.muted &&
        currentPlayhead >= s.startOnTimeline &&
        currentPlayhead < s.startOnTimeline + (s.outPoint - s.inPoint),
    )
    if (audioSeg && audioRef.current.paused && audioRef.current.src) {
      audioRef.current.play().catch(() => {})
    } else if (!audioSeg && !audioRef.current.paused) {
      audioRef.current.pause()
    }

    // Segment end and next-segment resolution.
    // segEnd is the timeline position where the current segment ends.
    const segEnd = seg.startOnTimeline + (seg.outPoint - seg.inPoint) / Math.max(0.01, seg.speed ?? 1)

    // Find what should play just after segEnd: first check if any segment covers segEnd+epsilon
    // (an overlapping lower-priority or same-priority segment), otherwise look for the next one.
    const coveringNext = findTopSegmentAtTime(segEnd + 0.001, segmentsRef.current, tracksRef.current, vIdx)
    const fallbackNext = coveringNext ? null : segmentsRef.current
      .filter((s) => vIdx.has(s.trackIndex) && !s.hidden && s.startOnTimeline > segEnd)
      .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null
    const nextSeg = coveringNext ?? fallbackNext ?? null
    const hasGap = !coveringNext && !!fallbackNext && fallbackNext.startOnTimeline > segEnd + 0.1

    // Transition preload: for dissolve/wipe/slide/zoom, load B early and animate
    if (nextSeg && transitionVideoRef.current) {
      const trans = transitionsRef.current.find(
        (t) => t.beforeSegmentId === seg.id && t.afterSegmentId === nextSeg.id &&
          OVERLAY_TRANSITIONS.includes(t.type) && t.duration > 0,
      )
      if (trans) {
        const segDuration = (seg.outPoint - seg.inPoint) / Math.max(0.01, seg.speed ?? 1)
        const transStart = seg.startOnTimeline + segDuration - trans.duration
        if (currentPlayhead >= transStart) {
          if (!transitionUrlRef.current) {
            const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
            if (nextClip?.file) {
              const tUrl = URL.createObjectURL(nextClip.file)
              transitionUrlRef.current = tUrl
              transitionVideoRef.current.src = tUrl
              transitionVideoRef.current.currentTime = nextSeg.inPoint
              transitionVideoRef.current.volume = 0
              transitionVideoRef.current.playbackRate = nextSeg.speed ?? 1
              transitionVideoRef.current.play().catch(() => {})
            }
          }
          if (transitionUrlRef.current) {
            const progress = Math.min(1, (currentPlayhead - transStart) / trans.duration)
            applyTransitionStyles(trans.type, progress, video, transitionVideoRef.current!)
          }
        }
      }
    }

    // For transitions to adjacent segments, preload early; for gaps, wait to the very end.
    const swapThreshold = hasGap ? 0.033 : Math.max(0.15, 0.15 * (seg.speed ?? 1))

    // Compute the seek time into nextSeg at swap moment.
    // If nextSeg started before segEnd (overlapping lower-priority segment), seek to the right position.
    const nextSeekTime = nextSeg && nextSeg.startOnTimeline < segEnd
      ? nextSeg.inPoint + (segEnd - nextSeg.startOnTimeline) * Math.max(0.01, nextSeg.speed ?? 1)
      : nextSeg?.inPoint ?? 0

    if (rawTime >= seg.outPoint - swapThreshold) {
      if (nextSeg) {
        if (hasGap) {
          // ── Enter gap mode: clear video → black, advance playhead by real time ──
          cancelPlayRef.current()
          video.pause()
          // Clear src BEFORE revoking to prevent ERR_FILE_NOT_FOUND
          video.removeAttribute('src')
          video.load()
          video.style.opacity = '0'
          if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
          activeSegRef.current = null
          inGap = true
          gapRealStart = performance.now()
          gapPlayheadStart = segEnd
          gapNextSeg = nextSeg
          setPlayheadPosition(segEnd)
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        // ── No gap — swap to next segment ──
        if (transitionUrlRef.current && transitionVideoRef.current) {
          cancelPlayRef.current()
          const nextClipForT = clipsRef.current.find((c) => c.id === nextSeg.clipId)
          if (nextClipForT?.id === seg.clipId && objectUrlRef.current) {
            transitionUrlRef.current = null
            transitionVideoRef.current.pause()
            transitionVideoRef.current.src = ''
            video.style.opacity = '1'; video.style.transform = ''; video.style.clipPath = ''
            transitionVideoRef.current.style.display = 'none'
            video.currentTime = nextSeekTime
            video.volume = Math.min(1, (nextSeg.volume ?? 1) * masterVolumeRef.current)
            video.playbackRate = nextSeg.speed ?? 1
            video.muted = nextSeg.muted ?? false
            playAbortRef.current = { cancelled: false }
            cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
          } else {
            const prevUrl6 = objectUrlRef.current
            const tUrl = transitionUrlRef.current
            const tTime = transitionVideoRef.current.currentTime
            transitionUrlRef.current = null
            transitionVideoRef.current.pause()
            transitionVideoRef.current.src = ''
            video.style.opacity = '1'; video.style.transform = ''; video.style.clipPath = ''
            transitionVideoRef.current.style.display = 'none'
            objectUrlRef.current = tUrl
            video.src = tUrl
            if (prevUrl6) URL.revokeObjectURL(prevUrl6)
            video.currentTime = tTime
            video.volume = Math.min(1, (nextSeg.volume ?? 1) * masterVolumeRef.current)
            video.playbackRate = nextSeg.speed ?? 1
            video.muted = nextSeg.muted ?? false
            playAbortRef.current = { cancelled: false }
            cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
          }
          activeSegRef.current = nextSeg
          stallCountRef.current = 0
        } else {
          const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
          if (nextClip?.file) {
            cancelPlayRef.current()
            stallCountRef.current = 0
            if (nextClip.id === seg.clipId && objectUrlRef.current) {
              // Same-clip: just seek, call play() directly to avoid canplaythrough wait lag
              video.currentTime = nextSeekTime
              video.volume = Math.min(1, (nextSeg.volume ?? 1) * masterVolumeRef.current)
              video.playbackRate = nextSeg.speed ?? 1
              video.muted = nextSeg.muted ?? false
              playAbortRef.current = { cancelled: false }
              const abort = playAbortRef.current
              video.play().catch((err: unknown) => {
                if (abort.cancelled) return
                if (err instanceof DOMException && err.name === 'AbortError') return
                console.error('[VideoPreview] same-clip play() failed:', err)
                setIsPlaying(false)
              })
              cancelPlayRef.current = () => { abort.cancelled = true }
            } else {
              const prevUrl5 = objectUrlRef.current
              const url = URL.createObjectURL(nextClip.file)
              objectUrlRef.current = url
              video.src = url
              if (prevUrl5) URL.revokeObjectURL(prevUrl5)
              video.currentTime = nextSeekTime
              video.volume = Math.min(1, (nextSeg.volume ?? 1) * masterVolumeRef.current)
              video.playbackRate = nextSeg.speed ?? 1
              video.muted = nextSeg.muted ?? false
              playAbortRef.current = { cancelled: false }
              cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
            }
            activeSegRef.current = nextSeg
          } else {
            if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
            setIsPlaying(false)
            return
          }
        }
      } else {
        setIsPlaying(false)
        return
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  rafRef.current = requestAnimationFrame(tick)
}

export interface AudioOnlyTickParams {
  audioRef: { current: HTMLAudioElement }
  rafRef: { current: number }
  cancelPlayRef: { current: () => void }
  playAbortRef: { current: { cancelled: boolean } }
  segmentsRef: { current: Segment[] }
  clipsRef: { current: Clip[] }
  tracksRef: { current: TimelineTrack[] }
  audioUrlRef: { current: string | null }
  masterVolumeRef: { current: number }
  initialSeg: Segment
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

export function startAudioOnlyTick(params: AudioOnlyTickParams): () => void {
  const {
    audioRef, rafRef, cancelPlayRef, playAbortRef,
    segmentsRef, clipsRef, tracksRef, audioUrlRef, masterVolumeRef, initialSeg,
    setPlayheadPosition, setIsPlaying,
  } = params

  const currentSegRef = { current: initialSeg }

  const tick = () => {
    const seg = currentSegRef.current
    if (!seg || audioRef.current.paused) return

    const rawTime = audioRef.current.currentTime
    setPlayheadPosition(seg.startOnTimeline + (rawTime - seg.inPoint))

    if (rawTime >= seg.outPoint - 0.05) {
      const aIdx2 = audioIndices(tracksRef.current)
      const nextSeg = segmentsRef.current
        .filter((s) => aIdx2.has(s.trackIndex) && !s.muted && s.startOnTimeline > seg.startOnTimeline)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0]

      if (nextSeg) {
        const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
        if (nextClip?.file) {
          cancelPlayRef.current()
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
          const url = URL.createObjectURL(nextClip.file)
          audioUrlRef.current = url
          audioRef.current.src = url
          audioRef.current.currentTime = nextSeg.inPoint
          audioRef.current.volume = Math.min(1, (nextSeg.volume ?? 1) * masterVolumeRef.current)
          playAbortRef.current = { cancelled: false }
          cancelPlayRef.current = playWhenReady(audioRef.current, () => setIsPlaying(false), playAbortRef.current)
          currentSegRef.current = nextSeg
        } else {
          setIsPlaying(false)
          return
        }
      } else {
        setIsPlaying(false)
        return
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  rafRef.current = requestAnimationFrame(tick)

  return () => {}
}
