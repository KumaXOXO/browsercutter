# Export via FFmpeg.wasm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement video export using FFmpeg.wasm running in a Web Worker. The user clicks Export, a modal opens showing progress, FFmpeg trims and concatenates all V1 segments from the timeline, and the result is offered as a download.

**Architecture:** A Vite Worker module (`exportWorker.ts`) imports `@ffmpeg/ffmpeg` and runs entirely off the main thread. The main thread communicates via `postMessage`/`onmessage`. A `useExport` React hook wraps the worker lifecycle and exposes reactive status + progress. An `ExportModal` component renders the progress bar and download link. TopBar's Export button opens the modal. The COEP/COOP headers required for FFmpeg's SharedArrayBuffer are already configured in nginx — add them to Vite dev server as well.

**Tech Stack:** React 18, TypeScript, Vite 6, `@ffmpeg/ffmpeg@0.12.x`, `@ffmpeg/util@0.12.x`

**Prerequisite:** Phases 1–3 complete (segments exist on timeline that can be exported).

---

### Task 1: Install FFmpeg.wasm packages and configure Vite

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Install packages**

Run: `npm install @ffmpeg/ffmpeg @ffmpeg/util`
Expected: both packages appear in `package-lock.json`.

- [ ] **Step 2: Update vite.config.ts**

Replace the full contents of `vite.config.ts` with:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Verify build still works**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "feat: install @ffmpeg/ffmpeg + @ffmpeg/util, configure Vite for worker and COEP/COOP"
```

---

### Task 2: Create the export Web Worker

**Files:**
- Create: `src/lib/export/exportWorker.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/lib/export
```

- [ ] **Step 2: Write the worker**

Create `src/lib/export/exportWorker.ts`:

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { Segment, ProjectSettings } from '../../types'

interface StartMessage {
  type: 'start'
  segments: Segment[]
  files: { id: string; file: File }[]
  settings: ProjectSettings
}

const ffmpeg = new FFmpeg()

self.onmessage = async (e: MessageEvent<StartMessage>) => {
  if (e.data.type !== 'start') return

  try {
    // Load FFmpeg core from CDN via blob URLs (avoids CORS issues with COEP)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpeg.on('progress', ({ progress }) => {
      self.postMessage({ type: 'progress', value: Math.min(99, Math.round(progress * 100)) })
    })

    const { segments, files, settings } = e.data

    // Only export V1 track, sorted by timeline position
    const v1Segs = segments
      .filter((s) => s.trackIndex === 0)
      .sort((a, b) => a.startOnTimeline - b.startOnTimeline)

    if (v1Segs.length === 0) {
      self.postMessage({ type: 'error', message: 'No clips on V1 track to export.' })
      return
    }

    // Write each unique source file into FFmpeg's virtual filesystem
    const written = new Set<string>()
    for (const { id, file } of files) {
      if (written.has(id)) continue
      const data = await fetchFile(file)
      await ffmpeg.writeFile(`src_${id}`, data)
      written.add(id)
    }

    // Trim each segment to a numbered output file
    const segFileNames: string[] = []
    for (let i = 0; i < v1Segs.length; i++) {
      const seg = v1Segs[i]
      const outName = `seg_${i}.mp4`
      await ffmpeg.exec([
        '-ss', String(seg.inPoint),
        '-to', String(seg.outPoint),
        '-i', `src_${seg.clipId}`,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        outName,
      ])
      segFileNames.push(outName)
    }

    // Write concat manifest
    const manifest = segFileNames.map((f) => `file '${f}'`).join('\n')
    await ffmpeg.writeFile('list.txt', manifest)

    // Concatenate all trimmed segments
    const outExt = settings.format
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'list.txt',
      '-c', 'copy',
      `output.${outExt}`,
    ])

    // Read result and send back as transferable
    const data = await ffmpeg.readFile(`output.${outExt}`) as Uint8Array
    self.postMessage({ type: 'done', data, format: outExt }, [data.buffer])

  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
```

- [ ] **Step 3: Verify TypeScript (skip runtime test — worker needs browser)**

Run: `npm run build 2>&1 | head -30`
Expected: clean — no type errors in the worker file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export/exportWorker.ts
git commit -m "feat: add FFmpeg.wasm export Web Worker"
```

---

### Task 3: Create useExport hook

**Files:**
- Create: `src/lib/export/useExport.ts`

- [ ] **Step 1: Write the hook**

Create `src/lib/export/useExport.ts`:

```typescript
import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'

export type ExportStatus = 'idle' | 'loading' | 'exporting' | 'done' | 'error'

export interface UseExportReturn {
  status: ExportStatus
  progress: number
  downloadUrl: string | null
  error: string | null
  startExport: () => void
  cancel: () => void
  reset: () => void
}

export function useExport(): UseExportReturn {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const prevDownloadUrl = useRef<string | null>(null)

  const segments = useAppStore((s) => s.segments)
  const clips = useAppStore((s) => s.clips)
  const projectSettings = useAppStore((s) => s.projectSettings)

  const reset = useCallback(() => {
    if (prevDownloadUrl.current) {
      URL.revokeObjectURL(prevDownloadUrl.current)
      prevDownloadUrl.current = null
    }
    setStatus('idle')
    setProgress(0)
    setDownloadUrl(null)
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus('idle')
  }, [])

  const startExport = useCallback(() => {
    // Revoke previous download URL if any
    if (prevDownloadUrl.current) {
      URL.revokeObjectURL(prevDownloadUrl.current)
      prevDownloadUrl.current = null
    }

    setStatus('loading')
    setProgress(0)
    setDownloadUrl(null)
    setError(null)

    const worker = new Worker(
      new URL('./exportWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data
      if (type === 'progress') {
        setStatus('exporting')
        setProgress(e.data.value as number)
      } else if (type === 'done') {
        const blob = new Blob([e.data.data as Uint8Array], {
          type: `video/${e.data.format as string}`,
        })
        const url = URL.createObjectURL(blob)
        prevDownloadUrl.current = url
        setDownloadUrl(url)
        setProgress(100)
        setStatus('done')
        worker.terminate()
        workerRef.current = null
      } else if (type === 'error') {
        setError(e.data.message as string)
        setStatus('error')
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.onerror = (ev) => {
      setError(`Worker error: ${ev.message}`)
      setStatus('error')
      workerRef.current = null
    }

    const files = clips.map((c) => ({ id: c.id, file: c.file }))
    worker.postMessage({ type: 'start', segments, files, settings: projectSettings })
  }, [segments, clips, projectSettings])

  return { status, progress, downloadUrl, error, startExport, cancel, reset }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/useExport.ts
git commit -m "feat: add useExport hook wrapping FFmpeg worker lifecycle"
```

---

### Task 4: Create ExportModal component

**Files:**
- Create: `src/components/export/ExportModal.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/components/export
```

- [ ] **Step 2: Write the modal**

Create `src/components/export/ExportModal.tsx`:

```tsx
import { X, Download, AlertCircle, Loader2 } from 'lucide-react'
import { useExport } from '../../lib/export/useExport'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  onClose: () => void
}

export default function ExportModal({ onClose }: Props) {
  const { status, progress, downloadUrl, error, startExport, cancel, reset } = useExport()
  const projectSettings = useAppStore((s) => s.projectSettings)

  function handleClose() {
    if (status === 'loading' || status === 'exporting') cancel()
    else reset()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="flex flex-col gap-5 rounded-xl"
        style={{
          width: 420,
          padding: 28,
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Export Video</h2>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--muted2)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Settings summary */}
        {status === 'idle' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted2)' }}>
              <div className="flex justify-between mb-1"><span>Format</span><span className="font-mono uppercase">{projectSettings.format}</span></div>
              <div className="flex justify-between mb-1"><span>Resolution</span><span className="font-mono">{projectSettings.resolution}</span></div>
              <div className="flex justify-between"><span>Frame Rate</span><span className="font-mono">{projectSettings.fps} fps</span></div>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted-subtle)' }}>
              FFmpeg.wasm (~25 MB) loads on first export. Subsequent exports in this session are faster.
            </p>
            <button
              onClick={startExport}
              className="rounded-lg text-sm font-semibold text-white cursor-pointer transition-all duration-150"
              style={{ padding: '11px 20px', background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none', boxShadow: '0 4px 14px rgba(225,29,72,0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(225,29,72,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(225,29,72,0.35)' }}
            >
              Start Export
            </button>
          </div>
        )}

        {(status === 'loading' || status === 'exporting') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted2)' }}>
              <Loader2 size={14} className="animate-spin" />
              {status === 'loading' ? 'Loading FFmpeg.wasm…' : `Exporting… ${progress}%`}
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${status === 'loading' ? 5 : progress}%`,
                  background: 'linear-gradient(90deg,#E11D48,#C41232)',
                  borderRadius: 3,
                  transition: 'width 400ms ease',
                }}
              />
            </div>
            <button
              onClick={() => { cancel(); onClose() }}
              className="text-xs cursor-pointer text-left"
              style={{ color: 'var(--muted-subtle)', background: 'transparent', border: 'none' }}
            >
              Cancel export
            </button>
          </div>
        )}

        {status === 'done' && downloadUrl && (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: '#34D399' }}>Export complete!</p>
            <a
              href={downloadUrl}
              download={`browsercutter-export.${projectSettings.format}`}
              className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white"
              style={{
                padding: '11px 20px',
                background: 'linear-gradient(135deg,#059669,#047857)',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Download .{projectSettings.format}
            </a>
            <button
              onClick={reset}
              className="text-xs cursor-pointer"
              style={{ color: 'var(--muted-subtle)', background: 'transparent', border: 'none' }}
            >
              Export again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
            <button
              onClick={startExport}
              className="rounded-lg text-sm font-semibold text-white cursor-pointer"
              style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#E11D48,#C41232)', border: 'none' }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/export/ExportModal.tsx
git commit -m "feat: add ExportModal component with progress bar and download"
```

---

### Task 5: Wire Export button in TopBar

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/layout/TopBar.tsx`, add:

```typescript
import { useState } from 'react'
import ExportModal from '../export/ExportModal'
```

- [ ] **Step 2: Add modal state and wire the button**

Inside the `TopBar` function body, add state:

```typescript
  const [showExport, setShowExport] = useState(false)
```

Change the existing `PrimaryBtn` `onClick`:

```tsx
        <PrimaryBtn onClick={() => setShowExport(true)}>
          Export Video
        </PrimaryBtn>
```

- [ ] **Step 3: Mount the modal at the end of TopBar's return**

The current TopBar return is a single `<div>`. Convert it to a fragment and append the modal:

```tsx
  return (
    <>
      <div
        className="flex items-center justify-between px-3 border-b shrink-0"
        style={{ height: 48, background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}
      >
        {/* ... all existing content unchanged ... */}
      </div>
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
```

- [ ] **Step 4: Verify TypeScript**

Run: `npm run build 2>&1 | head -20`
Expected: clean.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat: wire Export button to open ExportModal in TopBar"
```

---

### Notes for testing export end-to-end

Export cannot be unit-tested (requires browser + FFmpeg.wasm). To verify manually after deployment:

1. Load 2–3 short video clips (under 30 seconds total)
2. Use BPM Generate to place segments on the timeline
3. Click Export Video → modal opens showing settings
4. Click Start Export → progress bar should advance through loading (5%) then exporting (5–99%)
5. When done, click Download — file should be a valid MP4
6. Verify with VLC or browser: video plays, all segments concatenated in order

**If FFmpeg core fails to load from unpkg:**
The `toBlobURL` approach requires the browser to fetch from unpkg. If the network is blocked, mirror the core files to `/public/ffmpeg/` and update the `baseURL` in `exportWorker.ts` to `/ffmpeg`.

**On export cancellation:** the Worker is terminated immediately — no cleanup of FFmpeg's virtual filesystem is needed since the worker process ends.
