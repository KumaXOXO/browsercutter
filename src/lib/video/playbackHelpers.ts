import type { Segment, Clip, TimelineTrack } from '../../types'
import type { ClipVideoPool } from './videoPool'

export function videoIndices(tracks: TimelineTrack[]): Set<number> {
  return new Set(tracks.filter((t) => t.type === 'video' && !t.hidden && !t.muted).map((t) => t.trackIndex))
}

export function audioIndices(tracks: TimelineTrack[]): Set<number> {
  return new Set(tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex))
}

export function findTopSegmentAtTime(
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

const PLAY_RETRY_MS = 30
const BUFFER_RECHECK_MS = 3000

export function playWhenReady(
  media: HTMLMediaElement,
  onFail: () => void,
  abortRef: { cancelled: boolean },
): () => void {
  const pendingListeners: (() => void)[] = []
  const addListener = (el: EventTarget, evt: string, fn: () => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(evt, fn, opts)
    pendingListeners.push(() => el.removeEventListener(evt, fn))
  }
  const cancel = () => { abortRef.cancelled = true; pendingListeners.forEach(fn => fn()) }

  const tryPlay = () => {
    if (abortRef.cancelled) return
    media.play().catch((err: unknown) => {
      if (abortRef.cancelled) return
      if (err instanceof DOMException && err.name === 'AbortError') {
        const retry = () => {
          if (abortRef.cancelled) return
          media.play().catch((e2: unknown) => {
            if (e2 instanceof DOMException && e2.name === 'AbortError') return
            if (!abortRef.cancelled) onFail()
          })
        }
        if (media.seeking) {
          addListener(media, 'seeked', retry, { once: true })
        } else {
          const t = setTimeout(retry, PLAY_RETRY_MS)
          pendingListeners.push(() => clearTimeout(t))
        }
        return
      }
      console.error('[VideoPreview] play() failed:', err, 'src:', media.src.slice(0, 60))
      onFail()
    })
  }

  const waitForBuffer = () => {
    const onError = () => {
      if (!abortRef.cancelled) {
        const me = (media as HTMLVideoElement).error
        console.error('[VideoPreview] media error:', me?.code, me?.message, 'src:', media.src.slice(0, 60))
        onFail()
      }
    }
    addListener(media, 'error', onError, { once: true })
    const onReady = () => { media.removeEventListener('error', onError); tryPlay() }
    addListener(media, 'canplay', onReady, { once: true })
  }

  if (media.seeking) {
    addListener(media, 'seeked', () => {
      if (abortRef.cancelled) return
      if (media.readyState >= 3) tryPlay()
      else waitForBuffer()
    }, { once: true })
    return cancel
  }

  if (media.readyState >= 3) {
    tryPlay()
    return cancel
  }

  waitForBuffer()
  const timer = setTimeout(() => {
    if (abortRef.cancelled || media.readyState >= 3) return
    waitForBuffer()
  }, BUFFER_RECHECK_MS)
  pendingListeners.push(() => clearTimeout(timer))
  return cancel
}

export function activateClip(
  pool: ClipVideoPool,
  clip: Clip,
  seg: Segment,
  seekTime: number,
  masterVolume: number,
  activeClipIdRef: { current: string | null },
  cancelPlayRef: { current: () => void },
  playAbortRef: { current: { cancelled: boolean } },
  setIsPlaying: (playing: boolean) => void,
): void {
  const video = pool.ensure(clip.id, clip.proxyFile ?? clip.file)
  pool.pauseAllExcept(clip.id)
  pool.showOnly(clip.id)
  pool.applyTransform(clip.id, seg.rotation ?? 0)
  seekAndPlay(video, seg, seekTime, masterVolume, cancelPlayRef, playAbortRef, setIsPlaying)
  activeClipIdRef.current = clip.id
}

const PRESEEKED_SNAP_S = 0.05

export function seekAndPlay(
  video: HTMLVideoElement,
  seg: Segment,
  seekTime: number,
  masterVolume: number,
  cancelPlayRef: { current: () => void },
  playAbortRef: { current: { cancelled: boolean } },
  setIsPlaying: (playing: boolean) => void,
): void {
  video.volume = Math.min(1, (seg.volume ?? 1) * masterVolume)
  video.playbackRate = seg.speed ?? 1
  video.muted = seg.muted ?? false
  playAbortRef.current = { cancelled: false }
  // Skip seek if already positioned by pre-seek — avoids re-triggering 'seeking' at swap time.
  if (video.seeking || Math.abs(video.currentTime - seekTime) > PRESEEKED_SNAP_S) {
    video.currentTime = seekTime
  }
  cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
}
