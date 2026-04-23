// src/components/timeline/ClipBlock.tsx
import { useEffect, useRef, useState } from 'react'
import type { Segment, Clip, EffectType, TransitionType } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { EFFECT_DEFAULTS } from '../../lib/effectDefs'
import ThumbnailLayer from './ThumbnailLayer'
import WaveformCanvas from './WaveformCanvas'

const CLIP_GRADIENTS = [
  'linear-gradient(135deg,#5B21B6,#7C3AED)',
  'linear-gradient(135deg,#0C5F78,#0891B2)',
  'linear-gradient(135deg,#065F46,#059669)',
]

const AUDIO_GRADIENT = 'linear-gradient(135deg,#1A4A2A,#2E7040)'

const PX_PER_SEC = 20

interface Props {
  segment: Segment
  clip: Clip
  zoom: number
}

const TRANSITION_SYMBOLS: Record<string, string> = {
  dissolve: '◈', wipe: '|→', slide: '↗', zoom: '⊕', fade: 'A→B',
}

export default function ClipBlock({ segment, clip, zoom }: Props) {
  const { selectedElement, setSelectedElement, updateSegment, updateSegmentLive, updateSegmentsLive, pushHistory, splitSegment, addTransition, removeTransition, projectSettings, transitions, selectedSegmentIds, setSelectedSegmentIds, toggleSegmentSelection, segments, timelineMode, resizeEnabled, playheadPosition } = useAppStore()
  const showThumbnails = projectSettings.showClipThumbnails ?? false
  const transitionAfter = transitions.find((t) => t.beforeSegmentId === segment.id && t.type !== 'cut')
  const isSelected = selectedElement?.id === segment.id
  const isMultiSelected = selectedSegmentIds.includes(segment.id)
  const px = PX_PER_SEC * zoom
  const left  = segment.startOnTimeline * px
  const width = (segment.outPoint - segment.inPoint) / Math.max(0.01, segment.speed ?? 1) * px

  const [hovered, setHovered] = useState(false)

  const bgIndex = clip.id.charCodeAt(0) % CLIP_GRADIENTS.length
  const bg = clip.type === 'audio' ? AUDIO_GRADIENT : CLIP_GRADIENTS[bgIndex]
  const label = clip.name.replace(/\.[^.]+$/, '').slice(0, 4).toUpperCase()

  const segRef = useRef(segment)
  segRef.current = segment

  // Delete / H / M keyboard shortcuts when selected
  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (selectedElement?.type !== 'segment') return
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        updateSegment(segment.id, { hidden: !segRef.current.hidden })
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        updateSegment(segment.id, { muted: !segRef.current.muted })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, segment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move drag: mousedown on body
  const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineMode === 'playhead') return  // let event bubble to track for playhead jump

    e.stopPropagation()

    if (timelineMode === 'cut') {
      splitSegment(segment.id, playheadPosition)
      return
    }

    if (e.ctrlKey || e.metaKey) {
      toggleSegmentSelection(segment.id)
      return
    }

    if (e.shiftKey) {
      // Shift+click: range select across all tracks between anchor and this clip
      const anchorId = selectedElement?.id ?? selectedSegmentIds[selectedSegmentIds.length - 1]
      const anchor = segments.find((s) => s.id === anchorId)
      if (anchor) {
        // Same track: range by position
        if (anchor.trackIndex === segment.trackIndex) {
          const trackSegs = segments
            .filter((s) => s.trackIndex === segment.trackIndex)
            .sort((a, b) => a.startOnTimeline - b.startOnTimeline)
          const aIdx = trackSegs.findIndex((s) => s.id === anchor.id)
          const bIdx = trackSegs.findIndex((s) => s.id === segment.id)
          const range = trackSegs.slice(Math.min(aIdx, bIdx), Math.max(aIdx, bIdx) + 1)
          setSelectedSegmentIds(range.map((s) => s.id))
          return
        }
        // Cross-track: select all clips between the two time positions across all tracks
        const minTime = Math.min(anchor.startOnTimeline, segment.startOnTimeline)
        const maxTime = Math.max(
          anchor.startOnTimeline + (anchor.outPoint - anchor.inPoint) / Math.max(0.01, anchor.speed ?? 1),
          segment.startOnTimeline + (segment.outPoint - segment.inPoint) / Math.max(0.01, segment.speed ?? 1),
        )
        const range = segments.filter((s) => s.startOnTimeline >= minTime && s.startOnTimeline < maxTime)
        setSelectedSegmentIds(range.map((s) => s.id))
        return
      }
      toggleSegmentSelection(segment.id)
      return
    }

    // Normal click: single select and drag (with cross-timeline track detection)
    const multiIds = selectedSegmentIds.includes(segment.id) ? selectedSegmentIds : [segment.id]
    setSelectedElement({ type: 'segment', id: segment.id })
    setSelectedSegmentIds([])

    // Push one undo snapshot before drag begins (not inside mousemove to avoid flooding)
    pushHistory()

    const trackContent = (e.currentTarget as HTMLElement).parentElement!
    const trackRect = trackContent.getBoundingClientRect()
    const scrollContainer = trackContent.closest('.overflow-auto') as HTMLElement | null
    const scrollLeft = scrollContainer?.scrollLeft ?? 0
    const offsetX = e.clientX - trackRect.left + scrollLeft - left
    const startPositions = Object.fromEntries(
      segments.filter((s) => multiIds.includes(s.id)).map((s) => [s.id, s.startOnTimeline])
    )

    // Set pointer-events:none on this element so elementsFromPoint can see tracks below
    const dragEl = e.currentTarget as HTMLElement
    dragEl.style.pointerEvents = 'none'

    const handleMouseMove = (ev: MouseEvent) => {
      const curScroll = scrollContainer?.scrollLeft ?? 0
      const { projectSettings: ps, bpmConfig: bc } = useAppStore.getState()
      const beatDuration = ps.snapToBeat ? 60 / Math.max(1, bc.bpm) : 0
      // Snap to gridStep subdivisions (e.g. ¼ beat = beatDuration * 0.25)
      const snapUnit = beatDuration > 0 ? beatDuration * (bc.gridStep ?? 1) : 0
      const rawStart = Math.max(0, (ev.clientX - trackRect.left + curScroll - offsetX) / px)
      const newStart = snapUnit > 0 ? Math.round(rawStart / snapUnit) * snapUnit : rawStart
      const primaryDelta = newStart - (startPositions[segment.id] ?? segment.startOnTimeline)

      // Detect target track under cursor for cross-timeline drag
      const els = document.elementsFromPoint(ev.clientX, ev.clientY)
      const trackEl = els.find((el) => el instanceof HTMLElement && el.dataset.trackIndex !== undefined) as HTMLElement | undefined
      const targetTrackIndex = trackEl ? parseInt(trackEl.dataset.trackIndex!, 10) : null
      const targetTrackType = trackEl?.dataset.trackType ?? null
      document.dispatchEvent(new CustomEvent('bc:drag-track', { detail: targetTrackIndex !== null ? { trackIndex: targetTrackIndex, clipType: clip.type } : null }))

      if (multiIds.length > 1) {
        // Multi-select: only change startOnTimeline, preserve each clip's original track.
        // Prevents all clips from collapsing to one track on a simple click+move.
        const patches = multiIds.map((id) => ({
          id,
          patch: { startOnTimeline: Math.max(0, (startPositions[id] ?? 0) + primaryDelta) } as Partial<Segment>,
        }))
        updateSegmentsLive(patches)
      } else {
        const patchSingle: Partial<typeof segment> = { startOnTimeline: newStart }
        if (targetTrackIndex !== null && targetTrackType !== null) {
          if ((clip.type === 'video' || clip.type === 'image') && targetTrackType === 'video') {
            patchSingle.trackIndex = targetTrackIndex
          } else if (clip.type === 'audio' && targetTrackType === 'audio') {
            patchSingle.trackIndex = targetTrackIndex
          }
        }
        updateSegmentLive(segment.id, patchSingle)
      }
    }
    const handleMouseUp = () => {
      dragEl.style.pointerEvents = ''
      document.dispatchEvent(new CustomEvent<null>('bc:drag-track', { detail: null }))
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Left trim: changes inPoint + startOnTimeline together (right edge stays fixed)
  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    if (timelineMode !== 'selection' || !resizeEnabled) return
    e.stopPropagation()
    pushHistory()
    const startX = e.clientX
    const initialInPoint = segRef.current.inPoint
    const initialStart = segRef.current.startOnTimeline

    const handleMouseMove = (ev: MouseEvent) => {
      const { projectSettings: ps, bpmConfig: bc } = useAppStore.getState()
      const beatDuration = ps.snapToBeat ? 60 / Math.max(1, bc.bpm) : 0
      const snapUnit = beatDuration > 0 ? beatDuration * (bc.gridStep ?? 1) : 0
      const dSec = (ev.clientX - startX) / px
      let newInPoint = Math.max(0, Math.min(segRef.current.outPoint - 0.1, initialInPoint + dSec))
      if (snapUnit > 0) {
        // Snap startOnTimeline to grid, derive inPoint from that
        const rawStart = Math.max(0, initialStart + (newInPoint - initialInPoint))
        const snappedStart = Math.round(rawStart / snapUnit) * snapUnit
        newInPoint = Math.max(0, Math.min(segRef.current.outPoint - 0.1, initialInPoint + (snappedStart - initialStart)))
      }
      const delta = newInPoint - initialInPoint
      const newStart = Math.max(0, initialStart + delta)
      updateSegmentLive(segment.id, { inPoint: newInPoint, startOnTimeline: newStart })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Right trim: changes outPoint only (left edge stays fixed)
  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    if (timelineMode !== 'selection' || !resizeEnabled) return
    e.stopPropagation()
    pushHistory()
    const startX = e.clientX
    const initialOutPoint = segRef.current.outPoint

    const handleMouseMove = (ev: MouseEvent) => {
      const { projectSettings: ps, bpmConfig: bc } = useAppStore.getState()
      const beatDuration = ps.snapToBeat ? 60 / Math.max(1, bc.bpm) : 0
      const snapUnit = beatDuration > 0 ? beatDuration * (bc.gridStep ?? 1) : 0
      const dSec = (ev.clientX - startX) / px
      const maxOut = (clip.type === 'video' || clip.type === 'audio') ? clip.duration : Infinity
      let newOutPoint = Math.max(segRef.current.inPoint + 0.1, Math.min(maxOut, initialOutPoint + dSec))
      if (snapUnit > 0) {
        // Snap outPoint to the nearest grid position relative to segment start
        const outOnTimeline = segRef.current.startOnTimeline + (newOutPoint - segRef.current.inPoint) / Math.max(0.01, segRef.current.speed ?? 1)
        const snappedTimeline = Math.round(outOnTimeline / snapUnit) * snapUnit
        newOutPoint = Math.max(segRef.current.inPoint + 0.1, Math.min(maxOut,
          segRef.current.inPoint + (snappedTimeline - segRef.current.startOnTimeline) * Math.max(0.01, segRef.current.speed ?? 1)
        ))
      }
      updateSegmentLive(segment.id, { outPoint: newOutPoint })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleDragOver = (e: React.DragEvent) => {
    const hasEffect = e.dataTransfer.types.includes('effecttype')
    const hasTransition = e.dataTransfer.types.includes('transitiontype')
    if (hasEffect || hasTransition) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    const effectType = e.dataTransfer.getData('effectType') as EffectType | ''
    if (effectType) {
      e.preventDefault()
      e.stopPropagation()
      const existing = segment.effects ?? []
      if (!existing.find((ef) => ef.type === effectType)) {
        updateSegment(segment.id, { effects: [...existing, { type: effectType, value: EFFECT_DEFAULTS[effectType] }] })
      }
      // Select the segment and switch to effects tab so the RightPanel stays visible
      useAppStore.setState({ selectedElement: { type: 'segment', id: segment.id }, activeTab: 'effects', selectedSegmentIds: [] })
      return
    }

    const transitionType = e.dataTransfer.getData('transitionType') as TransitionType | ''
    if (transitionType) {
      e.preventDefault()
      e.stopPropagation()
      const trackSegs = [...segments.filter((s) => s.trackIndex === segment.trackIndex)]
        .sort((a, b) => a.startOnTimeline - b.startOnTimeline)
      const idx = trackSegs.findIndex((s) => s.id === segment.id)
      const nextSeg = trackSegs[idx + 1]
      if (!nextSeg) return
      const existing = transitions.find((t) => t.beforeSegmentId === segment.id && t.afterSegmentId === nextSeg.id)
      if (existing) removeTransition(existing.id)
      addTransition({
        id: crypto.randomUUID(),
        type: transitionType,
        beforeSegmentId: segment.id,
        afterSegmentId: nextSeg.id,
        duration: 0.5,
      })
    }
  }

  return (
    <div
      onMouseDown={handleBodyMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: bg,
        cursor: timelineMode === 'playhead' ? 'default' : timelineMode === 'cut' ? 'crosshair' : 'grab',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: (isSelected || isMultiSelected) ? '2px solid #F43F5E' : 'none',
        outlineOffset: 1,
        opacity: segment.hidden ? 0.4 : 1,
        filter: hovered && !isSelected ? 'brightness(1.2)' : undefined,
        transition: 'filter 120ms, opacity 120ms',
      }}
    >
      {/* Thumbnail layer — z-index 0, only for non-audio when enabled */}
      {showThumbnails && clip.type !== 'audio' && (
        <ThumbnailLayer clipId={clip.id} file={clip.file ?? null} inPoint={segment.inPoint} />
      )}

      {/* Waveform canvas — z-index 2, all clip types */}
      <WaveformCanvas clipId={clip.id} file={clip.file ?? null} />

      {/* Left trim handle — only shown when resize is enabled */}
      {timelineMode === 'selection' && resizeEnabled && (
        <div
          onMouseDown={handleLeftTrimMouseDown}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
            cursor: 'ew-resize', zIndex: 2,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: '5px 0 0 5px',
          }}
        />
      )}

      <span style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        padding: '0 12px', whiteSpace: 'nowrap', letterSpacing: 0.3,
        pointerEvents: 'none', zIndex: 1,
      }}>
        {label}
      </span>

      {/* Missing file badge — shown when clip has no file (after project load) */}
      {!clip.file && (
        <span title="File not linked — re-import in Media tab" style={{
          position: 'absolute', top: 3, right: 10,
          fontSize: 8, color: 'rgba(255,200,0,0.9)', pointerEvents: 'none', zIndex: 4,
          background: 'rgba(0,0,0,0.5)', padding: '1px 3px', borderRadius: 2,
        }}>
          !
        </span>
      )}
      {/* Mute badge — always visible when muted */}
      {segment.muted && (
        <span style={{
          position: 'absolute', top: 3, left: 12,
          fontSize: 9, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 3,
        }}>
          M
        </span>
      )}

      {/* Transition badge — bottom-right corner when transition is applied after this segment */}
      {transitionAfter && (
        <span
          title={`${transitionAfter.type} transition (${transitionAfter.duration.toFixed(1)}s)`}
          style={{
            position: 'absolute', bottom: 2, right: 10,
            fontSize: 8, color: 'rgba(255,255,255,0.75)',
            pointerEvents: 'none', zIndex: 4,
            fontFamily: 'monospace',
          }}
        >
          {TRANSITION_SYMBOLS[transitionAfter.type] ?? transitionAfter.type}
        </span>
      )}

      {/* Right trim handle — only shown when resize is enabled */}
      {timelineMode === 'selection' && resizeEnabled && (
        <div
          onMouseDown={handleRightTrimMouseDown}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
            cursor: 'ew-resize', zIndex: 2,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: '0 5px 5px 0',
          }}
        />
      )}
    </div>
  )
}

export { PX_PER_SEC }
