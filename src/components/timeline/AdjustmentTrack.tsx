// src/components/timeline/AdjustmentTrack.tsx
import { Wand2 } from 'lucide-react'
import AdjustmentLayerBlock from './AdjustmentLayerBlock'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

interface Props {
  zoom: number
  trackLabelWidth: number
}

export default function AdjustmentTrack({ zoom, trackLabelWidth }: Props) {
  const adjustmentLayers = useAppStore((s) => s.adjustmentLayers)

  const totalWidth = Math.max(
    600,
    adjustmentLayers.reduce((max, l) => Math.max(max, (l.startOnTimeline + l.duration) * PX_PER_SEC * zoom), 0) + 120,
  )

  return (
    <div className="flex shrink-0" style={{ height: 30 }}>
      {/* Label */}
      <div
        className="flex items-center gap-1.5 shrink-0"
        style={{
          width: trackLabelWidth,
          padding: '0 8px',
          borderRight: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
        }}
      >
        <Wand2 size={9} style={{ color: 'rgba(239,68,68,0.7)', flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-subtle)', textTransform: 'uppercase', letterSpacing: 0.5 }}>FX</span>
      </div>

      {/* Track content */}
      <div
        className="relative flex-1"
        style={{
          minWidth: totalWidth,
          background: 'rgba(239,68,68,0.03)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {adjustmentLayers.map((layer) => (
          <AdjustmentLayerBlock key={layer.id} layer={layer} zoom={zoom} />
        ))}
      </div>
    </div>
  )
}
