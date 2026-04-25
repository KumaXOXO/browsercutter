// src/components/preview/VideoPreview.tsx
import { useRef, useEffect, useMemo, useState } from 'react'
import { Film, Maximize2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { formatTime } from '../../lib/utils'
import TextOverlayRenderer from './TextOverlayRenderer'
import { buildCSSFilter, hasVignette, vignetteOpacity } from '../../lib/video/effectsFilter'
import { playWhenReady, startVideoTick, startAudioOnlyTick, getClipUrl } from '../../lib/video/playbackEngine'
import { ClipVideoPool } from '../../lib/video/videoPool'
import type { Segment } from '../../types'

export default function VideoPreview() {
  const {
    segments, clips, tracks, playheadPosition, isPlaying,
    setPlayheadPosition, setIsPlaying,
    masterVolume, transitions, loopRegion, projectSettings,
  } = useAppStore()

  const previewContainerRef = useRef<HTMLDivElement>(null)
  const poolRef = useRef<ClipVideoPool | null>(null)
  const poolContainerRef = useRef<HTMLDivElement>(null)
  const activeClipIdRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const stallCountRef = useRef(0)
  const activeSegRef = useRef<Segment | null>(null)
  const segmentsRef = useRef(segments)
  const clipsRef = useRef(clips)
  const masterVolumeRef = useRef(masterVolume)
  const transitionsRef = useRef(transitions)

  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const audioUrlRef = useRef<string | null>(null)
  const activeAudioSegRef = useRef<Segment | null>(null)

  const [imgUrl, setImgUrl] = useState<string | null>(null)

  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  const loopRegionRef = useRef(loopRegion)
  loopRegionRef.current = loopRegion

  const playAbortRef = useRef({ cancelled: false })
  const cancelPlayRef = useRef<() => void>(() => {})

  segmentsRef.current = segments
  clipsRef.current = clips
  masterVolumeRef.current = masterVolume
  transitionsRef.current = transitions

  useEffect(() => {
    const pool = new ClipVideoPool()
    poolRef.current = pool
    if (poolContainerRef.current) pool.attach(poolContainerRef.current)
    return () => { pool.destroy(); poolRef.current = null }
  }, [])

  useEffect(() => {
    const pool = poolRef.current
    if (!pool) return
    const activeIds = new Set(clips.map((c) => c.id))
    pool.syncToClips(activeIds)
  }, [clips])

  useEffect(() => {
    poolRef.current?.setObjectFit(projectSettings.stretchToFormat ? 'fill' : 'contain')
  }, [projectSettings.stretchToFormat])

  const videoTrackIdx = useMemo(
    () => new Set(tracks.filter((t) => t.type === 'video' && !t.hidden && !t.muted).map((t) => t.trackIndex)),
    [tracks],
  )
  const audioTrackIdx = useMemo(
    () => new Set(tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex)),
    [tracks],
  )

  const activeSeg = useMemo(() => {
    const candidates = segments.filter(
      (s) => videoTrackIdx.has(s.trackIndex) && !s.hidden &&
        playheadPosition >= s.startOnTimeline &&
        playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1),
    )
    return candidates.sort((a, b) => {
      const aPos = tracks.findIndex((t) => t.trackIndex === a.trackIndex)
      const bPos = tracks.findIndex((t) => t.trackIndex === b.trackIndex)
      return aPos - bPos
    })[0] ?? null
  }, [segments, playheadPosition, videoTrackIdx, tracks])
  const activeClip = activeSeg ? clips.find((c) => c.id === activeSeg.clipId) ?? null : null
  if (!isPlaying) activeSegRef.current = activeSeg

  const activeAudioSeg = useMemo(() => segments.find(
    (s) => audioTrackIdx.has(s.trackIndex) && !s.muted &&
      playheadPosition >= s.startOnTimeline &&
      playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
  ) ?? null, [segments, playheadPosition, audioTrackIdx])
  const activeAudioClip = activeAudioSeg ? clips.find((c) => c.id === activeAudioSeg.clipId) ?? null : null
  if (!isPlaying) activeAudioSegRef.current = activeAudioSeg

  const isImageClip = activeClip?.type === 'image'

  const fadeOverlayOpacity = useMemo(() => {
    if (!activeSeg) return 0
    const segDuration = (activeSeg.outPoint - activeSeg.inPoint) / Math.max(0.01, activeSeg.speed ?? 1)
    const segEnd = activeSeg.startOnTimeline + segDuration
    const posInSeg = playheadPosition - activeSeg.startOnTimeline

    const transAfter = transitions.find((t) => t.afterSegmentId === activeSeg.id && t.type === 'fade')
    if (transAfter && transAfter.duration > 0) {
      const fadeStart = segEnd - transAfter.duration
      if (playheadPosition >= fadeStart) {
        return Math.min(1, (playheadPosition - fadeStart) / transAfter.duration)
      }
    }

    const transBefore = transitions.find((t) => t.beforeSegmentId === activeSeg.id && t.type === 'fade')
    if (transBefore && transBefore.duration > 0 && posInSeg < transBefore.duration) {
      return Math.max(0, 1 - posInSeg / transBefore.duration)
    }

    return 0
  }, [activeSeg, playheadPosition, transitions])

  // Load video into pool when clip changes or when pausing.
  // isPlaying is in the dependency array so that pausing mid-transition re-shows
  // the correct clip (the RAF loop may have hidden the previous one already).
  useEffect(() => {
    if (isPlaying) return
    const pool = poolRef.current
    if (!pool || !activeClip?.file || activeClip.type === 'image') {
      pool?.hideAll()
      return
    }
    pool.ensure(activeClip.id, activeClip.file)
    pool.showOnly(activeClip.id)
    activeClipIdRef.current = activeClip.id
    pool.applyFilter(activeClip.id, buildCSSFilter(activeSeg?.effects ?? []) || '')
    pool.applyTransform(activeClip.id, activeSeg?.rotation ?? 0)
    // Seek to the exact paused frame so the display is never left mid-transition.
    const video = pool.get(activeClip.id)
    if (video && activeSeg) {
      video.currentTime = activeSeg.inPoint + (playheadPosition - activeSeg.startOnTimeline) * (activeSeg.speed ?? 1)
    }
  }, [activeClip?.id, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load image blob URL for image clips
  useEffect(() => {
    if (!activeClip?.file || activeClip.type !== 'image') { setImgUrl(null); return }
    const url = URL.createObjectURL(activeClip.file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [activeClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load audio object URL when audio clip changes (paused state only)
  useEffect(() => {
    if (isPlaying) return
    const audio = audioRef.current
    if (!activeAudioClip?.file) { audio.removeAttribute('src'); audio.load(); return }
    const url = getClipUrl(activeAudioClip.id, activeAudioClip.file)
    audioUrlRef.current = url
    audio.src = url
    return () => {
      const aud = audioRef.current
      if (aud) { aud.removeAttribute('src'); aud.load() }
      if (audioUrlRef.current === url) audioUrlRef.current = null
    }
  }, [activeAudioClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek video when playhead moves while paused
  useEffect(() => {
    const pool = poolRef.current
    const seg = activeSegRef.current
    if (isPlaying || !pool || !seg) return
    const video = pool.get(activeClipIdRef.current)
    if (!video) return
    video.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline) * (seg.speed ?? 1)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek audio when playhead moves while paused
  useEffect(() => {
    const audio = audioRef.current
    const seg = activeAudioSegRef.current
    if (isPlaying || !seg) return
    audio.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume, playbackRate, muted when active segment changes (paused)
  useEffect(() => {
    const pool = poolRef.current
    if (!pool || !activeSeg) return
    const video = pool.get(activeClipIdRef.current)
    if (!video) return
    video.volume = Math.min(1, (activeSeg.volume ?? 1) * masterVolume)
    video.playbackRate = activeSeg.speed ?? 1
    video.muted = activeSeg.muted ?? false
  }, [activeSeg?.id, activeSeg?.volume, activeSeg?.speed, activeSeg?.muted, masterVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume to audio element
  useEffect(() => {
    if (!activeAudioSeg) return
    audioRef.current.volume = Math.min(1, (activeAudioSeg.volume ?? 1) * masterVolume)
  }, [activeAudioSeg?.id, activeAudioSeg?.volume, masterVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply CSS filter and rotation when effects/rotation change (paused)
  useEffect(() => {
    const pool = poolRef.current
    if (!pool || !activeSeg || isPlaying) return
    pool.clearAllFilters()
    const clipId = activeClipIdRef.current
    if (clipId) {
      pool.applyFilter(clipId, buildCSSFilter(activeSeg.effects ?? []) || '')
      pool.applyTransform(clipId, activeSeg.rotation ?? 0)
    }
  }, [activeSeg?.effects, activeSeg?.rotation]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAF playback loop
  useEffect(() => {
    const pool = poolRef.current

    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current)
      pool?.pauseAll()
      audioRef.current.pause()
      return
    }

    if (!pool) { setIsPlaying(false); return }

    playAbortRef.current = { cancelled: false }
    stallCountRef.current = 0
    let audioOnlyCleanup = () => {}

    const lr = loopRegionRef.current
    if (lr && (playheadPosition < lr.start || playheadPosition >= lr.end)) {
      setPlayheadPosition(lr.start)
    }

    const vIdx = new Set(tracksRef.current.filter((t) => t.type === 'video' && !t.hidden).map((t) => t.trackIndex))
    const aIdx = new Set(tracksRef.current.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex))

    let startSeg = activeSeg
    let gapInitialTarget: Segment | null = null

    if (startSeg?.hidden) {
      const nextVisible = segmentsRef.current
        .filter((s) => vIdx.has(s.trackIndex) && !s.hidden && s.startOnTimeline >= startSeg!.startOnTimeline)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null
      if (!nextVisible) { setIsPlaying(false); return }
      startSeg = nextVisible
    }

    if (!startSeg) {
      const nextVideoSeg = [...segmentsRef.current]
        .filter((s) => vIdx.has(s.trackIndex) && !s.hidden && s.startOnTimeline >= playheadPosition - 0.001)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null

      if (!nextVideoSeg) {
        const firstAudioSeg = [...segmentsRef.current]
          .filter((s) => aIdx.has(s.trackIndex))
          .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null

        if (!firstAudioSeg) { setIsPlaying(false); return }

        const audioClip = clipsRef.current.find((c) => c.id === firstAudioSeg.clipId)
        if (!audioClip?.file) { setIsPlaying(false); return }
        const audioUrl = getClipUrl(audioClip.id, audioClip.file)
        audioUrlRef.current = audioUrl
        const audio = audioRef.current
        audio.src = audioUrl
        audio.currentTime = firstAudioSeg.inPoint
        audio.volume = Math.min(1, (firstAudioSeg.volume ?? 1) * masterVolumeRef.current)
        setPlayheadPosition(firstAudioSeg.startOnTimeline)
        activeSegRef.current = null

        cancelPlayRef.current = playWhenReady(audio, () => setIsPlaying(false), playAbortRef.current)
        audioOnlyCleanup = startAudioOnlyTick({
          audioRef, rafRef, cancelPlayRef, playAbortRef,
          segmentsRef, clipsRef, tracksRef, audioUrlRef, masterVolumeRef,
          initialSeg: firstAudioSeg, setPlayheadPosition, setIsPlaying,
        })
      } else if (nextVideoSeg.startOnTimeline <= playheadPosition + 0.001) {
        const clip = clipsRef.current.find((c) => c.id === nextVideoSeg.clipId)
        if (clip?.type !== 'image') {
          if (!clip?.file) { setIsPlaying(false); return }
          const video = pool.ensure(clip.id, clip.file)
          pool.showOnly(clip.id)
          activeClipIdRef.current = clip.id
          video.currentTime = nextVideoSeg.inPoint
          video.volume = Math.min(1, (nextVideoSeg.volume ?? 1) * masterVolumeRef.current)
          video.playbackRate = nextVideoSeg.speed ?? 1
          video.muted = nextVideoSeg.muted ?? false
        }
        activeSegRef.current = nextVideoSeg
        setPlayheadPosition(nextVideoSeg.startOnTimeline)
        startSeg = nextVideoSeg
      } else {
        pool.hideAll()
        activeSegRef.current = null
        gapInitialTarget = nextVideoSeg
      }
    }

    const tickParams = {
      pool, activeClipIdRef,
      audioRef, segmentsRef, clipsRef, tracksRef, activeSegRef,
      stallCountRef, rafRef, cancelPlayRef, playAbortRef,
      masterVolumeRef, transitionsRef, loopRegionRef,
      setPlayheadPosition, setIsPlaying,
    }

    if (startSeg) {
      const startClip = clipsRef.current.find((c) => c.id === startSeg!.clipId)
      if (startClip?.type !== 'image' && startClip?.file) {
        const video = pool.ensure(startClip.id, startClip.file)
        pool.showOnly(startClip.id)
        activeClipIdRef.current = startClip.id
        pool.applyFilter(startClip.id, buildCSSFilter(startSeg!.effects ?? []) || '')
        pool.applyTransform(startClip.id, startSeg!.rotation ?? 0)
        const targetTime = startSeg!.inPoint + (playheadPosition - startSeg!.startOnTimeline) * Math.max(0.01, startSeg!.speed ?? 1)
        if (Math.abs(video.currentTime - targetTime) > 0.05) video.currentTime = targetTime
        cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
      }
      if (activeAudioSegRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {})
      }
      startVideoTick(tickParams)
    } else if (gapInitialTarget) {
      if (activeAudioSegRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {})
      }
      startVideoTick({ ...tickParams, initialGapTarget: gapInitialTarget, initialPlayheadPosition: playheadPosition })
    }

    return () => {
      playAbortRef.current.cancelled = true
      cancelPlayRef.current()
      audioOnlyCleanup()
      cancelAnimationFrame(rafRef.current)
      pool.pauseAll()
      pool.resetStyles()
      audioRef.current.pause()
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFullscreen = () => {
    const el = previewContainerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const hasSegments = segments.length > 0

  return (
    <div className="flex flex-1 items-center justify-center min-h-0" style={{ background: '#05050C', padding: 20 }}>
      <div
        ref={previewContainerRef}
        data-preview-container
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: '16/9',
          width: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          background: '#000',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div
          ref={poolContainerRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        {isImageClip && imgUrl && (
          <img
            src={imgUrl}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: projectSettings.stretchToFormat ? 'fill' : 'contain',
              filter: buildCSSFilter(activeSeg?.effects ?? []) || undefined,
            }}
            alt=""
          />
        )}
        {activeSeg?.effects && hasVignette(activeSeg.effects) && (
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity(activeSeg.effects)}) 100%)`,
            }}
          />
        )}
        {fadeOverlayOpacity > 0 && (
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: '#000',
              opacity: fadeOverlayOpacity,
            }}
          />
        )}
        <TextOverlayRenderer />
        {!hasSegments && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#12122A,#0A0A1A,#12122A)' }}
          >
            <div className="text-center">
              <Film size={40} style={{ margin: '0 auto 12px', opacity: 0.15 }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Drag a clip to the timeline to begin</p>
            </div>
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          title="Fullscreen preview (P)"
          style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
            padding: '3px 5px', display: 'flex', alignItems: 'center',
            backdropFilter: 'blur(4px)', zIndex: 10,
          }}
        >
          <Maximize2 size={11} />
        </button>
        <div
          className="absolute text-xs font-mono"
          style={{ bottom: 10, right: 36, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}
        >
          {formatTime(playheadPosition)}
        </div>
      </div>
    </div>
  )
}
