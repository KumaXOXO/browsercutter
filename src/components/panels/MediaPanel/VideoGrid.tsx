// src/components/panels/MediaPanel/VideoGrid.tsx
import { useState } from 'react'
import { Play, Plus } from 'lucide-react'
import type { Clip } from '../../../types'
import { useAppStore } from '../../../store/useAppStore'

export default function VideoGrid({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return <p className="text-xs text-center" style={{ color: 'var(--muted-subtle)' }}>No videos yet. Upload some above.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {clips.map((clip) => <VideoThumb key={clip.id} clip={clip} />)}
    </div>
  )
}

function VideoThumb({ clip }: { clip: Clip }) {
  const [hovered, setHovered] = useState(false)
  const { segments, addSegment } = useAppStore()

  const handleAddToTimeline = () => {
    const trackIndex = clip.type === 'audio' ? 2 : 0
    const endOfTrack = segments
      .filter((s) => s.trackIndex === trackIndex)
      .reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)
    addSegment({
      id: crypto.randomUUID(),
      clipId: clip.id,
      trackIndex,
      startOnTimeline: endOfTrack,
      inPoint: 0,
      outPoint: clip.duration,
    })
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('clipId', clip.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-lg overflow-hidden cursor-grab transition-all duration-200"
      style={{
        background: 'var(--surface2)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)'}`,
        transform: hovered ? 'translateY(-1px)' : '',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.4)' : '',
        position: 'relative',
      }}
    >
      <div className="relative flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'rgba(124,58,237,0.15)' }}>
        {clip.thumbnail
          ? <img src={clip.thumbnail} alt={clip.name} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.5)' }}>
              <Play size={12} fill="white" color="white" />
            </div>
        }
        <span className="absolute bottom-1 right-1 text-white text-xs font-mono" style={{ background: 'rgba(0,0,0,0.65)', padding: '1px 5px', borderRadius: 3 }}>
          {formatDuration(clip.duration)}
        </span>
        {hovered && (
          <button
            title="Add to timeline"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleAddToTimeline() }}
            style={{
              position: 'absolute', bottom: 4, right: 4,
              background: 'rgba(225,29,72,0.9)', border: 'none', borderRadius: 4,
              cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center', gap: 2,
              color: 'white', fontSize: 9, fontWeight: 700, zIndex: 2,
            }}
          >
            <Plus size={9} /> Add
          </button>
        )}
      </div>
      <div style={{ padding: '6px 8px' }}>
        <p className="text-xs font-medium truncate">{clip.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-subtle)' }}>{clip.width}×{clip.height}</p>
      </div>
    </div>
  )
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
