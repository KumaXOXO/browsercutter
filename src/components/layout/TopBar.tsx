// src/components/layout/TopBar.tsx
import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { Undo2, Redo2, Save, FolderOpen, HelpCircle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import ExportModal from '../export/ExportModal'
import ShortcutsModal from './ShortcutsModal'
import { saveProjectFile, hasSaveDir, getSaveDirName } from '../../lib/saveManager'

export function validateProjectJSON(json: unknown): { valid: true; data: Record<string, unknown> } | { valid: false; error: string } {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { valid: false, error: 'Invalid JSON structure' }
  }
  const obj = json as Record<string, unknown>
  if (!Array.isArray(obj.segments)) return { valid: false, error: 'Missing segments' }
  if (!Array.isArray(obj.clips)) return { valid: false, error: 'Missing clips' }
  if (typeof obj.projectSettings !== 'object' || obj.projectSettings === null) return { valid: false, error: 'Missing projectSettings' }
  return { valid: true, data: obj }
}

export default function TopBar() {
  const { projectName, setProjectName, undo, redo, canUndo, canRedo, loadProject } = useAppStore()
  const [saved, setSaved] = useState(false)
  const [savedOnce, setSavedOnce] = useState(hasSaveDir())
  const [saveDirName, setSaveDirName] = useState<string | null>(getSaveDirName())
  const [showExport, setShowExport] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const showShortcutsRef = useRef(false)
  useEffect(() => { showShortcutsRef.current = showShortcuts }, [showShortcuts])
  const showExportRef = useRef(false)
  useEffect(() => { showExportRef.current = showExport }, [showExport])
  const helpBtnRef = useRef<HTMLButtonElement>(null)
  const handleCloseShortcuts = useCallback(() => {
    setShowShortcuts(false)
    requestAnimationFrame(() => helpBtnRef.current?.focus())
  }, [])

  async function handleSave() {
    const result = await saveProjectFile()
    if (result.ok) {
      setSavedOnce(true)
      setSaveDirName(getSaveDirName())
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } else if (result.reason !== 'cancelled') {
      alert(`Save failed: ${result.reason}`)
    }
  }

  function handleLoadClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        const result = validateProjectJSON(json)
        if (!result.valid) {
          alert(`Load failed: ${result.error}`)
          return
        }
        loadProject(result.data)
      } catch {
        alert('Load failed: invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showShortcutsRef.current || showExportRef.current) return
      const el = document.activeElement
      const isText = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        if (isText) return
        e.preventDefault()
        const { isPlaying, setIsPlaying } = useAppStore.getState()
        setIsPlaying(!isPlaying)
        return
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isText) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); handleSave() }
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
        if (e.key === 'c' && !isText) {
          e.preventDefault()
          const state = useAppStore.getState()
          const ids = state.selectedSegmentIds.length > 0
            ? state.selectedSegmentIds
            : state.selectedElement?.type === 'segment' ? [state.selectedElement.id] : []
          if (ids.length > 0) {
            const copied = state.segments.filter((s) => ids.includes(s.id))
            ;(window as Record<string, unknown>).__clipboardSegments = copied
          }
        }
        if (e.key === 'v' && !isText) {
          e.preventDefault()
          const w = window as Record<string, unknown>
          const copied = w.__clipboardSegments
          if (Array.isArray(copied) && copied.length > 0) {
            const { addSegments, segments } = useAppStore.getState()
            const timelineEnd = segments.length > 0
              ? Math.max(...segments.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint) / Math.max(0.01, s.speed ?? 1)))
              : 0
            const copyStart = Math.min(...copied.map((s: { startOnTimeline: number }) => s.startOnTimeline))
            const offset = timelineEnd - copyStart + 0.1
            const pasted = copied.map((s: Record<string, unknown>) => ({
              ...s,
              id: crypto.randomUUID(),
              startOnTimeline: (s.startOnTimeline as number) + offset,
            }))
            addSegments(pasted)
          }
        }
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
        <IconBtn ref={helpBtnRef} title="Keyboard shortcuts (?)" onClick={() => setShowShortcuts(true)}><HelpCircle size={14} /></IconBtn>
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
        <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo()}><Undo2 size={14} /></IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo()}><Redo2 size={14} /></IconBtn>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
        <GhostBtn onClick={handleLoadClick}>
          <FolderOpen size={13} />
          Load
        </GhostBtn>
        <GhostBtn onClick={handleSave}>
          <Save size={13} />
          {saved ? 'Saved!' : saveDirName ? `Save (${saveDirName})` : 'Save'}
        </GhostBtn>
        <PrimaryBtn
          onClick={() => setShowExport(true)}
          disabled={!savedOnce}
          title={!savedOnce ? 'Save your project first before exporting' : undefined}
        >
          Export Video
        </PrimaryBtn>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showShortcuts && <ShortcutsModal onClose={handleCloseShortcuts} />}
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

const IconBtn = forwardRef<HTMLButtonElement, { children: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean }>(
  ({ children, title, onClick, disabled }, ref) => (
    <button
      ref={ref}
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
)

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

function PrimaryBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg text-sm font-semibold text-white transition-all duration-200"
      style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none', boxShadow: '0 4px 14px rgba(225,29,72,0.35)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(225,29,72,0.5)' } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(225,29,72,0.35)' }}
      onMouseDown={(e)  => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={(e)    => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)' }}
    >
      {children}
    </button>
  )
}
