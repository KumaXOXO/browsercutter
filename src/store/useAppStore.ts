// src/store/useAppStore.ts
import { create } from 'zustand'
import type {
  Clip, ClipId, Segment, SegmentId, AdjustmentLayer,
  Transition, TextOverlay, BpmConfig, ProjectSettings,
  ActiveTab, MediaSubTab, SelectedElement,
} from '../types'

interface TimelineSnapshot {
  segments: Segment[]
  textOverlays: TextOverlay[]
}

const MAX_HISTORY = 50

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
  masterVolume: number

  // ─── Undo / Redo ───
  _history: TimelineSnapshot[]
  _future: TimelineSnapshot[]

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

  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  removeTextOverlay: (id: string) => void

  addAdjustmentLayer: (layer: AdjustmentLayer) => void
  updateAdjustmentLayer: (id: string, patch: Partial<AdjustmentLayer>) => void
  removeAdjustmentLayer: (id: string) => void

  addTransition: (transition: Transition) => void
  updateTransition: (id: string, patch: Partial<Transition>) => void
  removeTransition: (id: string) => void

  updateBpmConfig: (patch: Partial<BpmConfig>) => void
  setPlayheadPosition: (pos: number) => void
  setIsPlaying: (playing: boolean) => void
  setMasterVolume: (volume: number) => void
  loadProject: (data: Record<string, unknown>) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

// Snapshot current timeline state before a mutation
function push(s: AppState) {
  return {
    _history: [...s._history.slice(-(MAX_HISTORY - 1)), { segments: s.segments, textOverlays: s.textOverlays }],
    _future: [] as TimelineSnapshot[],
  }
}

export const useAppStore = create<AppState>((set, get) => ({
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
    quality: 'good',
    autoDetectBpm: true,
    snapToBeat: true,
    hardwareAcceleration: false,
    showClipThumbnails: false,
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
  masterVolume: 1,

  // ─── Undo / Redo ───
  _history: [],
  _future: [],

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

  addSegment: (segment) => set((s) => ({ ...push(s), segments: [...s.segments, segment] })),
  removeSegment: (id) => set((s) => ({ ...push(s), segments: s.segments.filter((seg) => seg.id !== id) })),
  updateSegment: (id, patch) =>
    set((s) => ({ ...push(s), segments: s.segments.map((seg) => seg.id === id ? { ...seg, ...patch } : seg) })),
  addSegments: (newSegs) => set((s) => ({ ...push(s), segments: [...s.segments, ...newSegs] })),
  replaceSegments: (newSegs) =>
    set((s) => ({ ...push(s), segments: [...s.segments.filter((seg) => seg.trackIndex !== 0), ...newSegs] })),

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

  updateBpmConfig: (patch) =>
    set((s) => ({ bpmConfig: { ...s.bpmConfig, ...patch } })),
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),

  loadProject: (data) => {
    const existing = get()
    const clips = (data.clips as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      file: null as unknown as File,
    })) as Clip[]
    set({
      projectName: (data.projectName as string | undefined) ?? existing.projectName,
      projectSettings: { ...existing.projectSettings, ...(data.projectSettings as Partial<ProjectSettings>) },
      segments: (data.segments as Segment[]) ?? [],
      textOverlays: (data.textOverlays as TextOverlay[] | undefined) ?? [],
      bpmConfig: (data.bpmConfig as BpmConfig | undefined) ?? existing.bpmConfig,
      transitions: (data.transitions as Transition[] | undefined) ?? [],
      adjustmentLayers: (data.adjustmentLayers as AdjustmentLayer[] | undefined) ?? [],
      clips,
      isPlaying: false,
      playheadPosition: 0,
      selectedElement: null,
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
      _future: [{ segments: s.segments, textOverlays: s.textOverlays }, ...s._future.slice(0, MAX_HISTORY - 1)],
    }
  }),

  redo: () => set((s) => {
    if (s._future.length === 0) return s
    const next = s._future[0]
    return {
      ...next,
      _history: [...s._history.slice(-(MAX_HISTORY - 1)), { segments: s.segments, textOverlays: s.textOverlays }],
      _future: s._future.slice(1),
    }
  }),

  canUndo: () => get()._history.length > 0,
  canRedo: () => get()._future.length > 0,
}))
