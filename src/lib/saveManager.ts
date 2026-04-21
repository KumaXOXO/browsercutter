// src/lib/saveManager.ts
// Handles folder-based project save/load using File System Access API.
// Falls back to JSON download on unsupported browsers.

import { useAppStore } from '../store/useAppStore'

let _saveDir: FileSystemDirectoryHandle | null = null

export function hasSaveDir(): boolean { return _saveDir !== null }
export function getSaveDirName(): string | null { return _saveDir?.name ?? null }

async function pickDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' } as DirectoryPickerOptions)
    _saveDir = dir
    return dir
  } catch {
    return null
  }
}

export async function ensureSaveDir(): Promise<FileSystemDirectoryHandle | null> {
  if (_saveDir) return _saveDir
  return pickDir()
}

export async function saveProjectFile(): Promise<{ ok: boolean; reason?: string }> {
  const { projectName, projectSettings, segments, textOverlays, bpmConfig, transitions, adjustmentLayers, clips, tracks } = useAppStore.getState()
  const serializedClips = clips.map(({ file: _f, ...meta }) => meta)
  const data = { projectName, projectSettings, segments, textOverlays, bpmConfig, transitions, adjustmentLayers, clips: serializedClips, tracks, savedAt: Date.now() }

  if ('showDirectoryPicker' in window) {
    if (!_saveDir) {
      const dir = await pickDir()
      if (!dir) return { ok: false, reason: 'cancelled' }
    }
    try {
      const fh = await _saveDir!.getFileHandle('project.json', { create: true })
      const writable = await fh.createWritable()
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      return { ok: true }
    } catch (e: unknown) {
      // Only reset the saved directory when the handle is no longer valid
      // (e.g. user deleted the folder). Transient I/O errors keep the handle.
      if (e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'InvalidStateError')) {
        _saveDir = null
      }
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  } else {
    // Fallback: download JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'project'}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return { ok: true }
  }
}

export async function writeExportFile(buffer: ArrayBuffer, filename: string): Promise<boolean> {
  if (!_saveDir) return false
  try {
    const exportDir = await _saveDir.getDirectoryHandle('export', { create: true })
    const fh = await exportDir.getFileHandle(filename, { create: true })
    const writable = await fh.createWritable()
    await writable.write(buffer)
    await writable.close()
    return true
  } catch {
    return false
  }
}
