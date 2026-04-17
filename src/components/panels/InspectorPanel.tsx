// src/components/panels/InspectorPanel.tsx
import { useAppStore } from '../../store/useAppStore'
import { PanelLabel } from './TextPanel'

const CLIP_COLORS: Record<string, { bg: string; color: string }> = {
  video: { bg: 'rgba(124,58,237,0.15)', color: '#A78BFA' },
  audio: { bg: 'rgba(225,29,72,0.15)',  color: '#F43F5E' },
  image: { bg: 'rgba(5,150,105,0.15)',  color: '#34D399' },
}

export default function InspectorPanel() {
  const { selectedElement, segments, clips, updateSegment } = useAppStore()

  if (!selectedElement) {
    return (
      <div className="flex flex-col gap-3 p-3.5 h-full items-center justify-center">
        <p className="text-xs text-center" style={{ color: 'var(--muted-subtle)' }}>Select a clip on the timeline to inspect it</p>
      </div>
    )
  }

  const segment = segments.find((s) => s.id === selectedElement.id)
  const clip = segment ? clips.find((c) => c.id === segment.clipId) : null

  if (!segment || !clip) return null

  const style = CLIP_COLORS[clip.type] ?? CLIP_COLORS.video
  const duration = segment.outPoint - segment.inPoint

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

      <Field label="Volume">
        <input type="range" min={0} max={100} defaultValue={100} className="w-full" style={{ accentColor: '#E11D48' }} />
      </Field>
      <Field label="Speed">
        <input type="range" min={25} max={400} defaultValue={100} className="w-full" style={{ accentColor: '#E11D48' }} />
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
