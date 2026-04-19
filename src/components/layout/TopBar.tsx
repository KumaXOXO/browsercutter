// src/components/layout/TopBar.tsx
import { useState, useEffect } from 'react'
import { Undo2, Redo2, Save } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import ExportModal from '../export/ExportModal'

const SAVE_KEY = 'browsercutter_project'

function saveProject() {
  const { projectName, projectSettings, segments, textOverlays, bpmConfig, transitions, adjustmentLayers } = useAppStore.getState()
  const data = { projectName, projectSettings, segments, textOverlays, bpmConfig, transitions, adjustmentLayers, savedAt: Date.now() }
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

export default function TopBar() {
  const { projectName, setProjectName, undo, redo, canUndo, canRedo } = useAppStore()
  const [saved, setSaved] = useState(false)
  const [showExport, setShowExport] = useState(false)

  function handleSave() {
    saveProject()
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); handleSave() }
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex items-center justify-between px-3 border-b shrink-0"
      style={{ height: 48, background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Left: logo + project name */}
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="font-bold text-sm tracking-tight" style={{ background: 'linear-gradient(90deg,#EEEEF8,#A8A8C8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          BrowserCutter
        </span>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent border-b border-transparent text-sm outline-none transition-all duration-150 px-1 rounded"
          style={{ color: 'var(--muted2)', width: 180 }}
          onFocus={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onBlur={(e)  => { e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.background = 'transparent' }}
        />
      </div>

      {/* Center: version */}
      <span className="text-xs font-mono" style={{ color: 'var(--muted-subtle)' }}>
        v{__APP_VERSION__}
      </span>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo()}><Undo2 size={14} /></IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo()}><Redo2 size={14} /></IconBtn>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
        <GhostBtn onClick={handleSave}>
          <Save size={13} />
          {saved ? 'Saved!' : 'Save'}
        </GhostBtn>
        <PrimaryBtn onClick={() => setShowExport(true)}>
          Export Video
        </PrimaryBtn>
      </div>
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  )
}

function Logo() {
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#E11D48,#9C1EAB)', boxShadow: '0 4px 12px rgba(225,29,72,0.4)' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/>
        <line x1="6" y1="8.5" x2="6" y2="21"/><line x1="18" y1="3" x2="18" y2="15.5"/>
        <line x1="6" y1="14" x2="18" y2="10"/>
      </svg>
    </div>
  )
}

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded-md transition-all duration-150"
      style={{ width: 28, height: 28, color: 'var(--muted2)', background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)' }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer"
      style={{ padding: '6px 12px', color: 'var(--muted2)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg text-sm font-semibold text-white cursor-pointer transition-all duration-200"
      style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none', boxShadow: '0 4px 14px rgba(225,29,72,0.35)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(225,29,72,0.5)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(225,29,72,0.35)' }}
      onMouseDown={(e)  => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={(e)    => { e.currentTarget.style.transform = 'translateY(-1px)' }}
    >
      {children}
    </button>
  )
}
