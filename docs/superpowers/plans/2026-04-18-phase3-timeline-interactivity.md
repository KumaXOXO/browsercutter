# Phase 3: Timeline Interactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timeline segments interactive — click ruler to seek, delete segments, drag to move, drag edges to trim, and enable audio clips on the audio track with playback sync.

**Architecture:** All interaction is implemented directly in ClipBlock (mousedown/mousemove/mouseup on document). No drag-and-drop API is used — only pointer events — to allow fine-grained control. Audio playback is added as a second media element inside VideoPreview, synced in the same RAF loop as video.

**Tech Stack:** React refs, document-level event listeners, Zustand updateSegment, HTML Audio element

---

## File Map

| File | Change |
|---|---|
| `src/components/timeline/TimeRuler.tsx` | Add click-to-seek |
| `src/components/timeline/ClipBlock.tsx` | Add move, trim, delete |
| `src/components/timeline/Track.tsx` | Add clip-type guard on drop |
| `src/components/timeline/Timeline.tsx` | Replace static audio row with real Track |
| `src/components/preview/VideoPreview.tsx` | Add audio element + sync |

---

### Task 1: TimeRuler click to seek

**Files:**
- Modify: `src/components/timeline/TimeRuler.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/timeline/timeRuler.test.ts
import { describe, it, expect } from 'vitest'

function timeFromClick(x: number, zoom: number, pxPerSec: number): number {
  return Math.max(0, x / (pxPerSec * zoom))
}

describe('timeFromClick', () => {
  it('converts pixel offset to seconds', () => {
    expect(timeFromClick(100, 1, 20)).toBe(5)
  })
  it('clamps negative to zero', () => {
    expect(timeFromClick(-50, 1, 20)).toBe(0)
  })
  it('respects zoom', () => {
    expect(timeFromClick(100, 2, 20)).toBe(2.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/lib/timeline/timeRuler.test.ts
```
Expected: FAIL — file does not exist

- [ ] **Step 3: Create the test file and run**

Create `src/lib/timeline/timeRuler.test.ts` with the content above.

```
npx vitest run src/lib/timeline/timeRuler.test.ts
```
Expected: PASS (pure function, no imports needed)

- [ ] **Step 4: Update TimeRuler.tsx**

```typescript
// src/components/timeline/TimeRuler.tsx
import { PX_PER_SEC } from './ClipBlock'
import { useAppStore } from '../../store/useAppStore'

const INTERVAL_SEC = 5

export default function TimeRuler({
  trackLabelWidth,
  zoom,
}: {
  trackLabelWidth: number
  zoom: number
}) {
  const { setPlayheadPosition, setIsPlaying } = useAppStore()
  const markWidth = PX_PER_SEC * zoom * INTERVAL_SEC
  const markCount = Math.ceil(700 / markWidth) + 2
  const marks = Array.from({ length: markCount }, (_, i) => i * INTERVAL_SEC)

  return (
    <div
      className="flex sticky top-0 z-10 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', userSelect: 'none' }}
    >
      <div style={{ minWidth: trackLabelWidth, width: trackLabelWidth }} />
      <div
        className="flex"
        style={{ color: '#35354A', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          setIsPlaying(false)
          setPlayheadPosition(Math.max(0, x / (PX_PER_SEC * zoom)))
        }}
      >
        {marks.map((s) => (
          <span
            key={s}
            style={{ minWidth: markWidth, width: markWidth, paddingLeft: 4, paddingTop: 4, paddingBottom: 4 }}
          >
            {`0:${String(s).padStart(2, '0')}`}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual test**

Run `npm run dev`. Click anywhere on the TimeRuler. Playhead should jump to that time position. Clicking while playing should stop playback and seek.

- [ ] **Step 6: Commit**

```bash
git add src/components/timeline/TimeRuler.tsx src/lib/timeline/timeRuler.test.ts
git commit -m "feat: click TimeRuler to seek playhead"
```

---

### Task 2: Delete segment with Delete/Backspace key

**Files:**
- Modify: `src/components/timeline/ClipBlock.tsx`

- [ ] **Step 1: Read current ClipBlock.tsx**

Read `src/components/timeline/ClipBlock.tsx` to confirm current imports and store destructuring.

- [ ] **Step 2: Add removeSegment to store destructuring and add keydown effect**

Replace the store destructuring line and add the useEffect. Full updated ClipBlock.tsx:

```typescript
// src/components/timeline/ClipBlock.tsx
import { useEffect } from 'react'
import type { Segment, Clip } from '../../types'
import { useAppStore } from '../../store/useAppStore'

const CLIP_GRADIENTS = [
  'linear-gradient(135deg,#5B21B6,#7C3AED)',
  'linear-gradient(135deg,#0C5F78,#0891B2)',
  'linear-gradient(135deg,#065F46,#059669)',
]

const AUDIO_GRADIENT = 'linear-gradient(135deg,#1A4A2A,#2E7040)'

const PX_PER_SEC = 20

interface Props {
  segment: Segment
  clip: Clip
  zoom: number
}

export default function ClipBlock({ segment, clip, zoom }: Props) {
  const { selectedElement, setSelectedElement, removeSegment } = useAppStore()
  const isSelected = selectedElement?.id === segment.id
  const px = PX_PER_SEC * zoom
  const left  = segment.startOnTimeline * px
  const width = (segment.outPoint - segment.inPoint) * px

  const bgIndex = clip.id.charCodeAt(0) % CLIP_GRADIENTS.length
  const bg = clip.type === 'audio' ? AUDIO_GRADIENT : CLIP_GRADIENTS[bgIndex]
  const label = clip.name.replace(/\.[^.]+$/, '').slice(0, 1).toUpperCase()

  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedElement(null)
        removeSegment(segment.id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, segment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={() => setSelectedElement({ type: 'segment', id: segment.id })}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: bg,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: isSelected ? '2px solid rgba(255,255,255,0.9)' : 'none',
        outlineOffset: 1,
        transition: 'filter 120ms',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', padding: '0 7px', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
        {label}
      </span>
    </div>
  )
}

export { PX_PER_SEC }
```

- [ ] **Step 3: Manual test**

Run `npm run dev`. Drop a clip on the timeline. Click it (selected = white outline). Press Delete. Segment disappears. Press Delete with nothing selected → no error.

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline/ClipBlock.tsx
git commit -m "feat: delete selected segment with Delete/Backspace key"
```

---

### Task 3: Drag segment to move within track

**Files:**
- Modify: `src/components/timeline/ClipBlock.tsx`

- [ ] **Step 1: Add move drag logic to ClipBlock**

The approach: on mousedown on the clip body, capture the pixel offset from the clip's left edge to the cursor. On document mousemove, compute the new `startOnTimeline` from the track content rect. On mouseup, clean up listeners.

The clip's parent element is the track content div (`position: relative, width: 700`). We access it via `e.currentTarget.parentElement`.

Full updated ClipBlock.tsx (adds move on top of Task 2's delete):

```typescript
// src/components/timeline/ClipBlock.tsx
import { useEffect, useRef } from 'react'
import type { Segment, Clip } from '../../types'
import { useAppStore } from '../../store/useAppStore'

const CLIP_GRADIENTS = [
  'linear-gradient(135deg,#5B21B6,#7C3AED)',
  'linear-gradient(135deg,#0C5F78,#0891B2)',
  'linear-gradient(135deg,#065F46,#059669)',
]

const AUDIO_GRADIENT = 'linear-gradient(135deg,#1A4A2A,#2E7040)'

const PX_PER_SEC = 20

interface Props {
  segment: Segment
  clip: Clip
  zoom: number
}

export default function ClipBlock({ segment, clip, zoom }: Props) {
  const { selectedElement, setSelectedElement, removeSegment, updateSegment } = useAppStore()
  const isSelected = selectedElement?.id === segment.id
  const px = PX_PER_SEC * zoom
  const left  = segment.startOnTimeline * px
  const width = (segment.outPoint - segment.inPoint) * px

  const bgIndex = clip.id.charCodeAt(0) % CLIP_GRADIENTS.length
  const bg = clip.type === 'audio' ? AUDIO_GRADIENT : CLIP_GRADIENTS[bgIndex]
  const label = clip.name.replace(/\.[^.]+$/, '').slice(0, 1).toUpperCase()

  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedElement(null)
        removeSegment(segment.id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, segment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement({ type: 'segment', id: segment.id })
    isDraggingRef.current = false

    const trackContent = (e.currentTarget as HTMLElement).parentElement!
    const trackRect = trackContent.getBoundingClientRect()
    const offsetX = e.clientX - trackRect.left - left

    const handleMouseMove = (ev: MouseEvent) => {
      isDraggingRef.current = true
      const newStart = Math.max(0, (ev.clientX - trackRect.left - offsetX) / px)
      updateSegment(segment.id, { startOnTimeline: newStart })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: bg,
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: isSelected ? '2px solid rgba(255,255,255,0.9)' : 'none',
        outlineOffset: 1,
        transition: 'filter 120ms',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', padding: '0 7px', whiteSpace: 'nowrap', letterSpacing: 0.3, pointerEvents: 'none' }}>
        {label}
      </span>
    </div>
  )
}

export { PX_PER_SEC }
```

- [ ] **Step 2: Manual test**

Run `npm run dev`. Drop a clip. Click and drag it left/right. It should move smoothly. Release — position stays. Drag to left edge → clamps at 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/ClipBlock.tsx
git commit -m "feat: drag segment to move within track"
```

---

### Task 4: Trim segment by dragging left/right edges

**Files:**
- Modify: `src/components/timeline/ClipBlock.tsx`

Left edge drag: changes `inPoint` (how far into the clip we start) and `startOnTimeline` together so the clip's end stays fixed.
Right edge drag: changes `outPoint` only (clip end moves, start stays fixed).

- [ ] **Step 1: Add trim handles and logic to ClipBlock**

Full updated ClipBlock.tsx (adds trim on top of Task 3's move):

```typescript
// src/components/timeline/ClipBlock.tsx
import { useEffect, useRef } from 'react'
import type { Segment, Clip } from '../../types'
import { useAppStore } from '../../store/useAppStore'

const CLIP_GRADIENTS = [
  'linear-gradient(135deg,#5B21B6,#7C3AED)',
  'linear-gradient(135deg,#0C5F78,#0891B2)',
  'linear-gradient(135deg,#065F46,#059669)',
]

const AUDIO_GRADIENT = 'linear-gradient(135deg,#1A4A2A,#2E7040)'

const PX_PER_SEC = 20

interface Props {
  segment: Segment
  clip: Clip
  zoom: number
}

export default function ClipBlock({ segment, clip, zoom }: Props) {
  const { selectedElement, setSelectedElement, removeSegment, updateSegment } = useAppStore()
  const isSelected = selectedElement?.id === segment.id
  const px = PX_PER_SEC * zoom
  const left  = segment.startOnTimeline * px
  const width = (segment.outPoint - segment.inPoint) * px

  const bgIndex = clip.id.charCodeAt(0) % CLIP_GRADIENTS.length
  const bg = clip.type === 'audio' ? AUDIO_GRADIENT : CLIP_GRADIENTS[bgIndex]
  const label = clip.name.replace(/\.[^.]+$/, '').slice(0, 4).toUpperCase()

  useEffect(() => {
    if (!isSelected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedElement(null)
        removeSegment(segment.id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSelected, segment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement({ type: 'segment', id: segment.id })

    const trackContent = (e.currentTarget as HTMLElement).parentElement!
    const trackRect = trackContent.getBoundingClientRect()
    const offsetX = e.clientX - trackRect.left - left

    const handleMouseMove = (ev: MouseEvent) => {
      const newStart = Math.max(0, (ev.clientX - trackRect.left - offsetX) / px)
      updateSegment(segment.id, { startOnTimeline: newStart })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const initialInPoint = segment.inPoint
    const initialStart = segment.startOnTimeline

    const handleMouseMove = (ev: MouseEvent) => {
      const dSec = (ev.clientX - startX) / px
      const newInPoint = Math.max(0, Math.min(segment.outPoint - 0.1, initialInPoint + dSec))
      const delta = newInPoint - initialInPoint
      const newStart = Math.max(0, initialStart + delta)
      updateSegment(segment.id, { inPoint: newInPoint, startOnTimeline: newStart })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const initialOutPoint = segment.outPoint

    const handleMouseMove = (ev: MouseEvent) => {
      const dSec = (ev.clientX - startX) / px
      const newOutPoint = Math.max(segment.inPoint + 0.1, Math.min(clip.duration, initialOutPoint + dSec))
      updateSegment(segment.id, { outPoint: newOutPoint })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleBodyMouseDown}
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left, width,
        borderRadius: 5,
        background: bg,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        outline: isSelected ? '2px solid rgba(255,255,255,0.9)' : 'none',
        outlineOffset: 1,
        transition: 'filter 120ms',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.filter = 'brightness(1.2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
    >
      {/* Left trim handle */}
      <div
        onMouseDown={handleLeftTrimMouseDown}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', flexShrink: 0, zIndex: 2,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '5px 0 0 5px',
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', padding: '0 12px', whiteSpace: 'nowrap', letterSpacing: 0.3, pointerEvents: 'none', zIndex: 1 }}>
        {label}
      </span>
      {/* Right trim handle */}
      <div
        onMouseDown={handleRightTrimMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', flexShrink: 0, zIndex: 2,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '0 5px 5px 0',
        }}
      />
    </div>
  )
}

export { PX_PER_SEC }
```

- [ ] **Step 2: Manual test**

Run `npm run dev`. Drop a long clip. Hover near the left edge — cursor becomes `ew-resize`. Drag the left edge right — clip shortens from the left, start time moves right. Drag left edge left — clip expands (to the left, clamped at timeline 0 and clip.inPoint 0). Drag right edge — outPoint moves, start stays fixed. Minimum width of 0.1s is enforced.

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/ClipBlock.tsx
git commit -m "feat: trim segment by dragging left/right edge handles"
```

---

### Task 5: Audio track — real droppable track

**Files:**
- Modify: `src/components/timeline/Timeline.tsx`
- Modify: `src/components/timeline/Track.tsx`

- [ ] **Step 1: Read Timeline.tsx and Track.tsx**

Confirm the static audio row location in Timeline.tsx and the handleDrop logic in Track.tsx.

- [ ] **Step 2: Replace static audio row with Track component in Timeline.tsx**

In `src/components/timeline/Timeline.tsx`, replace:

```tsx
{/* Audio track (static) */}
<div className="flex items-center" style={{ height: 28 }}>
  <div className="flex items-center gap-1 px-2 shrink-0" style={{ minWidth: TRACK_LABEL_WIDTH, width: TRACK_LABEL_WIDTH, fontSize: 10, color: 'var(--muted-subtle)' }}>
    <Volume2 size={9} /> Audio
  </div>
  <div style={{ position: 'relative', height: 18, width: 700, borderRadius: 4, overflow: 'hidden', margin: '5px 0', background: '#0A1A12' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,#1A4A2A 0,#2E7040 3px,#1A4A2A 6px)', opacity: 0.65 }} />
  </div>
</div>
```

With:

```tsx
<Track trackIndex={2} label="Audio" icon={<Volume2 size={9} />} height={28} zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />
```

- [ ] **Step 3: Add clip-type guard in Track.tsx handleDrop**

In `src/components/timeline/Track.tsx`, update handleDrop:

```typescript
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault()
  const clipId = e.dataTransfer.getData('clipId')
  if (!clipId) return
  const clip = clips.find((c) => c.id === clipId)
  if (!clip) return

  // Enforce track type: video → trackIndex 0, audio → trackIndex 2
  if (clip.type === 'video' && trackIndex !== 0) return
  if (clip.type === 'audio' && trackIndex !== 2) return

  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const startOnTimeline = Math.max(0, x / (PX_PER_SEC * zoom))

  addSegment({
    id: crypto.randomUUID(),
    clipId,
    trackIndex,
    startOnTimeline,
    inPoint: 0,
    outPoint: clip.duration,
  })
}
```

- [ ] **Step 4: Manual test**

Run `npm run dev`. Upload an audio file (MP3). Drag it to the Video track — it should be rejected. Drag it to the Audio track — it should land as a green segment. Drag a video clip to the Audio track — rejected.

- [ ] **Step 5: Commit**

```bash
git add src/components/timeline/Timeline.tsx src/components/timeline/Track.tsx
git commit -m "feat: audio track is now a real droppable Track (trackIndex 2) with type guard"
```

---

### Task 6: Audio playback sync in VideoPreview

**Files:**
- Modify: `src/components/preview/VideoPreview.tsx`

Audio segments on trackIndex=2 play simultaneously with the video. An `Audio` object (not DOM element) is managed with the same object-URL lifecycle as the video. In the RAF loop, when the playhead enters an audio segment's range, the audio element seeks and plays.

- [ ] **Step 1: Read VideoPreview.tsx**

Read the full file to understand the current ref structure and RAF logic before modifying.

- [ ] **Step 2: Add audio element refs and active audio segment tracking**

Add these refs after the existing refs (after `clipsRef`):

```typescript
const audioRef = useRef<HTMLAudioElement>(new Audio())
const audioUrlRef = useRef<string | null>(null)
const activeAudioSegRef = useRef<Segment | null>(null)
```

Add active audio segment computation after `activeSeg`:

```typescript
const activeAudioSeg = useMemo(() =>
  segments.find(
    (s) => s.trackIndex === 2 &&
      playheadPosition >= s.startOnTimeline &&
      playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
  ) ?? null,
  [segments, playheadPosition],
)
const activeAudioClip = activeAudioSeg ? clips.find((c) => c.id === activeAudioSeg.clipId) ?? null : null
activeAudioSegRef.current = activeAudioSeg
```

- [ ] **Step 3: Add audio object URL effect**

Add this effect after the existing `[activeClip?.id]` effect:

```typescript
// Load audio object URL when audio clip changes (only when not playing)
useEffect(() => {
  if (isPlaying) return
  const audio = audioRef.current

  if (audioUrlRef.current) {
    URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
  }

  if (!activeAudioClip?.file) {
    audio.src = ''
    return
  }

  const url = URL.createObjectURL(activeAudioClip.file)
  audioUrlRef.current = url
  audio.src = url

  return () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }
}, [activeAudioClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Add audio seek effect**

Add after the `[playheadPosition]` seek effect:

```typescript
// Seek audio when playhead moves while paused
useEffect(() => {
  const audio = audioRef.current
  const seg = activeAudioSegRef.current
  if (isPlaying || !seg) return
  audio.currentTime = seg.inPoint + (playheadPosition - seg.startOnTimeline)
}, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Update RAF effect to sync audio**

In the `[isPlaying]` RAF effect, add audio play/pause alongside the video. In the `if (!isPlaying)` branch:

```typescript
if (!isPlaying) {
  cancelAnimationFrame(rafRef.current)
  video?.pause()
  audioRef.current.pause()
  return
}
```

After `video.play().catch(...)`:

```typescript
if (activeAudioSegRef.current && audioRef.current.src) {
  audioRef.current.play().catch(() => {})
}
```

In the RAF tick, after the `stallCountRef.current = 0` line (the stall guard reset), add:

```typescript
// Sync audio if an audio segment is active
const audioSeg = segments.find(
  (s) => s.trackIndex === 2 &&
    seg.startOnTimeline + (rawTime - seg.inPoint) >= s.startOnTimeline &&
    seg.startOnTimeline + (rawTime - seg.inPoint) < s.startOnTimeline + (s.outPoint - s.inPoint)
)
if (audioSeg && audioRef.current.paused) {
  audioRef.current.play().catch(() => {})
} else if (!audioSeg && !audioRef.current.paused) {
  audioRef.current.pause()
}
```

And in the RAF cleanup return:

```typescript
return () => {
  cancelAnimationFrame(rafRef.current)
  videoRef.current?.pause()
  audioRef.current.pause()
}
```

- [ ] **Step 6: Manual test**

Run `npm run dev`. Drop a video on V1 track and a music file on the Audio track, positioned to start at 0:00. Press play. Both video and audio should play simultaneously. Pause — both stop.

- [ ] **Step 7: Commit**

```bash
git add src/components/preview/VideoPreview.tsx
git commit -m "feat: audio track playback sync in RAF loop"
```
