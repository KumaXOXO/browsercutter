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

  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  removeTextOverlay: (id: string) => void

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
  replaceSegments: (newSegs) =>
    set((s) => ({ segments: [...s.segments.filter((seg) => seg.trackIndex !== 0), ...newSegs] })),

  addTextOverlay: (overlay) => set((s) => ({ textOverlays: [...s.textOverlays, overlay] })),
  updateTextOverlay: (id, patch) =>
    set((s) => ({ textOverlays: s.textOverlays.map((o) => o.id === id ? { ...o, ...patch } : o) })),
  removeTextOverlay: (id) => set((s) => ({ textOverlays: s.textOverlays.filter((o) => o.id !== id) })),

  updateBpmConfig: (patch) =>
    set((s) => ({ bpmConfig: { ...s.bpmConfig, ...patch } })),
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}))
