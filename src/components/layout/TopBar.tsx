// src/components/layout/TopBar.tsx
import { Undo2, Redo2, Save } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export default function TopBar() {
  const { projectName, setProjectName } = useAppStore()

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
        <IconBtn title="Undo"><Undo2 size={14} /></IconBtn>
        <IconBtn title="Redo"><Redo2 size={14} /></IconBtn>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
        <GhostBtn>
          <Save size={13} />
          Save
        </GhostBtn>
        <PrimaryBtn onClick={() => alert('Export not yet implemented')}>
          Export Video
        </PrimaryBtn>
      </div>
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

function IconBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer"
      style={{ width: 28, height: 28, color: 'var(--muted2)', background: 'transparent', border: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' }}
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
