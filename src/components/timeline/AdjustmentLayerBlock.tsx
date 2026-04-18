// src/components/timeline/AdjustmentLayerBlock.tsx
import { useEffect, useRef } from 'react'
import { Wand2 } from 'lucide-react'
import type { AdjustmentLayer } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

interface Props {
  layer: AdjustmentLayer
  zoom: number
}

export default function AdjustmentLayerBlock({ layer, zoom }: Props) {
  const { selectedElement, setSelectedElement, removeAdjustmentLayer, updateAdjustmentLayer } = useAppStore()
  const isSelected = selectedElement?.id === layer.id
  const px = PX_PER_SEC * zoom
  const left = layer.startOnTimeline * px
  const width = layer.duration * px

  const layerRef = useRef(layer)
  layerRef.current = layer

  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedElement(null)
        removeAdjustmentLayer(layer.id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, layer.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement({ type: 'adjustment', id: layer.id })

    const trackContent = (e.currentTarget as HTMLElement).parentElement!
    const trackRect = trackContent.getBoundingClientRect()
    const offsetX = e.clientX - trackRect.left - left

    const handleMouseMove = (ev: MouseEvent) => {
      const newStart = Math.max(0, (ev.clientX - trackRect.left - offsetX) / px)
      updateAdjustmentLayer(layer.id, { startOnTimeline: newStart })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const initialDuration = layerRef.current.duration

    const handleMouseMove = (ev: MouseEvent) => {
      const dSec = (ev.clientX - startX) / px
      updateAdjustmentLayer(layer.id, { duration: Math.max(0.5, initialDuration + dSec) })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleBodyMouseDown}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: 'linear-gradient(135deg,rgba(239,68,68,0.25),rgba(239,68,68,0.15))',
        border: `1px solid ${isSelected ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.4)'}`,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: isSelected ? '2px solid rgba(239,68,68,0.6)' : 'none',
        outlineOffset: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', pointerEvents: 'none' }}>
        <Wand2 size={10} color="rgba(239,68,68,0.9)" />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.9)', whiteSpace: 'nowrap' }}>
          ADJ
        </span>
      </div>
      <div
        onMouseDown={handleRightTrimMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', zIndex: 2,
          background: 'rgba(239,68,68,0.3)',
          borderRadius: '0 5px 5px 0',
        }}
      />
    </div>
  )
}
