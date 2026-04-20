// src/components/panels/MediaPanel/MusicList.tsx
import { useState } from 'react'
import { Music, Plus } from 'lucide-react'
import type { Clip } from '../../../types'
import { useAppStore } from '../../../store/useAppStore'

export default function MusicList({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return <p className="text-xs text-center" style={{ color: 'var(--muted-subtle)' }}>No audio files yet.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {clips.map((clip) => <MusicRow key={clip.id} clip={clip} />)}
    </div>
  )
}

function MusicRow({ clip }: { clip: Clip }) {
  const [hovered, setHovered] = useState(false)
  const { segments, addSegment } = useAppStore()

  const handleAddToTimeline = () => {
    const endOfTrack = segments
      .filter((s) => s.trackIndex === 2)
      .reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)
    addSegment({
      id: crypto.randomUUID(),
      clipId: clip.id,
      trackIndex: 2,
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
      className="flex items-center gap-2.5 rounded-lg cursor-grab transition-all duration-150"
      style={{
        padding: '8px 10px',
        border: `1px solid ${hovered ? 'var(--border-subtle)' : 'transparent'}`,
        background: hovered ? 'var(--surface2)' : 'transparent',
        position: 'relative',
      }}
    >
      <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 32, height: 32, background: 'rgba(225,29,72,0.15)' }}>
        <Music size={14} color="#F43F5E" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{clip.name}</p>
        <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
          {Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2,'0')}
          {clip.bpm ? ` · ${clip.bpm} BPM` : ''}
        </p>
      </div>
      {hovered && (
        <button
          title="Add to timeline"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleAddToTimeline() }}
          style={{
            background: 'rgba(225,29,72,0.9)', border: 'none', borderRadius: 4,
            cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 2,
            color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0,
          }}
        >
          <Plus size={9} /> Add
        </button>
      )}
    </div>
  )
}
