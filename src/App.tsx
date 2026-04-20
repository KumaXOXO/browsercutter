// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import TopBar from './components/layout/TopBar'
import IconSidebar from './components/layout/IconSidebar'
import LeftPanel from './components/layout/LeftPanel'
import VideoPreview from './components/preview/VideoPreview'
import PlaybackControls from './components/preview/PlaybackControls'
import ResizeHandle from './components/layout/ResizeHandle'
import Timeline from './components/timeline/Timeline'

const MIN_HEIGHT = 120
const MAX_HEIGHT = 500
const DEFAULT_HEIGHT = 205

export default function App() {
  const [timelineHeight, setTimelineHeight] = useState(
    () => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(localStorage.getItem('bc:timeline:height')) || DEFAULT_HEIGHT)),
  )
  const [isDragging, setIsDragging] = useState(false)
  const startHeightRef = useRef(DEFAULT_HEIGHT)

  // Debounced localStorage write — 300ms to avoid 60 writes/sec during drag
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('bc:timeline:height', String(timelineHeight)), 300)
    return () => clearTimeout(t)
  }, [timelineHeight])

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar />
        <LeftPanel />
        <div className="flex flex-col flex-1 overflow-hidden">
          <VideoPreview />
          <PlaybackControls />
          <ResizeHandle
            onDragStart={() => { setIsDragging(true); startHeightRef.current = timelineHeight }}
            onResize={(dy) => {
              const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current - dy))
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
