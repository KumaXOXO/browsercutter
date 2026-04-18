// src/components/panels/InspectorPanel.tsx
import { useAppStore } from '../../store/useAppStore'
import { PanelLabel } from './TextPanel'

const CLIP_COLORS: Record<string, { bg: string; color: string }> = {
  video: { bg: 'rgba(124,58,237,0.15)', color: '#A78BFA' },
  audio: { bg: 'rgba(225,29,72,0.15)',  color: '#F43F5E' },
  image: { bg: 'rgba(5,150,105,0.15)',  color: '#34D399' },
}

export default function InspectorPanel() {
  const { selectedElement, segments, clips, textOverlays, updateSegment, updateTextOverlay } = useAppStore()

  if (!selectedElement) {
    return (
      <div className="flex flex-col gap-3 p-3.5 h-full items-center justify-center">
        <p className="text-xs text-center" style={{ color: 'var(--muted-subtle)' }}>Select a clip on the timeline to inspect it</p>
      </div>
    )
  }

  if (selectedElement.type === 'text') {
    const overlay = textOverlays.find((o) => o.id === selectedElement.id)
    if (!overlay) return null
    return <TextOverlayInspector overlay={overlay} onUpdate={(patch) => updateTextOverlay(overlay.id, patch)} />
  }

  const segment = segments.find((s) => s.id === selectedElement.id)
  const clip = segment ? clips.find((c) => c.id === segment.clipId) : null

  if (!segment || !clip) return null

  const style = CLIP_COLORS[clip.type] ?? CLIP_COLORS.video
  const duration = segment.outPoint - segment.inPoint
  const volume = segment.volume ?? 1
  const speed = segment.speed ?? 1

  return (
    <div className="flex flex-col gap-4 p-3.5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <PanelLabel>Inspector</PanelLabel>
        <span className="text-xs font-semibold rounded px-2 py-0.5" style={{ background: style.bg, color: style.color }}>{clip.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="In Point">
          <InpField value={formatTime(segment.inPoint)} onChange={(v) => updateSegment(segment.id, { inPoint: parseTime(v) })} />
        </Field>
        <Field label="Out Point">
          <InpField value={formatTime(segment.outPoint)} onChange={(v) => updateSegment(segment.id, { outPoint: parseTime(v) })} />
        </Field>
      </div>
      <Field label="Duration">
        <InpField value={formatTime(duration)} readOnly />
      </Field>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <Field label={`Volume — ${Math.round(volume * 100)}%`}>
        <input
          type="range" min={0} max={100}
          value={Math.round(volume * 100)}
          className="w-full"
          style={{ accentColor: '#E11D48' }}
          onChange={(e) => updateSegment(segment.id, { volume: Number(e.target.value) / 100 })}
        />
      </Field>
      <Field label={`Speed — ${speed.toFixed(2)}x`}>
        <input
          type="range" min={25} max={400}
          value={Math.round(speed * 100)}
          className="w-full"
          style={{ accentColor: '#E11D48' }}
          onChange={(e) => updateSegment(segment.id, { speed: Number(e.target.value) / 100 })}
        />
      </Field>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <div>
        <PanelLabel>Applied Effects</PanelLabel>
        <p className="text-xs mt-2" style={{ color: 'var(--muted-subtle)' }}>No effects applied.</p>
        <button className="text-xs mt-2 cursor-pointer transition-colors" style={{ color: '#E11D48', background: 'transparent', border: 'none' }}>+ Add Effect</button>
      </div>
    </div>
  )
}

import type { TextOverlay } from '../../types'

function TextOverlayInspector({ overlay, onUpdate }: { overlay: TextOverlay; onUpdate: (patch: Partial<TextOverlay>) => void }) {
  return (
    <div className="flex flex-col gap-4 p-3.5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <PanelLabel>Inspector</PanelLabel>
        <span className="text-xs font-semibold rounded px-2 py-0.5" style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}>Text</span>
      </div>

      <Field label="Text">
        <textarea
          className="inp resize-none"
          rows={3}
          value={overlay.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Start">
          <InpField value={formatTime(overlay.startOnTimeline)} onChange={(v) => onUpdate({ startOnTimeline: parseTime(v) })} />
        </Field>
        <Field label="Duration">
          <InpField value={formatTime(overlay.duration)} onChange={(v) => onUpdate({ duration: parseTime(v) })} />
        </Field>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Font">
          <InpField value={overlay.font} onChange={(v) => onUpdate({ font: v })} />
        </Field>
        <Field label={`Size — ${overlay.size}px`}>
          <input
            type="range" min={10} max={120}
            value={overlay.size}
            className="w-full mt-1"
            style={{ accentColor: '#EAB308' }}
            onChange={(e) => onUpdate({ size: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Color">
        <input
          type="color"
          value={overlay.color}
          className="h-8 w-full rounded cursor-pointer"
          onChange={(e) => onUpdate({ color: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={`X — ${Math.round(overlay.x * 100)}%`}>
          <input type="range" min={0} max={100} value={Math.round(overlay.x * 100)} className="w-full" style={{ accentColor: '#EAB308' }}
            onChange={(e) => onUpdate({ x: Number(e.target.value) / 100 })} />
        </Field>
        <Field label={`Y — ${Math.round(overlay.y * 100)}%`}>
          <input type="range" min={0} max={100} value={Math.round(overlay.y * 100)} className="w-full" style={{ accentColor: '#EAB308' }}
            onChange={(e) => onUpdate({ y: Number(e.target.value) / 100 })} />
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-subtle)' }}>{label}</label>
      {children}
    </div>
  )
}

function InpField({ value, readOnly, onChange }: { value: string; readOnly?: boolean; onChange?: (v: string) => void }) {
  return (
    <input
      className="inp"
      value={value}
      readOnly={readOnly}
      style={{ opacity: readOnly ? 0.5 : 1, cursor: readOnly ? 'default' : 'text' }}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec.toFixed(2)).padStart(5, '0')}`
}

function parseTime(str: string): number {
  const parts = str.split(':')
  if (parts.length !== 3) return 0
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
}
