// src/components/panels/TransitionsPanel.tsx
import { PanelLabel } from './TextPanel'
import type { TransitionType } from '../../types'

const TRANSITIONS: { type: TransitionType; label: string; symbol: string }[] = [
  { type: 'cut',      label: 'Cut',      symbol: '▶' },
  { type: 'fade',     label: 'Fade',     symbol: 'A→B' },
  { type: 'wipe',     label: 'Wipe',     symbol: '|→' },
  { type: 'zoom',     label: 'Zoom',     symbol: '⊕' },
  { type: 'slide',    label: 'Slide',    symbol: '↗' },
  { type: 'dissolve', label: 'Dissolve', symbol: '◈' },
]

export default function TransitionsPanel() {
  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Transitions</PanelLabel>
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>Drag between two clips on the timeline</p>
      <div className="grid grid-cols-2 gap-2">
        {TRANSITIONS.map((t) => (
          <TransCard key={t.type} label={t.label} symbol={t.symbol} onClick={() => alert(`${t.label} — Phase 2`)} />
        ))}
      </div>
    </div>
  )
}

function TransCard({ label, symbol, onClick }: { label: string; symbol: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center rounded-lg cursor-pointer transition-all duration-150"
      style={{ padding: '12px 8px', background: 'var(--surface2)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.background = 'rgba(225,29,72,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.transform = '' }}
    >
      <span className="text-sm mb-1" style={{ color: 'var(--muted-subtle)', fontFamily: 'monospace' }}>{symbol}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
