// src/components/panels/TextPanel.tsx
import { Type, FileText, Type as FontIcon } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../../store/useAppStore'
import { parseSrt } from '../../lib/srt/parseSrt'
import { loadCustomFont } from '../../lib/fontManager'

export default function TextPanel() {
  const { addTextOverlay, setSelectedElement, playheadPosition, addFont } = useAppStore()

  function handleAddText() {
    const id = uuidv4()
    addTextOverlay({
      id,
      text: 'New Text',
      startOnTimeline: playheadPosition,
      duration: 3,
      font: 'Inter',
      size: 32,
      color: '#FFFFFF',
      x: 0.5,
      y: 0.85,
    })
    setSelectedElement({ type: 'text', id })
  }

  async function handleUploadFont() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ttf,.otf,.woff,.woff2'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const result = await loadCustomFont(file, addFont)
      if (!result.ok) alert(`Font load failed: ${result.error}`)
    }
    input.click()
  }

  async function handleImportSrt() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.srt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const overlays = parseSrt(text)
      overlays.forEach(addTextOverlay)
    }
    input.click()
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Text &amp; Subtitles</PanelLabel>
      <GhostAction icon={<Type size={13} />} label="Add Text Overlay" onClick={handleAddText} />
      <GhostAction icon={<FileText size={13} />} label="Import .srt File" onClick={handleImportSrt} />
      <GhostAction icon={<FontIcon size={13} />} label="Upload Custom Font" onClick={handleUploadFont} />
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>No text or subtitles added yet.</p>
    </div>
  )
}

function GhostAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 w-full rounded-lg text-sm transition-all duration-150 cursor-pointer"
      style={{ padding: '10px 12px', color: 'var(--muted2)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'var(--muted2)' }}
    >
      {icon} {label}
    </button>
  )
}

export function PanelLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-subtle)' }}>{children}</p>
}
