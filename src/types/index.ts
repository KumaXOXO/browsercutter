// src/types/index.ts

export type ClipId = string
export type SegmentId = string

export type ClipType = 'video' | 'audio' | 'image'
export type BpmMode = 'sequential' | 'random' | 'forfeit' | 'normal'
export type SegmentLength = number
export type ActiveTab = 'media' | 'text' | 'effects' | 'transitions' | 'bpm' | 'settings' | 'inspector'
export type MediaSubTab = 'videos' | 'music' | 'images'
export type EffectType = 'brightness' | 'contrast' | 'saturation' | 'grayscale' | 'blur' | 'vignette' | 'sharpen'
export type TransitionType = 'cut' | 'fade' | 'wipe' | 'zoom' | 'slide' | 'dissolve'
export type Resolution = '1920x1080' | '3840x2160' | '2560x1440' | '1280x720' | '1080x1920' | 'custom'
export type FrameRate = 24 | 30 | 60 | 120 | 0
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
  proxyFile?: File       // low-res proxy for large-file preview
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
  rotation?: number        // degrees, default 0
  effects?: Effect[]
  hidden?: boolean         // if true, skip in preview and export
  muted?: boolean          // if true, suppress audio for this segment
}

export interface Effect {
  type: EffectType
  value: number            // 0-100
}

export interface AdjustmentLayer {
  id: string
  trackId?: string
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
  trackId?: string
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
  onlyWholeClips?: boolean
  gridStep?: number       // beat subdivisions: 0.25=¼, 0.5=½, 1=1, 2=2, 4=4 beats per mark
  importMode?: 'fixed' | 'full'  // 'fixed' = use segmentLength, 'full' = each clip at full duration
}

export interface TimelineTrack {
  id: string
  name: string
  type: 'video' | 'audio' | 'adjustment' | 'subtitle'
  trackIndex: number
  hidden?: boolean
  muted?: boolean
}

export interface ProjectSettings {
  resolution: Resolution
  fps: FrameRate
  format: ExportFormat
  quality: 'draft' | 'good' | 'best'
  autoDetectBpm: boolean
  snapToBeat: boolean
  hardwareAcceleration: boolean
  showClipThumbnails: boolean
  customWidth?: number
  customHeight?: number
  customFps?: number
  fullWidthTimeline?: boolean
  stretchToFormat?: boolean
}

export type SelectedElementType = 'segment' | 'adjustment' | 'text' | 'transition' | null

export interface SelectedElement {
  type: SelectedElementType
  id: string
}
