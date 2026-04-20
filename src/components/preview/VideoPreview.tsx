// src/components/preview/VideoPreview.tsx
import { useRef, useEffect, useMemo } from 'react'
import { Film } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { formatTime } from '../../lib/utils'
import TextOverlayRenderer from './TextOverlayRenderer'
import { buildCSSFilter, hasVignette, vignetteOpacity } from '../../lib/video/effectsFilter'
import { playWhenReady, startVideoTick, startAudioOnlyTick } from '../../lib/video/playbackEngine'
import type { Segment } from '../../types'

export default function VideoPreview() {
  const { segments, clips, playheadPosition, isPlaying, setPlayheadPosition, setIsPlaying } = useAppStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const stallCountRef = useRef(0)
  const activeSegRef = useRef<Segment | null>(null)
  const segmentsRef = useRef(segments)
  const clipsRef = useRef(clips)

  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const audioUrlRef = useRef<string | null>(null)
  const activeAudioSegRef = useRef<Segment | null>(null)

  const playAbortRef = useRef({ cancelled: false })
  const cancelPlayRef = useRef<() => void>(() => {})

  segmentsRef.current = segments
  clipsRef.current = clips

  const activeSeg = useMemo(() =>
    segments.find(
      (s) => s.trackIndex === 0 && !s.hidden &&
        playheadPosition >= s.startOnTimeline &&
        playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
    ) ?? null,
    [segments, playheadPosition],
  )
  const activeClip = activeSeg ? clips.find((c) => c.id === activeSeg.clipId) ?? null : null
  activeSegRef.current = activeSeg

  const activeAudioSeg = useMemo(() =>
    segments.find(
      (s) => s.trackIndex === 2 && !s.muted &&
        playheadPosition >= s.startOnTimeline &&
        playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
    ) ?? null,
    [segments, playheadPosition],
  )
  const activeAudioClip = activeAudioSeg ? clips.find((c) => c.id === activeAudioSeg.clipId) ?? null : null
  activeAudioSegRef.current = activeAudioSeg

  // Load video object URL when clip changes (only when not playing)
  useEffect(() => {
    if (isPlaying) return
    const video = videoRef.current
    if (!video) return
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    if (!activeClip?.file) { video.src = ''; return }
    const url = URL.createObjectURL(activeClip.file)
    objectUrlRef.current = url
    video.src = url
    return () => { if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null } }
  }, [activeClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load audio object URL when audio clip changes (only when not playing)
  useEffect(() => {
    if (isPlaying) return
    const audio = audioRef.current
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
    if (!activeAudioClip?.file) { audio.src = ''; return }
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
    video.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek audio when playhead moves while paused
  useEffect(() => {
    const audio = audioRef.current
    const seg = activeAudioSegRef.current
    if (isPlaying || !seg) return
    audio.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume and playbackRate to video when active segment changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeSeg) return
    video.volume = activeSeg.volume ?? 1
    video.playbackRate = activeSeg.speed ?? 1
  }, [activeSeg?.id, activeSeg?.volume, activeSeg?.speed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply volume to audio element when active audio segment changes
  useEffect(() => {
    if (!activeAudioSeg) return
    audioRef.current.volume = activeAudioSeg.volume ?? 1
  }, [activeAudioSeg?.id, activeAudioSeg?.volume]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Resolve the starting video segment (skip hidden segments)
    let startSeg = activeSeg
    if (startSeg?.hidden) {
      const nextVisible = segmentsRef.current
        .filter((s) => s.trackIndex === 0 && !s.hidden && s.startOnTimeline >= startSeg!.startOnTimeline)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null
      if (!nextVisible) { setIsPlaying(false); return }
      startSeg = nextVisible
    }

    if (!startSeg) {
      // No video segment at playhead — find first visible video segment on timeline
      const firstVideoSeg = [...segmentsRef.current]
        .filter((s) => s.trackIndex === 0 && !s.hidden)
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0] ?? null

      if (!firstVideoSeg) {
        // No video at all — try audio-only path
        const firstAudioSeg = [...segmentsRef.current]
          .filter((s) => s.trackIndex === 2)
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
        audio.volume = firstAudioSeg.volume ?? 1
        setPlayheadPosition(firstAudioSeg.startOnTimeline)
        activeSegRef.current = null

        cancelPlayRef.current = playWhenReady(audio, () => setIsPlaying(false), playAbortRef.current)
        // Mutually exclusive: audio-only RAF runs here, video RAF below does not
        audioOnlyCleanup = startAudioOnlyTick({
          audioRef,
          rafRef,
          startOnTimeline: firstAudioSeg.startOnTimeline,
          inPoint: firstAudioSeg.inPoint,
          setPlayheadPosition,
          setIsPlaying,
        })
      } else {
        if (!video) { setIsPlaying(false); return }
        const clip = clipsRef.current.find((c) => c.id === firstVideoSeg.clipId)
        if (!clip?.file) { setIsPlaying(false); return }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        const url = URL.createObjectURL(clip.file)
        objectUrlRef.current = url
        video.src = url
        video.currentTime = firstVideoSeg.inPoint
        video.volume = firstVideoSeg.volume ?? 1
        video.playbackRate = firstVideoSeg.speed ?? 1
        activeSegRef.current = firstVideoSeg
        setPlayheadPosition(firstVideoSeg.startOnTimeline)
        startSeg = firstVideoSeg
      }
    }

    if (startSeg) {
      // Video path — mutually exclusive with audio-only path above
      if (!video) { setIsPlaying(false); return }
      cancelPlayRef.current = playWhenReady(video, () => setIsPlaying(false), playAbortRef.current)
      if (activeAudioSegRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {})
      }
      startVideoTick({
        videoRef,
        audioRef,
        segmentsRef,
        clipsRef,
        activeSegRef,
        objectUrlRef,
        stallCountRef,
        rafRef,
        cancelPlayRef,
        playAbortRef,
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
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000',
            filter: buildCSSFilter(activeSeg?.effects ?? []) || undefined,
          }}
        />
        {activeSeg?.effects && hasVignette(activeSeg.effects) && (
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity(activeSeg.effects)}) 100%)`,
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
