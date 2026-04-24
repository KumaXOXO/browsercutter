// src/lib/export/exportWorkerUtils.ts
// Pure helper functions extracted from exportWorker.ts for testability.
// (FFmpeg WASM cannot be instantiated in Node/Vitest — keep this file FFmpeg-free.)
import type { Effect, Transition, AdjustmentLayer } from '../../types'
import { buildFFmpegFilter } from '../video/effectsFilter'

export interface ExportSegment {
  id: string
  clipId: string
  trackIndex: number
  startOnTimeline: number
  inPoint: number
  outPoint: number
  volume?: number
  speed?: number
  effects?: Effect[]
}

const XFADE_MAP: Record<string, string> = {
  fade: 'fade',
  dissolve: 'dissolve',
  wipe: 'wipeleft',
  slide: 'slideleft',
  zoom: 'circleopen',
}

// Returns xfade offset for each transition. tDur=0 for cuts.
export function calculateXfadeOffsets(segDurs: number[], transitionDurs: number[]): number[] {
  const offsets: number[] = []
  let cumDur = segDurs[0]
  for (let i = 0; i < transitionDurs.length; i++) {
    const tDur = transitionDurs[i]
    offsets.push(Math.max(0, cumDur - tDur))
    cumDur += segDurs[i + 1] - tDur
  }
  return offsets
}

export function buildAtempoChain(speed: number): string {
  if (speed >= 0.5 && speed <= 2.0) return `atempo=${speed.toFixed(4)}`
  const parts: string[] = []
  let s = speed
  while (s > 2.0) { parts.push('atempo=2.0'); s /= 2.0 }
  while (s < 0.5) { parts.push('atempo=0.5'); s *= 2.0 }
  parts.push(`atempo=${s.toFixed(4)}`)
  return parts.join(',')
}

export function buildFilterComplex(
  v1Segs: ExportSegment[],
  transitions: Transition[],
  adjustmentLayers: AdjustmentLayer[],
  width: number,
  height: number,
  segInputIdx?: number[],
): { filterComplex: string; videoOut: string; audioOut: string } {
  const lines: string[] = []

  // Build per-segment input labels; when segInputIdx maps multiple segments to
  // the same FFmpeg input, generate split/asplit so each reference is unique.
  const segVLabel: string[] = []
  const segALabel: string[] = []

  if (segInputIdx) {
    const usageCount = new Map<number, number>()
    for (const idx of segInputIdx) usageCount.set(idx, (usageCount.get(idx) ?? 0) + 1)

    for (const [inputIdx, count] of usageCount) {
      if (count > 1) {
        const vOut = Array.from({ length: count }, (_, k) => `[vin${inputIdx}_${k}]`).join('')
        const aOut = Array.from({ length: count }, (_, k) => `[ain${inputIdx}_${k}]`).join('')
        lines.push(`[${inputIdx}:v]split=${count}${vOut}`)
        lines.push(`[${inputIdx}:a]asplit=${count}${aOut}`)
      }
    }

    const usageCounter = new Map<number, number>()
    for (const idx of usageCount.keys()) usageCounter.set(idx, 0)

    for (let i = 0; i < v1Segs.length; i++) {
      const inputIdx = segInputIdx[i]
      const count = usageCount.get(inputIdx) ?? 1
      if (count > 1) {
        const k = usageCounter.get(inputIdx)!
        segVLabel.push(`vin${inputIdx}_${k}`)
        segALabel.push(`ain${inputIdx}_${k}`)
        usageCounter.set(inputIdx, k + 1)
      } else {
        segVLabel.push(`${inputIdx}:v`)
        segALabel.push(`${inputIdx}:a`)
      }
    }
  } else {
    for (let i = 0; i < v1Segs.length; i++) {
      segVLabel.push(`${i}:v`)
      segALabel.push(`${i}:a`)
    }
  }

  // Per-segment filters
  const segDurs: number[] = []
  for (let i = 0; i < v1Segs.length; i++) {
    const seg = v1Segs[i]
    const speed = seg.speed ?? 1.0
    segDurs.push((seg.outPoint - seg.inPoint) / speed)

    // Video: trim → speed → scale → pad → effects
    const vParts = [
      `trim=start=${seg.inPoint.toFixed(6)}:end=${seg.outPoint.toFixed(6)}`,
      `setpts=(1/${speed.toFixed(4)})*(PTS-STARTPTS)`,
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    ]
    const vfx = buildFFmpegFilter(seg.effects ?? [])
    if (vfx) vParts.push(vfx)
    lines.push(`[${segVLabel[i]}]${vParts.join(',')}[vs${i}]`)

    // Audio: trim → reset pts → speed → volume
    const aParts = [
      `atrim=start=${seg.inPoint.toFixed(6)}:end=${seg.outPoint.toFixed(6)}`,
      'asetpts=PTS-STARTPTS',
    ]
    if (speed !== 1.0) aParts.push(buildAtempoChain(speed))
    const vol = seg.volume
    if (vol != null && vol !== 1.0) aParts.push(`volume=${vol.toFixed(4)}`)
    lines.push(`[${segALabel[i]}]${aParts.join(',')}[as${i}]`)
  }

  // Build transition lookup keyed by beforeSegmentId
  const transMap = new Map<string, Transition>()
  for (const t of transitions) transMap.set(t.beforeSegmentId, t)

  // Chain segments left to right with concat (cut) or xfade (non-cut)
  let curV = 'vs0'
  let curA = 'as0'
  let cumOutputDur = segDurs[0]

  for (let i = 0; i < v1Segs.length - 1; i++) {
    const seg = v1Segs[i]
    const nextSeg = v1Segs[i + 1]
    const t = transMap.get(seg.id)
    const isCut = !t || t.type === 'cut' || t.afterSegmentId !== nextSeg.id
    const ni = i + 1

    if (isCut) {
      lines.push(`[${curV}][vs${ni}]concat=n=2:v=1:a=0[vchain${ni}]`)
      lines.push(`[${curA}][as${ni}]concat=n=2:v=0:a=1[achain${ni}]`)
      cumOutputDur += segDurs[ni]
    } else {
      const tDur = Math.min(t.duration, segDurs[i], segDurs[ni])
      const offset = Math.max(0, cumOutputDur - tDur)
      const xName = XFADE_MAP[t.type] ?? 'fade'
      lines.push(`[${curV}][vs${ni}]xfade=transition=${xName}:duration=${tDur.toFixed(4)}:offset=${offset.toFixed(4)}[vchain${ni}]`)
      lines.push(`[${curA}][as${ni}]acrossfade=d=${tDur.toFixed(4)}[achain${ni}]`)
      cumOutputDur += segDurs[ni] - tDur
    }

    curV = `vchain${ni}`
    curA = `achain${ni}`
  }

  // Adjustment layers: merge all effects and apply to final video output
  if (adjustmentLayers.length > 0) {
    const mergedEffects: Effect[] = adjustmentLayers.flatMap((l) => l.effects)
    const adjFilter = buildFFmpegFilter(mergedEffects)
    if (adjFilter) {
      lines.push(`[${curV}]${adjFilter}[vadj]`)
      curV = 'vadj'
    }
  }

  return { filterComplex: lines.join(';'), videoOut: curV, audioOut: curA }
}
