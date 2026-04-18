// src/lib/export/exportWorker.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

export interface ExportRequest {
  segments: Array<{
    id: string
    clipId: string
    trackIndex: number
    startOnTimeline: number
    inPoint: number
    outPoint: number
    volume?: number
    speed?: number
  }>
  clipData: Record<string, { buffer: ArrayBuffer; name: string }>
  fps: number
  resolution: string
}

export type WorkerMessage =
  | { type: 'progress'; value: number; label: string }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

const ffmpeg = new FFmpeg()

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  try {
    await runExport(e.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', message: msg } satisfies WorkerMessage)
  }
}

async function runExport(req: ExportRequest) {
  post({ type: 'progress', value: 0.02, label: 'Loading FFmpeg...' })

  const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL:  await toBlobURL(`${BASE}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL:  await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  post({ type: 'progress', value: 0.1, label: 'Writing clips...' })

  const v1Segs = req.segments
    .filter((s) => s.trackIndex === 0)
    .sort((a, b) => a.startOnTimeline - b.startOnTimeline)

  if (v1Segs.length === 0) {
    throw new Error('No video clips on the timeline.')
  }

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

  const concatLines: string[] = []
  for (const seg of v1Segs) {
    const cd = req.clipData[seg.clipId]
    const ext = cd.name.split('.').pop()?.toLowerCase() ?? 'mp4'
    const fname = `clip_${seg.clipId}.${ext}`
    concatLines.push(`file '${fname}'`)
    concatLines.push(`inpoint ${seg.inPoint.toFixed(6)}`)
    concatLines.push(`outpoint ${seg.outPoint.toFixed(6)}`)
  }

  await ffmpeg.writeFile('concat.txt', concatLines.join('\n'))

  const [width, height] = (req.resolution ?? '1920x1080').split('x').map(Number)

  ffmpeg.on('progress', ({ progress }) => {
    post({ type: 'progress', value: 0.25 + progress * 0.7, label: 'Encoding...' })
  })

  post({ type: 'progress', value: 0.25, label: 'Encoding video...' })

  await ffmpeg.exec([
    '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    '-r', String(req.fps),
    '-movflags', '+faststart',
    '-y', 'output.mp4',
  ])

  post({ type: 'progress', value: 0.97, label: 'Reading output...' })

  const data = await ffmpeg.readFile('output.mp4')
  const buffer = (data as Uint8Array).buffer

  post({ type: 'done', buffer } satisfies WorkerMessage, [buffer])
}

function post(msg: WorkerMessage, transfer?: Transferable[]) {
  if (transfer) {
    self.postMessage(msg, { transfer })
  } else {
    self.postMessage(msg)
  }
}
