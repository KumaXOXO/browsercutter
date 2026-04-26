// src/components/timeline/Timeline.tsx
import { useState, useEffect, useRef } from 'react'
import { Film, Volume2, Wand2, Type, Eye, EyeOff, VolumeX, Trash2, MousePointer2, Move, Scissors, ArrowLeftRight, ChevronUp, ChevronDown } from 'lucide-react'
import TimeRuler from './TimeRuler'
import Track from './Track'
import TextTrack from './TextTrack'
import AdjustmentTrack from './AdjustmentTrack'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'
import type { TimelineTrack } from '../../types'

const TRACK_LABEL_WIDTH = 78
const GRID_VALUES = [2, 4, 8, 16, 32, 64, 128]

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
  const [playheadHovered, setPlayheadHovered] = useState(false)
  const [playheadDragging, setPlayheadDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  const playheadRef = useRef(0)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const {
    playheadPosition, setPlayheadPosition,
    tracks, updateTrack, removeTrack, moveTrack,
    timelineMode, resizeEnabled, setTimelineMode, setResizeEnabled,
    cutSubMode, cutGridParts, setCutSubMode, setCutGridParts,
    projectSettings, updateProjectSettings,
    bpmConfig, updateBpmConfig,
  } = useAppStore()

  useEffect(() => { playheadRef.current = playheadPosition }, [playheadPosition])

  // Center the timeline on the playhead whenever zoom changes
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const playheadPx = TRACK_LABEL_WIDTH + playheadRef.current * PX_PER_SEC * zoom
    container.scrollLeft = Math.max(0, playheadPx - container.clientWidth / 2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  const currentCutIdx = GRID_VALUES.indexOf(cutGridParts)
  const stepCutUp = () => { if (currentCutIdx < GRID_VALUES.length - 1) setCutGridParts(GRID_VALUES[currentCutIdx + 1]) }
  const stepCutDown = () => { if (currentCutIdx > 0) setCutGridParts(GRID_VALUES[currentCutIdx - 1]) }

  // Shift+Mousewheel zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return
      e.preventDefault()
      setZoom((z) => Math.min(5, Math.max(0.5, z - e.deltaY * 0.005)))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const store = useAppStore.getState()
      const { selectedSegmentIds, selectedElement, segments, setSelectedSegmentIds, setSelectedElement, removeSegments, removeTextOverlay, removeAdjustmentLayer } = store

      // P: toggle preview fullscreen
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const previewEl = document.querySelector('[data-preview-container]') as HTMLElement | null
        if (previewEl) {
          if (!document.fullscreenElement) previewEl.requestFullscreen().catch(() => {})
          else document.exitFullscreen().catch(() => {})
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const toDelete = new Set(selectedSegmentIds)
        if (selectedElement?.type === 'segment') toDelete.add(selectedElement.id)
        if (toDelete.size > 0) {
          e.preventDefault()
          removeSegments([...toDelete])
          setSelectedSegmentIds([])
          setSelectedElement(null)
          return
        }
        if (selectedElement?.type === 'text') {
          e.preventDefault()
          removeTextOverlay(selectedElement.id)
          setSelectedElement(null)
          return
        }
        if (selectedElement?.type === 'adjustment') {
          e.preventDefault()
          removeAdjustmentLayer(selectedElement.id)
          setSelectedElement(null)
          return
        }
      }

      // Ctrl+A: select all segments + all text overlays
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'a') {
        e.preventDefault()
        const { textOverlays, setSelectedTextIds } = store
        setSelectedSegmentIds(segments.map((s) => s.id))
        setSelectedTextIds(textOverlays.map((o) => o.id))
        return
      }

      // Shift+A: select all clips in the track of the current selection
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'A') {
        e.preventDefault()
        const anchorId = selectedElement?.id ?? selectedSegmentIds[selectedSegmentIds.length - 1]
        const anchor = segments.find((s) => s.id === anchorId)
        if (anchor) {
          setSelectedSegmentIds(segments.filter((s) => s.trackIndex === anchor.trackIndex).map((s) => s.id))
        }
        return
      }

      // Alt+A: select all clips that share the same source video as the current selection
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        const anchorId = selectedElement?.id ?? selectedSegmentIds[selectedSegmentIds.length - 1]
        const anchor = segments.find((s) => s.id === anchorId)
        if (anchor) {
          setSelectedSegmentIds(segments.filter((s) => s.clipId === anchor.clipId).map((s) => s.id))
        }
        return
      }

      // Ctrl+Shift+A: select all segments whose track type matches current selection, else all video segments
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        const { tracks: allTracks } = store
        const anchorSeg = segments.find((s) => s.id === (selectedElement?.id ?? selectedSegmentIds[0]))
        const anchorTrack = anchorSeg ? allTracks.find((t) => t.trackIndex === anchorSeg.trackIndex) : null
        const matchType = anchorTrack?.type ?? 'video'
        const matchIdx = new Set(allTracks.filter((t) => t.type === matchType).map((t) => t.trackIndex))
        setSelectedSegmentIds(segments.filter((s) => matchIdx.has(s.trackIndex)).map((s) => s.id))
        return
      }

      // Arrow key timeline navigation (no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const { tracks: allTracks, isPlaying, setIsPlaying } = store
        const anchorId = selectedElement?.id ?? selectedSegmentIds[0]
        const anchorSeg = segments.find((s) => s.id === anchorId)

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const trackIdx = anchorSeg?.trackIndex ?? (allTracks[0]?.trackIndex ?? 0)
          const trackSegs = segments
            .filter((s) => s.trackIndex === trackIdx)
            .sort((a, b) => a.startOnTimeline - b.startOnTimeline)
          if (trackSegs.length === 0) return

          let target = trackSegs[0]
          if (anchorSeg) {
            const ci = trackSegs.findIndex((s) => s.id === anchorSeg.id)
            const ni = e.key === 'ArrowRight' ? ci + 1 : ci - 1
            if (ni < 0 || ni >= trackSegs.length) return
            target = trackSegs[ni]
          } else if (e.key === 'ArrowLeft') {
            target = trackSegs[trackSegs.length - 1]
          }
          if (isPlaying) setIsPlaying(false)
          setSelectedElement({ type: 'segment', id: target.id })
          store.setPlayheadPosition(target.startOnTimeline)
          return
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const curPos = anchorSeg
            ? allTracks.findIndex((t) => t.trackIndex === anchorSeg.trackIndex)
            : -1
          const nextPos = e.key === 'ArrowUp'
            ? Math.max(0, curPos <= 0 ? 0 : curPos - 1)
            : Math.min(allTracks.length - 1, curPos < 0 ? 0 : curPos + 1)
          const targetTrack = allTracks[nextPos]
          if (!targetTrack || targetTrack.trackIndex === anchorSeg?.trackIndex) return

          const refPos = anchorSeg?.startOnTimeline ?? store.playheadPosition
          const candidates = segments.filter((s) => s.trackIndex === targetTrack.trackIndex)
          if (candidates.length === 0) return

          const closest = candidates.reduce((best, s) =>
            Math.abs(s.startOnTimeline - refPos) < Math.abs(best.startOnTimeline - refPos) ? s : best
          )
          if (isPlaying) setIsPlaying(false)
          setSelectedElement({ type: 'segment', id: closest.id })
          store.setPlayheadPosition(closest.startOnTimeline)
          return
        }
      }

      // Shift+Arrow: move selected clip along grid (left/right) or to adjacent track (up/down)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const { tracks: allTracks, updateSegment, isPlaying, setIsPlaying, bpmConfig } = store
        const anchorId = selectedElement?.id ?? selectedSegmentIds[0]
        const anchorSeg = segments.find((s) => s.id === anchorId)
        if (!anchorSeg) return

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const stepSec = (60 / (bpmConfig.bpm || 120)) * (bpmConfig.gridStep ?? 1)
          const delta = e.key === 'ArrowRight' ? stepSec : -stepSec
          const newStart = Math.max(0, anchorSeg.startOnTimeline + delta)
          if (isPlaying) setIsPlaying(false)
          updateSegment(anchorSeg.id, { startOnTimeline: newStart })
          return
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const anchorTrack = allTracks.find((t) => t.trackIndex === anchorSeg.trackIndex)
          if (!anchorTrack) return
          const sameTracks = allTracks.filter((t) => t.type === anchorTrack.type)
          const curPos = sameTracks.findIndex((t) => t.trackIndex === anchorSeg.trackIndex)
          const nextPos = e.key === 'ArrowUp'
            ? Math.max(0, curPos - 1)
            : Math.min(sameTracks.length - 1, curPos + 1)
          const targetTrack = sameTracks[nextPos]
          if (!targetTrack || targetTrack.trackIndex === anchorSeg.trackIndex) return
          if (isPlaying) setIsPlaying(false)
          updateSegment(anchorSeg.id, { trackIndex: targetTrack.trackIndex })
          return
        }
      }

      // Frame step: . = forward, , = back
      if (e.key === '.' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        const { playheadPosition: pos, isPlaying, setPlayheadPosition: setPos, setIsPlaying: setPlay, projectSettings: ps } = store
        if (isPlaying) setPlay(false)
        setPos(Math.max(0, pos + 1 / Math.max(1, ps.fps)))
        return
      }
      if (e.key === ',' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        const { playheadPosition: pos, isPlaying, setPlayheadPosition: setPos, setIsPlaying: setPlay, projectSettings: ps } = store
        if (isPlaying) setPlay(false)
        setPos(Math.max(0, pos - 1 / Math.max(1, ps.fps)))
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const playheadLeft = TRACK_LABEL_WIDTH + playheadPosition * PX_PER_SEC * zoom

  function handlePlayheadMouseDown(e: React.MouseEvent) {
    if (timelineMode !== 'playhead') return
    e.stopPropagation()
    e.preventDefault()
    setPlayheadDragging(true)
    const scrollEl = scrollRef.current
    const containerRect = scrollEl?.getBoundingClientRect()

    const onMove = (ev: MouseEvent) => {
      const scrollLeft = scrollEl?.scrollLeft ?? 0
      const left = containerRect?.left ?? 0
      const x = ev.clientX - left + scrollLeft - TRACK_LABEL_WIDTH
      setPlayheadPosition(Math.max(0, x / (PX_PER_SEC * zoomRef.current)))
    }
    const onUp = () => {
      setPlayheadDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

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
    const newTrack: TimelineTrack = {
      id: crypto.randomUUID(),
      name: nameMap[type],
      type,
      trackIndex: type === 'adjustment' || type === 'subtitle' ? -(nextIndex) : nextIndex,
    }
    const lastSameTypeIdx = tracks.reduce((best, t, i) => t.type === type ? i : best, -1)
    let insertAfter: number
    if (lastSameTypeIdx >= 0) {
      insertAfter = lastSameTypeIdx
    } else if (type === 'adjustment') {
      insertAfter = -1  // top of list
    } else {
      insertAfter = tracks.length - 1
    }
    const newTracks = [...tracks]
    newTracks.splice(insertAfter + 1, 0, newTrack)
    useAppStore.setState({ tracks: newTracks })
    setShowAddModal(false)
  }

  const enlarged = timelineMode === 'playhead' && (playheadHovered || playheadDragging)

  return (
    <div
      className="flex flex-col shrink-0 relative"
      style={{ height, background: 'var(--bg)', borderTop: '1px solid var(--border-subtle)', transition: isDragging ? 'none' : 'height 0.15s ease', userSelect: 'none' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-2.5 shrink-0"
        style={{ height: 30, background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 relative">

          <button
            title={projectSettings.snapToBeat ? 'Snap: Grid — clips snap to beat. Click for Free.' : 'Snap: Free — clips move freely. Click for Grid.'}
            onClick={() => updateProjectSettings({ snapToBeat: !projectSettings.snapToBeat })}
            className="text-xs rounded cursor-pointer transition-all duration-150"
            style={{
              padding: '2px 7px',
              border: `1px solid ${projectSettings.snapToBeat ? 'rgba(225,29,72,0.55)' : 'var(--border-subtle)'}`,
              background: projectSettings.snapToBeat ? 'rgba(225,29,72,0.1)' : 'transparent',
              color: projectSettings.snapToBeat ? '#F43F5E' : 'var(--muted2)',
              fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            {projectSettings.snapToBeat ? 'GRID' : 'FREE'}
          </button>

          {/* BPM input — disabled in Free mode */}
          <input
            type="number"
            title={projectSettings.snapToBeat ? 'BPM for grid snapping' : 'Enable Grid to edit BPM'}
            min={20} max={300}
            value={bpmConfig.bpm ?? ''}
            placeholder="–"
            disabled={!projectSettings.snapToBeat}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 20 && v <= 300) updateBpmConfig({ bpm: v })
            }}
            style={{
              width: 52, fontSize: 10, textAlign: 'center',
              background: 'transparent', border: '1px solid var(--border-subtle)',
              color: projectSettings.snapToBeat ? 'var(--muted2)' : 'var(--muted-subtle)',
              borderRadius: 4, padding: '2px 4px',
              outline: 'none',
              opacity: projectSettings.snapToBeat ? 1 : 0.4,
              cursor: projectSettings.snapToBeat ? 'text' : 'not-allowed',
            }}
            onFocus={(e) => { if (projectSettings.snapToBeat) { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' } }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = projectSettings.snapToBeat ? 'var(--muted2)' : 'var(--muted-subtle)' }}
          />

          {/* Grid step selector — pill-shaped note-value toggle, only when Grid is on */}
          {projectSettings.snapToBeat && (
            <div
              title="Grid step — beats per marker"
              style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 5, overflow: 'hidden' }}
            >
              {([{ v: 0.25, label: '¼' }, { v: 0.5, label: '½' }, { v: 1, label: '1' }, { v: 2, label: '2' }, { v: 4, label: '4' }] as { v: number; label: string }[]).map(({ v, label }, idx) => {
                const active = (bpmConfig.gridStep ?? 1) === v
                return (
                  <button
                    key={v}
                    title={`Grid: ${label} beat${v !== 1 ? 's' : ''} per mark`}
                    onClick={() => updateBpmConfig({ gridStep: v })}
                    style={{
                      padding: '2px 5px', fontSize: 9, lineHeight: '1.6', fontFamily: 'monospace',
                      fontWeight: active ? 700 : 400,
                      color: active ? '#F43F5E' : 'var(--muted-subtle)',
                      background: active ? 'rgba(225,29,72,0.12)' : 'transparent',
                      border: 'none',
                      borderRight: idx < 4 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                      transition: 'color 120ms, background 120ms',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

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
          {/* Mode buttons */}
          <div className="flex items-center gap-0.5 ml-1" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 6 }}>
            <ModeBtn active={timelineMode === 'playhead'} title="Playhead Mode — click empty area or drag playhead" onClick={() => setTimelineMode('playhead')}>
              <MousePointer2 size={10} />
            </ModeBtn>
            <ModeBtn active={timelineMode === 'selection'} title="Selection Mode — select & move clips" onClick={() => setTimelineMode('selection')}>
              <Move size={10} />
            </ModeBtn>
            <ModeBtn active={timelineMode === 'cut'} title="Cut Mode — click a clip to split at playhead" onClick={() => setTimelineMode('cut')}>
              <Scissors size={10} />
            </ModeBtn>

            {/* Inline cut sub-mode controls — animate in when cut mode is active */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                overflow: 'hidden',
                maxWidth: timelineMode === 'cut' ? 140 : 0,
                opacity: timelineMode === 'cut' ? 1 : 0,
                transition: 'max-width 200ms ease, opacity 150ms ease',
                marginLeft: timelineMode === 'cut' ? 4 : 0,
              }}
            >
              {/* FREE: single cut line icon */}
              <button
                title="Free cut — click anywhere on a clip to split there"
                onClick={() => setCutSubMode('free')}
                style={{
                  background: cutSubMode === 'free' ? 'rgba(225,29,72,0.15)' : 'transparent',
                  border: `1px solid ${cutSubMode === 'free' ? 'rgba(225,29,72,0.55)' : 'var(--border-subtle)'}`,
                  borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cutSubMode === 'free' ? '#F43F5E' : 'var(--muted2)',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>|</span>
              </button>

              {/* GRID: multiple cut lines icon */}
              <button
                title="Grid cut — split clip into equal parts"
                onClick={() => setCutSubMode('grid')}
                style={{
                  background: cutSubMode === 'grid' ? 'rgba(225,29,72,0.15)' : 'transparent',
                  border: `1px solid ${cutSubMode === 'grid' ? 'rgba(225,29,72,0.55)' : 'var(--border-subtle)'}`,
                  borderRadius: 4, padding: '2px 5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cutSubMode === 'grid' ? '#F43F5E' : 'var(--muted2)',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 900, lineHeight: 1, letterSpacing: 1 }}>|||</span>
              </button>

              {/* Parts stepper — only visible in grid sub-mode */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  overflow: 'hidden',
                  maxWidth: cutSubMode === 'grid' ? 70 : 0,
                  opacity: cutSubMode === 'grid' ? 1 : 0,
                  transition: 'max-width 180ms ease, opacity 140ms ease',
                  marginLeft: cutSubMode === 'grid' ? 2 : 0,
                }}
              >
                <button onClick={stepCutDown} disabled={currentCutIdx <= 0}
                  style={{ background: 'transparent', border: 'none', cursor: currentCutIdx > 0 ? 'pointer' : 'not-allowed',
                    color: 'var(--muted2)', opacity: currentCutIdx > 0 ? 0.9 : 0.25, padding: '2px 1px', display: 'flex' }}
                  title="Fewer parts"
                >
                  <ChevronDown size={11} />
                </button>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F43F5E', minWidth: 22, textAlign: 'center', userSelect: 'none' }}>
                  {cutGridParts}
                </span>
                <button onClick={stepCutUp} disabled={currentCutIdx >= GRID_VALUES.length - 1}
                  style={{ background: 'transparent', border: 'none', cursor: currentCutIdx < GRID_VALUES.length - 1 ? 'pointer' : 'not-allowed',
                    color: 'var(--muted2)', opacity: currentCutIdx < GRID_VALUES.length - 1 ? 0.9 : 0.25, padding: '2px 1px', display: 'flex' }}
                  title="More parts"
                >
                  <ChevronUp size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Resize toggle — only active in selection mode */}
          <button
            title={resizeEnabled ? 'Resize ON — click to disable' : 'Resize OFF — click to enable (Selection mode only)'}
            disabled={timelineMode !== 'selection'}
            onClick={() => setResizeEnabled(!resizeEnabled)}
            className="flex items-center gap-1 rounded text-xs cursor-pointer transition-all duration-150"
            style={{
              padding: '2px 6px',
              border: `1px solid ${resizeEnabled ? 'rgba(225,29,72,0.6)' : 'var(--border-subtle)'}`,
              background: resizeEnabled ? 'rgba(225,29,72,0.1)' : 'transparent',
              color: timelineMode !== 'selection' ? 'var(--muted-subtle)' : resizeEnabled ? '#F43F5E' : 'var(--muted2)',
              opacity: timelineMode !== 'selection' ? 0.4 : 1,
              cursor: timelineMode !== 'selection' ? 'not-allowed' : 'pointer',
            }}
          >
            <ArrowLeftRight size={9} />
          </button>
          <input
            type="range" min={0.5} max={5} step={0.1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: 72, accentColor: '#E11D48', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Scrollable tracks */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <TimeRuler trackLabelWidth={TRACK_LABEL_WIDTH} zoom={zoom} />
        <div style={{ position: 'relative' }}>
          {/* Playhead line — fully draggable in playhead mode */}
          <div
            onMouseDown={handlePlayheadMouseDown}
            onMouseEnter={() => setPlayheadHovered(true)}
            onMouseLeave={() => setPlayheadHovered(false)}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: playheadLeft,
              width: enlarged ? 3 : 1.5,
              background: enlarged ? 'rgba(228,29,72,0.9)' : '#E11D48',
              zIndex: 20,
              cursor: timelineMode === 'playhead' ? 'col-resize' : 'default',
              pointerEvents: timelineMode === 'playhead' ? 'auto' : 'none',
              transition: 'width 80ms, background 80ms',
            }}
          >
            {/* Triangle head */}
            <div
              style={{
                position: 'absolute',
                top: -2, left: enlarged ? -7 : -5,
                width: enlarged ? 16 : 12,
                height: enlarged ? 10 : 8,
                background: '#E11D48',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                borderRadius: 2,
                transition: 'all 100ms',
                pointerEvents: 'none',
              }}
            />
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
                {track.type === 'subtitle' && <TextTrack zoom={zoom} trackLabelWidth={0} trackId={track.id} />}
                {track.type === 'adjustment' && <AdjustmentTrack zoom={zoom} trackLabelWidth={0} trackId={track.id} />}
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

function ModeBtn({ children, active, title, onClick }: { children: React.ReactNode; active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active ? 'rgba(225,29,72,0.15)' : 'transparent',
        border: `1px solid ${active ? 'rgba(225,29,72,0.5)' : 'var(--border-subtle)'}`,
        color: active ? '#F43F5E' : 'var(--muted2)',
        cursor: 'pointer', padding: '2px 5px', borderRadius: 4, lineHeight: 1,
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  )
}
