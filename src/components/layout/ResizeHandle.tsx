// src/components/layout/ResizeHandle.tsx
// Shared vertical resize handle. Horizontal resize (left panel) will reuse this in Phase 10.

interface Props {
  onDragStart: () => void
  onResize: (dy: number) => void
  onDragEnd: () => void
}

export default function ResizeHandle({ onDragStart, onResize, onDragEnd }: Props) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onDragStart()
    const startY = e.clientY
    const onMove = (ev: MouseEvent) => onResize(ev.clientY - startY)
    const onUp = () => {
      onDragEnd()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        height: 4,
        cursor: 'ns-resize',
        background: 'var(--border-subtle)',
        flexShrink: 0,
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(225,29,72,0.5)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-subtle)' }}
    />
  )
}
