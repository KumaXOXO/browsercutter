// src/components/panels/SettingsPanel.tsx
import { PanelLabel } from './TextPanel'
import { useAppStore } from '../../store/useAppStore'

export default function SettingsPanel() {
  const { projectSettings, updateProjectSettings } = useAppStore()

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Settings</PanelLabel>
      <div className="flex flex-col">
        <SettingRow label="Resolution" sub="Output video size">
          <select
            className="inp"
            value={projectSettings.resolution}
            onChange={(e) => updateProjectSettings({ resolution: e.target.value as typeof projectSettings.resolution })}
          >
            <option value="1920x1080">1920×1080</option>
            <option value="3840x2160">3840×2160</option>
            <option value="1280x720">1280×720</option>
          </select>
        </SettingRow>
        <SettingRow label="Frame Rate" sub="FPS">
          <select
            className="inp"
            value={projectSettings.fps}
            onChange={(e) => updateProjectSettings({ fps: Number(e.target.value) as typeof projectSettings.fps })}
          >
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </SettingRow>
        <SettingRow label="Format" sub="Export format">
          <select
            className="inp"
            value={projectSettings.format}
            onChange={(e) => updateProjectSettings({ format: e.target.value as typeof projectSettings.format })}
          >
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </SettingRow>
        <SettingRow label="Auto-detect BPM" sub="On upload">
          <Toggle
            on={projectSettings.autoDetectBpm}
            onChange={(v) => updateProjectSettings({ autoDetectBpm: v })}
          />
        </SettingRow>
        <SettingRow label="Snap to Beat" sub="Timeline snapping">
          <Toggle
            on={projectSettings.snapToBeat}
            onChange={(v) => updateProjectSettings({ snapToBeat: v })}
          />
        </SettingRow>
        <SettingRow label="Hardware Accel." sub="GPU when available">
          <Toggle
            on={projectSettings.hardwareAcceleration}
            onChange={(v) => updateProjectSettings({ hardwareAcceleration: v })}
          />
        </SettingRow>
        <SettingRow label="Video Frames" sub="Show frames in timeline">
          <Toggle
            on={projectSettings.showClipThumbnails}
            onChange={(v) => updateProjectSettings({ showClipThumbnails: v })}
          />
        </SettingRow>
      </div>
    </div>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-subtle)' }}>{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="cursor-pointer shrink-0 transition-all duration-200"
      style={{
        width: 34, height: 19, borderRadius: 99,
        position: 'relative',
        background: on ? '#E11D48' : 'var(--surface3)',
        border: `1px solid ${on ? '#E11D48' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: on ? '0 0 8px rgba(225,29,72,0.4)' : 'none',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          top: 2, left: on ? 17 : 2,
          width: 13, height: 13,
          background: on ? 'white' : 'var(--muted2)',
          boxShadow: on ? '0 2px 6px rgba(225,29,72,0.5)' : 'none',
        }}
      />
    </button>
  )
}
