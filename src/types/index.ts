// src/types/index.ts

export type ClipId = string
export type SegmentId = string

export type ClipType = 'video' | 'audio' | 'image'
export type BpmMode = 'sequential' | 'random' | 'forfeit'
export type SegmentLength = 0.5 | 1 | 2 | 4
export type ActiveTab = 'media' | 'text' | 'effects' | 'transitions' | 'bpm' | 'settings' | 'inspector'
export type MediaSubTab = 'videos' | 'music' | 'images'
export type EffectType = 'brightness' | 'contrast' | 'saturation' | 'grayscale' | 'blur' | 'vignette' | 'sharpen'
export type TransitionType = 'cut' | 'fade' | 'wipe' | 'zoom' | 'slide' | 'dissolve'
export type Resolution = '1920x1080' | '3840x2160' | '1280x720'
export type FrameRate = 24 | 30 | 60
export type ExportFormat = 'mp4' | 'webm'

export interface Clip {
  id: ClipId
  file: File
  name: string
  duration: number       // seconds
  width: number
  height: number
  type: ClipType
  thumbnail?: string     // data URL (video/image only)
  bpm?: number
}

export interface Segment {
  id: SegmentId
  clipId: ClipId
  trackIndex: number
  startOnTimeline: number  // seconds from timeline start
  inPoint: number          // seconds from clip start
  outPoint: number         // seconds from clip start
  volume?: number          // 0–1, default 1.0
  speed?: number           // 0.25–4.0, default 1.0
  effects?: Effect[]
}

export interface Effect {
  type: EffectType
  value: number            // 0-100
}

export interface AdjustmentLayer {
  id: string
  startOnTimeline: number
  duration: number
  effects: Effect[]
}

export interface Transition {
  id: string
  type: TransitionType
  beforeSegmentId: SegmentId
  afterSegmentId: SegmentId
  duration: number         // seconds
}

export interface TextOverlay {
  id: string
  text: string
  startOnTimeline: number
  duration: number
  font: string
  size: number             // px
  color: string
  x: number                // 0-1 relative to canvas width
  y: number                // 0-1 relative to canvas height
}

export interface BpmConfig {
  bpm: number
  mode: BpmMode
  segmentLength: SegmentLength
  outputDuration: number
  outputUnit: 'seconds' | 'beats'
  selectedClipIds: ClipId[]
}

export interface ProjectSettings {
  resolution: Resolution
  fps: FrameRate
  format: ExportFormat
  quality: 'draft' | 'good' | 'best'
  autoDetectBpm: boolean
  snapToBeat: boolean
  hardwareAcceleration: boolean
}

export type SelectedElementType = 'segment' | 'adjustment' | 'text' | 'transition' | null

export interface SelectedElement {
  type: SelectedElementType
  id: string
}
