// src/store/useAppStore.ts
import { create } from 'zustand'
import type {
  Clip, ClipId, Segment, SegmentId, AdjustmentLayer,
  Transition, TextOverlay, BpmConfig, ProjectSettings,
  ActiveTab, MediaSubTab, SelectedElement, TimelineTrack,
} from '../types'

interface TimelineSnapshot {
  segments: Segment[]
  textOverlays: TextOverlay[]
  transitions: Transition[]
}

const MAX_HISTORY = 50

interface AppState {
  // ─── Navigation ───
  activeTab: ActiveTab
  mediaSubTab: MediaSubTab
  selectedElement: SelectedElement | null
  selectedSegmentIds: string[]  // multi-select

  // ─── Project ───
  projectName: string
  projectSettings: ProjectSettings

  // ─── Media library ───
  clips: Clip[]

  // ─── Tracks ───
  tracks: TimelineTrack[]

  // ─── Timeline ───
  segments: Segment[]
  adjustmentLayers: AdjustmentLayer[]
  transitions: Transition[]
  textOverlays: TextOverlay[]
  playheadPosition: number  // seconds
  isPlaying: boolean
  masterVolume: number
  loopRegion: { start: number; end: number } | null

  // ─── Undo / Redo ───
  _history: TimelineSnapshot[]
  _future: TimelineSnapshot[]

  // ─── Fonts ───
  availableFonts: string[]

  // ─── BPM tool ───
  bpmConfig: BpmConfig

  // ─── Actions ───
  setActiveTab: (tab: ActiveTab) => void
  setMediaSubTab: (tab: MediaSubTab) => void
  setSelectedElement: (el: SelectedElement | null) => void
  setSelectedSegmentIds: (ids: string[]) => void
  toggleSegmentSelection: (id: string) => void
  setProjectName: (name: string) => void
  updateProjectSettings: (settings: Partial<ProjectSettings>) => void

  addTrack: (track: TimelineTrack) => void
  updateTrack: (id: string, patch: Partial<TimelineTrack>) => void
  removeTrack: (id: string) => void
  moveTrack: (id: string, direction: 'up' | 'down') => void

  addClip: (clip: Clip) => void
  removeClip: (id: ClipId) => void

  addSegment: (segment: Segment) => void
  removeSegment: (id: SegmentId) => void
  removeSegments: (ids: string[]) => void
  updateSegment: (id: SegmentId, patch: Partial<Segment>) => void
  addSegments: (segments: Segment[]) => void
  replaceSegments: (segments: Segment[], targetTrackIndex?: number) => void

  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  removeTextOverlay: (id: string) => void

  addAdjustmentLayer: (layer: AdjustmentLayer) => void
  updateAdjustmentLayer: (id: string, patch: Partial<AdjustmentLayer>) => void
  removeAdjustmentLayer: (id: string) => void

  addTransition: (transition: Transition) => void
  updateTransition: (id: string, patch: Partial<Transition>) => void
  removeTransition: (id: string) => void

  addFont: (name: string) => void
  updateBpmConfig: (patch: Partial<BpmConfig>) => void
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
  setMasterVolume: (volume: number) => void
  setLoopRegion: (region: { start: number; end: number } | null) => void
  loadProject: (data: Record<string, unknown>) => void

  // ─── Timeline mode ───
  timelineMode: 'playhead' | 'selection'
  resizeEnabled: boolean
  setTimelineMode: (mode: 'playhead' | 'selection') => void
  setResizeEnabled: (enabled: boolean) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

// Snapshot current timeline state before a mutation
function push(s: AppState) {
  return {
    _history: [...s._history.slice(-(MAX_HISTORY - 1)), { segments: s.segments, textOverlays: s.textOverlays, transitions: s.transitions }],
    _future: [] as TimelineSnapshot[],
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Navigation ───
  activeTab: 'media',
  mediaSubTab: 'videos',
  selectedElement: null,
  selectedSegmentIds: [],

  // ─── Project ───
  projectName: 'Untitled Project',
  projectSettings: {
    resolution: '1920x1080',
    fps: 30,
    format: 'mp4',
    quality: 'good',
    autoDetectBpm: true,
    snapToBeat: true,
    hardwareAcceleration: false,
    showClipThumbnails: false,
  },

  // ─── Media library ───
  clips: [],

  // ─── Tracks ───
  tracks: [
    { id: 'v1', name: 'V1', type: 'video', trackIndex: 0 },
    { id: 'v2', name: 'V2', type: 'video', trackIndex: 3 },
    { id: 'v3', name: 'V3', type: 'video', trackIndex: 4 },
    { id: 'text', name: 'Text', type: 'subtitle', trackIndex: 1 },
    { id: 'adj', name: 'Adjustment', type: 'adjustment', trackIndex: -1 },
    { id: 'audio', name: 'Audio', type: 'audio', trackIndex: 2 },
  ] as TimelineTrack[],

  // ─── Timeline ───
  segments: [],
  adjustmentLayers: [],
  transitions: [],
  textOverlays: [],
  playheadPosition: 0,
  isPlaying: false,
  masterVolume: 1,
  loopRegion: null,

  // ─── Undo / Redo ───
  _history: [],
  _future: [],

  // ─── Fonts ───
  availableFonts: ['Inter', 'Arial', 'Helvetica', 'Georgia', 'Courier New', 'Impact', 'Verdana', 'Trebuchet MS'],

  // ─── BPM tool ───
  bpmConfig: {
    bpm: 128,
    mode: 'random',
    segmentLength: 1,
    outputDuration: 30,
    outputUnit: 'seconds',
    selectedClipIds: [],
  },

  // ─── Timeline mode ───
  timelineMode: 'selection',
  resizeEnabled: false,

  // ─── Actions ───
  setTimelineMode: (mode) => set({ timelineMode: mode, resizeEnabled: mode === 'playhead' ? false : get().resizeEnabled }),
  setResizeEnabled: (enabled) => set((s) => ({ resizeEnabled: s.timelineMode === 'selection' ? enabled : false })),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setMediaSubTab: (tab) => set({ mediaSubTab: tab }),
  setSelectedElement: (el) => set({ selectedElement: el, activeTab: el ? 'inspector' : 'media', selectedSegmentIds: [] }),
  setSelectedSegmentIds: (ids) => set({ selectedSegmentIds: ids }),
  toggleSegmentSelection: (id) => set((s) => ({
    selectedSegmentIds: s.selectedSegmentIds.includes(id)
      ? s.selectedSegmentIds.filter((x) => x !== id)
      : [...s.selectedSegmentIds, id],
  })),
  setProjectName: (name) => set({ projectName: name }),
  updateProjectSettings: (patch) =>
    set((s) => ({ projectSettings: { ...s.projectSettings, ...patch } })),

  addTrack: (track) => set((s) => ({ tracks: [...s.tracks, track] })),
  updateTrack: (id, patch) => set((s) => ({ tracks: s.tracks.map((t) => t.id === id ? { ...t, ...patch } : t) })),
  removeTrack: (id) => set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),
  moveTrack: (id, direction) => set((s) => {
    const idx = s.tracks.findIndex((t) => t.id === id)
    if (idx < 0) return s
    const next = direction === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= s.tracks.length) return s
    const arr = [...s.tracks]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    return { tracks: arr }
  }),

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

  addSegment: (segment) => set((s) => ({ ...push(s), segments: [...s.segments, segment] })),
  removeSegment: (id) => set((s) => ({ ...push(s), segments: s.segments.filter((seg) => seg.id !== id) })),
  removeSegments: (ids) => set((s) => ({ ...push(s), segments: s.segments.filter((seg) => !ids.includes(seg.id)) })),
  updateSegment: (id, patch) =>
    set((s) => {
      const segments = s.segments.map((seg) => seg.id === id ? { ...seg, ...patch } : seg)
      let { playheadPosition } = s
      if ('speed' in patch || 'outPoint' in patch || 'inPoint' in patch) {
        const seg = segments.find((seg) => seg.id === id)
        if (seg) {
          const newEnd = seg.startOnTimeline + (seg.outPoint - seg.inPoint) / Math.max(0.01, seg.speed ?? 1)
          if (playheadPosition > newEnd) playheadPosition = Math.max(seg.startOnTimeline, newEnd - 0.001)
        }
      }
      return { ...push(s), segments, playheadPosition }
    }),
  addSegments: (newSegs) => set((s) => ({ ...push(s), segments: [...s.segments, ...newSegs] })),
  replaceSegments: (newSegs, targetTrackIndex = 0) =>
    set((s) => ({ ...push(s), segments: [...s.segments.filter((seg) => seg.trackIndex !== targetTrackIndex), ...newSegs] })),

  addTextOverlay: (overlay) => set((s) => ({ ...push(s), textOverlays: [...s.textOverlays, overlay] })),
  updateTextOverlay: (id, patch) =>
    set((s) => ({ ...push(s), textOverlays: s.textOverlays.map((o) => o.id === id ? { ...o, ...patch } : o) })),
  removeTextOverlay: (id) => set((s) => ({ ...push(s), textOverlays: s.textOverlays.filter((o) => o.id !== id) })),

  addAdjustmentLayer: (layer) => set((s) => ({ adjustmentLayers: [...s.adjustmentLayers, layer] })),
  updateAdjustmentLayer: (id, patch) =>
    set((s) => ({ adjustmentLayers: s.adjustmentLayers.map((l) => l.id === id ? { ...l, ...patch } : l) })),
  removeAdjustmentLayer: (id) => set((s) => ({ adjustmentLayers: s.adjustmentLayers.filter((l) => l.id !== id) })),

  addTransition: (transition) => set((s) => ({ transitions: [...s.transitions, transition] })),
  updateTransition: (id, patch) =>
    set((s) => ({ transitions: s.transitions.map((t) => t.id === id ? { ...t, ...patch } : t) })),
  removeTransition: (id) => set((s) => ({ transitions: s.transitions.filter((t) => t.id !== id) })),

  addFont: (name) => set((s) => ({
    availableFonts: s.availableFonts.includes(name) ? s.availableFonts : [...s.availableFonts, name],
  })),
  updateBpmConfig: (patch) =>
    set((s) => ({ bpmConfig: { ...s.bpmConfig, ...patch } })),
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setLoopRegion: (region) => set({ loopRegion: region }),

  loadProject: (data) => {
    const existing = get()
    const clips = (data.clips as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      file: (c.file instanceof File ? c.file : null) as unknown as File,
    })) as Clip[]
    set({
      projectName: (data.projectName as string | undefined) ?? existing.projectName,
      projectSettings: { ...existing.projectSettings, ...(data.projectSettings as Partial<ProjectSettings>) },
      segments: (data.segments as Segment[]) ?? [],
      textOverlays: (data.textOverlays as TextOverlay[] | undefined) ?? [],
      bpmConfig: (data.bpmConfig as BpmConfig | undefined) ?? existing.bpmConfig,
      transitions: (data.transitions as Transition[] | undefined) ?? [],
      adjustmentLayers: (data.adjustmentLayers as AdjustmentLayer[] | undefined) ?? [],
      tracks: (data.tracks as TimelineTrack[] | undefined) ?? existing.tracks,
      clips,
      isPlaying: false,
      playheadPosition: 0,
      selectedElement: null,
      selectedSegmentIds: [],
      _history: [],
      _future: [],
    })
  },

  undo: () => set((s) => {
    if (s._history.length === 0) return s
    const prev = s._history[s._history.length - 1]
    return {
      ...prev,
      _history: s._history.slice(0, -1),
      _future: [{ segments: s.segments, textOverlays: s.textOverlays, transitions: s.transitions }, ...s._future.slice(0, MAX_HISTORY - 1)],
    }
  }),

  redo: () => set((s) => {
    if (s._future.length === 0) return s
    const next = s._future[0]
    return {
      ...next,
      _history: [...s._history.slice(-(MAX_HISTORY - 1)), { segments: s.segments, textOverlays: s.textOverlays, transitions: s.transitions }],
      _future: s._future.slice(1),
    }
  }),

  canUndo: () => get()._history.length > 0,
  canRedo: () => get()._future.length > 0,
}))
