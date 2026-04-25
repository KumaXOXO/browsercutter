// src/lib/export/useExport.ts
import { useState, useRef, useCallback } from 'react'
import type { WorkerMessage } from './exportWorker'
import { useAppStore } from '../../store/useAppStore'
import { writeExportFile, getUniqueExportFilename, hasSaveDir } from '../saveManager'

export type ExportStatus = 'idle' | 'running' | 'done' | 'error'

export interface ExportState {
  status: ExportStatus
  progress: number
  label: string
  errorMsg: string
  startExport: () => void
  cancel: () => void
}

export function useExport(): ExportState {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const workerRef = useRef<Worker | null>(null)
  const blobUrlsRef = useRef<string[]>([])

  const cancel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrlsRef.current = []
    setStatus('idle')
    setProgress(0)
    setLabel('')
  }, [])

  const startExport = useCallback(async () => {
    const { segments, clips, projectSettings, transitions, adjustmentLayers, tracks } = useAppStore.getState()

    const videoTrackIndices = new Set(tracks.filter((t) => t.type === 'video').map((t) => t.trackIndex))
    const videoSegs = segments.filter((s) => videoTrackIndices.has(s.trackIndex))
    if (videoSegs.length === 0) {
      setErrorMsg('Add at least one clip to the timeline before exporting.')
      setStatus('error')
      return
    }

    setStatus('running')
    setProgress(0)
    setLabel('Preparing...')
    setErrorMsg('')

    const clipFiles: Record<string, { url: string; name: string }> = {}
    blobUrlsRef.current = []
    const blobUrls = blobUrlsRef.current
    const needed = new Set(videoSegs.map((s) => s.clipId))

    const missingFiles = clips.filter((c) => needed.has(c.id) && !c.file).map((c) => c.name)
    if (missingFiles.length > 0) {
      setErrorMsg(`Cannot export: ${missingFiles.length} clip(s) have no source file. Re-import them in the Media tab: ${missingFiles.slice(0, 3).join(', ')}${missingFiles.length > 3 ? '…' : ''}`)
      setStatus('error')
      return
    }

    // Create blob URLs on the main thread where file permissions are guaranteed.
    // Workers can fetch blob URLs without running into permission expiry issues.
    const notAllowed: string[] = []
    const notReadable: string[] = []
    const otherErrors: string[] = []
    for (const clip of clips) {
      if (!needed.has(clip.id) || !clip.file) continue
      try {
        await clip.file.slice(0, 1).arrayBuffer()
        const url = URL.createObjectURL(clip.file)
        blobUrls.push(url)
        clipFiles[clip.id] = { url, name: clip.name }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotAllowedError') notAllowed.push(clip.name)
        else if (e instanceof DOMException && e.name === 'NotReadableError') notReadable.push(clip.name)
        else otherErrors.push(clip.name)
      }
    }
    if (notAllowed.length > 0) {
      const names = notAllowed.slice(0, 3).join(', ') + (notAllowed.length > 3 ? '…' : '')
      setErrorMsg(`Files no longer readable — close and reload this project folder: ${names}`)
      setStatus('error')
      return
    }
    if (notReadable.length > 0) {
      const names = notReadable.slice(0, 3).join(', ') + (notReadable.length > 3 ? '…' : '')
      setErrorMsg(`Files deleted or moved — re-import in the Media tab: ${names}`)
      setStatus('error')
      return
    }
    if (otherErrors.length > 0) {
      const names = otherErrors.slice(0, 3).join(', ') + (otherErrors.length > 3 ? '…' : '')
      setErrorMsg(`Cannot read ${otherErrors.length} file(s): ${names}. Re-import them in the Media tab and try again.`)
      setStatus('error')
      return
    }

    // Pre-pick the save handle now while we're in a user-gesture context.
    // showSaveFilePicker() fails silently inside worker.onmessage (not a user gesture).
    const ext = projectSettings.format === 'webm' ? 'webm' : 'mp4'
    const baseName = 'browsercutter-export'
    let prePickedHandle: FileSystemFileHandle | null = null
    if (!hasSaveDir() && 'showSaveFilePicker' in window) {
      try {
        prePickedHandle = await (window as Window & {
          showSaveFilePicker: (o: Record<string, unknown>) => Promise<FileSystemFileHandle>
        }).showSaveFilePicker({
          suggestedName: `${baseName}.${ext}`,
          types: [{ description: `${ext.toUpperCase()} Video`, accept: { [`video/${ext}`]: [`.${ext}`] } }],
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('idle')
          return
        }
        // SecurityError or other: continue without pre-picked handle, fall back to download
      }
    }

    const worker = new Worker(
      new URL('./exportWorker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress(msg.value)
        setLabel(msg.label)
      } else if (msg.type === 'done') {
        setProgress(1)
        setLabel('Done!')
        setStatus('done')
        blobUrls.forEach((u) => URL.revokeObjectURL(u))
        ;(async () => {
          const filename = await getUniqueExportFilename(baseName, ext)
          let saved = await writeExportFile(msg.buffer, filename).catch(() => false)
          if (!saved && prePickedHandle) {
            try {
              const writable = await prePickedHandle.createWritable()
              await writable.write(msg.buffer)
              await writable.close()
              saved = true
            } catch { /* fall through to download */ }
          }
          if (!saved) {
            downloadBuffer(msg.buffer, `${baseName}.${ext}`)
          }
          workerRef.current = null
        })()
      } else if (msg.type === 'error') {
        setErrorMsg(msg.message)
        setStatus('error')
        blobUrls.forEach((u) => URL.revokeObjectURL(u))
        workerRef.current = null
      }
    }

    worker.onerror = (err) => {
      setErrorMsg(err.message ?? 'Worker error')
      setStatus('error')
      workerRef.current = null
    }

    const resolution = projectSettings.resolution === 'custom'
      ? `${projectSettings.customWidth ?? 1920}x${projectSettings.customHeight ?? 1080}`
      : projectSettings.resolution
    const fps = projectSettings.fps === 0 ? (projectSettings.customFps ?? 30) : projectSettings.fps

    // File objects are structured-cloned (no data copied yet); the worker reads
    // the full buffers itself so the main thread never blocks on large files.
    worker.postMessage({
      segments: videoSegs,
      clipFiles,
      fps,
      resolution,
      transitions,
      adjustmentLayers,
      format: projectSettings.format,
      quality: projectSettings.quality,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, progress, label, errorMsg, startExport, cancel }
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'video/mp4' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// saveWithPickerOrDownload removed — export now pre-picks the handle before
// starting the worker so it stays within a user-gesture context.
