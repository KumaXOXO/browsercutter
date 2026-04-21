// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import TopBar from './components/layout/TopBar'
import IconSidebar from './components/layout/IconSidebar'
import LeftPanel from './components/layout/LeftPanel'
import VideoPreview from './components/preview/VideoPreview'
import PlaybackControls from './components/preview/PlaybackControls'
import ResizeHandle from './components/layout/ResizeHandle'
import Timeline from './components/timeline/Timeline'

const MIN_TIMELINE_HEIGHT = 120
const MAX_TIMELINE_HEIGHT = 500
const DEFAULT_TIMELINE_HEIGHT = 205

const MIN_LEFT_WIDTH = 160
const MAX_LEFT_WIDTH = 400
const DEFAULT_LEFT_WIDTH = 284

export default function App() {
  const [timelineHeight, setTimelineHeight] = useState(
    () => Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, Number(localStorage.getItem('bc:timeline:height')) || DEFAULT_TIMELINE_HEIGHT)),
  )
  const [leftPanelWidth, setLeftPanelWidth] = useState(
    () => Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, Number(localStorage.getItem('bc:leftpanel:width')) || DEFAULT_LEFT_WIDTH)),
  )
  const [isDragging, setIsDragging] = useState(false)
  const startTimelineHeightRef = useRef(DEFAULT_TIMELINE_HEIGHT)
  const startLeftWidthRef = useRef(DEFAULT_LEFT_WIDTH)

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('bc:timeline:height', String(timelineHeight)), 300)
    return () => clearTimeout(t)
  }, [timelineHeight])

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('bc:leftpanel:width', String(leftPanelWidth)), 300)
    return () => clearTimeout(t)
  }, [leftPanelWidth])

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar />
        <LeftPanel
          width={leftPanelWidth}
          onResizeStart={() => { startLeftWidthRef.current = leftPanelWidth }}
          onResize={(dx) => {
            const next = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, startLeftWidthRef.current + dx))
            setLeftPanelWidth(next)
          }}
        />
        <div className="flex flex-col overflow-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
          <VideoPreview />
          <PlaybackControls />
          <ResizeHandle
            onDragStart={() => { setIsDragging(true); startTimelineHeightRef.current = timelineHeight }}
            onResize={(dy) => {
              const next = Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, startTimelineHeightRef.current - dy))
              setTimelineHeight(next)
            }}
            onDragEnd={() => setIsDragging(false)}
          />
          <Timeline
            height={timelineHeight}
            isDragging={isDragging}
          />
        </div>
      </div>
    </div>
  )
}
