// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExport } from './useExport'
import { useAppStore } from '../../store/useAppStore'
import type { Clip } from '../../types'

function makeClipWithError(id: string, error: Error | DOMException): Clip {
  return {
    id,
    name: `${id}.mp4`,
    file: { arrayBuffer: vi.fn().mockRejectedValue(error) } as unknown as File,
    duration: 5,
    width: 1920,
    height: 1080,
    type: 'video',
  }
}

function setupStore(clips: Clip[]) {
  const defaults = useAppStore.getState()
  useAppStore.setState({
    clips,
    segments: clips.map((c, i) => ({
      id: `s${i}`,
      clipId: c.id,
      trackIndex: 0,
      startOnTimeline: i * 5,
      inPoint: 0,
      outPoint: 5,
    })),
    tracks: [{ id: 't1', trackIndex: 0, type: 'video' as const, name: 'Video 1' }],
    transitions: [],
    adjustmentLayers: [],
    projectSettings: defaults.projectSettings,
  })
}

describe('useExport — Change 3: file-read error messages', () => {
  let savedState: ReturnType<typeof useAppStore.getState>

  beforeEach(() => { savedState = useAppStore.getState() })
  afterEach(() => { useAppStore.setState(savedState); vi.restoreAllMocks() })

  it('3a: NotReadableError → "deleted or moved" message', async () => {
    setupStore([makeClipWithError('c1', new DOMException('gone', 'NotReadableError'))])
    const { result } = renderHook(() => useExport())

    await act(async () => { await result.current.startExport() })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('deleted or moved')
    expect(result.current.errorMsg).toContain('re-import in the Media tab')
  })

  it('3b: NotAllowedError → "reload this project folder" message', async () => {
    setupStore([makeClipWithError('c1', new DOMException('denied', 'NotAllowedError'))])
    const { result } = renderHook(() => useExport())

    await act(async () => { await result.current.startExport() })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('reload this project folder')
  })

  it('3c: generic Error → generic re-import message', async () => {
    setupStore([makeClipWithError('c1', new Error('disk I/O error'))])
    const { result } = renderHook(() => useExport())

    await act(async () => { await result.current.startExport() })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('Re-import them in the Media tab')
  })

  it('NotAllowedError takes priority over NotReadableError when both present', async () => {
    setupStore([
      makeClipWithError('c1', new DOMException('gone', 'NotReadableError')),
      makeClipWithError('c2', new DOMException('gone', 'NotReadableError')),
      makeClipWithError('c3', new DOMException('denied', 'NotAllowedError')),
    ])
    const { result } = renderHook(() => useExport())

    await act(async () => { await result.current.startExport() })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMsg).toContain('reload this project folder')
  })
})
