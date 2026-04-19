// src/lib/export/useExport.ts
import { useState, useRef, useCallback } from 'react'
import type { WorkerMessage } from './exportWorker'
import { useAppStore } from '../../store/useAppStore'

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

  const cancel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus('idle')
    setProgress(0)
    setLabel('')
  }, [])

  const startExport = useCallback(async () => {
    const { segments, clips, projectSettings, transitions, adjustmentLayers } = useAppStore.getState()

    const v1Segs = segments.filter((s) => s.trackIndex === 0)
    if (v1Segs.length === 0) {
      setErrorMsg('Add at least one clip to the timeline before exporting.')
      setStatus('error')
      return
    }

    setStatus('running')
    setProgress(0)
    setLabel('Preparing...')
    setErrorMsg('')

    const clipData: Record<string, { buffer: ArrayBuffer; name: string }> = {}
    const needed = new Set(v1Segs.map((s) => s.clipId))

    for (const clip of clips) {
      if (!needed.has(clip.id)) continue
      if (!clip.file) continue
      const buffer = await clip.file.arrayBuffer()
      clipData[clip.id] = { buffer, name: clip.name }
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
        const ext = projectSettings.format === 'webm' ? 'webm' : 'mp4'
        downloadBuffer(msg.buffer, `browsercutter-export.${ext}`)
        workerRef.current = null
      } else if (msg.type === 'error') {
        setErrorMsg(msg.message)
        setStatus('error')
        workerRef.current = null
      }
    }

    worker.onerror = (err) => {
      setErrorMsg(err.message ?? 'Worker error')
      setStatus('error')
      workerRef.current = null
    }

    const transferBuffers = Object.values(clipData).map((c) => c.buffer)

    worker.postMessage(
      {
        segments: v1Segs,
        clipData,
        fps: projectSettings.fps,
        resolution: projectSettings.resolution,
        transitions,
        adjustmentLayers,
        format: projectSettings.format,
        quality: projectSettings.quality,
      },
      transferBuffers,
    )
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
