// src/components/preview/PlaybackControls.tsx
import { SkipBack, Play, Pause, SkipForward, Volume2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { formatTime } from '../../lib/utils'

export default function PlaybackControls() {
  const { isPlaying, playheadPosition, segments, masterVolume, setIsPlaying, setPlayheadPosition, setMasterVolume, undo, redo, canUndo, canRedo } = useAppStore()

  // Include ALL segments (all tracks) so audio-only timelines show correct duration
  const totalDuration = segments
    .reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)

  const progress = totalDuration > 0 ? (playheadPosition / totalDuration) * 100 : 0

  const handleUndo = () => { setIsPlaying(false); undo() }
  const handleRedo = () => { setIsPlaying(false); redo() }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPlaying(false)
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setPlayheadPosition(Math.max(0, Math.min(totalDuration, ratio * totalDuration)))
  }

  return (
    <div
      className="flex items-center gap-2.5 px-4 shrink-0"
      style={{ height: 46, background: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}
    >
      <IconBtn onClick={handleUndo} title="Undo (Ctrl+Z)" disabled={!canUndo()}><SkipBack size={14} fill="currentColor" /></IconBtn>
      <PlayBtn isPlaying={isPlaying} onToggle={() => setIsPlaying(!isPlaying)} />
      <IconBtn onClick={handleRedo} title="Redo (Ctrl+Y)" disabled={!canRedo()}><SkipForward size={14} fill="currentColor" /></IconBtn>
      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--muted-subtle)' }}>{formatTime(playheadPosition)}</span>
      <SeekBar progress={progress} onSeek={handleSeek} />
      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--muted-subtle)' }}>{formatTime(totalDuration)}</span>
      <IconBtn title="Master Volume"><Volume2 size={14} /></IconBtn>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={masterVolume}
        onChange={(e) => setMasterVolume(Number(e.target.value))}
        title={`Master Volume: ${Math.round(masterVolume * 100)}%`}
        style={{ width: 60, accentColor: '#E11D48', cursor: 'pointer' }}
      />
    </div>
  )
}

function IconBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick?: () => void; title?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center rounded-md transition-all duration-150"
      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: 'var(--muted-subtle)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-subtle)' }}
    >
      {children}
    </button>
  )
}

function PlayBtn({ isPlaying, onToggle }: { isPlaying: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 shrink-0"
      style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none', boxShadow: '0 3px 10px rgba(225,29,72,0.4)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 5px 16px rgba(225,29,72,0.6)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(225,29,72,0.4)' }}
    >
      {isPlaying
        ? <Pause size={12} fill="white" color="white" />
        : <Play size={12} fill="white" color="white" />
      }
    </button>
  )
}

function SeekBar({ progress, onSeek }: { progress: number; onSeek: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div
      className="flex-1 relative cursor-pointer"
      style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', transition: 'height 150ms' }}
      onMouseEnter={(e) => { e.currentTarget.style.height = '5px' }}
      onMouseLeave={(e) => { e.currentTarget.style.height = '3px' }}
      onClick={onSeek}
    >
      <div style={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#E11D48,#F43F5E)' }} />
    </div>
  )
}
