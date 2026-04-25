// src/components/panels/MediaPanel/UploadZone.tsx
import { Upload } from 'lucide-react'
import { openVideoFiles, fileToClip } from '../../../lib/video/fileHandler'
import { useAppStore } from '../../../store/useAppStore'
import { ensureSaveDir, hasSaveDir } from '../../../lib/saveManager'

const PROXY_THRESHOLD_BYTES = 300 * 1024 * 1024 // 300 MB

interface Props {
  setJobProgress: (clipId: string, progress: number, label: string) => void
  clearJob: (clipId: string) => void
}

export default function UploadZone({ setJobProgress, clearJob }: Props) {
  const { addClip, updateClip } = useAppStore()

  async function processFiles(files: File[]) {
    for (const file of files) {
      const { clips } = useAppStore.getState()
      const existing = clips.find((c) => c.name === file.name && !c.file)
      if (existing) {
        updateClip(existing.id, { file })
      } else {
        const clip = await fileToClip(file)
        addClip(clip)

        if (clip.type === 'video' && file.size > PROXY_THRESHOLD_BYTES) {
          generateProxy(clip.id, file).catch((err) => {
            console.error('[Proxy] generation failed:', err)
            clearJob(clip.id)
          })
        }
      }
    }
  }

  async function generateProxy(clipId: string, file: File) {
    setJobProgress(clipId, 0, 'Select project folder to save proxy…')

    // Require a project folder so the proxy survives page reloads
    const dir = !hasSaveDir() ? await ensureSaveDir() : await ensureSaveDir()
    if (!dir) { clearJob(clipId); return }

    setJobProgress(clipId, 0, 'Starting proxy generation…')

    const blobUrl = URL.createObjectURL(file)

    const worker = new Worker(
      new URL('../../../lib/video/proxyWorker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = async (e: MessageEvent) => {
      const msg = e.data as { type: string; value?: number; label?: string; buffer?: ArrayBuffer; message?: string; clipId?: string }
      if (msg.type === 'progress') {
        setJobProgress(clipId, msg.value ?? 0, msg.label ?? 'Generating proxy…')
      } else if (msg.type === 'done' && msg.buffer) {
        URL.revokeObjectURL(blobUrl)
        worker.terminate()

        try {
          const mediaDir = await dir.getDirectoryHandle('media', { create: true })
          const proxyDir = await mediaDir.getDirectoryHandle('proxy', { create: true })
          const proxyName = file.name.replace(/\.[^.]+$/, '') + '_proxy.mp4'
          const fh = await proxyDir.getFileHandle(proxyName, { create: true })
          const writable = await fh.createWritable()
          await writable.write(msg.buffer)
          await writable.close()
          const proxyFile = await fh.getFile()
          updateClip(clipId, { proxyFile })
        } catch {
          // Fallback: keep proxy in memory only
          const proxyName = file.name.replace(/\.[^.]+$/, '') + '_proxy.mp4'
          const proxyFile = new File([msg.buffer!], proxyName, { type: 'video/mp4' })
          updateClip(clipId, { proxyFile })
        }
        clearJob(clipId)
      } else if (msg.type === 'error') {
        URL.revokeObjectURL(blobUrl)
        worker.terminate()
        clearJob(clipId)
        console.error('[Proxy] worker error:', msg.message)
      }
    }

    worker.onerror = (err) => {
      URL.revokeObjectURL(blobUrl)
      clearJob(clipId)
      console.error('[Proxy] worker onerror:', err.message)
    }

    worker.postMessage({ clipId, fileName: file.name, blobUrl })
  }

  async function handleUpload() {
    const files = await openVideoFiles()
    await processFiles(files)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    processFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <button
      onClick={handleUpload}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="w-full text-center rounded-xl cursor-pointer transition-all duration-200"
      style={{ padding: '18px 12px', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)'; e.currentTarget.style.background = 'rgba(225,29,72,0.04)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'transparent' }}
    >
      <Upload size={20} className="mx-auto mb-2" style={{ color: 'var(--muted-subtle)' }} />
      <p className="text-xs" style={{ color: 'var(--muted2)' }}>
        Drop files or <span style={{ color: '#E11D48' }}>browse</span>
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--muted-subtle)', fontSize: 9 }}>
        Files &gt;300 MB: a project folder will be requested to save the preview proxy
      </p>
    </button>
  )
}
