// src/components/preview/TextOverlayRenderer.tsx
import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'

export default function TextOverlayRenderer() {
  const textOverlays = useAppStore((s) => s.textOverlays)
  const playheadPosition = useAppStore((s) => s.playheadPosition)

  const active = useMemo(
    () => textOverlays.filter(
      (o) => playheadPosition >= o.startOnTimeline &&
             playheadPosition < o.startOnTimeline + o.duration
    ),
    [textOverlays, playheadPosition],
  )

  if (active.length === 0) return null

  return (
    <>
      {active.map((overlay) => (
        <div
          key={overlay.id}
          style={{
            position: 'absolute',
            left: `${overlay.x * 100}%`,
            top: `${overlay.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            color: overlay.color,
            fontSize: `${overlay.size}px`,
            fontFamily: overlay.font,
            fontWeight: 700,
            pointerEvents: 'none',
            textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            maxWidth: '80%',
            lineHeight: 1.25,
            zIndex: 10,
          }}
        >
          {overlay.text}
        </div>
      ))}
    </>
  )
}
