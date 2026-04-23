// src/components/panels/BpmPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { PanelLabel } from './TextPanel'
import type { BpmMode } from '../../types'
import { detectBpm } from '../../lib/audio/bpmDetector'
import { generateCut } from '../../lib/bpm/generateCut'

const MODES: { id: BpmMode; label: string }[] = [
  { id: 'normal',     label: 'Normal'     },
  { id: 'sequential', label: 'Sequential' },
  { id: 'random',     label: 'Random'     },
  { id: 'forfeit',    label: 'Forfeit'    },
]

// Musical segment length steps: 1/32, 1/16, 1/8, 1/4, 1/2, 1, 2, 4, 8, 16, 32
const SEG_STEPS = [1/32, 1/16, 1/8, 1/4, 0.5, 1, 2, 4, 8, 16, 32]

function segStepLabel(v: number): string {
  if (v < 1) return `1/${Math.round(1 / v)}`
  return `${v}`
}

export default function BpmPanel() {
  const { bpmConfig, clips, tracks, segments, updateBpmConfig, addSegments, replaceSegments, setPlayheadPosition, setIsPlaying } = useAppStore()
  const [detecting, setDetecting] = useState(false)
  const [appendMode, setAppendMode] = useState(true)
  const [cutToast, setCutToast] = useState<number | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const videoClips = clips.filter((c) => c.type === 'video')

  // Auto-select newly uploaded clips
  const prevClipCountRef = useRef(videoClips.length)
  useEffect(() => {
    if (videoClips.length > prevClipCountRef.current) {
      const newIds = videoClips.slice(prevClipCountRef.current).map((c) => c.id)
      updateBpmConfig({ selectedClipIds: [...bpmConfig.selectedClipIds, ...newIds] })
    }
    prevClipCountRef.current = videoClips.length
  }, [videoClips.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const videoTracks = tracks.filter((t) => t.type === 'video')
  const [selectedTrackId, setSelectedTrackId] = useState<string>(() => videoTracks[0]?.id ?? 'v1')
  const selectedTrack = videoTracks.find((t) => t.id === selectedTrackId) ?? videoTracks[0]

  const segStepIndex = SEG_STEPS.findIndex((v) => Math.abs(v - bpmConfig.segmentLength) < 0.001)
  const currentStepIndex = segStepIndex >= 0 ? segStepIndex : 5

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

      {/* Mode — dropdown */}
      <div>
        <PanelLabel>Cutting Mode</PanelLabel>
        <select
          className="inp mt-1.5"
          value={bpmConfig.mode}
          onChange={(e) => updateBpmConfig({ mode: e.target.value as BpmMode })}
        >
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      {/* Import mode toggle */}
      <div>
        <PanelLabel>Import Mode</PanelLabel>
        <div className="flex mt-1.5 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {([['fixed', 'By BPM'], ['full', 'Full Length']] as const).map(([id, label]) => {
            const active = (bpmConfig.importMode ?? 'fixed') === id
            return (
              <button
                key={id}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11, fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(225,29,72,0.25)' : 'transparent',
                  color: active ? '#F43F5E' : 'var(--muted2)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => updateBpmConfig({ importMode: id })}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Segment length — slider (hidden in full-length mode) */}
      {(bpmConfig.importMode ?? 'fixed') === 'fixed' && (
        <div>
          <PanelLabel>Segment Length — {segStepLabel(SEG_STEPS[currentStepIndex])} beat{SEG_STEPS[currentStepIndex] !== 1 ? 's' : ''}</PanelLabel>
          <input
            type="range"
            className="mt-1.5"
            min={0} max={SEG_STEPS.length - 1} step={1}
            value={currentStepIndex}
            style={{ width: '100%', accentColor: '#E11D48', cursor: 'pointer' }}
            onChange={(e) => updateBpmConfig({ segmentLength: SEG_STEPS[Number(e.target.value)] })}
          />
          <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--muted-subtle)', fontSize: 9 }}>
            <span>1/32</span><span>1</span><span>32</span>
          </div>
        </div>
      )}

      {/* Output (hidden in full-length mode) */}
      {(bpmConfig.importMode ?? 'fixed') === 'fixed' && (
        <div>
          <PanelLabel>Output Duration</PanelLabel>
          <div className="flex gap-1 mt-1.5">
            <input
              type="number"
              className="inp"
              style={{ width: 72 }}
              value={bpmConfig.outputDuration}
              min={0.1}
              step={0.1}
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
      )}

      {/* Target track + insert mode */}
      {videoTracks.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <PanelLabel>Target Track</PanelLabel>
            <select
              className="inp mt-1.5"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
            >
              {videoTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--muted2)' }}>
            <input
              type="checkbox"
              checked={appendMode}
              style={{ accentColor: '#E11D48' }}
              onChange={(e) => setAppendMode(e.target.checked)}
            />
            Append to timeline (instead of replace)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--muted2)' }}>
            <input
              type="checkbox"
              checked={bpmConfig.onlyWholeClips}
              style={{ accentColor: '#E11D48' }}
              onChange={(e) => updateBpmConfig({ onlyWholeClips: e.target.checked })}
            />
            Only import complete segments (skip partial clips at end)
          </label>
        </div>
      )}

      {/* Generate button */}
      <button
        className="w-full rounded-xl font-bold text-sm text-white cursor-pointer transition-all duration-200 relative overflow-hidden"
        style={{ padding: 13, background: 'linear-gradient(135deg,#E11D48,#9C1EAB)', border: 'none', boxShadow: '0 4px 20px rgba(225,29,72,0.4), 0 4px 20px rgba(156,30,171,0.2)' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(225,29,72,0.55)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(225,29,72,0.4)' }}
        onMouseDown={(e)  => { e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseUp={(e)    => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onClick={() => {
          const trackIdx = selectedTrack?.trackIndex ?? 0
          const trackSegs = segments.filter((s) => s.trackIndex === trackIdx)
          const startOffset = appendMode && trackSegs.length > 0
            ? Math.max(...trackSegs.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1)))
            : 0
          const newSegments = generateCut(clips, bpmConfig, trackIdx, startOffset)
          if (newSegments.length > 0) {
            if (appendMode) {
              addSegments(newSegments)
            } else {
              replaceSegments(newSegments, trackIdx)
            }
            setIsPlaying(false)
            if (!appendMode) setPlayheadPosition(0)
            setCutToast(newSegments.length)
            setTimeout(() => setCutToast(null), 3000)
          }
        }}
      >
        {appendMode ? 'Append Cut' : 'Replace Cut'}
      </button>

      {cutToast !== null && (
        <div style={{
          background: 'rgba(225,29,72,0.15)', border: '1px solid rgba(225,29,72,0.3)',
          borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#F43F5E', textAlign: 'center',
        }}>
          {cutToast} clip{cutToast !== 1 ? 's' : ''} created
        </div>
      )}
    </div>
  )
}
