// src/lib/audio/waveform.ts
// Main-thread API for waveform extraction.
// Sends ArrayBuffer (zero-copy) to worker, receives Float32Array (200 samples) back.

import WaveformWorker from './waveform.worker?worker'

const cache = new Map<string, Float32Array>()
const inFlight = new Map<string, Promise<Float32Array>>()

const MAX_CONCURRENT = 3
let activeCount = 0
const pendingQueue: Array<() => void> = []

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new WaveformWorker()
  }
  return worker
}

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
    return Promise.resolve()
  }
  return new Promise((resolve) => pendingQueue.push(() => { activeCount++; resolve() }))
}

function releaseSlot() {
  activeCount--
  const next = pendingQueue.shift()
  if (next) next()
}

export async function getWaveformSamples(file: File, clipId: string): Promise<Float32Array> {
  const cached = cache.get(clipId)
  if (cached) return cached

  const existing = inFlight.get(clipId)
  if (existing) return existing

  const promise = decodeWithWorker(file, clipId)
    .then((samples) => { cache.set(clipId, samples); return samples })
    .finally(() => inFlight.delete(clipId))
  inFlight.set(clipId, promise)
  return promise
}

async function decodeWithWorker(file: File, clipId: string): Promise<Float32Array> {
  // File size guard: skip >500MB (worker also guards, but saves the transfer cost)
  if (file.size > 500_000_000) {
    return new Float32Array(0)
  }

  await acquireSlot()

  try {
    const buffer = await file.arrayBuffer()
    const w = getWorker()

    return await new Promise<Float32Array>((resolve, reject) => {
      const handler = (e: MessageEvent<{ clipId: string; samples: Float32Array }>) => {
        if (e.data.clipId !== clipId) return
        w.removeEventListener('message', handler)
        resolve(e.data.samples)
      }
      w.addEventListener('message', handler)
      const errorHandler = (err: ErrorEvent) => {
        w.removeEventListener('message', handler)
        w.removeEventListener('error', errorHandler)
        reject(err)
      }
      w.addEventListener('error', errorHandler, { once: true })
      // Transfer ArrayBuffer to worker (zero-copy)
      w.postMessage({ buffer, clipId }, [buffer])
    })
  } catch {
    return new Float32Array(0)
  } finally {
    releaseSlot()
  }
}
