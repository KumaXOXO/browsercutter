// src/components/panels/EffectsPanel.tsx
import { useState, useEffect } from 'react'
import { Sun, Contrast, Droplets, Blend, Circle, ScanLine, Zap } from 'lucide-react'
import { PanelLabel } from './TextPanel'
import { useAppStore } from '../../store/useAppStore'
import { EFFECT_DEFAULTS } from '../../lib/effectDefs'
import type { EffectType, Effect } from '../../types'

const EFFECT_DEFS: { type: EffectType; label: string; icon: React.ReactNode; min: number; max: number }[] = [
  { type: 'brightness',  label: 'Brightness',    icon: <Sun size={13} />,      min: 0,   max: 200 },
  { type: 'contrast',    label: 'Contrast',      icon: <Contrast size={13} />, min: 0,   max: 200 },
  { type: 'saturation',  label: 'Saturation',    icon: <Droplets size={13} />, min: 0,   max: 200 },
  { type: 'grayscale',   label: 'Black & White', icon: <Blend size={13} />,    min: 0,   max: 100 },
  { type: 'blur',        label: 'Blur',          icon: <Circle size={13} />,   min: 0,   max: 100 },
  { type: 'vignette',    label: 'Vignette',      icon: <ScanLine size={13} />, min: 0,   max: 100 },
  { type: 'sharpen',     label: 'Sharpen',       icon: <Zap size={13} />,      min: 0,   max: 100 },
]

export { EFFECT_DEFS }

export default function EffectsPanel() {
  const { selectedElement, segments, updateSegment, addAdjustmentLayer } = useAppStore()

  const segment = selectedElement?.type === 'segment'
    ? segments.find((s) => s.id === selectedElement.id) ?? null
    : null

  const effects: Effect[] = segment?.effects ?? []

  function toggle(type: EffectType) {
    if (!segment) return
    const exists = effects.find((e) => e.type === type)
    if (exists) {
      updateSegment(segment.id, { effects: effects.filter((e) => e.type !== type) })
    } else {
      updateSegment(segment.id, { effects: [...effects, { type, value: EFFECT_DEFAULTS[type] }] })
    }
  }

  function setValue(type: EffectType, value: number) {
    if (!segment) return
    updateSegment(segment.id, {
      effects: effects.map((e) => e.type === type ? { ...e, value } : e),
    })
  }

  function handleAddAdjustmentLayer() {
    addAdjustmentLayer({
      id: crypto.randomUUID(),
      startOnTimeline: 0,
      duration: 5,
      effects: [],
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Effects</PanelLabel>

      {!segment && (
        <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
          Select a clip on the timeline, then drag an effect onto it — or click to toggle.
        </p>
      )}

      <div className="flex flex-col gap-1">
        {EFFECT_DEFS.map((def) => {
          const active = effects.find((e) => e.type === def.type)
          return (
            <EffectRow
              key={def.type}
              def={def}
              active={!!active}
              value={active?.value ?? EFFECT_DEFAULTS[def.type]}
              onToggle={() => toggle(def.type)}
              onValueChange={(v) => setValue(def.type, v)}
            />
          )
        })}
      </div>

      <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <PanelLabel>Adjustment Layer</PanelLabel>
        <button
          className="w-full mt-2 rounded-lg text-xs cursor-pointer transition-all duration-150"
          style={{ padding: '9px', color: '#EF4444', background: 'transparent', border: '1px dashed rgba(239,68,68,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.background = 'transparent' }}
          onClick={handleAddAdjustmentLayer}
        >
          + Add Adjustment Layer
        </button>
      </div>
    </div>
  )
}

interface EffectRowProps {
  def: typeof EFFECT_DEFS[number]
  active: boolean
  value: number
  onToggle: () => void
  onValueChange: (v: number) => void
}

function EffectRow({ def, active, value, onToggle, onValueChange }: EffectRowProps) {
  const [localVal, setLocalVal] = useState(value)
  useEffect(() => { if (!active) setLocalVal(EFFECT_DEFAULTS[def.type]) }, [active, def.type])

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('effectType', def.type)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="rounded-lg transition-all duration-150"
      style={{
        padding: '8px 10px',
        background: active ? 'rgba(225,29,72,0.08)' : 'transparent',
        border: `1px solid ${active ? 'rgba(225,29,72,0.3)' : 'rgba(255,255,255,0.05)'}`,
        cursor: 'grab',
      }}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-sm text-left cursor-pointer"
        style={{ background: 'transparent', border: 'none', color: active ? '#F43F5E' : 'var(--muted2)', padding: 0 }}
      >
        {def.icon}
        <span className="flex-1">{def.label}</span>
        <span className="text-xs" style={{ color: active ? '#F43F5E' : 'var(--muted-subtle)' }}>
          {active ? 'ON' : 'OFF'}
        </span>
      </button>

      {active && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={def.min}
            max={def.max}
            value={localVal}
            className="flex-1"
            style={{ accentColor: '#E11D48' }}
            onChange={(e) => setLocalVal(Number(e.target.value))}
            onPointerUp={(e) => onValueChange(Number((e.target as HTMLInputElement).value))}
          />
          <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--muted-subtle)' }}>{localVal}</span>
        </div>
      )}
    </div>
  )
}
