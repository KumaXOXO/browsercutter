// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadProjectFromDir } from './saveManager'

afterEach(() => {
  vi.unstubAllGlobals()
})

const BASE_PROJECT = {
  segments: [],
  clips: [{ id: 'c1', name: 'test.mp4', mediaPath: 'media/test.mp4' }],
  projectSettings: { resolution: '1920x1080' },
}

function makeProjectFh(json: object) {
  const projectFile = new File([JSON.stringify(json)], 'project.json', { type: 'application/json' })
  return { getFile: vi.fn().mockResolvedValue(projectFile) }
}

function makeDir(projectFh: object, mediaDirFh?: object) {
  return {
    getFileHandle: vi.fn().mockImplementation((name: string) =>
      name === 'project.json'
        ? Promise.resolve(projectFh)
        : Promise.reject(new DOMException('not found', 'NotFoundError')),
    ),
    getDirectoryHandle: mediaDirFh
      ? vi.fn().mockResolvedValue(mediaDirFh)
      : vi.fn().mockRejectedValue(new DOMException('no media', 'NotFoundError')),
  }
}

describe('loadProjectFromDir — no arrayBuffer() on load', () => {
  it('returns the File from getFile() directly without buffering', async () => {
    const fakeFile = new File(['video-data'], 'test.mp4', { type: 'video/mp4', lastModified: 1000 })
    const mediaFileFh = { getFile: vi.fn().mockResolvedValue(fakeFile) }
    const mediaDirFh = { getFileHandle: vi.fn().mockResolvedValue(mediaFileFh) }
    const dirFh = makeDir(makeProjectFh(BASE_PROJECT), mediaDirFh)

    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(dirFh))

    const result = await loadProjectFromDir()

    expect(result.ok).toBe(true)
    const clips = result.data!.clips as Array<Record<string, unknown>>
    expect(clips[0].file).toBe(fakeFile)
    // arrayBuffer() is NOT called during load — no OOM risk for large files
    expect(mediaFileFh.getFile).toHaveBeenCalledTimes(1)
  })

  it('returns clip without file when getFile() throws (e.g. missing media file)', async () => {
    const mediaFileFh = { getFile: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotReadableError')) }
    const mediaDirFh = { getFileHandle: vi.fn().mockResolvedValue(mediaFileFh) }
    const dirFh = makeDir(makeProjectFh(BASE_PROJECT), mediaDirFh)

    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(dirFh))

    const result = await loadProjectFromDir()

    expect(result.ok).toBe(true)
    const clips = result.data!.clips as Array<Record<string, unknown>>
    expect(clips[0].file).toBeUndefined()
    expect(clips[0].mediaPath).toBe('media/test.mp4') // original data intact
  })

  it('returns clip without file when media/ directory does not exist', async () => {
    const dirFh = makeDir(makeProjectFh(BASE_PROJECT), undefined)
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(dirFh))

    const result = await loadProjectFromDir()

    expect(result.ok).toBe(true)
    const clips = result.data!.clips as Array<Record<string, unknown>>
    expect(clips[0].file).toBeUndefined()
  })
})

describe('saveProjectFile — stream write (no arrayBuffer)', () => {
  function makeSaveDir(opts: { writeFails?: boolean; filename?: string } = {}) {
    const { writeFails = false, filename = 'clip.mp4' } = opts
    const savedFile = new File(['saved'], filename, { type: 'video/mp4' })
    const writable = {
      write: writeFails
        ? vi.fn().mockRejectedValue(new DOMException('disk full', 'QuotaExceededError'))
        : vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const mediaFileFh = {
      createWritable: vi.fn().mockResolvedValue(writable),
      getFile: vi.fn().mockResolvedValue(savedFile),
    }
    const mediaDirFh = { getFileHandle: vi.fn().mockResolvedValue(mediaFileFh) }
    const projectWritable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }
    const projectFh = { createWritable: vi.fn().mockResolvedValue(projectWritable) }
    const saveDir = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mediaDirFh),
      getFileHandle: vi.fn().mockImplementation((name: string) =>
        name === 'project.json' ? Promise.resolve(projectFh) : Promise.resolve(mediaFileFh)
      ),
      name: 'my-project',
    }
    return { saveDir, writable, filename, savedFile }
  }

  it('writes the File/Blob directly without arrayBuffer()', async () => {
    const { saveDir, writable, filename } = makeSaveDir()
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(saveDir))

    vi.resetModules()
    const { ensureSaveDir, saveProjectFile } = await import('./saveManager')
    const { useAppStore } = await import('../store/useAppStore')

    await ensureSaveDir()
    const fakeFile = new File(['big-video'], filename, { type: 'video/mp4' })
    const prevClips = useAppStore.getState().clips
    useAppStore.setState({ clips: [{ id: 'c1', name: filename, file: fakeFile, duration: 1, width: 0, height: 0, type: 'video' }] })

    const result = await saveProjectFile()
    useAppStore.setState({ clips: prevClips })

    expect(result.ok).toBe(true)
    expect(result.skippedFiles).toHaveLength(0)
    // write() was called with the File directly, not an ArrayBuffer
    expect(writable.write).toHaveBeenCalledWith(fakeFile)
  })

  it('adds to skippedFiles and continues when write throws', async () => {
    const { saveDir, filename } = makeSaveDir({ writeFails: true, filename: 'clip.mp4' })
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(saveDir))

    vi.resetModules()
    const { ensureSaveDir, saveProjectFile } = await import('./saveManager')
    const { useAppStore } = await import('../store/useAppStore')

    await ensureSaveDir()
    const fakeFile = new File([new ArrayBuffer(4)], filename, { type: 'video/mp4' })
    const prevClips = useAppStore.getState().clips
    useAppStore.setState({ clips: [{ id: 'c1', name: filename, file: fakeFile, duration: 1, width: 0, height: 0, type: 'video' }] })

    const result = await saveProjectFile()
    useAppStore.setState({ clips: prevClips })

    expect(result.ok).toBe(true)
    expect(result.skippedFiles).toContain(filename)
  })
})
