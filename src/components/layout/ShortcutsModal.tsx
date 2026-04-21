// src/components/layout/ShortcutsModal.tsx
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const SHORTCUTS: { keys: string[]; description: string; context?: string }[] = [
  { keys: ['Space'],         description: 'Play / Pause' },
  { keys: ['Delete', 'Backspace'], description: 'Remove selected clip' },
  { keys: ['H'],             description: 'Hide / Show selected clip' },
  { keys: ['M'],             description: 'Mute / Unmute selected clip' },
  { keys: ['Ctrl', 'Z'],    description: 'Undo' },
  { keys: ['Ctrl', 'Y'],    description: 'Redo', context: 'or Ctrl+Shift+Z' },
  { keys: ['Ctrl', 'S'],    description: 'Save project' },
]

interface Props {
  onClose: () => void
}

export default function ShortcutsModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { closeButtonRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      )
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        style={{
          width: 340, borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          padding: '18px 20px 20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Keyboard Shortcuts</span>
          <button
            ref={closeButtonRef}
            aria-label="Close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-subtle)', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted2)' }}>
                {s.description}
                {s.context && <span style={{ color: 'var(--muted-subtle)', marginLeft: 4 }}>({s.context})</span>}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <span style={{ color: 'var(--muted-subtle)', fontSize: 9 }}>+</span>}
                    <kbd style={{
                      fontSize: 10, fontFamily: 'monospace',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text)',
                    }}>
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs mt-4" style={{ color: 'var(--muted-subtle)' }}>
          Press <kbd style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>Esc</kbd> to close
        </p>
      </div>
    </div>
  )
}
