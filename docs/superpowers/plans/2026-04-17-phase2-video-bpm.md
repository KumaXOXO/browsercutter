# Phase 2: Video Playback & BPM Cutting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real HTML5 video playback, drag-to-timeline, BPM auto-detection, and three BPM cutting modes (Sequential, Random, Forfeit) into the existing BrowserCutter shell.

**Architecture:** All state lives in Zustand (`useAppStore`). A single `<video>` element inside `VideoPreview` owns playback; a `requestAnimationFrame` loop inside that component reads `video.currentTime` and writes `playheadPosition` to the store. `PlaybackControls` and `Timeline` are pure consumers of that store state. BPM cutting is a pure function `generateCut(clips, config) → Segment[]` tested with Vitest.

**Tech Stack:** React 18, TypeScript, Zustand 5, Web Audio API (`AudioContext.decodeAudioData`), `requestAnimationFrame`, Vitest (new devDep), uuid (already installed).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/store/useAppStore.ts` | Modify | Add `isPlaying: boolean` + `setIsPlaying` + `replaceSegments` |
| `src/components/timeline/TimeRuler.tsx` | Modify | Accept `zoom` prop, compute mark width dynamically |
| `src/components/timeline/Timeline.tsx` | Modify | Wire playhead from store, pass zoom to TimeRuler |
| `src/components/timeline/Track.tsx` | Modify | Add `zoom` prop + drop zone handler that creates segments |
| `src/components/panels/MediaPanel/VideoGrid.tsx` | Modify | Add `draggable` + `onDragStart` to VideoThumb |
| `src/components/preview/VideoPreview.tsx` | Rewrite | Real `<video>` element, object URL lifecycle, seek sync, RAF loop |
| `src/components/preview/PlaybackControls.tsx` | Rewrite | Wire play/pause, seek bar, live timecodes, skip buttons |
| `src/lib/audio/bpmDetector.ts` | Create | Web Audio API BPM detection |
| `src/lib/bpm/generateCut.ts` | Create | Pure cutting algorithm for Sequential, Random, Forfeit modes |
| `src/lib/bpm/generateCut.test.ts` | Create | Vitest unit tests for all three modes |
| `src/components/panels/BpmPanel.tsx` | Modify | Wire Auto-Detect button + Generate Cut button |
| `vite.config.ts` | Modify | Add Vitest test config |
| `package.json` | Modify | Add `vitest` devDep + `"test"` script |

---

## Task 1: Store + Timeline Plumbing

**Files:**
- Modify: `src/store/useAppStore.ts`
- Modify: `src/components/timeline/TimeRuler.tsx`
- Modify: `src/components/timeline/Timeline.tsx`

- [ ] **Step 1: Add `isPlaying` and `replaceSegments` to store**

Open `src/store/useAppStore.ts`. Replace the entire file with:

```typescript
// src/store/useAppStore.ts
import { create } from 'zustand'
import type {
  Clip, ClipId, Segment, SegmentId, AdjustmentLayer,
  Transition, TextOverlay, BpmConfig, ProjectSettings,
  ActiveTab, MediaSubTab, SelectedElement,
} from '../types'

interface AppState {
  // ─── Navigation ───
  activeTab: ActiveTab
  mediaSubTab: MediaSubTab
  selectedElement: SelectedElement | null

  // ─── Project ───
  projectName: string
  projectSettings: ProjectSettings

  // ─── Media library ───
  clips: Clip[]

  // ─── Timeline ───
  segments: Segment[]
  adjustmentLayers: AdjustmentLayer[]
  transitions: Transition[]
  textOverlays: TextOverlay[]
  playheadPosition: number  // seconds
  isPlaying: boolean

  // ─── BPM tool ───
  bpmConfig: BpmConfig

  // ─── Actions ───
  setActiveTab: (tab: ActiveTab) => void
  setMediaSubTab: (tab: MediaSubTab) => void
  setSelectedElement: (el: SelectedElement | null) => void
  setProjectName: (name: string) => void
  updateProjectSettings: (settings: Partial<ProjectSettings>) => void

  addClip: (clip: Clip) => void
  removeClip: (id: ClipId) => void

  addSegment: (segment: Segment) => void
  removeSegment: (id: SegmentId) => void
  updateSegment: (id: SegmentId, patch: Partial<Segment>) => void
  addSegments: (segments: Segment[]) => void
  replaceSegments: (segments: Segment[]) => void

  updateBpmConfig: (patch: Partial<BpmConfig>) => void
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // ─── Navigation ───
  activeTab: 'media',
  mediaSubTab: 'videos',
  selectedElement: null,

  // ─── Project ───
  projectName: 'Untitled Project',
  projectSettings: {
    resolution: '1920x1080',
    fps: 30,
    format: 'mp4',
    autoDetectBpm: true,
    snapToBeat: true,
    hardwareAcceleration: false,
  },

  // ─── Media library ───
  clips: [],

  // ─── Timeline ───
  segments: [],
  adjustmentLayers: [],
  transitions: [],
  textOverlays: [],
  playheadPosition: 0,
  isPlaying: false,

  // ─── BPM tool ───
  bpmConfig: {
    bpm: 128,
    mode: 'random',
    segmentLength: 1,
    outputDuration: 30,
    outputUnit: 'seconds',
    selectedClipIds: [],
  },

  // ─── Actions ───
  setActiveTab: (tab) => set({ activeTab: tab }),
  setMediaSubTab: (tab) => set({ mediaSubTab: tab }),
  setSelectedElement: (el) => set({ selectedElement: el, activeTab: el ? 'inspector' : 'media' }),
  setProjectName: (name) => set({ projectName: name }),
  updateProjectSettings: (patch) =>
    set((s) => ({ projectSettings: { ...s.projectSettings, ...patch } })),

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

  addSegment: (segment) => set((s) => ({ segments: [...s.segments, segment] })),
  removeSegment: (id) => set((s) => ({ segments: s.segments.filter((seg) => seg.id !== id) })),
  updateSegment: (id, patch) =>
    set((s) => ({ segments: s.segments.map((seg) => seg.id === id ? { ...seg, ...patch } : seg) })),
  addSegments: (newSegs) => set((s) => ({ segments: [...s.segments, ...newSegs] })),
  replaceSegments: (newSegs) => set({ segments: newSegs }),

  updateBpmConfig: (patch) =>
    set((s) => ({ bpmConfig: { ...s.bpmConfig, ...patch } })),
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}))
```

- [ ] **Step 2: Rewrite TimeRuler to be zoom-aware**

Open `src/components/timeline/TimeRuler.tsx`. Replace with:

```typescript
// src/components/timeline/TimeRuler.tsx
import { PX_PER_SEC } from './ClipBlock'

const INTERVAL_SEC = 5 // seconds between ruler marks

export default function TimeRuler({
  trackLabelWidth,
  zoom,
}: {
  trackLabelWidth: number
  zoom: number
}) {
  const markWidth = PX_PER_SEC * zoom * INTERVAL_SEC
  const markCount = Math.ceil(700 / markWidth) + 2
  const marks = Array.from({ length: markCount }, (_, i) => i * INTERVAL_SEC)

  return (
    <div
      className="flex sticky top-0 z-10 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', userSelect: 'none' }}
    >
      <div style={{ minWidth: trackLabelWidth, width: trackLabelWidth }} />
      <div className="flex" style={{ color: '#35354A', fontSize: 9, fontFamily: 'monospace' }}>
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

- [ ] **Step 3: Wire playhead in Timeline + pass zoom to ruler and tracks**

Open `src/components/timeline/Timeline.tsx`. Replace with:

```typescript
// src/components/timeline/Timeline.tsx
import { useState } from 'react'
import { Film, Type, Volume2 } from 'lucide-react'
import TimeRuler from './TimeRuler'
import Track from './Track'
import { useAppStore } from '../../store/useAppStore'
import { PX_PER_SEC } from './ClipBlock'

const TRACK_LABEL_WIDTH = 78

export default function Timeline() {
  const [zoom, setZoom] = useState(1)
  const playheadPosition = useAppStore((s) => s.playheadPosition)
  const playheadLeft = TRACK_LABEL_WIDTH + playheadPosition * PX_PER_SEC * zoom

  return (
    <div
      className="flex flex-col shrink-0"
      style={{ height: 205, background: 'var(--bg)', borderTop: '1px solid var(--border-subtle)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-2.5 shrink-0"
        style={{ height: 30, background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted-subtle)', fontSize: 10 }}>Timeline</span>
          <button
            className="text-xs rounded cursor-pointer transition-all duration-150"
            style={{ padding: '2px 8px', color: 'var(--muted2)', background: 'transparent', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--muted2)' }}
          >
            + Track
          </button>
        </div>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 72, accentColor: '#E11D48', cursor: 'pointer' }}
        />
      </div>

      {/* Scrollable tracks */}
      <div className="flex-1 overflow-auto relative">
        <TimeRuler trackLabelWidth={TRACK_LABEL_WIDTH} zoom={zoom} />
        <div style={{ position: 'relative' }}>
          {/* Playhead */}
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: playheadLeft,
              width: 1.5, background: '#E11D48', zIndex: 20, pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', top: -2, left: -5, width: 12, height: 8, background: '#E11D48', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', borderRadius: 2 }} />
          </div>

          <Track trackIndex={0} label="V1" icon={<Film size={9} />} height={38} zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />
          <Track trackIndex={1} label="Text" icon={<Type size={9} />} height={26} zoom={zoom} trackLabelWidth={TRACK_LABEL_WIDTH} />

          {/* Audio track (static) */}
          <div className="flex items-center" style={{ height: 28 }}>
            <div className="flex items-center gap-1 px-2 shrink-0" style={{ minWidth: TRACK_LABEL_WIDTH, width: TRACK_LABEL_WIDTH, fontSize: 10, color: 'var(--muted-subtle)' }}>
              <Volume2 size={9} /> Audio
            </div>
            <div style={{ position: 'relative', height: 18, width: 700, borderRadius: 4, overflow: 'hidden', margin: '5px 0', background: '#0A1A12' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,#1A4A2A 0,#2E7040 3px,#1A4A2A 6px)', opacity: 0.65 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run dev server and verify playhead position comes from store**

```bash
npm run dev
```

Expected: app loads, ruler marks scale when zoom slider moves, playhead stays at left edge (playheadPosition = 0). No TypeScript errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/components/timeline/TimeRuler.tsx src/components/timeline/Timeline.tsx
git commit -m "feat: add isPlaying/replaceSegments to store, zoom-aware ruler, wire playhead"
```

---

## Task 2: Drag-to-Timeline

**Files:**
- Modify: `src/components/panels/MediaPanel/VideoGrid.tsx`
- Modify: `src/components/timeline/Track.tsx`

- [ ] **Step 1: Add draggable attribute to VideoThumb**

Open `src/components/panels/MediaPanel/VideoGrid.tsx`. Replace `VideoThumb`:

```typescript
function VideoThumb({ clip }: { clip: Clip }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('clipId', clip.id)}
      className="rounded-lg overflow-hidden cursor-grab transition-all duration-200"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div className="relative flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'rgba(124,58,237,0.15)' }}>
        {clip.thumbnail
          ? <img src={clip.thumbnail} alt={clip.name} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.5)' }}>
              <Play size={12} fill="white" color="white" />
            </div>
        }
        <span className="absolute bottom-1 right-1 text-white text-xs font-mono" style={{ background: 'rgba(0,0,0,0.65)', padding: '1px 5px', borderRadius: 3 }}>
          {formatDuration(clip.duration)}
        </span>
      </div>
      <div style={{ padding: '6px 8px' }}>
        <p className="text-xs font-medium truncate">{clip.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-subtle)' }}>{clip.width}×{clip.height}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add drop zone to Track**

Open `src/components/timeline/Track.tsx`. Replace the entire file:

```typescript
// src/components/timeline/Track.tsx
import { useAppStore } from '../../store/useAppStore'
import ClipBlock, { PX_PER_SEC } from './ClipBlock'

interface Props {
  trackIndex: number
  label: string
  icon: React.ReactNode
  height: number
  zoom: number
  trackLabelWidth: number
}

export default function Track({ trackIndex, label, icon, height, zoom, trackLabelWidth }: Props) {
  const { segments, clips, addSegment } = useAppStore()
  const trackSegments = segments.filter((s) => s.trackIndex === trackIndex)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const clipId = e.dataTransfer.getData('clipId')
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return

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

  return (
    <div
      className="flex items-center"
      style={{ height, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div
        className="flex items-center gap-1 px-2 shrink-0"
        style={{ minWidth: trackLabelWidth, width: trackLabelWidth, fontSize: 10, color: 'var(--muted-subtle)' }}
      >
        {icon} {label}
      </div>
      <div
        className="relative h-full"
        style={{ width: 700 }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {trackSegments.map((seg) => {
          const clip = clips.find((c) => c.id === seg.clipId)
          return clip ? <ClipBlock key={seg.id} segment={seg} clip={clip} zoom={zoom} /> : null
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test drag-to-timeline manually**

```bash
npm run dev
```

1. Upload a video via the Media panel
2. Drag the video thumbnail to the V1 track
3. Expected: a colored clip block appears on the track at the drop position
4. Expected: no TypeScript errors in console

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/MediaPanel/VideoGrid.tsx src/components/timeline/Track.tsx
git commit -m "feat: drag-to-timeline — VideoGrid draggable, Track drop zone"
```

---

## Task 3: VideoPreview — HTML5 Video Element

**Files:**
- Rewrite: `src/components/preview/VideoPreview.tsx`

- [ ] **Step 1: Rewrite VideoPreview with real `<video>` element**

Replace the entire file `src/components/preview/VideoPreview.tsx`:

```typescript
// src/components/preview/VideoPreview.tsx
import { useRef, useEffect, useMemo } from 'react'
import { Film } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Segment } from '../../types'

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '00')}:${String(sec).padStart(2, '0')}`
}

export default function VideoPreview() {
  const { segments, clips, playheadPosition, isPlaying, setPlayheadPosition, setIsPlaying } = useAppStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const activeSegRef = useRef<Segment | null>(null)
  const segmentsRef = useRef(segments)
  const clipsRef = useRef(clips)

  // Keep refs in sync for RAF tick (avoids stale closures)
  segmentsRef.current = segments
  clipsRef.current = clips

  const activeSeg = useMemo(() =>
    segments.find(
      (s) => s.trackIndex === 0 &&
        playheadPosition >= s.startOnTimeline &&
        playheadPosition < s.startOnTimeline + (s.outPoint - s.inPoint),
    ) ?? null,
    [segments, playheadPosition],
  )
  const activeClip = activeSeg ? clips.find((c) => c.id === activeSeg.clipId) ?? null : null

  // Keep activeSegRef in sync
  activeSegRef.current = activeSeg

  // Load object URL when clip changes (only when not playing)
  useEffect(() => {
    if (isPlaying) return
    const video = videoRef.current
    if (!video) return

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (!activeClip?.file) {
      video.src = ''
      return
    }

    const url = URL.createObjectURL(activeClip.file)
    objectUrlRef.current = url
    video.src = url
  }, [activeClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek when playhead moves while paused
  useEffect(() => {
    const video = videoRef.current
    if (isPlaying || !video || !activeSeg) return
    video.currentTime = activeSeg.inPoint + (playheadPosition - activeSeg.startOnTimeline)
  }, [playheadPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAF playback loop
  useEffect(() => {
    const video = videoRef.current

    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current)
      video?.pause()
      return
    }

    if (!video || !activeSeg) {
      setIsPlaying(false)
      return
    }

    video.play().catch(() => setIsPlaying(false))

    const tick = () => {
      const seg = activeSegRef.current
      if (!seg || !videoRef.current) return

      const rawTime = videoRef.current.currentTime
      setPlayheadPosition(seg.startOnTimeline + (rawTime - seg.inPoint))

      if (rawTime >= seg.outPoint - 0.05) {
        const nextSeg = segmentsRef.current
          .filter((s) => s.trackIndex === 0 && s.startOnTimeline > seg.startOnTimeline)
          .sort((a, b) => a.startOnTimeline - b.startOnTimeline)[0]

        if (nextSeg) {
          const nextClip = clipsRef.current.find((c) => c.id === nextSeg.clipId)
          if (nextClip?.file) {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
            const url = URL.createObjectURL(nextClip.file)
            objectUrlRef.current = url
            videoRef.current.src = url
            videoRef.current.currentTime = nextSeg.inPoint
            videoRef.current.play().catch(() => {})
            activeSegRef.current = nextSeg
          } else {
            setIsPlaying(false)
            return
          }
        } else {
          setIsPlaying(false)
          return
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      videoRef.current?.pause()
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSegments = segments.length > 0

  return (
    <div className="flex flex-1 items-center justify-center min-h-0" style={{ background: '#05050C', padding: 20 }}>
      <div
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: '16/9',
          maxHeight: '100%',
          maxWidth: '100%',
          background: '#000',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
        {!hasSegments && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#12122A,#0A0A1A,#12122A)' }}
          >
            <div className="text-center">
              <Film size={40} style={{ margin: '0 auto 12px', opacity: 0.15 }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Drag a clip to the timeline to begin</p>
            </div>
          </div>
        )}
        <div
          className="absolute text-xs font-mono"
          style={{ bottom: 10, right: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}
        >
          {formatTime(playheadPosition)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test video preview manually**

```bash
npm run dev
```

1. Upload a video
2. Drag it to the V1 track
3. Expected: the video frame is visible in the preview at position 0:00 of the clip
4. Expected: timecode in bottom-right updates from store's playheadPosition
5. Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/preview/VideoPreview.tsx
git commit -m "feat: VideoPreview with real video element, object URL management, seek sync, RAF loop"
```

---

## Task 4: PlaybackControls Wiring

**Files:**
- Rewrite: `src/components/preview/PlaybackControls.tsx`

- [ ] **Step 1: Rewrite PlaybackControls with live store wiring**

Replace the entire file `src/components/preview/PlaybackControls.tsx`:

```typescript
// src/components/preview/PlaybackControls.tsx
import { SkipBack, Play, Pause, SkipForward, Volume2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function PlaybackControls() {
  const { isPlaying, playheadPosition, segments, setIsPlaying, setPlayheadPosition } = useAppStore()

  const totalDuration = segments
    .filter((s) => s.trackIndex === 0)
    .reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)

  const progress = totalDuration > 0 ? (playheadPosition / totalDuration) * 100 : 0

  const handleSkipBack = () => {
    setIsPlaying(false)
    setPlayheadPosition(0)
  }

  const handleSkipForward = () => {
    setIsPlaying(false)
    setPlayheadPosition(totalDuration)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setPlayheadPosition(Math.max(0, Math.min(totalDuration, ratio * totalDuration)))
  }

  return (
    <div
      className="flex items-center gap-2.5 px-4 shrink-0"
      style={{ height: 46, background: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}
    >
      <IconBtn onClick={handleSkipBack}><SkipBack size={14} fill="currentColor" /></IconBtn>
      <PlayBtn isPlaying={isPlaying} onToggle={() => setIsPlaying(!isPlaying)} />
      <IconBtn onClick={handleSkipForward}><SkipForward size={14} fill="currentColor" /></IconBtn>
      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--muted-subtle)' }}>{formatTime(playheadPosition)}</span>
      <SeekBar progress={progress} onSeek={handleSeek} />
      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--muted-subtle)' }}>{formatTime(totalDuration)}</span>
      <IconBtn><Volume2 size={14} /></IconBtn>
    </div>
  )
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-md cursor-pointer transition-all duration-150"
      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: 'var(--muted-subtle)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' }}
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
```

- [ ] **Step 2: Test playback controls manually**

```bash
npm run dev
```

1. Drag a clip to V1 track
2. Click the play button → Expected: video plays, timecode advances, seek bar fills, playhead moves on timeline
3. Click pause → Expected: video pauses
4. Click skip-back → Expected: playhead resets to 0
5. Click on the seek bar → Expected: playhead jumps to click position
6. Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/preview/PlaybackControls.tsx
git commit -m "feat: wire PlaybackControls — play/pause toggle, seek bar, live timecodes, skip buttons"
```

---

## Task 5: BPM Auto-Detection

**Files:**
- Create: `src/lib/audio/bpmDetector.ts`
- Modify: `src/components/panels/BpmPanel.tsx`

- [ ] **Step 1: Create BPM detector**

Create `src/lib/audio/bpmDetector.ts`:

```typescript
// src/lib/audio/bpmDetector.ts

export async function detectBpm(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const maxSamples = Math.min(audioBuffer.length, sampleRate * 60) // analyze first 60s
    const data = audioBuffer.getChannelData(0).subarray(0, maxSamples)
    return computeBpm(data, sampleRate)
  } finally {
    await ctx.close()
  }
}

function computeBpm(data: Float32Array, sampleRate: number): number {
  // Compute RMS energy in overlapping 50ms windows
  const windowSize = Math.round(sampleRate * 0.05)
  const hopSize = Math.round(windowSize / 2)
  const energies: number[] = []

  for (let i = 0; i + windowSize < data.length; i += hopSize) {
    let energy = 0
    for (let j = 0; j < windowSize; j++) energy += data[i + j] ** 2
    energies.push(energy / windowSize)
  }

  // Find onset peaks: local maximum that's 30% above local average
  const contextLen = 20
  const onsetTimes: number[] = []
  let lastOnset = -Infinity

  for (let i = contextLen; i < energies.length - contextLen; i++) {
    const localAvg = energies.slice(i - contextLen, i).reduce((a, b) => a + b, 0) / contextLen
    const isLocalMax = energies[i] > energies[i - 1] && energies[i] > energies[i + 1]

    if (isLocalMax && energies[i] > localAvg * 1.3) {
      const t = (i * hopSize) / sampleRate
      if (t - lastOnset > 0.2) { // min 200ms between onsets (max 300 BPM)
        onsetTimes.push(t)
        lastOnset = t
      }
    }
  }

  if (onsetTimes.length < 4) return 120 // not enough onsets — return default

  // Compute inter-onset intervals, take median
  const intervals: number[] = []
  for (let i = 1; i < onsetTimes.length; i++) {
    intervals.push(onsetTimes[i] - onsetTimes[i - 1])
  }

  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  let bpm = 60 / median

  // Normalize to 60–200 BPM range
  while (bpm < 60) bpm *= 2
  while (bpm > 200) bpm /= 2

  return Math.round(bpm)
}
```

- [ ] **Step 2: Wire Auto-Detect button in BpmPanel**

Open `src/components/panels/BpmPanel.tsx`. Add the import at the top:

```typescript
import { useState } from 'react'
import { detectBpm } from '../../lib/audio/bpmDetector'
```

Inside `BpmPanel`, add a state variable after the existing destructuring:

```typescript
const [detecting, setDetecting] = useState(false)
```

Replace the Auto-Detect button's `onClick` handler. Find this block:

```typescript
          <button
            className="flex-1 rounded-lg text-xs cursor-pointer transition-all duration-150"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--muted2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'var(--muted2)' }}
            onClick={() => alert('BPM detection — Phase 2')}
          >
            Auto-Detect
          </button>
```

Replace it with:

```typescript
          <button
            className="flex-1 rounded-lg text-xs cursor-pointer transition-all duration-150"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: detecting ? 'var(--muted-subtle)' : 'var(--muted2)', cursor: detecting ? 'wait' : 'pointer' }}
            onMouseEnter={(e) => { if (!detecting) { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.color = 'var(--text)' } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = detecting ? 'var(--muted-subtle)' : 'var(--muted2)' }}
            disabled={detecting}
            onClick={async () => {
              const targetClip = clips.find((c) => bpmConfig.selectedClipIds.includes(c.id) && c.type === 'video')
              if (!targetClip) return
              setDetecting(true)
              try {
                const detected = await detectBpm(targetClip.file)
                updateBpmConfig({ bpm: detected })
              } catch {
                // silently ignore — user keeps manual value
              } finally {
                setDetecting(false)
              }
            }}
          >
            {detecting ? 'Detecting…' : 'Auto-Detect'}
          </button>
```

- [ ] **Step 3: Test BPM detection manually**

```bash
npm run dev
```

1. Upload a video with a music soundtrack
2. Check the video in the BPM panel's clip selection list
3. Click Auto-Detect
4. Expected: button shows "Detecting…", then updates the BPM number field with a detected value between 60–200
5. Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/audio/bpmDetector.ts src/components/panels/BpmPanel.tsx
git commit -m "feat: BPM auto-detection via Web Audio API, wire Auto-Detect button in BpmPanel"
```

---

## Task 6: BPM Cutting Algorithms + Vitest Tests

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/bpm/generateCut.ts`
- Create: `src/lib/bpm/generateCut.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected output: vitest added to devDependencies.

- [ ] **Step 2: Add test script to package.json**

Open `package.json`. In `"scripts"`, add `"test": "vitest"`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest"
},
```

- [ ] **Step 3: Add Vitest config to vite.config.ts**

Open `vite.config.ts`. Replace with:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Write the failing tests first**

Create `src/lib/bpm/generateCut.test.ts`:

```typescript
// src/lib/bpm/generateCut.test.ts
import { describe, it, expect } from 'vitest'
import { generateCut } from './generateCut'
import type { Clip, BpmConfig } from '../../types'

function makeClip(id: string, duration: number): Clip {
  return {
    id,
    file: {} as File,
    name: id,
    duration,
    width: 1920,
    height: 1080,
    type: 'video',
  }
}

const clips = [makeClip('a', 10), makeClip('b', 10)]

const baseConfig: BpmConfig = {
  bpm: 120,           // 0.5s per beat
  mode: 'sequential',
  segmentLength: 1,   // 1 beat = 0.5s per segment
  outputDuration: 4,  // 4 seconds total
  outputUnit: 'seconds',
  selectedClipIds: ['a', 'b'],
}

describe('generateCut', () => {
  it('returns empty array when no clips are selected', () => {
    const result = generateCut(clips, { ...baseConfig, selectedClipIds: [] })
    expect(result).toHaveLength(0)
  })

  it('sequential: fills exactly the requested duration', () => {
    const result = generateCut(clips, baseConfig)
    expect(result.length).toBeGreaterThan(0)
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })

  it('sequential: alternates clips A-B-A-B', () => {
    const result = generateCut(clips, baseConfig)
    const ids = result.map((s) => s.clipId)
    expect(ids[0]).toBe('a')
    expect(ids[1]).toBe('b')
    expect(ids[2]).toBe('a')
    expect(ids[3]).toBe('b')
  })

  it('sequential: segments have no gaps', () => {
    const result = generateCut(clips, baseConfig)
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]
      const curr = result[i]
      const prevEnd = prev.startOnTimeline + (prev.outPoint - prev.inPoint)
      expect(curr.startOnTimeline).toBeCloseTo(prevEnd, 5)
    }
  })

  it('random: fills exactly the requested duration', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'random' })
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })

  it('random: segments have no gaps', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'random' })
    for (let i = 1; i < result.length; i++) {
      const prevEnd = result[i - 1].startOnTimeline + (result[i - 1].outPoint - result[i - 1].inPoint)
      expect(result[i].startOnTimeline).toBeCloseTo(prevEnd, 5)
    }
  })

  it('forfeit: alternates two slots initially', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'forfeit', outputDuration: 2 })
    const ids = result.map((s) => s.clipId)
    expect(ids[0]).toBe('a')
    expect(ids[1]).toBe('b')
  })

  it('forfeit: replaces exhausted slot from remaining pool', () => {
    const shortClips = [makeClip('a', 0.5), makeClip('b', 10), makeClip('c', 10)]
    const result = generateCut(shortClips, {
      ...baseConfig,
      mode: 'forfeit',
      selectedClipIds: ['a', 'b', 'c'],
      outputDuration: 4,
    })
    // 'a' lasts only 0.5s (1 segment at 0.5s/seg), replaced by 'c'
    const ids = result.map((s) => s.clipId)
    expect(ids).toContain('c') // 'c' must appear after 'a' is exhausted
  })

  it('respects outputUnit beats', () => {
    const result = generateCut(clips, {
      ...baseConfig,
      outputDuration: 8,
      outputUnit: 'beats',
    })
    // 8 beats at 120 BPM = 4 seconds
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })
})
```

- [ ] **Step 5: Run tests to confirm they fail**

```bash
npm test
```

Expected: errors like `Cannot find module './generateCut'`. That confirms tests are wired correctly.

- [ ] **Step 6: Implement generateCut**

Create `src/lib/bpm/generateCut.ts`:

```typescript
// src/lib/bpm/generateCut.ts
import { v4 as uuidv4 } from 'uuid'
import type { Clip, Segment, BpmConfig } from '../../types'

export function generateCut(clips: Clip[], config: BpmConfig): Segment[] {
  const { bpm, mode, segmentLength, outputDuration, outputUnit, selectedClipIds } = config

  const pool = clips.filter((c) => selectedClipIds.includes(c.id) && c.type === 'video')
  if (pool.length === 0) return []

  const beatDuration = 60 / bpm
  const segDuration = beatDuration * segmentLength
  const totalSeconds = outputUnit === 'beats' ? outputDuration * beatDuration : outputDuration

  if (mode === 'sequential') return generateSequential(pool, segDuration, totalSeconds)
  if (mode === 'random') return generateRandom(pool, segDuration, totalSeconds)
  return generateForfeit(pool, segDuration, totalSeconds)
}

function generateSequential(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))
  let timeline = 0
  let poolIndex = 0
  let exhaustedCount = 0

  while (timeline < totalSeconds - 0.001 && exhaustedCount < pool.length) {
    const clip = pool[poolIndex % pool.length]
    const inPoint = bookmarks[clip.id]
    const remaining = clip.duration - inPoint

    if (remaining <= 0.001) {
      poolIndex++
      exhaustedCount++
      continue
    }

    exhaustedCount = 0
    const duration = Math.min(segDuration, remaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
    poolIndex++
  }

  return segments
}

function generateRandom(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))
  let timeline = 0
  const available = [...pool]

  while (timeline < totalSeconds - 0.001 && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length)
    const clip = available[idx]
    const inPoint = bookmarks[clip.id]
    const remaining = clip.duration - inPoint

    if (remaining <= 0.001) {
      available.splice(idx, 1)
      continue
    }

    const duration = Math.min(segDuration, remaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
  }

  return segments
}

function generateForfeit(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  if (pool.length === 0) return []

  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))

  let slotA = pool[0]
  let slotB = pool.length > 1 ? pool[1] : pool[0]
  const remaining = pool.slice(2)

  let timeline = 0
  let turn = 0

  while (timeline < totalSeconds - 0.001) {
    const clip = turn === 0 ? slotA : slotB
    const inPoint = bookmarks[clip.id]
    const clipRemaining = clip.duration - inPoint

    if (clipRemaining <= 0.001) {
      const next = remaining.shift()
      if (!next) break
      if (turn === 0) slotA = next
      else slotB = next
      continue
    }

    const duration = Math.min(segDuration, clipRemaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
    turn = 1 - turn
  }

  return segments
}
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 9 tests pass. Output like:
```
 ✓ src/lib/bpm/generateCut.test.ts (9)

 Test Files  1 passed (1)
 Tests       9 passed (9)
```

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.ts src/lib/bpm/generateCut.ts src/lib/bpm/generateCut.test.ts
git commit -m "feat: BPM cutting algorithms (sequential/random/forfeit) with Vitest tests"
```

---

## Task 7: Wire Generate Cut Button

**Files:**
- Modify: `src/components/panels/BpmPanel.tsx`

- [ ] **Step 1: Wire Generate Cut in BpmPanel**

Open `src/components/panels/BpmPanel.tsx`. Add import at top:

```typescript
import { generateCut } from '../../lib/bpm/generateCut'
```

Update the destructuring of `useAppStore` (currently `const { bpmConfig, clips, updateBpmConfig } = useAppStore()`) to also grab `replaceSegments`:

```typescript
const { bpmConfig, clips, updateBpmConfig, replaceSegments } = useAppStore()
```

Replace the Generate Cut button's `onClick`:

Find:
```typescript
        onClick={() => alert('Generate Cut — Phase 2')}
```

Replace with:
```typescript
        onClick={() => {
          const newSegments = generateCut(clips, bpmConfig)
          if (newSegments.length > 0) replaceSegments(newSegments)
        }}
```

- [ ] **Step 2: Test Generate Cut end-to-end**

```bash
npm run dev
```

1. Upload 2+ video clips in the Media tab
2. Switch to BPM tab
3. Check both clips in "Select Source Clips"
4. Set BPM to 120, mode to Sequential, Segment to 1 Beat, Output to 10 seconds
5. Click "Generate Cut"
6. Expected: V1 track fills with alternating colored clip blocks spanning 10 seconds
7. Click Play → Expected: video plays through the generated cut with clips switching at beat boundaries
8. Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/BpmPanel.tsx
git commit -m "feat: wire Generate Cut button — calls generateCut and replaces timeline segments"
```

---

## Self-Review

### Spec Coverage

| Feature | Task |
|---------|------|
| `isPlaying` in store | Task 1 |
| Zoom-aware ruler | Task 1 |
| Playhead wired from store | Task 1 |
| Drag clip to timeline | Task 2 |
| HTML5 `<video>` preview | Task 3 |
| RAF playback loop with segment switching | Task 3 |
| Play/pause button toggle | Task 4 |
| Seek bar (click-to-seek) | Task 4 |
| Live timecodes | Task 4 |
| Skip-back / skip-forward | Task 4 |
| BPM auto-detection (Web Audio API) | Task 5 |
| Auto-Detect button wired | Task 5 |
| Sequential cutting mode | Task 6 |
| Random cutting mode | Task 6 |
| Forfeit cutting mode | Task 6 |
| Vitest unit tests | Task 6 |
| Generate Cut wired | Task 7 |
| `replaceSegments` store action | Task 1 |

### Type Consistency Check

- `Segment` used consistently: `id`, `clipId`, `trackIndex`, `startOnTimeline`, `inPoint`, `outPoint` — matches `src/types/index.ts`
- `generateCut` returns `Segment[]` — same type passed to `replaceSegments(Segment[])` — consistent
- `BpmConfig.segmentLength: SegmentLength` (`0.5 | 1 | 2 | 4`) — used as multiplier in `generateCut` — correct
- `PX_PER_SEC` imported from `ClipBlock` in both `TimeRuler` and `Track` — single source of truth maintained
- `detectBpm(file: File): Promise<number>` — called with `clip.file` (typed `File`) — correct

### Placeholder Scan

No "TBD", "TODO", or incomplete sections found.
