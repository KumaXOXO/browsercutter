// src/components/preview/TextOverlayRenderer.tsx
import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'

export default function TextOverlayRenderer() {
  const textOverlays = useAppStore((s) => s.textOverlays)
  const playheadPosition = useAppStore((s) => s.playheadPosition)
  const selectedElement = useAppStore((s) => s.selectedElement)
  const updateTextOverlay = useAppStore((s) => s.updateTextOverlay)
  const setSelectedElement = useAppStore((s) => s.setSelectedElement)

  const active = useMemo(
    () => textOverlays.filter(
      (o) => playheadPosition >= o.startOnTimeline &&
             playheadPosition < o.startOnTimeline + o.duration
    ),
    [textOverlays, playheadPosition],
  )

  if (active.length === 0) return null

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedElement({ type: 'text', id })

    const parent = (e.currentTarget as HTMLElement).parentElement!
    const rect = parent.getBoundingClientRect()

    const onMove = (ev: PointerEvent) => {
      const newX = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const newY = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height))
      updateTextOverlay(id, { x: newX, y: newY })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string, currentSize: number) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const startSize = currentSize

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const newSize = Math.max(8, Math.min(200, Math.round(startSize + (dx + dy) / 2)))
      updateTextOverlay(id, { size: newSize })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <>
      {active.map((overlay) => {
        const isSelected = selectedElement?.id === overlay.id
        return (
          <div
            key={overlay.id}
            onPointerDown={(e) => handlePointerDown(e, overlay.id)}
            style={{
              position: 'absolute',
              left: `${overlay.x * 100}%`,
              top: `${overlay.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: overlay.color,
              fontSize: `${overlay.size}px`,
              fontFamily: overlay.font,
              fontWeight: 700,
              pointerEvents: 'auto',
              cursor: 'move',
              textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
              whiteSpace: 'pre-wrap',
              textAlign: 'center',
              maxWidth: '80%',
              lineHeight: 1.25,
              zIndex: 10,
              userSelect: 'none',
              outline: isSelected ? '1px dashed rgba(255,255,255,0.5)' : 'none',
              outlineOffset: 4,
            }}
          >
            {overlay.text}
            {isSelected && (
              <div
                onPointerDown={(e) => handleResizePointerDown(e, overlay.id, overlay.size)}
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 10,
                  height: 10,
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.4)',
                  borderRadius: 2,
                  cursor: 'se-resize',
                  zIndex: 11,
                }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
