// src/components/layout/RightPanel.tsx
import EffectsPanel from '../panels/EffectsPanel'

const WIDTH = 240

export default function RightPanel() {
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: WIDTH,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      <EffectsPanel />
    </div>
  )
}
