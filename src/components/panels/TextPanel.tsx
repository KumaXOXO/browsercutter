// src/components/panels/TextPanel.tsx
import { Type, FileText } from 'lucide-react'

export default function TextPanel() {
  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Text &amp; Subtitles</PanelLabel>
      <GhostAction icon={<Type size={13} />} label="Add Text Overlay" onClick={() => alert('Phase 2')} />
      <GhostAction icon={<FileText size={13} />} label="Import .srt File" onClick={() => alert('Phase 2')} />
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
