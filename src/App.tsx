// src/App.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Segment } from './types'
import TopBar from './components/layout/TopBar'
import IconSidebar from './components/layout/IconSidebar'
import LeftPanel from './components/layout/LeftPanel'
import VideoPreview from './components/preview/VideoPreview'
import PlaybackControls from './components/preview/PlaybackControls'
import ResizeHandle from './components/layout/ResizeHandle'
import Timeline from './components/timeline/Timeline'
import RightPanel from './components/layout/RightPanel'
import { useAppStore } from './store/useAppStore'

const MIN_TIMELINE_HEIGHT = 120
const MAX_TIMELINE_HEIGHT = 500
const DEFAULT_TIMELINE_HEIGHT = 205

const MIN_LEFT_WIDTH = 160
const MAX_LEFT_WIDTH = 400
const DEFAULT_LEFT_WIDTH = 284

export default function App() {
  const { projectSettings, activeTab } = useAppStore()
  const fullWidth = projectSettings.fullWidthTimeline ?? true
  const showRightPanel = activeTab === 'effects'

  const [timelineHeight, setTimelineHeight] = useState(
    () => Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, Number(localStorage.getItem('bc:timeline:height')) || DEFAULT_TIMELINE_HEIGHT)),
  )
  const [leftPanelWidth, setLeftPanelWidth] = useState(
    () => Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, Number(localStorage.getItem('bc:leftpanel:width')) || DEFAULT_LEFT_WIDTH)),
  )
  const [isDragging, setIsDragging] = useState(false)
  const startTimelineHeightRef = useRef(DEFAULT_TIMELINE_HEIGHT)
  const startLeftWidthRef = useRef(DEFAULT_LEFT_WIDTH)
  const clipboardRef = useRef<Segment[]>([])

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('bc:timeline:height', String(timelineHeight)), 300)
    return () => clearTimeout(t)
  }, [timelineHeight])

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('bc:leftpanel:width', String(leftPanelWidth)), 300)
    return () => clearTimeout(t)
  }, [leftPanelWidth])

  const handleCopyPaste = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (!(e.ctrlKey || e.metaKey)) return
    const { segments, selectedSegmentIds, selectedElement, addSegments } = useAppStore.getState()
    if (e.key === 'c' || e.key === 'C') {
      const ids = selectedSegmentIds.length > 0
        ? selectedSegmentIds
        : selectedElement?.type === 'segment' ? [selectedElement.id] : []
      if (ids.length === 0) return
      clipboardRef.current = segments.filter((s) => ids.includes(s.id))
      e.preventDefault()
    } else if (e.key === 'v' || e.key === 'V') {
      if (clipboardRef.current.length === 0) return
      e.preventDefault()
      addSegments(clipboardRef.current.map((s) => ({ ...s, id: crypto.randomUUID(), startOnTimeline: s.startOnTimeline + 1 })))
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleCopyPaste)
    return () => document.removeEventListener('keydown', handleCopyPaste)
  }, [handleCopyPaste])

  const resizeHandle = (
    <ResizeHandle
      onDragStart={() => { setIsDragging(true); startTimelineHeightRef.current = timelineHeight }}
      onResize={(dy) => {
        const next = Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, startTimelineHeightRef.current - dy))
        setTimelineHeight(next)
      }}
      onDragEnd={() => setIsDragging(false)}
    />
  )

  const timeline = <Timeline height={timelineHeight} isDragging={isDragging} />

  const leftPanelProps = {
    width: leftPanelWidth,
    onResizeStart: () => { startLeftWidthRef.current = leftPanelWidth },
    onResize: (dx: number) => {
      const next = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, startLeftWidthRef.current + dx))
      setLeftPanelWidth(next)
    },
  }

  if (fullWidth) {
    return (
      <div className="flex flex-col" style={{ height: '100vh' }}>
        <TopBar />
        <div className="flex overflow-hidden" style={{ flex: '1 1 0', minHeight: 0 }}>
          <IconSidebar />
          <LeftPanel {...leftPanelProps} />
          <div className="flex flex-col overflow-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
            <VideoPreview />
            <PlaybackControls />
          </div>
          {showRightPanel && <RightPanel />}
        </div>
        {resizeHandle}
        {timeline}
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar />
        <LeftPanel {...leftPanelProps} />
        <div className="flex flex-col overflow-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
          <VideoPreview />
          <PlaybackControls />
          {resizeHandle}
          {timeline}
        </div>
        {showRightPanel && <RightPanel />}
      </div>
    </div>
  )
}
