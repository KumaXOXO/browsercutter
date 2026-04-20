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

import type { Segment, Clip } from '../../types'

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
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

// startVideoTick — starts the RAF loop that drives video playback.
// Mutually exclusive with startAudioOnlyTick — never run both simultaneously.
export function startVideoTick(params: VideoTickParams): void {
  const {
    videoRef, audioRef, segmentsRef, clipsRef, activeSegRef,
    objectUrlRef, stallCountRef, rafRef, cancelPlayRef, playAbortRef,
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

    const currentPlayhead = seg.startOnTimeline + (rawTime - seg.inPoint)
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

    if (rawTime >= seg.outPoint - 0.05) {
      const nextSeg = segmentsRef.current
        .filter((s) => s.trackIndex === 0 && !s.hidden && s.startOnTimeline > seg.startOnTimeline)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0]

      if (nextSeg) {
        const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
        if (nextClip?.file) {
          cancelPlayRef.current()
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          const url = URL.createObjectURL(nextClip.file)
          objectUrlRef.current = url
          videoRef.current.src = url
          videoRef.current.currentTime = nextSeg.inPoint
          videoRef.current.volume = nextSeg.volume ?? 1
          videoRef.current.playbackRate = nextSeg.speed ?? 1
          playAbortRef.current = { cancelled: false }
          cancelPlayRef.current = playWhenReady(videoRef.current, () => setIsPlaying(false), playAbortRef.current)
          activeSegRef.current = nextSeg
        } else {
          if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
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
}

export interface AudioOnlyTickParams {
  audioRef: { current: HTMLAudioElement }
  rafRef: { current: number }
  startOnTimeline: number
  inPoint: number
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

// startAudioOnlyTick — RAF loop for audio-only timelines.
// Mutually exclusive with startVideoTick — never run both simultaneously.
// Returns a cleanup function that removes the ended listener.
export function startAudioOnlyTick(params: AudioOnlyTickParams): () => void {
  const { audioRef, rafRef, startOnTimeline, inPoint, setPlayheadPosition, setIsPlaying } = params

  const onEnded = () => setIsPlaying(false)
  audioRef.current.addEventListener('ended', onEnded, { once: true })

  const tick = () => {
    if (!audioRef.current || audioRef.current.paused) return
    const elapsed = audioRef.current.currentTime - inPoint
    setPlayheadPosition(startOnTimeline + elapsed)
    rafRef.current = requestAnimationFrame(tick)
  }
  rafRef.current = requestAnimationFrame(tick)

  return () => {
    audioRef.current?.removeEventListener('ended', onEnded)
  }
}
