// src/components/panels/EffectsPanel.tsx
import { Sun, Contrast, Droplets, Blend, Circle, ScanLine, Zap } from 'lucide-react'
import { PanelLabel } from './TextPanel'
import type { EffectType } from '../../types'

const EFFECTS: { type: EffectType; label: string; icon: React.ReactNode }[] = [
  { type: 'brightness',  label: 'Brightness / Exposure', icon: <Sun size={13} /> },
  { type: 'contrast',    label: 'Contrast',               icon: <Contrast size={13} /> },
  { type: 'saturation',  label: 'Saturation',             icon: <Droplets size={13} /> },
  { type: 'grayscale',   label: 'Black & White',          icon: <Blend size={13} /> },
  { type: 'blur',        label: 'Blur',                   icon: <Circle size={13} /> },
  { type: 'vignette',    label: 'Vignette',               icon: <ScanLine size={13} /> },
  { type: 'sharpen',     label: 'Sharpen',                icon: <Zap size={13} /> },
]

export default function EffectsPanel() {
  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Effects</PanelLabel>
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>Click to apply to selected clip</p>
      <div className="flex flex-col gap-0.5">
        {EFFECTS.map((e) => (
          <EffectRow key={e.type} icon={e.icon} label={e.label} onClick={() => alert(`Apply ${e.label} — Phase 2`)} />
        ))}
      </div>
      <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <PanelLabel>Adjustment Layer</PanelLabel>
        <button
          className="w-full mt-2 rounded-lg text-xs cursor-pointer transition-all duration-150"
          style={{ padding: '9px', color: '#EF4444', background: 'transparent', border: '1px dashed rgba(239,68,68,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.background = 'transparent' }}
          onClick={() => alert('Phase 2')}
        >
          + Add Adjustment Layer
        </button>
      </div>
    </div>
  )
}

function EffectRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full rounded-lg text-sm text-left cursor-pointer transition-all duration-150"
      style={{ padding: '8px 10px', color: 'var(--muted2)', background: 'transparent', border: '1px solid transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.borderColor = 'transparent' }}
    >
      {icon} {label}
    </button>
  )
}
