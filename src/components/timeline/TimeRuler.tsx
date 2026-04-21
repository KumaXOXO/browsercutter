// src/components/timeline/TimeRuler.tsx
import { useRef, useMemo } from 'react'
import { PX_PER_SEC } from './ClipBlock'
import { useAppStore } from '../../store/useAppStore'

const INTERVAL_SEC = 5

export default function TimeRuler({
  trackLabelWidth,
  zoom,
}: {
  trackLabelWidth: number
  zoom: number
}) {
  const { setPlayheadPosition, setIsPlaying, loopRegion, setLoopRegion, segments } = useAppStore()
  const px = PX_PER_SEC * zoom
  const markWidth = px * INTERVAL_SEC

  const marks = useMemo(() => {
    const dur = Math.max(
      60,
      segments.reduce((max, s) =>
        Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1)),
        0,
      ) + 30,
    )
    const count = Math.ceil(dur / INTERVAL_SEC) + 2
    return Array.from({ length: count }, (_, i) => i * INTERVAL_SEC)
  }, [segments])

  const loopDragStartXRef = useRef(0)

  function xToSec(x: number) {
    return Math.max(0, x / px)
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left

    if (e.shiftKey) {
      e.preventDefault()
      // Start drawing a new loop region
      loopDragStartXRef.current = x
      const sec = xToSec(x)
      setLoopRegion({ start: sec, end: sec })

      const onMove = (ev: MouseEvent) => {
        const nx = ev.clientX - rect.left
        const ns = xToSec(nx)
        const a = xToSec(loopDragStartXRef.current)
        setLoopRegion({ start: Math.min(a, ns), end: Math.max(a, ns) })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      return
    }

    // Check if we're clicking on loop region edges to resize
    if (loopRegion) {
      const leftEdgePx = loopRegion.start * px
      const rightEdgePx = loopRegion.end * px
      if (Math.abs(x - leftEdgePx) <= 6) {
        // Drag left edge
        const onMove = (ev: MouseEvent) => {
          const nx = ev.clientX - rect.left
          const ns = Math.max(0, Math.min(loopRegion.end - 0.1, xToSec(nx)))
          setLoopRegion({ start: ns, end: loopRegion.end })
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return
      }
      if (Math.abs(x - rightEdgePx) <= 6) {
        // Drag right edge
        const onMove = (ev: MouseEvent) => {
          const nx = ev.clientX - rect.left
          const ns = Math.max(loopRegion.start + 0.1, xToSec(nx))
          setLoopRegion({ start: loopRegion.start, end: ns })
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return
      }
    }

    // Regular seek click
    setIsPlaying(false)
    setPlayheadPosition(xToSec(x))
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (loopRegion) {
      setLoopRegion(null)
      e.stopPropagation()
    }
  }

  const loopLeft = loopRegion ? loopRegion.start * px : 0
  const loopWidth = loopRegion ? (loopRegion.end - loopRegion.start) * px : 0

  return (
    <div
      className="flex sticky top-0 z-10 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', userSelect: 'none', position: 'relative' }}
    >
      <div style={{ minWidth: trackLabelWidth, width: trackLabelWidth }} />
      <div
        className="flex"
        style={{ color: '#35354A', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', position: 'relative' }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Loop region highlight */}
        {loopRegion && loopWidth > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: loopLeft, width: loopWidth,
              background: 'rgba(225,29,72,0.2)',
              borderLeft: '2px solid #E11D48',
              borderRight: '2px solid #E11D48',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
        {marks.map((s) => (
          <span
            key={s}
            style={{ minWidth: markWidth, width: markWidth, paddingLeft: 4, paddingTop: 4, paddingBottom: 4 }}
          >
            {`0:${String(s).padStart(2, '0')}`}
          </span>
        ))}
      </div>
    </div>
  )
}
