// src/components/layout/LeftPanel.tsx
import { useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import MediaPanel from '../panels/MediaPanel/MediaPanel'
import TextPanel from '../panels/TextPanel'
import TransitionsPanel from '../panels/TransitionsPanel'
import BpmPanel from '../panels/BpmPanel'
import SettingsPanel from '../panels/SettingsPanel'
import InspectorPanel from '../panels/InspectorPanel'

interface Props {
  width: number
  onResizeStart: () => void
  onResize: (dx: number) => void
}

export default function LeftPanel({ width, onResizeStart, onResize }: Props) {
  const { activeTab } = useAppStore()
  const startXRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    onResizeStart()
    const onMove = (ev: MouseEvent) => onResize(ev.clientX - startXRef.current)
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="flex border-r overflow-hidden shrink-0"
      style={{ width, background: 'var(--surface)', borderColor: 'var(--border-subtle)', position: 'relative' }}
    >
      <div className="flex flex-col overflow-hidden" style={{ flex: 1, minWidth: 0 }}>
        {activeTab === 'media'       && <MediaPanel />}
        {activeTab === 'text'        && <TextPanel />}
        {activeTab === 'effects'     && <InspectorPanel />}
        {activeTab === 'transitions' && <TransitionsPanel />}
        {activeTab === 'bpm'         && <BpmPanel />}
        {activeTab === 'settings'    && <SettingsPanel />}
        {activeTab === 'inspector'   && <InspectorPanel />}
      </div>
      {/* Right-edge horizontal resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
          cursor: 'col-resize', background: 'transparent', zIndex: 10,
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(225,29,72,0.5)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      />
    </div>
  )
}
