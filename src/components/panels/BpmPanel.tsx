// src/components/panels/BpmPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { PanelLabel } from './TextPanel'
import type { BpmMode, SegmentLength } from '../../types'
import { detectBpm } from '../../lib/audio/bpmDetector'

const MODES: { id: BpmMode; label: string; example: string }[] = [
  { id: 'sequential', label: 'Sequential', example: 'A→B→C→A→B→C' },
  { id: 'random',     label: 'Random',     example: 'ACBBA...'      },
  { id: 'forfeit',    label: 'Forfeit',     example: 'AB→BC→CD'     },
]

const SEGMENT_LENGTHS: { value: SegmentLength; label: string }[] = [
  { value: 0.5, label: '½ Beat' },
  { value: 1,   label: '1 Beat' },
  { value: 2,   label: '2 Beats' },
  { value: 4,   label: '4 Beats' },
]

export default function BpmPanel() {
  const { bpmConfig, clips, updateBpmConfig } = useAppStore()
  const [detecting, setDetecting] = useState(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const videoClips = clips.filter((c) => c.type === 'video')

  return (
    <div className="flex flex-col gap-4 p-3.5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E11D48', display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F43F5E' }}>BPM Cutting Tool</span>
      </div>

      {/* Clip selection */}
      <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
        <PanelLabel>Select Source Clips</PanelLabel>
        {videoClips.length === 0 && <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>Upload video clips in the Media tab first.</p>}
        {videoClips.map((clip) => (
          <label key={clip.id} className="flex items-center gap-2.5 cursor-pointer py-1.5 text-xs" style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              style={{ accentColor: '#E11D48' }}
              checked={bpmConfig.selectedClipIds.includes(clip.id)}
              onChange={(e) => {
                const ids = e.target.checked
                  ? [...bpmConfig.selectedClipIds, clip.id]
                  : bpmConfig.selectedClipIds.filter((id) => id !== clip.id)
                updateBpmConfig({ selectedClipIds: ids })
              }}
            />
            <span className="rounded" style={{ width: 9, height: 9, background: '#7C3AED', flexShrink: 0 }} />
            <span className="flex-1 truncate">{clip.name}</span>
            <span style={{ color: 'var(--muted-subtle)' }}>{Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2,'0')}</span>
          </label>
        ))}
      </div>

      {/* BPM */}
      <div>
        <PanelLabel>BPM</PanelLabel>
        <div className="flex gap-2 mt-1.5">
          <input
            type="number"
            className="inp"
            style={{ width: 80 }}
            value={bpmConfig.bpm}
            min={20} max={300}
            onChange={(e) => updateBpmConfig({ bpm: Number(e.target.value) })}
          />
          <button
            className="flex-1 rounded-lg text-xs cursor-pointer transition-all duration-150"
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: detecting ? 'var(--muted-subtle)' : 'var(--muted2)',
              cursor: detecting ? 'wait' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!detecting) {
                e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'
                e.currentTarget.style.color = 'var(--text)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = detecting ? 'var(--muted-subtle)' : 'var(--muted2)'
            }}
            disabled={detecting}
            onClick={async () => {
              const targetClip = clips.find(
                (c) => bpmConfig.selectedClipIds.includes(c.id) && c.type === 'video',
              )
              if (!targetClip) return
              setDetecting(true)
              try {
                const detected = await detectBpm(targetClip.file)
                if (mountedRef.current) updateBpmConfig({ bpm: detected })
              } catch (err) {
                if (import.meta.env.DEV) console.error('[BpmDetector]', err)
              } finally {
                setDetecting(false)
              }
            }}
          >
            {detecting ? 'Detecting…' : 'Auto-Detect'}
          </button>
        </div>
      </div>

      {/* Mode */}
      <div>
        <PanelLabel>Cutting Mode</PanelLabel>
        <div className="flex flex-col gap-1.5 mt-2">
          {MODES.map((m) => {
            const selected = bpmConfig.mode === m.id
            return (
              <button
                key={m.id}
                onClick={() => updateBpmConfig({ mode: m.id })}
                className="flex items-start gap-2.5 rounded-lg p-2.5 cursor-pointer text-left transition-all duration-150"
                style={{
                  border: `1px solid ${selected ? 'rgba(225,29,72,0.5)' : 'var(--border-subtle)'}`,
                  background: selected ? 'rgba(225,29,72,0.06)' : 'var(--surface2)',
                  boxShadow: selected ? '0 0 0 1px rgba(225,29,72,0.15)' : 'none',
                }}
              >
                <input type="radio" name="bpm-mode" readOnly checked={selected} style={{ accentColor: '#E11D48', marginTop: 2 }} />
                <div>
                  <p className="text-xs font-medium">{m.label}</p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted-subtle)' }}>{m.example}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Segment length + output */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <PanelLabel>Segment</PanelLabel>
          <select
            className="inp mt-1.5"
            value={bpmConfig.segmentLength}
            onChange={(e) => updateBpmConfig({ segmentLength: Number(e.target.value) as SegmentLength })}
          >
            {SEGMENT_LENGTHS.map((sl) => <option key={sl.value} value={sl.value}>{sl.label}</option>)}
          </select>
        </div>
        <div>
          <PanelLabel>Output</PanelLabel>
          <div className="flex gap-1 mt-1.5">
            <input
              type="number"
              className="inp"
              style={{ width: 52 }}
              value={bpmConfig.outputDuration}
              min={1}
              onChange={(e) => updateBpmConfig({ outputDuration: Number(e.target.value) })}
            />
            <select
              className="inp"
              style={{ paddingLeft: 6, paddingRight: 6 }}
              value={bpmConfig.outputUnit}
              onChange={(e) => updateBpmConfig({ outputUnit: e.target.value as 'seconds' | 'beats' })}
            >
              <option value="seconds">sec</option>
              <option value="beats">beats</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        className="w-full rounded-xl font-bold text-sm text-white cursor-pointer transition-all duration-200 relative overflow-hidden"
        style={{ padding: 13, background: 'linear-gradient(135deg,#E11D48,#9C1EAB)', border: 'none', boxShadow: '0 4px 20px rgba(225,29,72,0.4), 0 4px 20px rgba(156,30,171,0.2)' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(225,29,72,0.55)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(225,29,72,0.4)' }}
        onMouseDown={(e)  => { e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseUp={(e)    => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onClick={() => alert('Generate Cut — Phase 2')}
      >
        Generate Cut
      </button>
    </div>
  )
}
