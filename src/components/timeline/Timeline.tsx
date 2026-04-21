// src/components/timeline/Timeline.tsx
import { useState } from 'react'
import { Film, Volume2, Wand2, Type, ChevronUp, ChevronDown, Eye, EyeOff, VolumeX, Trash2 } from 'lucide-react'
import TimeRuler from './TimeRuler'
import Track from './Track'
import TextTrack from './TextTrack'
import AdjustmentTrack from './AdjustmentTrack'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'
import type { TimelineTrack } from '../../types'

const TRACK_LABEL_WIDTH = 78

interface Props {
  height?: number
  isDragging?: boolean
}

const TRACK_ICON: Record<TimelineTrack['type'], React.ReactNode> = {
  video: <Film size={9} />,
  audio: <Volume2 size={9} />,
  adjustment: <Wand2 size={9} />,
  subtitle: <Type size={9} />,
}

const ADD_OPTIONS: { type: TimelineTrack['type']; label: string }[] = [
  { type: 'video',      label: 'Video Track' },
  { type: 'audio',      label: 'Audio Track' },
  { type: 'adjustment', label: 'Adjustment Layer' },
  { type: 'subtitle',   label: 'Subtitle Track' },
]

export default function Timeline({ height = 205, isDragging = false }: Props) {
  const [zoom, setZoom] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const { playheadPosition, tracks, addTrack, updateTrack, removeTrack, moveTrack } = useAppStore()
  const playheadLeft = TRACK_LABEL_WIDTH + playheadPosition * PX_PER_SEC * zoom

  function handleAddTrack(type: TimelineTrack['type']) {
    const posIndices = tracks.map((t) => t.trackIndex).filter((i) => i >= 0)
    const nextIndex = posIndices.length > 0 ? Math.max(...posIndices) + 1 : 10
    const count = tracks.filter((t) => t.type === type).length + 1
    const nameMap: Record<TimelineTrack['type'], string> = {
      video: `V${count}`,
      audio: `Audio ${count}`,
      adjustment: `FX ${count}`,
      subtitle: `Sub ${count}`,
    }
    addTrack({
      id: crypto.randomUUID(),
      name: nameMap[type],
      type,
      trackIndex: type === 'adjustment' || type === 'subtitle' ? -(nextIndex) : nextIndex,
    })
    setShowAddModal(false)
  }

  return (
    <div
      className="flex flex-col shrink-0 relative"
      style={{ height, background: 'var(--bg)', borderTop: '1px solid var(--border-subtle)', transition: isDragging ? 'none' : 'height 0.15s ease' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-2.5 shrink-0"
        style={{ height: 30, background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 relative">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted-subtle)', fontSize: 10 }}>Timeline</span>
          <button
            className="text-xs rounded cursor-pointer transition-all duration-150"
            style={{ padding: '2px 8px', color: 'var(--muted2)', background: 'transparent', border: '1px solid var(--border-subtle)' }}
            onClick={() => setShowAddModal((v) => !v)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--muted2)' }}
          >
            + Track
          </button>
          {showAddModal && (
            <div
              className="absolute rounded-lg overflow-hidden z-50"
              style={{ top: 26, left: 0, background: 'var(--surface2)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 160 }}
            >
              {ADD_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleAddTrack(type)}
                  className="flex items-center gap-2 w-full text-xs cursor-pointer"
                  style={{ padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--muted2)', textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)' }}
                >
                  {TRACK_ICON[type]}
                  <span style={{ marginLeft: 4 }}>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="range" min={0.5} max={5} step={0.1} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 72, accentColor: '#E11D48', cursor: 'pointer' }}
        />
      </div>

      {/* Scrollable tracks */}
      <div className="flex-1 overflow-auto relative">
        <TimeRuler trackLabelWidth={TRACK_LABEL_WIDTH} zoom={zoom} />
        <div style={{ position: 'relative' }}>
          {/* Playhead line */}
          <div
            style={{ position: 'absolute', top: 0, bottom: 0, left: playheadLeft, width: 1.5, background: '#E11D48', zIndex: 20, pointerEvents: 'none' }}
          >
            <div style={{ position: 'absolute', top: -2, left: -5, width: 12, height: 8, background: '#E11D48', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', borderRadius: 2 }} />
          </div>

          {tracks.map((track, idx) => {
            const canMoveUp = idx > 0
            const canMoveDown = idx < tracks.length - 1
            const isDeletable = track.id !== 'v1' && track.id !== 'audio' && track.id !== 'text' && track.id !== 'adj'

            return (
              <TrackRow
                key={track.id}
                track={track}
                trackLabelWidth={TRACK_LABEL_WIDTH}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                isDeletable={isDeletable}
                onMoveUp={() => moveTrack(track.id, 'up')}
                onMoveDown={() => moveTrack(track.id, 'down')}
                onToggleHide={() => updateTrack(track.id, { hidden: !track.hidden })}
                onToggleMute={() => updateTrack(track.id, { muted: !track.muted })}
                onDelete={() => removeTrack(track.id)}
              >
                {track.type === 'subtitle' && <TextTrack zoom={zoom} trackLabelWidth={0} />}
                {track.type === 'adjustment' && <AdjustmentTrack zoom={zoom} trackLabelWidth={0} />}
                {(track.type === 'video' || track.type === 'audio') && (
                  <Track
                    trackIndex={track.trackIndex}
                    trackType={track.type}
                    label=""
                    icon={null}
                    height={track.type === 'audio' ? 28 : 38}
                    zoom={zoom}
                    trackLabelWidth={0}
                  />
                )}
              </TrackRow>
            )
          })}
        </div>
      </div>

      {/* Click-outside overlay for add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAddModal(false)} />
      )}
    </div>
  )
}

interface TrackRowProps {
  track: TimelineTrack
  trackLabelWidth: number
  canMoveUp: boolean
  canMoveDown: boolean
  isDeletable: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleHide: () => void
  onToggleMute: () => void
  onDelete: () => void
  children: React.ReactNode
}

function TrackRow({ track, trackLabelWidth, canMoveUp, canMoveDown, isDeletable, onMoveUp, onMoveDown, onToggleHide, onToggleMute, onDelete, children }: TrackRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex"
      style={{ opacity: track.hidden ? 0.4 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex items-center shrink-0"
        style={{
          minWidth: trackLabelWidth, width: trackLabelWidth,
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
          padding: '0 4px',
          fontSize: 9, color: 'var(--muted-subtle)',
          overflow: 'hidden',
        }}
      >
        {hovered ? (
          <div className="flex items-center gap-0.5 flex-wrap">
            {canMoveUp && <Ctrl title="Up" onClick={onMoveUp}><ChevronUp size={9} /></Ctrl>}
            {canMoveDown && <Ctrl title="Down" onClick={onMoveDown}><ChevronDown size={9} /></Ctrl>}
            <Ctrl title={track.hidden ? 'Show' : 'Hide'} onClick={onToggleHide}>
              {track.hidden ? <EyeOff size={9} /> : <Eye size={9} />}
            </Ctrl>
            {(track.type === 'video' || track.type === 'audio') && (
              <Ctrl title={track.muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
                {track.muted ? <VolumeX size={9} /> : <Volume2 size={9} />}
              </Ctrl>
            )}
            {isDeletable && <Ctrl title="Delete" onClick={onDelete} danger><Trash2 size={9} /></Ctrl>}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {TRACK_ICON[track.type]}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Ctrl({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: danger ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.5)', lineHeight: 1, borderRadius: 3 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = danger ? '#EF4444' : 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = danger ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'none' }}
    >
      {children}
    </button>
  )
}
