// src/lib/video/playbackEngine.ts
// Extracted from VideoPreview.tsx to stay under the 300-LOC project limit.
// Contains playWhenReady, the video RAF tick, and the audio-only RAF tick.
//
// Playback state machine:
//
//  isPlaying=false ──────────────────────────────────────────────────┐
//        │                                                            │
//  setIsPlaying(true)                                                 │
//        │                                                            │
//        ▼                                                            │
//  [Resolve startSeg]                                                 │
//   ├─ empty timeline ──────────────────────── setIsPlaying(false) ──┤
//   ├─ audio-only ──── playWhenReady(audio) ── tickAudioOnly RAF ────┤
//   │                          │ ended event                         │
//   └─ has video ──── playWhenReady(video) ─── tick RAF ─────────────┤
//                              │ segment end                         │
//                              ▼                                      │
//                      [swap video.src] ── playWhenReady(video) ─────┤
//                              │ no next seg                         │
//                              └─────────────── setIsPlaying(false) ─┘

import type { Segment, Clip, Transition, TransitionType } from '../../types'
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
    media.play().catch(onFail)
  }
  if (media.readyState >= 3) {
    tryPlay()
    return () => {}
  }
  let onReady: (() => void) | null = null
  const schedule = (event: 'canplaythrough' | 'canplay') => {
    if (onReady) {
      media.removeEventListener('canplaythrough', onReady)
      media.removeEventListener('canplay', onReady)
    }
    onReady = () => { onReady = null; tryPlay() }
    media.addEventListener(event, onReady, { once: true })
  }
  schedule('canplaythrough')
  const timer = setTimeout(() => schedule('canplay'), 5000)
  return () => {
    clearTimeout(timer)
    if (onReady) {
      media.removeEventListener('canplaythrough', onReady)
      media.removeEventListener('canplay', onReady)
      onReady = null
    }
  }
}

export interface VideoTickParams {
  videoRef: { current: HTMLVideoElement | null }
  audioRef: { current: HTMLAudioElement }
  segmentsRef: { current: Segment[] }
  clipsRef: { current: Clip[] }
  activeSegRef: { current: Segment | null }
  objectUrlRef: { current: string | null }
  stallCountRef: { current: number }
  rafRef: { current: number }
  cancelPlayRef: { current: () => void }
  playAbortRef: { current: { cancelled: boolean } }
  masterVolumeRef: { current: number }
  // Transition overlay — second video element for dissolve/wipe/slide/zoom
  transitionVideoRef: { current: HTMLVideoElement | null }
  transitionUrlRef: { current: string | null }
  transitionsRef: { current: Transition[] }
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

// TRANSITION_TYPES that use the second video element (fade is handled by CSS overlay in VideoPreview)
const OVERLAY_TRANSITIONS: TransitionType[] = ['dissolve', 'wipe', 'slide', 'zoom']

// startVideoTick — starts the RAF loop that drives video playback.
// Mutually exclusive with startAudioOnlyTick — never run both simultaneously.
export function startVideoTick(params: VideoTickParams): void {
  const {
    videoRef, audioRef, segmentsRef, clipsRef, activeSegRef,
    objectUrlRef, stallCountRef, rafRef, cancelPlayRef, playAbortRef,
    masterVolumeRef, transitionVideoRef, transitionUrlRef, transitionsRef,
    setPlayheadPosition, setIsPlaying,
  } = params

  const tick = () => {
    const seg = activeSegRef.current
    if (!seg || !videoRef.current) return

    const rawTime = videoRef.current.currentTime
    if (rawTime < seg.inPoint) {
      stallCountRef.current += 1
      if (stallCountRef.current > 60) {
        stallCountRef.current = 0
        setIsPlaying(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    stallCountRef.current = 0

    const currentPlayhead = seg.startOnTimeline + (rawTime - seg.inPoint) / Math.max(0.01, seg.speed ?? 1)
    setPlayheadPosition(currentPlayhead)

    // Sync audio track: find any audio segment at current playhead (skip muted)
    const audioSeg = segmentsRef.current.find(
      (s) => s.trackIndex === 2 && !s.muted &&
        currentPlayhead >= s.startOnTimeline &&
        currentPlayhead < s.startOnTimeline + (s.outPoint - s.inPoint),
    )
    if (audioSeg && audioRef.current.paused && audioRef.current.src) {
      audioRef.current.play().catch(() => {})
    } else if (!audioSeg && !audioRef.current.paused) {
      audioRef.current.pause()
    }

    // Resolve next video segment (shared by both transition preload and segment swap)
    const nextSeg = segmentsRef.current
      .filter((s) => s.trackIndex === 0 && !s.hidden && s.startOnTimeline > seg.startOnTimeline)
      .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0]

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
          // Lazy-load B on first entry into transition window
          if (!transitionUrlRef.current) {
            const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
            if (nextClip?.file) {
              const tUrl = URL.createObjectURL(nextClip.file)
              transitionUrlRef.current = tUrl
              transitionVideoRef.current.src = tUrl
              transitionVideoRef.current.currentTime = nextSeg.inPoint
              transitionVideoRef.current.volume = 0  // muted while B plays under A
              transitionVideoRef.current.playbackRate = nextSeg.speed ?? 1
              transitionVideoRef.current.play().catch(() => {})
            }
          }
          if (transitionUrlRef.current && videoRef.current) {
            const progress = Math.min(1, (currentPlayhead - transStart) / trans.duration)
            applyTransitionStyles(trans.type, progress, videoRef.current, transitionVideoRef.current)
          }
        }
      }
    }

    if (rawTime >= seg.outPoint - 0.05) {
      if (nextSeg) {
        // If transition B is preloaded, promote it to primary (avoid re-buffering)
        if (transitionUrlRef.current && transitionVideoRef.current && videoRef.current) {
          cancelPlayRef.current()
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          const tUrl = transitionUrlRef.current
          const tTime = transitionVideoRef.current.currentTime
          transitionUrlRef.current = null
          transitionVideoRef.current.pause()
          transitionVideoRef.current.src = ''
          // Restore A styles, hide B
          videoRef.current.style.opacity = '1'
          videoRef.current.style.transform = ''
          videoRef.current.style.clipPath = ''
          transitionVideoRef.current.style.display = 'none'
          objectUrlRef.current = tUrl
          videoRef.current.src = tUrl
          videoRef.current.currentTime = tTime
          videoRef.current.volume = (nextSeg.volume ?? 1) * masterVolumeRef.current
          videoRef.current.playbackRate = nextSeg.speed ?? 1
          videoRef.current.muted = nextSeg.muted ?? false
          playAbortRef.current = { cancelled: false }
          cancelPlayRef.current = playWhenReady(videoRef.current, () => setIsPlaying(false), playAbortRef.current)
          activeSegRef.current = nextSeg
        } else {
          const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
          if (nextClip?.file) {
            cancelPlayRef.current()
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
            const url = URL.createObjectURL(nextClip.file)
            objectUrlRef.current = url
            videoRef.current.src = url
            videoRef.current.currentTime = nextSeg.inPoint
            videoRef.current.volume = (nextSeg.volume ?? 1) * masterVolumeRef.current
            videoRef.current.playbackRate = nextSeg.speed ?? 1
            videoRef.current.muted = nextSeg.muted ?? false
            playAbortRef.current = { cancelled: false }
            cancelPlayRef.current = playWhenReady(videoRef.current, () => setIsPlaying(false), playAbortRef.current)
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
  audioUrlRef: { current: string | null }
  masterVolumeRef: { current: number }
  initialSeg: Segment
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

// startAudioOnlyTick — RAF loop for audio-only timelines.
// Supports multi-segment playback: transitions to the next audio segment at boundary.
// Mutually exclusive with startVideoTick — never run both simultaneously.
// Returns a cleanup function.
export function startAudioOnlyTick(params: AudioOnlyTickParams): () => void {
  const {
    audioRef, rafRef, cancelPlayRef, playAbortRef,
    segmentsRef, clipsRef, audioUrlRef, masterVolumeRef, initialSeg,
    setPlayheadPosition, setIsPlaying,
  } = params

  const currentSegRef = { current: initialSeg }

  const tick = () => {
    const seg = currentSegRef.current
    if (!seg || audioRef.current.paused) return

    const rawTime = audioRef.current.currentTime
    setPlayheadPosition(seg.startOnTimeline + (rawTime - seg.inPoint))

    if (rawTime >= seg.outPoint - 0.05) {
      const nextSeg = segmentsRef.current
        .filter((s) => s.trackIndex === 2 && !s.muted && s.startOnTimeline > seg.startOnTimeline)
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
          audioRef.current.volume = (nextSeg.volume ?? 1) * masterVolumeRef.current
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
