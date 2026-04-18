// src/components/timeline/TimeRuler.tsx
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
  const { setPlayheadPosition, setIsPlaying } = useAppStore()
  const markWidth = PX_PER_SEC * zoom * INTERVAL_SEC
  const markCount = Math.ceil(700 / markWidth) + 2
  const marks = Array.from({ length: markCount }, (_, i) => i * INTERVAL_SEC)

  return (
    <div
      className="flex sticky top-0 z-10 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', userSelect: 'none' }}
    >
      <div style={{ minWidth: trackLabelWidth, width: trackLabelWidth }} />
      <div
        className="flex"
        style={{ color: '#35354A', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          setIsPlaying(false)
          setPlayheadPosition(Math.max(0, x / (PX_PER_SEC * zoom)))
        }}
      >
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
