// src/components/preview/VideoPreview.tsx
import { useRef, useEffect, useMemo, useState } from 'react'
import { Film } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { formatTime } from '../../lib/utils'
import TextOverlayRenderer from './TextOverlayRenderer'
import { buildCSSFilter, hasVignette, vignetteOpacity } from '../../lib/video/effectsFilter'
import { playWhenReady, startVideoTick, startAudioOnlyTick } from '../../lib/video/playbackEngine'
import type { Segment } from '../../types'

export default function VideoPreview() {
  const {
    segments, clips, tracks, playheadPosition, isPlaying,
    setPlayheadPosition, setIsPlaying,
    masterVolume, transitions, loopRegion,
  } = useAppStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const objectUrlRef = useRef<string | null>(null)
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

  const transitionVideoRef = useRef<HTMLVideoElement>(null)
  const transitionUrlRef = useRef<string | null>(null)

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

  const videoTrackIdx = useMemo(
    () => new Set(tracks.filter((t) => t.type === 'video' && !t.hidden).map((t) => t.trackIndex)),
    [tracks],
  )
  const audioTrackIdx = useMemo(
    () => new Set(tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex)),
    [tracks],
  )

  const activeSeg = useMemo(() => segments.find(
    (s) => videoTrackIdx.has(s.trackIndex) && !s.hidden &&
      playheadPosition >= s.startOnTimeline &&
      playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1),
  ) ?? null, [segments, playheadPosition, videoTrackIdx])
  const activeClip = activeSeg ? clips.find((c) => c.id === activeSeg.clipId) ?? null : null
  activeSegRef.current = activeSeg

  const activeAudioSeg = useMemo(() => segments.find(
    (s) => audioTrackIdx.has(s.trackIndex) && !s.muted &&
      playheadPosition >= s.startOnTimeline &&
      playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
  ) ?? null, [segments, playheadPosition, audioTrackIdx])
  const activeAudioClip = activeAudioSeg ? clips.find((c) => c.id === activeAudioSeg.clipId) ?? null : null
  activeAudioSegRef.current = activeAudioSeg

  const isImageClip = activeClip?.type === 'image'

  // Compute fade overlay opacity — checks transitions around current playhead
  const fadeOverlayOpacity = useMemo(() => {
    if (!activeSeg) return 0
    const segDuration = (activeSeg.outPoint - activeSeg.inPoint) / Math.max(0.01, activeSeg.speed ?? 1)
    const segEnd = activeSeg.startOnTimeline + segDuration
    const posInSeg = playheadPosition - activeSeg.startOnTimeline

    // Check transition after this segment (fade out at end)
    const transAfter = transitions.find((t) => t.afterSegmentId === activeSeg.id && t.type === 'fade')
    if (transAfter && transAfter.duration > 0) {
      const fadeStart = segEnd - transAfter.duration
      if (playheadPosition >= fadeStart) {
        return Math.min(1, (playheadPosition - fadeStart) / transAfter.duration)
      }
    }

    // Check transition before this segment (fade in at start)
    const transBefore = transitions.find((t) => t.beforeSegmentId === activeSeg.id && t.type === 'fade')
    if (transBefore && transBefore.duration > 0 && posInSeg < transBefore.duration) {
      return Math.max(0, 1 - posInSeg / transBefore.duration)
    }

    return 0
  }, [activeSeg, playheadPosition, transitions])

  // Load video object URL when clip changes (only when not playing, skip image clips)
  useEffect(() => {
    if (isPlaying) return
    const video = videoRef.current
    if (!video) return
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    if (!activeClip?.file || activeClip.type === 'image') { video.removeAttribute('src'); video.load(); return }
    const url = URL.createObjectURL(activeClip.file)
    objectUrlRef.current = url
    video.src = url
    return () => { if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null } }
  }, [activeClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load image blob URL for image clips — must be state (not ref) to trigger re-render
  useEffect(() => {
    if (!activeClip?.file || activeClip.type !== 'image') { setImgUrl(null); return }
    const url = URL.createObjectURL(activeClip.file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [activeClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load audio object URL when audio clip changes (only when not playing)
  useEffect(() => {
    if (isPlaying) return
    const audio = audioRef.current
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
    if (!activeAudioClip?.file) { audio.removeAttribute('src'); audio.load(); return }
    const url = URL.createObjectURL(activeAudioClip.file)
    audioUrlRef.current = url
    audio.src = url
    return () => { if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null } }
  }, [activeAudioClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek video when playhead moves while paused
  useEffect(() => {
    const video = videoRef.current
    const seg = activeSegRef.current
    if (isPlaying || !video || !seg) return
    video.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline) * (seg.speed ?? 1)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek audio when playhead moves while paused
  useEffect(() => {
    const audio = audioRef.current
    const seg = activeAudioSegRef.current
    if (isPlaying || !seg) return
    audio.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume (with masterVolume), playbackRate, and muted to video when active segment changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeSeg) return
    video.volume = Math.min(1, (activeSeg.volume ?? 1) * masterVolume)
    video.playbackRate = activeSeg.speed ?? 1
    video.muted = activeSeg.muted ?? false
  }, [activeSeg?.id, activeSeg?.volume, activeSeg?.speed, activeSeg?.muted, masterVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume (with masterVolume) to audio element when active audio segment changes
  useEffect(() => {
    if (!activeAudioSeg) return
    audioRef.current.volume = Math.min(1, (activeAudioSeg.volume ?? 1) * masterVolume)
  }, [activeAudioSeg?.id, activeAudioSeg?.volume, masterVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAF playback loop
  useEffect(() => {
    const video = videoRef.current

    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current)
      video?.pause()
      audioRef.current.pause()
      return
    }

    playAbortRef.current = { cancelled: false }
    let audioOnlyCleanup = () => {}

    // If loop region active and playhead is outside it, jump to loop start
    const lr = loopRegionRef.current
    if (lr && (playheadPosition < lr.start || playheadPosition >= lr.end)) {
      setPlayheadPosition(lr.start)
    }

    // Resolve the starting video segment (skip hidden segments)
    const vIdx = new Set(tracksRef.current.filter((t) => t.type === 'video' && !t.hidden).map((t) => t.trackIndex))
    const aIdx = new Set(tracksRef.current.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.trackIndex))

    let startSeg = activeSeg
    if (startSeg?.hidden) {
      const nextVisible = segmentsRef.current
        .filter((s) => vIdx.has(s.trackIndex) && !s.hidden && s.startOnTimeline >= startSeg!.startOnTimeline)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null
      if (!nextVisible) { setIsPlaying(false); return }
      startSeg = nextVisible
    }

    if (!startSeg) {
      // No video segment at playhead — find first visible video segment on timeline
      const firstVideoSeg = [...segmentsRef.current]
        .filter((s) => vIdx.has(s.trackIndex) && !s.hidden)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null

      if (!firstVideoSeg) {
        // No video at all — try audio-only path
        const firstAudioSeg = [...segmentsRef.current]
          .filter((s) => aIdx.has(s.trackIndex))
          .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null

        if (!firstAudioSeg) {
          setIsPlaying(false)
          return
        }

        const audioClip = clipsRef.current.find((c) => c.id === firstAudioSeg.clipId)
        if (!audioClip?.file) { setIsPlaying(false); return }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        const audioUrl = URL.createObjectURL(audioClip.file)
        audioUrlRef.current = audioUrl
        const audio = audioRef.current
        audio.src = audioUrl
        audio.currentTime = firstAudioSeg.inPoint
        audio.volume = Math.min(1, (firstAudioSeg.volume ?? 1) * masterVolumeRef.current)
        setPlayheadPosition(firstAudioSeg.startOnTimeline)
        activeSegRef.current = null

        cancelPlayRef.current = playWhenReady(audio, () => setIsPlaying(false), playAbortRef.current)
        audioOnlyCleanup = startAudioOnlyTick({
          audioRef,
          rafRef,
          cancelPlayRef,
          playAbortRef,
          segmentsRef,
          clipsRef,
          tracksRef,
          audioUrlRef,
          masterVolumeRef,
          initialSeg: firstAudioSeg,
          setPlayheadPosition,
          setIsPlaying,
        })
      } else {
        // Image clips don't use the video element for playback — skip play setup
        const clip = clipsRef.current.find((c) => c.id === firstVideoSeg.clipId)
        if (clip?.type !== 'image') {
          if (!video) { setIsPlaying(false); return }
          if (!clip?.file) { setIsPlaying(false); return }
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          const url = URL.createObjectURL(clip.file)
          objectUrlRef.current = url
          video.src = url
          video.currentTime = firstVideoSeg.inPoint
          video.volume = Math.min(1, (firstVideoSeg.volume ?? 1) * masterVolumeRef.current)
          video.playbackRate = firstVideoSeg.speed ?? 1
          video.muted = firstVideoSeg.muted ?? false
        }
        activeSegRef.current = firstVideoSeg
        setPlayheadPosition(firstVideoSeg.startOnTimeline)
        startSeg = firstVideoSeg
      }
    }

    if (startSeg) {
      if (!video) { setIsPlaying(false); return }
      const startClip = clipsRef.current.find((c) => c.id === startSeg!.clipId)
      // Only play via video element for non-image clips
      if (startClip?.type !== 'image') {
        cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
      }
      if (activeAudioSegRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {})
      }
      startVideoTick({
        videoRef,
        audioRef,
        segmentsRef,
        clipsRef,
        tracksRef,
        activeSegRef,
        objectUrlRef,
        stallCountRef,
        rafRef,
        cancelPlayRef,
        playAbortRef,
        masterVolumeRef,
        transitionVideoRef,
        transitionUrlRef,
        transitionsRef,
        loopRegionRef,
        setPlayheadPosition,
        setIsPlaying,
      })
    }

    return () => {
      playAbortRef.current.cancelled = true
      cancelPlayRef.current()
      audioOnlyCleanup()
      cancelAnimationFrame(rafRef.current)
      videoRef.current?.pause()
      audioRef.current.pause()
      // Clean up transition B on stop
      if (transitionUrlRef.current) { URL.revokeObjectURL(transitionUrlRef.current); transitionUrlRef.current = null }
      if (transitionVideoRef.current) {
        transitionVideoRef.current.pause()
        transitionVideoRef.current.src = ''
        transitionVideoRef.current.style.display = 'none'
        transitionVideoRef.current.style.opacity = '0'
        transitionVideoRef.current.style.transform = ''
        transitionVideoRef.current.style.clipPath = ''
      }
      if (videoRef.current) { videoRef.current.style.opacity = '1'; videoRef.current.style.transform = ''; videoRef.current.style.clipPath = '' }
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSegments = segments.length > 0

  return (
    <div className="flex flex-1 items-center justify-center min-h-0" style={{ background: '#05050C', padding: 20 }}>
      <div
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: '16/9',
          maxHeight: '100%',
          maxWidth: '100%',
          background: '#000',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000',
            filter: buildCSSFilter(activeSeg?.effects ?? []) || undefined,
            display: isImageClip ? 'none' : undefined,
          }}
        />
        {/* Transition overlay — second video element for dissolve/wipe/slide/zoom */}
        <video
          ref={transitionVideoRef}
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'none', opacity: 0 }}
        />
        {/* Image clip display */}
        {isImageClip && imgUrl && (
          <img
            src={imgUrl}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
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
        {/* Fade transition overlay */}
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
        <div
          className="absolute text-xs font-mono"
          style={{ bottom: 10, right: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}
        >
          {formatTime(playheadPosition)}
        </div>
      </div>
    </div>
  )
}
