// src/components/timeline/TextTrack.tsx
import { Type } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

interface Props {
  zoom: number
  trackLabelWidth: number
}

export default function TextTrack({ zoom, trackLabelWidth }: Props) {
  const { textOverlays, selectedElement, setSelectedElement } = useAppStore()
  const px = PX_PER_SEC * zoom

  const totalWidth = Math.max(
    700,
    textOverlays.reduce((max, o) => Math.max(max, (o.startOnTimeline + o.duration) * px), 0) + 300,
  )

  return (
    <div
      className="flex items-center"
      style={{ height: 26, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div
        className="flex items-center gap-1 px-2 shrink-0"
        style={{ minWidth: trackLabelWidth, width: trackLabelWidth, fontSize: 10, color: 'var(--muted-subtle)' }}
      >
        <Type size={9} /> Text
      </div>
      <div className="relative h-full" style={{ width: totalWidth }}>
        {textOverlays.map((overlay) => {
          const left = overlay.startOnTimeline * px
          const width = Math.max(4, overlay.duration * px)
          const isSelected = selectedElement?.id === overlay.id
          return (
            <div
              key={overlay.id}
              onClick={() => setSelectedElement({ type: 'text', id: overlay.id })}
              style={{
                position: 'absolute',
                top: 3, bottom: 3,
                left, width,
                borderRadius: 4,
                background: 'rgba(234,179,8,0.18)',
                border: isSelected
                  ? '2px solid rgba(255,255,255,0.9)'
                  : '1px solid rgba(234,179,8,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                transition: 'filter 120ms',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, color: '#FDE68A', padding: '0 5px', whiteSpace: 'nowrap' }}>
                T {overlay.text.slice(0, 14)}{overlay.text.length > 14 ? '…' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
