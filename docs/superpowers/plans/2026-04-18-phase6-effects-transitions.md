# Effects & Transitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Effects panel to apply CSS visual filters to segments, implement Adjustment Layers that appear on the timeline and affect clips below them, and wire Transitions panel cards to store transition records between adjacent segments.

**Architecture:** `Segment` gains an optional `effects?: Effect[]` field. A pure `buildCSSFilter(effects)` utility converts Effect objects to a CSS filter string. VideoPreview applies the filter (plus a gradient overlay for vignette) to the active segment. Adjustment layers get store CRUD, a timeline block component, and an inspector branch. Transition clicks find the two adjacent V1 segments around the playhead and store a `Transition` record — preview rendering is deferred to export.

**Tech Stack:** React 18, TypeScript, Zustand 5, CSS filters

**Prerequisite:** Phase 4 must be complete (store textOverlay actions exist, InspectorPanel extended).

---

### Task 1: Add effects array to Segment type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add effects field to Segment interface**

In `src/types/index.ts`, update the Segment interface (which after Phase 4 already has `volume?` and `speed?`) to add:

```typescript
export interface Segment {
  id: SegmentId
  clipId: ClipId
  trackIndex: number
  startOnTimeline: number
  inPoint: number
  outPoint: number
  volume?: number
  speed?: number
  effects?: Effect[]
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean — field is optional, no callsites break.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add optional effects array to Segment type"
```

---

### Task 2: Add adjustment layer and transition store actions

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Add action signatures to AppState interface**

After the `removeTextOverlay` line in the interface, add:

```typescript
  addAdjustmentLayer: (layer: AdjustmentLayer) => void
  updateAdjustmentLayer: (id: string, patch: Partial<AdjustmentLayer>) => void
  removeAdjustmentLayer: (id: string) => void
  addTransition: (transition: Transition) => void
  removeTransition: (id: string) => void
```

- [ ] **Step 2: Add implementations**

After the `removeTextOverlay` implementation in the `create` body, add:

```typescript
  addAdjustmentLayer: (layer) => set((s) => ({ adjustmentLayers: [...s.adjustmentLayers, layer] })),
  updateAdjustmentLayer: (id, patch) =>
    set((s) => ({ adjustmentLayers: s.adjustmentLayers.map((l) => l.id === id ? { ...l, ...patch } : l) })),
  removeAdjustmentLayer: (id) => set((s) => ({ adjustmentLayers: s.adjustmentLayers.filter((l) => l.id !== id) })),
  addTransition: (transition) => set((s) => ({ transitions: [...s.transitions, transition] })),
  removeTransition: (id) => set((s) => ({ transitions: s.transitions.filter((t) => t.id !== id) })),
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: add adjustment layer and transition store actions"
```

---

### Task 3: Create CSS filter builder utility

**Files:**
- Create: `src/lib/video/effectsFilter.ts`

- [ ] **Step 1: Write the utility**

Create `src/lib/video/effectsFilter.ts`:

```typescript
import type { Effect } from '../../types'

export function buildCSSFilter(effects: Effect[]): string {
  return effects
    .filter((e) => e.type !== 'vignette')  // vignette uses a gradient overlay, not a filter
    .map((e) => {
      switch (e.type) {
        case 'brightness':
          // value 0-100: maps to brightness 0-200%, center (50) = 100% = no change
          return `brightness(${e.value * 2}%)`
        case 'contrast':
          return `contrast(${e.value * 2}%)`
        case 'saturation':
          return `saturate(${e.value * 2}%)`
        case 'grayscale':
          return `grayscale(${e.value}%)`
        case 'blur':
          return `blur(${(e.value / 100) * 8}px)`
        case 'sharpen':
          // No native CSS sharpen — approximate with contrast + brightness nudge
          return `contrast(${100 + e.value * 0.8}%) brightness(${100 + e.value * 0.1}%)`
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join(' ')
}

export function getVignetteValue(effects: Effect[]): number | null {
  const e = effects.find((ef) => ef.type === 'vignette')
  return e ? e.value : null
}
```

- [ ] **Step 2: Write tests**

Create `src/lib/video/effectsFilter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCSSFilter, getVignetteValue } from './effectsFilter'

describe('buildCSSFilter', () => {
  it('returns empty string for empty effects', () => {
    expect(buildCSSFilter([])).toBe('')
  })

  it('builds brightness filter', () => {
    const result = buildCSSFilter([{ type: 'brightness', value: 75 }])
    expect(result).toBe('brightness(150%)')
  })

  it('builds grayscale filter', () => {
    const result = buildCSSFilter([{ type: 'grayscale', value: 100 }])
    expect(result).toBe('grayscale(100%)')
  })

  it('skips vignette (handled separately)', () => {
    const result = buildCSSFilter([{ type: 'vignette', value: 80 }])
    expect(result).toBe('')
  })

  it('combines multiple filters', () => {
    const result = buildCSSFilter([
      { type: 'brightness', value: 60 },
      { type: 'grayscale', value: 50 },
    ])
    expect(result).toBe('brightness(120%) grayscale(50%)')
  })
})

describe('getVignetteValue', () => {
  it('returns null when no vignette effect', () => {
    expect(getVignetteValue([{ type: 'brightness', value: 50 }])).toBeNull()
  })

  it('returns vignette value when present', () => {
    expect(getVignetteValue([{ type: 'vignette', value: 70 }])).toBe(70)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/video/effectsFilter.test.ts`
Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/video/effectsFilter.ts src/lib/video/effectsFilter.test.ts
git commit -m "feat: add CSS filter builder utility for effects"
```

---

### Task 4: Wire EffectsPanel clicks to updateSegment

**Files:**
- Modify: `src/components/panels/EffectsPanel.tsx`

- [ ] **Step 1: Add store imports and toggle logic**

Replace the entire `src/components/panels/EffectsPanel.tsx` with:

```tsx
import { Sun, Contrast, Droplets, Blend, Circle, ScanLine, Zap } from 'lucide-react'
import { PanelLabel } from './TextPanel'
import { useAppStore } from '../../store/useAppStore'
import type { EffectType } from '../../types'

const EFFECTS: { type: EffectType; label: string; icon: React.ReactNode }[] = [
  { type: 'brightness',  label: 'Brightness / Exposure', icon: <Sun size={13} /> },
  { type: 'contrast',    label: 'Contrast',               icon: <Contrast size={13} /> },
  { type: 'saturation',  label: 'Saturation',             icon: <Droplets size={13} /> },
  { type: 'grayscale',   label: 'Black & White',          icon: <Blend size={13} /> },
  { type: 'blur',        label: 'Blur',                   icon: <Circle size={13} /> },
  { type: 'vignette',    label: 'Vignette',               icon: <ScanLine size={13} /> },
  { type: 'sharpen',     label: 'Sharpen',                icon: <Zap size={13} /> },
]

export default function EffectsPanel() {
  const { selectedElement, segments, updateSegment, addAdjustmentLayer, playheadPosition } = useAppStore()

  function handleEffectClick(type: EffectType) {
    if (!selectedElement || selectedElement.type !== 'segment') return
    const seg = segments.find((s) => s.id === selectedElement.id)
    if (!seg) return
    const existing = seg.effects ?? []
    const idx = existing.findIndex((e) => e.type === type)
    if (idx >= 0) {
      updateSegment(seg.id, { effects: existing.filter((_, i) => i !== idx) })
    } else {
      updateSegment(seg.id, { effects: [...existing, { type, value: 50 }] })
    }
  }

  function handleAddAdjustmentLayer() {
    addAdjustmentLayer({
      id: crypto.randomUUID(),
      startOnTimeline: playheadPosition,
      duration: 5,
      effects: [],
    })
  }

  const selectedSeg = selectedElement?.type === 'segment'
    ? segments.find((s) => s.id === selectedElement.id)
    : null
  const appliedTypes = new Set(selectedSeg?.effects?.map((e) => e.type) ?? [])

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Effects</PanelLabel>
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
        {selectedSeg ? 'Click to toggle on selected clip' : 'Select a clip on the timeline first'}
      </p>
      <div className="flex flex-col gap-0.5">
        {EFFECTS.map((e) => (
          <EffectRow
            key={e.type}
            icon={e.icon}
            label={e.label}
            active={appliedTypes.has(e.type)}
            onClick={() => handleEffectClick(e.type)}
          />
        ))}
      </div>
      <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <PanelLabel>Adjustment Layer</PanelLabel>
        <button
          className="w-full mt-2 rounded-lg text-xs cursor-pointer transition-all duration-150"
          style={{ padding: '9px', color: '#EF4444', background: 'transparent', border: '1px dashed rgba(239,68,68,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.background = 'transparent' }}
          onClick={handleAddAdjustmentLayer}
        >
          + Add Adjustment Layer
        </button>
      </div>
    </div>
  )
}

function EffectRow({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full rounded-lg text-sm text-left cursor-pointer transition-all duration-150"
      style={{
        padding: '8px 10px',
        color: active ? '#FFFFFF' : 'var(--muted2)',
        background: active ? 'rgba(225,29,72,0.15)' : 'transparent',
        border: `1px solid ${active ? 'rgba(225,29,72,0.4)' : 'transparent'}`,
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.borderColor = 'transparent' } }}
    >
      {icon} {label}
      {active && <span className="ml-auto text-xs" style={{ color: '#E11D48' }}>✓</span>}
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/EffectsPanel.tsx
git commit -m "feat: wire EffectsPanel to toggle effects on selected segment and add adjustment layers"
```

---

### Task 5: Apply CSS filters and vignette in VideoPreview

**Files:**
- Modify: `src/components/preview/VideoPreview.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/preview/VideoPreview.tsx`, add:

```typescript
import { useMemo } from 'react'  // add to existing react import
import { buildCSSFilter, getVignetteValue } from '../../lib/video/effectsFilter'
```

(useMemo may already be imported — if so, skip adding it to the import line.)

- [ ] **Step 2: Compute CSS filter and vignette from activeSeg**

Inside `VideoPreview`, after the `activeClip` line, add:

```typescript
  const cssFilter = useMemo(
    () => (activeSeg?.effects?.length ? buildCSSFilter(activeSeg.effects) : ''),
    [activeSeg?.id, activeSeg?.effects],
  )
  const vignetteValue = useMemo(
    () => (activeSeg?.effects?.length ? getVignetteValue(activeSeg.effects) : null),
    [activeSeg?.id, activeSeg?.effects],
  )
```

- [ ] **Step 3: Apply filter to the video element via effect**

After the volume/speed `useEffect` (added in Phase 4), add:

```typescript
  useEffect(() => {
    if (videoRef.current) videoRef.current.style.filter = cssFilter
  }, [cssFilter])
```

- [ ] **Step 4: Add vignette gradient overlay in JSX**

Inside the video container div, after `<TextOverlayRenderer />` (added in Phase 5), add:

```tsx
        {vignetteValue !== null && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse at center, transparent ${100 - vignetteValue}%, rgba(0,0,0,${(vignetteValue / 100).toFixed(2)}) 100%)`,
              pointerEvents: 'none',
              zIndex: 6,
            }}
          />
        )}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/preview/VideoPreview.tsx
git commit -m "feat: apply CSS filters and vignette overlay in VideoPreview from segment effects"
```

---

### Task 6: Create AdjustmentLayerBlock component

**Files:**
- Create: `src/components/timeline/AdjustmentLayerBlock.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/timeline/AdjustmentLayerBlock.tsx`:

```tsx
import type { AdjustmentLayer } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

interface Props {
  layer: AdjustmentLayer
  zoom: number
}

export default function AdjustmentLayerBlock({ layer, zoom }: Props) {
  const { selectedElement, setSelectedElement } = useAppStore()
  const isSelected = selectedElement?.id === layer.id
  const px = PX_PER_SEC * zoom
  const left = layer.startOnTimeline * px
  const width = Math.max(4, layer.duration * px)

  const effectLabels = layer.effects.map((e) => e.type.slice(0, 3).toUpperCase()).join('+')

  return (
    <div
      onClick={() => setSelectedElement({ type: 'adjustment', id: layer.id })}
      style={{
        position: 'absolute',
        top: 3, bottom: 3,
        left, width,
        borderRadius: 4,
        background: 'rgba(239,68,68,0.1)',
        border: isSelected
          ? '2px solid rgba(255,255,255,0.9)'
          : '1px dashed rgba(239,68,68,0.5)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        transition: 'filter 120ms',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, color: '#F87171', padding: '0 5px', whiteSpace: 'nowrap' }}>
        ADJ{effectLabels ? ` ${effectLabels}` : ''}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/AdjustmentLayerBlock.tsx
git commit -m "feat: add AdjustmentLayerBlock timeline component"
```

---

### Task 7: Create AdjustmentTrack and add to Timeline

**Files:**
- Create: `src/components/timeline/AdjustmentTrack.tsx`
- Modify: `src/components/timeline/Timeline.tsx`

- [ ] **Step 1: Create AdjustmentTrack**

Create `src/components/timeline/AdjustmentTrack.tsx`:

```tsx
import { Layers } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import AdjustmentLayerBlock from './AdjustmentLayerBlock'

interface Props {
  zoom: number
  trackLabelWidth: number
}

export default function AdjustmentTrack({ zoom, trackLabelWidth }: Props) {
  const adjustmentLayers = useAppStore((s) => s.adjustmentLayers)

  return (
    <div
      className="flex items-center"
      style={{ height: 24, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div
        className="flex items-center gap-1 px-2 shrink-0"
        style={{ minWidth: trackLabelWidth, width: trackLabelWidth, fontSize: 10, color: 'var(--muted-subtle)' }}
      >
        <Layers size={9} /> Adj
      </div>
      <div className="relative h-full" style={{ width: 700 }}>
        {adjustmentLayers.map((layer) => (
          <AdjustmentLayerBlock key={layer.id} layer={layer} zoom={zoom} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add AdjustmentTrack to Timeline.tsx**

In `src/components/timeline/Timeline.tsx`, add the import:

```typescript
import AdjustmentTrack from './AdjustmentTrack'
```

Inside the `<div style={{ position: 'relative' }}>` block, add `<AdjustmentTrack>` directly above `<Track trackIndex={0} …>`:

```tsx
          <AdjustmentTrack zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />
          <Track trackIndex={0} label="V1" icon={<Film size={9} />} height={38} zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline/AdjustmentTrack.tsx src/components/timeline/Timeline.tsx
git commit -m "feat: add AdjustmentTrack to timeline above V1"
```

---

### Task 8: Add adjustment layer inspector branch

**Files:**
- Modify: `src/components/panels/InspectorPanel.tsx`

- [ ] **Step 1: Add adjustment layer inspector branch**

In `InspectorPanel.tsx`, update the destructure to include `adjustmentLayers` and `updateAdjustmentLayer`:

```typescript
const { selectedElement, segments, clips, textOverlays, adjustmentLayers, updateSegment, updateTextOverlay, updateAdjustmentLayer } = useAppStore()
```

After the `if (selectedElement.type === 'text')` block and before `const segment = ...`, add:

```tsx
  if (selectedElement.type === 'adjustment') {
    const layer = adjustmentLayers.find((l) => l.id === selectedElement.id)
    if (!layer) return null
    return (
      <div className="flex flex-col gap-4 p-3.5 overflow-y-auto h-full">
        <div className="flex items-center justify-between">
          <PanelLabel>Adjustment Layer</PanelLabel>
          <span className="text-xs font-semibold rounded px-2 py-0.5" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>ADJ</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <InpField
              value={formatTime(layer.startOnTimeline)}
              onChange={(v) => updateAdjustmentLayer(layer.id, { startOnTimeline: parseTime(v) })}
            />
          </Field>
          <Field label="Duration">
            <InpField
              value={formatTime(layer.duration)}
              onChange={(v) => updateAdjustmentLayer(layer.id, { duration: Math.max(0.1, parseTime(v)) })}
            />
          </Field>
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
        <div>
          <PanelLabel>Applied Effects</PanelLabel>
          {layer.effects.length === 0
            ? <p className="text-xs mt-2" style={{ color: 'var(--muted-subtle)' }}>No effects. Go to Effects tab → click an effect row after selecting this layer in the timeline.</p>
            : layer.effects.map((e) => (
              <div key={e.type} className="flex items-center gap-2 mt-2">
                <span className="text-xs capitalize" style={{ color: 'var(--muted2)', minWidth: 80 }}>{e.type}</span>
                <input
                  type="range" min={0} max={100}
                  value={e.value}
                  className="flex-1"
                  style={{ accentColor: '#E11D48' }}
                  onChange={(ev) => updateAdjustmentLayer(layer.id, {
                    effects: layer.effects.map((ef) => ef.type === e.type ? { ...ef, value: Number(ev.target.value) } : ef),
                  })}
                />
                <span className="text-xs font-mono w-6 text-right" style={{ color: 'var(--muted2)' }}>{e.value}</span>
              </div>
            ))
          }
        </div>
      </div>
    )
  }
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/InspectorPanel.tsx
git commit -m "feat: add adjustment layer inspector branch in InspectorPanel"
```

---

### Task 9: Wire TransitionsPanel transition clicks

**Files:**
- Modify: `src/components/panels/TransitionsPanel.tsx`

- [ ] **Step 1: Replace TransitionsPanel with wired version**

Replace the entire content of `src/components/panels/TransitionsPanel.tsx` with:

```tsx
import { PanelLabel } from './TextPanel'
import { useAppStore } from '../../store/useAppStore'
import type { TransitionType } from '../../types'

const TRANSITIONS: { type: TransitionType; label: string; symbol: string }[] = [
  { type: 'cut',      label: 'Cut',      symbol: '▶' },
  { type: 'fade',     label: 'Fade',     symbol: 'A→B' },
  { type: 'wipe',     label: 'Wipe',     symbol: '|→' },
  { type: 'zoom',     label: 'Zoom',     symbol: '⊕' },
  { type: 'slide',    label: 'Slide',    symbol: '↗' },
  { type: 'dissolve', label: 'Dissolve', symbol: '◈' },
]

export default function TransitionsPanel() {
  const { segments, transitions, playheadPosition, addTransition, removeTransition } = useAppStore()

  function handleTransitionClick(type: TransitionType) {
    // Find two adjacent V1 segments that straddle the playhead
    const v1 = segments.filter((s) => s.trackIndex === 0).sort((a, b) => a.startOnTimeline - b.startOnTimeline)
    const beforeIdx = v1.findLastIndex((s) => s.startOnTimeline + (s.outPoint - s.inPoint) <= playheadPosition)
    const before = v1[beforeIdx]
    const after = v1[beforeIdx + 1]
    if (!before || !after) return

    // Remove any existing transition at this joint
    const existing = transitions.find((t) => t.beforeSegmentId === before.id && t.afterSegmentId === after.id)
    if (existing) removeTransition(existing.id)

    if (type !== 'cut') {
      addTransition({
        id: crypto.randomUUID(),
        type,
        beforeSegmentId: before.id,
        afterSegmentId: after.id,
        duration: 0.5,
      })
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Transitions</PanelLabel>
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
        Position playhead between two V1 clips, then click a transition
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TRANSITIONS.map((t) => (
          <TransCard key={t.type} label={t.label} symbol={t.symbol} onClick={() => handleTransitionClick(t.type)} />
        ))}
      </div>
      {transitions.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <PanelLabel>Applied ({transitions.length})</PanelLabel>
          {transitions.map((tr) => (
            <div key={tr.id} className="flex items-center justify-between mt-1.5">
              <span className="text-xs capitalize" style={{ color: 'var(--muted2)' }}>{tr.type}</span>
              <button
                onClick={() => removeTransition(tr.id)}
                className="text-xs cursor-pointer"
                style={{ color: 'rgba(239,68,68,0.7)', background: 'transparent', border: 'none' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TransCard({ label, symbol, onClick }: { label: string; symbol: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center rounded-lg cursor-pointer transition-all duration-150"
      style={{ padding: '12px 8px', background: 'var(--surface2)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.background = 'rgba(225,29,72,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.transform = '' }}
    >
      <span className="text-sm mb-1" style={{ color: 'var(--muted-subtle)', fontFamily: 'monospace' }}>{symbol}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
```

Note: `Array.prototype.findLastIndex` is available in Chrome 97+ / Node 18+. If TypeScript complains, add `"lib": ["ES2023"]` to `tsconfig.json` compilerOptions.

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -30`
Expected: clean. If `findLastIndex` is flagged, open `tsconfig.json`, find `"lib"` or add it under `compilerOptions`:
```json
"lib": ["ES2023", "DOM", "DOM.Iterable"]
```
Then rebuild.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/TransitionsPanel.tsx
git commit -m "feat: wire TransitionsPanel to store transitions between adjacent V1 segments"
```
