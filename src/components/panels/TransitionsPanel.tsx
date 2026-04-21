// src/components/panels/TransitionsPanel.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { PanelLabel } from './TextPanel'
import { useAppStore } from '../../store/useAppStore'
import type { TransitionType } from '../../types'

const TRANSITION_DEFS: { type: TransitionType; label: string; symbol: string; description: string }[] = [
  { type: 'cut',      label: 'Cut',      symbol: '▶',   description: 'Instant cut' },
  { type: 'fade',     label: 'Fade',     symbol: 'A→B', description: 'Dissolve to black' },
  { type: 'wipe',     label: 'Wipe',     symbol: '|→',  description: 'Horizontal wipe' },
  { type: 'zoom',     label: 'Zoom',     symbol: '⊕',   description: 'Zoom transition' },
  { type: 'slide',    label: 'Slide',    symbol: '↗',   description: 'Slide in/out' },
  { type: 'dissolve', label: 'Dissolve', symbol: '◈',   description: 'Cross-dissolve' },
]

export default function TransitionsPanel() {
  const { segments, clips, transitions, addTransition, updateTransition, removeTransition } = useAppStore()
  const [selected, setSelected] = useState<TransitionType | null>(null)

  const v1Segments = [...segments.filter((s) => s.trackIndex === 0)]
    .sort((a, b) => a.startOnTimeline - b.startOnTimeline)

  const adjacentPairs = v1Segments.slice(0, -1).map((seg, i) => ({
    before: seg,
    after: v1Segments[i + 1],
  }))

  function applyTransition(beforeId: string, afterId: string) {
    if (!selected) return
    const alreadyExists = transitions.find(
      (t) => t.beforeSegmentId === beforeId && t.afterSegmentId === afterId,
    )
    if (alreadyExists) removeTransition(alreadyExists.id)
    addTransition({
      id: crypto.randomUUID(),
      type: selected,
      beforeSegmentId: beforeId,
      afterSegmentId: afterId,
      duration: 0.5,
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Transitions</PanelLabel>

      <div className="grid grid-cols-2 gap-2">
        {TRANSITION_DEFS.map((t) => (
          <TransCard
            key={t.type}
            label={t.label}
            symbol={t.symbol}
            description={t.description}
            active={selected === t.type}
            onClick={() => setSelected(selected === t.type ? null : t.type)}
          />
        ))}
      </div>

      {selected && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--muted-subtle)' }}>
            Select a clip boundary to apply <strong style={{ color: 'var(--text)' }}>{selected}</strong>:
          </p>

          {adjacentPairs.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>No adjacent clips on V1.</p>
          )}

          {adjacentPairs.map(({ before, after }) => {
            const clipA = clips.find((c) => c.id === before.clipId)
            const clipB = clips.find((c) => c.id === after.clipId)
            const existing = transitions.find(
              (t) => t.beforeSegmentId === before.id && t.afterSegmentId === after.id,
            )
            return (
              <button
                key={`${before.id}-${after.id}`}
                onClick={() => applyTransition(before.id, after.id)}
                className="w-full text-left text-xs rounded-lg cursor-pointer transition-all duration-150"
                style={{
                  padding: '7px 10px', marginBottom: 4,
                  background: existing ? 'rgba(225,29,72,0.1)' : 'var(--surface2)',
                  border: `1px solid ${existing ? 'rgba(225,29,72,0.4)' : 'var(--border-subtle)'}`,
                  color: existing ? '#F43F5E' : 'var(--muted2)',
                }}
              >
                {clipA?.name ?? '?'} → {clipB?.name ?? '?'}
                {existing && <span className="ml-2 font-semibold">({existing.type})</span>}
              </button>
            )
          })}
        </div>
      )}

      {transitions.length > 0 && (
        <div>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 8 }} />
          <PanelLabel>Applied</PanelLabel>
          {transitions.map((t) => {
            const clipA = clips.find((c) => c.id === segments.find((s) => s.id === t.beforeSegmentId)?.clipId)
            const clipB = clips.find((c) => c.id === segments.find((s) => s.id === t.afterSegmentId)?.clipId)
            return (
              <div
                key={t.id}
                className="rounded-lg"
                style={{ padding: '8px 10px', marginBottom: 4, background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)' }}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span style={{ color: '#F43F5E', fontWeight: 600 }}>{t.type}</span>
                  <span style={{ color: 'var(--muted-subtle)', fontSize: 10 }}>{clipA?.name ?? '?'} → {clipB?.name ?? '?'}</span>
                  <button
                    onClick={() => removeTransition(t.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-subtle)', padding: 2 }}
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--muted-subtle)', fontSize: 10, whiteSpace: 'nowrap' }}>Duration</span>
                  <input
                    type="range" min="0.1" max="3" step="0.1"
                    value={t.duration}
                    onChange={(e) => updateTransition(t.id, { duration: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: '#F43F5E', height: 4 }}
                  />
                  <span style={{ color: 'var(--muted-subtle)', fontSize: 10, minWidth: 28, textAlign: 'right' }}>{t.duration.toFixed(1)}s</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface TransCardProps {
  label: string
  symbol: string
  description: string
  active: boolean
  onClick: () => void
}

function TransCard({ label, symbol, description, active, onClick }: TransCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center rounded-lg cursor-pointer transition-all duration-150"
      style={{
        padding: '12px 8px',
        background: active ? 'rgba(225,29,72,0.1)' : 'var(--surface2)',
        border: `1px solid ${active ? 'rgba(225,29,72,0.6)' : 'var(--border-subtle)'}`,
        transform: active ? 'translateY(-1px)' : '',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = '' } }}
    >
      <span className="text-sm mb-0.5" style={{ color: active ? '#F43F5E' : 'var(--muted-subtle)', fontFamily: 'monospace' }}>{symbol}</span>
      <span className="text-xs font-medium" style={{ color: active ? '#F43F5E' : 'var(--text)' }}>{label}</span>
      <span className="text-xs mt-0.5" style={{ color: 'var(--muted-subtle)', fontSize: 9 }}>{description}</span>
    </button>
  )
}
