# Text Overlays — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement text overlay creation from the Text panel, SRT subtitle import, a live text renderer overlay on the video preview, and visual TextOverlay blocks on the timeline's Text track.

**Architecture:** Phase 4 already added `addTextOverlay`, `updateTextOverlay`, `removeTextOverlay` to the store. This phase wires the TextPanel buttons, creates a `parseSrt` utility, replaces the static Text track row in Timeline with a `TextTrack` component that renders clickable overlay blocks, and adds a `TextOverlayRenderer` inside VideoPreview that renders active overlays as absolutely positioned divs over the video.

**Tech Stack:** React 18, TypeScript, Zustand 5, uuid

**Prerequisite:** Phase 4 must be complete (store textOverlay actions exist).

---

### Task 1: Wire TextPanel "Add Text Overlay" button

**Files:**
- Modify: `src/components/panels/TextPanel.tsx`

- [ ] **Step 1: Add store imports**

At the top of `src/components/panels/TextPanel.tsx`, add the imports:

```typescript
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../../store/useAppStore'
```

- [ ] **Step 2: Wire the Add Text Overlay button**

Replace the existing `export default function TextPanel()` with:

```tsx
export default function TextPanel() {
  const { addTextOverlay, setSelectedElement, playheadPosition } = useAppStore()

  function handleAddText() {
    const id = uuidv4()
    addTextOverlay({
      id,
      text: 'New Text',
      startOnTimeline: playheadPosition,
      duration: 3,
      font: 'Inter',
      size: 32,
      color: '#FFFFFF',
      x: 0.5,
      y: 0.85,
    })
    setSelectedElement({ type: 'text', id })
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 overflow-y-auto h-full">
      <PanelLabel>Text &amp; Subtitles</PanelLabel>
      <GhostAction icon={<Type size={13} />} label="Add Text Overlay" onClick={handleAddText} />
      <GhostAction icon={<FileText size={13} />} label="Import .srt File" onClick={() => alert('SRT import — Task 3')} />
      <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>No text or subtitles added yet.</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/TextPanel.tsx
git commit -m "feat: wire Add Text Overlay button in TextPanel"
```

---

### Task 2: Create SRT parser

**Files:**
- Create: `src/lib/srt/parseSrt.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/lib/srt
```

- [ ] **Step 2: Write the parser**

Create `src/lib/srt/parseSrt.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { TextOverlay } from '../../types'

export function parseSrt(srtContent: string): TextOverlay[] {
  const blocks = srtContent.trim().split(/\n\s*\n/)
  return blocks.flatMap((block) => {
    const lines = block.trim().split('\n')
    if (lines.length < 3) return []
    const timeLine = lines[1]
    const match = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/
    )
    if (!match) return []
    const startOnTimeline = srtTimeToSeconds(match[1])
    const endTime = srtTimeToSeconds(match[2])
    const text = lines.slice(2).join('\n').trim()
    if (!text) return []
    return [{
      id: uuidv4(),
      text,
      startOnTimeline,
      duration: Math.max(0.1, endTime - startOnTimeline),
      font: 'Inter',
      size: 32,
      color: '#FFFFFF',
      x: 0.5,
      y: 0.85,
    }] as TextOverlay[]
  })
}

function srtTimeToSeconds(t: string): number {
  const normalized = t.replace(',', '.')
  const [h, m, s] = normalized.split(':')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)
}
```

- [ ] **Step 3: Write a quick smoke test**

Create `src/lib/srt/parseSrt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseSrt } from './parseSrt'

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:09,200
Second subtitle
with two lines`

describe('parseSrt', () => {
  it('parses two subtitle blocks', () => {
    const result = parseSrt(SRT)
    expect(result).toHaveLength(2)
  })

  it('first block has correct timing', () => {
    const [first] = parseSrt(SRT)
    expect(first.startOnTimeline).toBe(1)
    expect(first.duration).toBeCloseTo(3)
    expect(first.text).toBe('Hello world')
  })

  it('second block joins multi-line text', () => {
    const [, second] = parseSrt(SRT)
    expect(second.text).toBe('Second subtitle\nwith two lines')
    expect(second.startOnTimeline).toBeCloseTo(5.5)
    expect(second.duration).toBeCloseTo(3.7)
  })

  it('returns empty array for invalid input', () => {
    expect(parseSrt('')).toHaveLength(0)
    expect(parseSrt('not an srt')).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/srt/parseSrt.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srt/
git commit -m "feat: add SRT subtitle parser with tests"
```

---

### Task 3: Wire "Import .srt File" in TextPanel

**Files:**
- Modify: `src/components/panels/TextPanel.tsx`

- [ ] **Step 1: Add parseSrt import**

At the top of `src/components/panels/TextPanel.tsx`, add:

```typescript
import { parseSrt } from '../../lib/srt/parseSrt'
```

- [ ] **Step 2: Add the handleImportSrt function inside TextPanel**

Inside the `TextPanel` function body, after `handleAddText`, add:

```typescript
  async function handleImportSrt() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.srt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const overlays = parseSrt(text)
      overlays.forEach(addTextOverlay)
    }
    input.click()
  }
```

- [ ] **Step 3: Wire the button**

Change the Import .srt GhostAction `onClick`:

```tsx
<GhostAction icon={<FileText size={13} />} label="Import .srt File" onClick={handleImportSrt} />
```

- [ ] **Step 4: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/TextPanel.tsx
git commit -m "feat: wire SRT import in TextPanel"
```

---

### Task 4: Create TextTrack timeline component

**Files:**
- Create: `src/components/timeline/TextTrack.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/timeline/TextTrack.tsx`:

```tsx
import { Type } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

interface Props {
  zoom: number
  trackLabelWidth: number
}

export default function TextTrack({ zoom, trackLabelWidth }: Props) {
  const { textOverlays, selectedElement, setSelectedElement } = useAppStore()
  const px = PX_PER_SEC * zoom

  return (
    <div
      className="flex items-center"
      style={{ height: 26, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div
        className="flex items-center gap-1 px-2 shrink-0"
        style={{ minWidth: trackLabelWidth, width: trackLabelWidth, fontSize: 10, color: 'var(--muted-subtle)' }}
      >
        <Type size={9} /> Text
      </div>
      <div className="relative h-full" style={{ width: 700 }}>
        {textOverlays.map((overlay) => {
          const left = overlay.startOnTimeline * px
          const width = Math.max(4, overlay.duration * px)
          const isSelected = selectedElement?.id === overlay.id
          return (
            <div
              key={overlay.id}
              onClick={() => setSelectedElement({ type: 'text', id: overlay.id })}
              style={{
                position: 'absolute',
                top: 3, bottom: 3,
                left, width,
                borderRadius: 4,
                background: 'rgba(234,179,8,0.18)',
                border: isSelected
                  ? '2px solid rgba(255,255,255,0.9)'
                  : '1px solid rgba(234,179,8,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                transition: 'filter 120ms',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, color: '#FDE68A', padding: '0 5px', whiteSpace: 'nowrap' }}>
                T {overlay.text.slice(0, 14)}{overlay.text.length > 14 ? '…' : ''}
              </span>
            </div>
          )
        })}
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
git add src/components/timeline/TextTrack.tsx
git commit -m "feat: add TextTrack timeline component for text overlays"
```

---

### Task 5: Replace static Text track row in Timeline with TextTrack

**Files:**
- Modify: `src/components/timeline/Timeline.tsx`

- [ ] **Step 1: Add TextTrack import**

At the top of `src/components/timeline/Timeline.tsx`, add:

```typescript
import TextTrack from './TextTrack'
```

Remove the `Type` import from `lucide-react` since TextTrack handles its own icon. The import line currently reads:
```typescript
import { Film, Type, Volume2 } from 'lucide-react'
```
Change it to:
```typescript
import { Film, Volume2 } from 'lucide-react'
```

- [ ] **Step 2: Replace the static Text track row**

Find the `<Track trackIndex={1} label="Text" ...>` line and replace it with:

```tsx
          <TextTrack zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline/Timeline.tsx
git commit -m "feat: replace static Text track with TextTrack component in Timeline"
```

---

### Task 6: Create TextOverlayRenderer

**Files:**
- Create: `src/components/preview/TextOverlayRenderer.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/preview/TextOverlayRenderer.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore'

export default function TextOverlayRenderer() {
  const textOverlays = useAppStore((s) => s.textOverlays)
  const playheadPosition = useAppStore((s) => s.playheadPosition)

  const active = textOverlays.filter(
    (o) => playheadPosition >= o.startOnTimeline &&
           playheadPosition < o.startOnTimeline + o.duration
  )

  if (active.length === 0) return null

  return (
    <>
      {active.map((overlay) => (
        <div
          key={overlay.id}
          style={{
            position: 'absolute',
            left: `${overlay.x * 100}%`,
            top: `${overlay.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            color: overlay.color,
            fontSize: overlay.size,
            fontFamily: overlay.font,
            fontWeight: 700,
            pointerEvents: 'none',
            textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            maxWidth: '80%',
            lineHeight: 1.25,
            zIndex: 10,
          }}
        >
          {overlay.text}
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/preview/TextOverlayRenderer.tsx
git commit -m "feat: add TextOverlayRenderer component for live text preview"
```

---

### Task 7: Mount TextOverlayRenderer inside VideoPreview

**Files:**
- Modify: `src/components/preview/VideoPreview.tsx`

- [ ] **Step 1: Add import**

At the top of `src/components/preview/VideoPreview.tsx`, add:

```typescript
import TextOverlayRenderer from './TextOverlayRenderer'
```

- [ ] **Step 2: Mount the renderer inside the video container**

Find the inner `<div>` that wraps the `<video>` element (the one with `style={{ aspectRatio: '16/9', ... }}`). Inside it, just after `</video>` and before the `{!hasSegments && ...}` empty-state block, add:

```tsx
        <TextOverlayRenderer />
```

The container already has `position: 'relative'` and `overflow: 'hidden'`, so the absolutely positioned overlays will clip correctly.

- [ ] **Step 3: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all existing tests + SRT tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/preview/VideoPreview.tsx
git commit -m "feat: mount TextOverlayRenderer in VideoPreview for live text overlay"
```
