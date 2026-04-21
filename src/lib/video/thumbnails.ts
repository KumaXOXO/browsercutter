// src/lib/video/thumbnails.ts
// Extracts a single video frame at a given inPoint using an async seek chain.
// Returns a blob URL (caller must not revoke — cached per clipId).

const CACHE_MAX = 200
const cache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()
const THUMB_W = 160
const THUMB_H = 90

export async function getThumbnail(clipId: string, file: File, inPoint: number): Promise<string | null> {
  const key = `${clipId}:${inPoint}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = extractFrame(file, inPoint).then((url) => {
    if (url) {
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest) { URL.revokeObjectURL(cache.get(oldest)!); cache.delete(oldest) }
      }
      cache.set(key, url)
    }
    inFlight.delete(key)
    return url
  })
  inFlight.set(key, promise)
  return promise
}

const MAX_CONCURRENT = 5
let activeCount = 0
const queue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(() => { activeCount++; resolve() }))
}

function releaseSlot() {
  activeCount--
  const next = queue.shift()
  if (next) next()
}

async function extractFrame(file: File, inPoint: number): Promise<string | null> {
  await acquireSlot()
  let objectUrl: string | null = null
  try {
    objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('canplay timeout')), 8000)
      video.oncanplay = () => { clearTimeout(timeout); resolve() }
      video.onerror = () => { clearTimeout(timeout); reject(new Error('video error')) }
      video.src = objectUrl!
    })

    video.currentTime = inPoint

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('seeked timeout')), 5000)
      video.onseeked = () => { clearTimeout(timeout); resolve() }
      video.onerror = () => { clearTimeout(timeout); reject(new Error('seek error')) }
    })

    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(THUMB_W, THUMB_H)
      : Object.assign(document.createElement('canvas'), { width: THUMB_W, height: THUMB_H })

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H)

    const blob = canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
      : await new Promise<Blob | null>((res) => (canvas as HTMLCanvasElement).toBlob(res, 'image/jpeg', 0.7))

    if (!blob) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    releaseSlot()
  }
}
