// src/components/layout/LeftPanel.tsx
import { useAppStore } from '../../store/useAppStore'
import MediaPanel from '../panels/MediaPanel/MediaPanel'
import TextPanel from '../panels/TextPanel'
import EffectsPanel from '../panels/EffectsPanel'
import TransitionsPanel from '../panels/TransitionsPanel'
import BpmPanel from '../panels/BpmPanel'
import SettingsPanel from '../panels/SettingsPanel'
import InspectorPanel from '../panels/InspectorPanel'

export default function LeftPanel() {
  const { activeTab } = useAppStore()

  return (
    <div
      className="flex flex-col border-r overflow-hidden shrink-0"
      style={{ width: 284, background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}
    >
      {activeTab === 'media'       && <MediaPanel />}
      {activeTab === 'text'        && <TextPanel />}
      {activeTab === 'effects'     && <EffectsPanel />}
      {activeTab === 'transitions' && <TransitionsPanel />}
      {activeTab === 'bpm'         && <BpmPanel />}
      {activeTab === 'settings'    && <SettingsPanel />}
      {activeTab === 'inspector'   && <InspectorPanel />}
    </div>
  )
}
