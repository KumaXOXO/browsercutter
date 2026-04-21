// src/components/layout/ResizeHandle.tsx

interface Props {
  onDragStart: () => void
  onResize: (delta: number) => void
  onDragEnd: () => void
  axis?: 'vertical' | 'horizontal'
}

export default function ResizeHandle({ onDragStart, onResize, onDragEnd, axis = 'vertical' }: Props) {
  const isHorizontal = axis === 'horizontal'

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onDragStart()
    const startPos = isHorizontal ? e.clientX : e.clientY
    const onMove = (ev: MouseEvent) => onResize((isHorizontal ? ev.clientX : ev.clientY) - startPos)
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
        ...(isHorizontal
          ? { width: 4, cursor: 'col-resize', height: '100%' }
          : { height: 4, cursor: 'ns-resize', width: '100%' }),
        background: 'var(--border-subtle)',
        flexShrink: 0,
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(225,29,72,0.5)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-subtle)' }}
    />
  )
}
