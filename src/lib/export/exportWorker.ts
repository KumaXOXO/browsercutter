// src/lib/export/exportWorker.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import type { Transition, AdjustmentLayer } from '../../types'
import { buildFilterComplex } from './exportWorkerUtils'

export type { ExportSegment } from './exportWorkerUtils'
export { calculateXfadeOffsets, buildFilterComplex } from './exportWorkerUtils'

export interface ExportRequest {
  segments: Array<{
    id: string; clipId: string; trackIndex: number
    startOnTimeline: number; inPoint: number; outPoint: number
    volume?: number; speed?: number; effects?: import('../../types').Effect[]
  }>
  clipData: Record<string, { buffer: ArrayBuffer; name: string }>
  fps: number
  resolution: string
  transitions: Transition[]
  adjustmentLayers: AdjustmentLayer[]
  format: 'mp4' | 'webm'
  quality: 'draft' | 'good' | 'best'
}

export type WorkerMessage =
  | { type: 'progress'; value: number; label: string }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

const QUALITY_PRESETS = {
  mp4:  { draft: 28, good: 22, best: 18 },
  webm: { draft: 40, good: 30, best: 20 },
}

const ffmpeg = new FFmpeg()

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  const timeout = setTimeout(() => {
    self.postMessage({ type: 'error', message: 'Export timed out after 60 seconds' } satisfies WorkerMessage)
  }, 60_000)

  try {
    await runExport(e.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', message: msg } satisfies WorkerMessage)
  } finally {
    clearTimeout(timeout)
  }
}

async function runExport(req: ExportRequest) {
  post({ type: 'progress', value: 0.02, label: 'Loading FFmpeg...' })

  const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  post({ type: 'progress', value: 0.1, label: 'Writing clips...' })

  const v1Segs = req.segments
    .filter((s) => s.trackIndex === 0)
    .sort((a, b) => a.startOnTimeline - b.startOnTimeline)

  if (v1Segs.length === 0) throw new Error('No video clips on the timeline.')

  const writtenFiles = new Set<string>()
  for (const seg of v1Segs) {
    const cd = req.clipData[seg.clipId]
    if (!cd) throw new Error(`Missing clip data for segment ${seg.id}`)
    const ext = cd.name.split('.').pop()?.toLowerCase() ?? 'mp4'
    const fname = `clip_${seg.clipId}.${ext}`
    if (!writtenFiles.has(fname)) {
      await ffmpeg.writeFile(fname, new Uint8Array(cd.buffer))
      writtenFiles.add(fname)
    }
  }

  post({ type: 'progress', value: 0.2, label: 'Building timeline...' })

  const [width, height] = (req.resolution ?? '1920x1080').split('x').map(Number)
  const format = req.format ?? 'mp4'
  const quality = req.quality ?? 'good'
  const outputFile = `output.${format}`

  const needsFilterComplex =
    req.transitions.some((t) => t.type !== 'cut') ||
    v1Segs.some((s) => s.effects && s.effects.length > 0) ||
    v1Segs.some((s) => s.volume != null && s.volume !== 1.0) ||
    v1Segs.some((s) => s.speed != null && s.speed !== 1.0) ||
    req.adjustmentLayers.some((l) => l.effects.length > 0)

  ffmpeg.on('progress', ({ progress }) => {
    post({ type: 'progress', value: 0.25 + progress * 0.7, label: 'Encoding...' })
  })

  post({ type: 'progress', value: 0.25, label: 'Encoding video...' })

  if (!needsFilterComplex) {
    // Tier 1: concat demuxer — fast path, no filters
    const concatLines: string[] = []
    for (const seg of v1Segs) {
      const cd = req.clipData[seg.clipId]
      const ext = cd.name.split('.').pop()?.toLowerCase() ?? 'mp4'
      concatLines.push(`file 'clip_${seg.clipId}.${ext}'`)
      concatLines.push(`inpoint ${seg.inPoint.toFixed(6)}`)
      concatLines.push(`outpoint ${seg.outPoint.toFixed(6)}`)
    }
    await ffmpeg.writeFile('concat.txt', concatLines.join('\n'))

    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
      ...buildEncodeArgs(format, quality, req.fps, width, height),
      '-y', outputFile,
    ])
  } else {
    // Tier 4: filter_complex — effects, transitions, speed, volume
    const inputs: string[] = []
    for (const seg of v1Segs) {
      const cd = req.clipData[seg.clipId]
      const ext = cd.name.split('.').pop()?.toLowerCase() ?? 'mp4'
      inputs.push('-i', `clip_${seg.clipId}.${ext}`)
    }

    const { filterComplex, videoOut, audioOut } = buildFilterComplex(
      v1Segs, req.transitions, req.adjustmentLayers, width, height,
    )

    await ffmpeg.exec([
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', `[${videoOut}]`, '-map', `[${audioOut}]`,
      ...buildEncodeArgs(format, quality, req.fps),
      '-y', outputFile,
    ])
  }

  post({ type: 'progress', value: 0.97, label: 'Reading output...' })

  const data = await ffmpeg.readFile(outputFile)
  const buffer = (data as Uint8Array).buffer

  post({ type: 'done', buffer } satisfies WorkerMessage, [buffer])
}

function buildEncodeArgs(
  format: 'mp4' | 'webm',
  quality: 'draft' | 'good' | 'best',
  fps: number,
  width?: number,
  height?: number,
): string[] {
  const crf = QUALITY_PRESETS[format][quality]
  const args: string[] = []

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0')
    args.push('-c:a', 'libopus', '-b:a', '128k')
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf))
    args.push('-c:a', 'aac', '-b:a', '128k')
    args.push('-movflags', '+faststart')
  }

  args.push('-r', String(fps))

  if (width != null && height != null) {
    args.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`)
  }

  return args
}

function post(msg: WorkerMessage, transfer?: Transferable[]) {
  if (transfer) {
    self.postMessage(msg, { transfer })
  } else {
    self.postMessage(msg)
  }
}
