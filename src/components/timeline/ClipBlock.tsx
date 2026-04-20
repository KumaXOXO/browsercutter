// src/components/timeline/ClipBlock.tsx
import { useEffect, useRef, useState } from 'react'
import { X, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react'
import type { Segment, Clip } from '../../types'
import { useAppStore } from '../../store/useAppStore'

const CLIP_GRADIENTS = [
  'linear-gradient(135deg,#5B21B6,#7C3AED)',
  'linear-gradient(135deg,#0C5F78,#0891B2)',
  'linear-gradient(135deg,#065F46,#059669)',
]

const AUDIO_GRADIENT = 'linear-gradient(135deg,#1A4A2A,#2E7040)'

const PX_PER_SEC = 20

interface Props {
  segment: Segment
  clip: Clip
  zoom: number
}

export default function ClipBlock({ segment, clip, zoom }: Props) {
  const { selectedElement, setSelectedElement, removeSegment, updateSegment } = useAppStore()
  const isSelected = selectedElement?.id === segment.id
  const px = PX_PER_SEC * zoom
  const left  = segment.startOnTimeline * px
  const width = (segment.outPoint - segment.inPoint) * px
  const showButtons = width >= 60

  const [hovered, setHovered] = useState(false)

  const bgIndex = clip.id.charCodeAt(0) % CLIP_GRADIENTS.length
  const bg = clip.type === 'audio' ? AUDIO_GRADIENT : CLIP_GRADIENTS[bgIndex]
  const label = clip.name.replace(/\.[^.]+$/, '').slice(0, 4).toUpperCase()

  const segRef = useRef(segment)
  segRef.current = segment

  // Delete / H / M keyboard shortcuts when selected
  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (selectedElement?.type !== 'segment') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedElement(null)
        removeSegment(segment.id)
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        updateSegment(segment.id, { hidden: !segRef.current.hidden })
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        updateSegment(segment.id, { muted: !segRef.current.muted })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, segment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move drag: mousedown on body
  const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement({ type: 'segment', id: segment.id })

    const trackContent = (e.currentTarget as HTMLElement).parentElement!
    const trackRect = trackContent.getBoundingClientRect()
    const offsetX = e.clientX - trackRect.left - left

    const handleMouseMove = (ev: MouseEvent) => {
      const newStart = Math.max(0, (ev.clientX - trackRect.left - offsetX) / px)
      updateSegment(segment.id, { startOnTimeline: newStart })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Left trim: changes inPoint + startOnTimeline together (right edge stays fixed)
  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const initialInPoint = segRef.current.inPoint
    const initialStart = segRef.current.startOnTimeline

    const handleMouseMove = (ev: MouseEvent) => {
      const dSec = (ev.clientX - startX) / px
      const newInPoint = Math.max(0, Math.min(segRef.current.outPoint - 0.1, initialInPoint + dSec))
      const delta = newInPoint - initialInPoint
      const newStart = Math.max(0, initialStart + delta)
      updateSegment(segment.id, { inPoint: newInPoint, startOnTimeline: newStart })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Right trim: changes outPoint only (left edge stays fixed)
  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const initialOutPoint = segRef.current.outPoint

    const handleMouseMove = (ev: MouseEvent) => {
      const dSec = (ev.clientX - startX) / px
      const newOutPoint = Math.max(segRef.current.inPoint + 0.1, Math.min(clip.duration, initialOutPoint + dSec))
      updateSegment(segment.id, { outPoint: newOutPoint })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleBodyMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: bg,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: isSelected ? '2px solid rgba(255,255,255,0.9)' : 'none',
        outlineOffset: 1,
        opacity: segment.hidden ? 0.4 : 1,
        filter: hovered && !isSelected ? 'brightness(1.2)' : undefined,
        transition: 'filter 120ms, opacity 120ms',
      }}
    >
      {/* Left trim handle */}
      <div
        onMouseDown={handleLeftTrimMouseDown}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', zIndex: 2,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '5px 0 0 5px',
        }}
      />

      <span style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        padding: '0 12px', whiteSpace: 'nowrap', letterSpacing: 0.3,
        pointerEvents: 'none', zIndex: 1,
      }}>
        {label}
      </span>

      {/* Mute badge — always visible when muted */}
      {segment.muted && (
        <span style={{
          position: 'absolute', top: 3, left: 12,
          fontSize: 9, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 3,
        }}>
          M
        </span>
      )}

      {/* Hover toolbar — bottom strip */}
      {hovered && (
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 2,
            padding: '2px 4px',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            title="Remove (Delete)"
            onClick={(e) => { e.stopPropagation(); setSelectedElement(null); removeSegment(segment.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,100,100,0.9)', lineHeight: 1 }}
          >
            <X size={10} />
          </button>
          {showButtons && (
            <>
              <button
                title={segment.hidden ? 'Show (H)' : 'Hide (H)'}
                onClick={(e) => { e.stopPropagation(); updateSegment(segment.id, { hidden: !segment.hidden }) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.75)', lineHeight: 1 }}
              >
                {segment.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
              <button
                title={segment.muted ? 'Unmute (M)' : 'Mute (M)'}
                onClick={(e) => { e.stopPropagation(); updateSegment(segment.id, { muted: !segment.muted }) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.75)', lineHeight: 1 }}
              >
                {segment.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Right trim handle */}
      <div
        onMouseDown={handleRightTrimMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', zIndex: 2,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '0 5px 5px 0',
        }}
      />
    </div>
  )
}

export { PX_PER_SEC }
