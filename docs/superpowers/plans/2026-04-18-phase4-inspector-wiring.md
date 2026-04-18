# Inspector Panel Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Volume and Speed sliders in InspectorPanel to the Segment store and the HTML5 video element, and add a text-overlay inspector branch so clicking a TextOverlay on the timeline opens its fields in the panel.

**Architecture:** `Segment` gains two optional fields — `volume?: number` (0–1) and `speed?: number` (0.25–4). InspectorPanel reads them and writes via `updateSegment`. A new `useEffect` in VideoPreview syncs `video.volume` and `video.playbackRate` whenever the active segment changes. The store gains `addTextOverlay`, `updateTextOverlay`, `removeTextOverlay` actions (also consumed by Phase 5).

**Tech Stack:** React 18, TypeScript, Zustand 5, HTML5 Video API

---

### Task 1: Add volume and speed to Segment type

**Files:**
- Modify: `src/types/index.ts:29-36`

- [ ] **Step 1: Confirm current Segment interface**

Run: `npm run build 2>&1 | head -5`
Expected: clean build — baseline before changes.

- [ ] **Step 2: Add optional fields to Segment**

In `src/types/index.ts`, replace the Segment interface with:

```typescript
export interface Segment {
  id: SegmentId
  clipId: ClipId
  trackIndex: number
  startOnTimeline: number
  inPoint: number
  outPoint: number
  volume?: number   // 0–1, default 1.0
  speed?: number    // 0.25–4.0, default 1.0
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npm run build 2>&1 | head -20`
Expected: clean — the fields are optional so no callsites need updating.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add optional volume and speed fields to Segment"
```

---

### Task 2: Add textOverlay CRUD actions to store

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Add action signatures to AppState interface**

In `src/store/useAppStore.ts`, after the `replaceSegments` line in the interface block, add:

```typescript
  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  removeTextOverlay: (id: string) => void
```

- [ ] **Step 2: Add implementations**

In the `create<AppState>((set) => ({` body, after the `replaceSegments` implementation, add:

```typescript
  addTextOverlay: (overlay) => set((s) => ({ textOverlays: [...s.textOverlays, overlay] })),
  updateTextOverlay: (id, patch) =>
    set((s) => ({ textOverlays: s.textOverlays.map((o) => o.id === id ? { ...o, ...patch } : o) })),
  removeTextOverlay: (id) => set((s) => ({ textOverlays: s.textOverlays.filter((o) => o.id !== id) })),
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: add textOverlay CRUD actions to store"
```

---

### Task 3: Wire Volume and Speed sliders in InspectorPanel

**Files:**
- Modify: `src/components/panels/InspectorPanel.tsx`

- [ ] **Step 1: Update the destructure to include textOverlay store access**

Replace the existing destructure at the top of `InspectorPanel`:

```typescript
const { selectedElement, segments, clips, textOverlays, updateSegment, updateTextOverlay } = useAppStore()
```

- [ ] **Step 2: Replace the uncontrolled volume slider with a controlled one**

Find the `<Field label="Volume">` block (currently uses `defaultValue={100}`) and replace it with:

```tsx
<Field label="Volume">
  <div className="flex items-center gap-2">
    <input
      type="range" min={0} max={100}
      value={Math.round((segment.volume ?? 1) * 100)}
      className="w-full"
      style={{ accentColor: '#E11D48' }}
      onChange={(e) => updateSegment(segment.id, { volume: Number(e.target.value) / 100 })}
    />
    <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--muted2)' }}>
      {Math.round((segment.volume ?? 1) * 100)}%
    </span>
  </div>
</Field>
```

- [ ] **Step 3: Replace the uncontrolled speed slider**

Find the `<Field label="Speed">` block and replace it with:

```tsx
<Field label="Speed">
  <div className="flex items-center gap-2">
    <input
      type="range" min={25} max={400}
      value={Math.round((segment.speed ?? 1) * 100)}
      className="w-full"
      style={{ accentColor: '#E11D48' }}
      onChange={(e) => updateSegment(segment.id, { speed: Number(e.target.value) / 100 })}
    />
    <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--muted2)' }}>
      {(segment.speed ?? 1).toFixed(2)}x
    </span>
  </div>
</Field>
```

- [ ] **Step 4: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/InspectorPanel.tsx
git commit -m "feat: wire volume and speed sliders to segment store in InspectorPanel"
```

---

### Task 4: Add text overlay inspector branch

**Files:**
- Modify: `src/components/panels/InspectorPanel.tsx`

- [ ] **Step 1: Add the text inspector branch**

Directly after the `if (!selectedElement)` early-return block (which shows "Select a clip…"), and before the `const segment = …` line, add:

```tsx
  if (selectedElement.type === 'text') {
    const overlay = textOverlays.find((o) => o.id === selectedElement.id)
    if (!overlay) return null
    return (
      <div className="flex flex-col gap-4 p-3.5 overflow-y-auto h-full">
        <PanelLabel>Text Inspector</PanelLabel>
        <Field label="Text">
          <textarea
            className="inp resize-none"
            rows={3}
            value={overlay.text}
            onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
            style={{ fontFamily: 'inherit', fontSize: 12 }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Font Size">
            <InpField
              value={String(overlay.size)}
              onChange={(v) => updateTextOverlay(overlay.id, { size: parseInt(v) || overlay.size })}
            />
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={overlay.color}
              onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
              style={{ width: '100%', height: 30, borderRadius: 4, border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'transparent' }}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X (0–1)">
            <InpField
              value={overlay.x.toFixed(2)}
              onChange={(v) => updateTextOverlay(overlay.id, { x: Math.max(0, Math.min(1, parseFloat(v) || 0)) })}
            />
          </Field>
          <Field label="Y (0–1)">
            <InpField
              value={overlay.y.toFixed(2)}
              onChange={(v) => updateTextOverlay(overlay.id, { y: Math.max(0, Math.min(1, parseFloat(v) || 0)) })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <InpField
              value={formatTime(overlay.startOnTimeline)}
              onChange={(v) => updateTextOverlay(overlay.id, { startOnTimeline: parseTime(v) })}
            />
          </Field>
          <Field label="Duration">
            <InpField
              value={formatTime(overlay.duration)}
              onChange={(v) => updateTextOverlay(overlay.id, { duration: Math.max(0.1, parseTime(v)) })}
            />
          </Field>
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
git commit -m "feat: add text overlay inspector branch to InspectorPanel"
```

---

### Task 5: Apply volume and speed in VideoPreview

**Files:**
- Modify: `src/components/preview/VideoPreview.tsx`

- [ ] **Step 1: Add effect to sync volume/speed when active segment changes**

In `VideoPreview.tsx`, after the existing `// Seek when playhead moves while paused` `useEffect`, add:

```typescript
  // Sync volume and playback rate when active segment changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeSeg) return
    video.volume = activeSeg.volume ?? 1
    video.playbackRate = activeSeg.speed ?? 1
  }, [activeSeg?.id, activeSeg?.volume, activeSeg?.speed])
```

- [ ] **Step 2: Apply volume/speed when the RAF loop switches to the next segment**

In the RAF tick, inside the `if (nextSeg)` → `if (nextClip?.file)` block, after the line `videoRef.current.currentTime = nextSeg.inPoint`, add:

```typescript
            videoRef.current.volume = nextSeg.volume ?? 1
            videoRef.current.playbackRate = nextSeg.speed ?? 1
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/preview/VideoPreview.tsx
git commit -m "feat: apply segment volume and playbackRate in VideoPreview"
```
