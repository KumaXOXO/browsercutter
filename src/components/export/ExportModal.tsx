// src/components/export/ExportModal.tsx
import { X, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { useExport } from '../../lib/export/useExport'

interface Props {
  onClose: () => void
}

export default function ExportModal({ onClose }: Props) {
  const { status, progress, label, errorMsg, startExport, cancel } = useExport()

  function handleClose() {
    if (status === 'running') cancel()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Download size={15} style={{ color: '#E11D48' }} />
            <span className="text-sm font-semibold">Export Video</span>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-subtle)', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          {status === 'idle' && (
            <>
              <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-subtle)' }}>What happens on export</p>
                <ul className="text-xs flex flex-col gap-1" style={{ color: 'var(--muted2)', listStyle: 'none', padding: 0 }}>
                  <li>• Your V1 clips are concatenated in timeline order</li>
                  <li>• Encoded as H.264 MP4 via FFmpeg WebAssembly</li>
                  <li>• Downloaded directly to your computer</li>
                  <li>• No data leaves your browser</li>
                </ul>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <p className="text-xs" style={{ color: '#EAB308' }}>
                  First export loads ~31 MB of FFmpeg WASM from CDN. Subsequent exports are instant.
                </p>
              </div>
            </>
          )}

          {status === 'running' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted2)' }}>{label}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--muted-subtle)' }}>
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(progress * 100)}%`,
                    background: 'linear-gradient(90deg,#E11D48,#F43F5E)',
                    borderRadius: 9999,
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
                Large timelines may take several minutes.
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-3 rounded-lg p-4" style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)' }}>
              <CheckCircle size={16} style={{ color: '#34D399', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#34D399' }}>Export complete</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-subtle)' }}>Your video has been downloaded.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Export failed</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted2)', wordBreak: 'break-word' }}>{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={handleClose}
            className="text-sm rounded-lg cursor-pointer transition-all duration-150"
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--muted2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--muted2)' }}
          >
            {status === 'running' ? 'Cancel' : 'Close'}
          </button>

          {(status === 'idle' || status === 'error') && (
            <button
              onClick={startExport}
              className="text-sm font-semibold text-white rounded-lg cursor-pointer transition-all duration-200"
              style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none', boxShadow: '0 4px 14px rgba(225,29,72,0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(225,29,72,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(225,29,72,0.35)' }}
            >
              {status === 'error' ? 'Retry Export' : 'Export Now'}
            </button>
          )}

          {status === 'done' && (
            <button
              onClick={() => { onClose() }}
              className="text-sm font-semibold text-white rounded-lg cursor-pointer transition-all duration-200"
              style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#059669,#047857)', border: 'none', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
