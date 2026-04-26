// src/components/timeline/Track.tsx
import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import ClipBlock, { PX_PER_SEC } from './ClipBlock'

interface Props {
  trackIndex: number
  trackType: 'video' | 'audio'
  label: string
  icon: React.ReactNode
  height: number
  zoom: number
  trackLabelWidth: number
}

export default function Track({ trackIndex, trackType, label, icon, height, zoom, trackLabelWidth }: Props) {
  const { segments, clips, addSegment, timelineMode, setPlayheadPosition, setSelectedElement, setSelectedSegmentIds, playheadPosition } = useAppStore()
  const [dragTarget, setDragTarget] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ trackIndex: number | null; clipType: string } | null>).detail
      if (!detail || detail.trackIndex === null) {
        setDragTarget(false)
        return
      }
      if (detail.trackIndex !== trackIndex) { setDragTarget(false); return }
      const compatible =
        ((detail.clipType === 'video' || detail.clipType === 'image') && trackType === 'video') ||
        (detail.clipType === 'audio' && trackType === 'audio')
      setDragTarget(compatible)
    }
    document.addEventListener('bc:drag-track', handler)
    return () => document.removeEventListener('bc:drag-track', handler)
  }, [trackIndex, trackType])
  const trackSegments = segments.filter((s) => s.trackIndex === trackIndex)

  const totalWidth = Math.max(
    4000,
    (playheadPosition + 120) * PX_PER_SEC * zoom,
    trackSegments.reduce((max, s) =>
      Math.max(max, (s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1)) * PX_PER_SEC * zoom),
      0,
    ) + 600,
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const clipId = e.dataTransfer.getData('clipId')
    if (!clipId) return
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return

    // Enforce track type: video/image clips go on video tracks, audio clips on audio tracks
    if ((clip.type === 'video' || clip.type === 'image') && trackType !== 'video') return
    if (clip.type === 'audio' && trackType !== 'audio') return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const startOnTimeline = Math.max(0, x / (PX_PER_SEC * zoom))

    addSegment({
      id: crypto.randomUUID(),
      clipId,
      trackIndex,
      startOnTimeline,
      inPoint: 0,
      outPoint: clip.duration,
    })
  }

  return (
    <div
      className="flex items-center"
      style={{ height, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      {trackLabelWidth > 0 && (
        <div
          className="flex items-center gap-1 px-2 shrink-0"
          style={{ minWidth: trackLabelWidth, width: trackLabelWidth, fontSize: 10, color: 'var(--muted-subtle)' }}
        >
          {icon} {label}
        </div>
      )}
      <div
        className="relative h-full"
        style={{ width: totalWidth, background: dragTarget ? 'rgba(225,29,72,0.12)' : undefined, transition: 'background 80ms', cursor: timelineMode === 'playhead' ? 'grab' : undefined }}
        data-track-index={trackIndex}
        data-track-type={trackType}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={(e) => {
          // Deselect when clicking empty track area in selection mode.
          // ClipBlock calls e.stopPropagation() on its own mousedown, so this only
          // fires when the user clicks genuine empty space — no data-segment-id check needed.
          if (timelineMode === 'selection') {
            setSelectedElement(null)
            setSelectedSegmentIds([])
          }
          if (timelineMode === 'playhead') {
            const rect = e.currentTarget.getBoundingClientRect()
            setPlayheadPosition(Math.max(0, (e.clientX - rect.left) / (PX_PER_SEC * zoom)))
            // Drag to pan the timeline
            const scrollEl = e.currentTarget.closest('.overflow-auto') as HTMLElement | null
            if (!scrollEl) return
            const startX = e.clientX
            const startScroll = scrollEl.scrollLeft
            const onMove = (ev: MouseEvent) => {
              scrollEl.scrollLeft = Math.max(0, startScroll - (ev.clientX - startX))
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }
        }}
      >
        {trackSegments.map((seg) => {
          const clip = clips.find((c) => c.id === seg.clipId)
          return clip ? <ClipBlock key={seg.id} segment={seg} clip={clip} zoom={zoom} /> : null
        })}
      </div>
    </div>
  )
}
