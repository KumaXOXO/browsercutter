import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Segment, TextOverlay } from '../types'

const makeSeg = (id: string, overrides?: Partial<Segment>): Segment => ({
  id,
  clipId: 'clip1',
  trackIndex: 0,
  startOnTimeline: 0,
  inPoint: 0,
  outPoint: 5,
  ...overrides,
})

const makeOverlay = (id: string, overrides?: Partial<TextOverlay>): TextOverlay => ({
  id,
  text: 'Hello',
  startOnTimeline: 0,
  duration: 2,
  font: 'Inter',
  size: 32,
  color: '#FFFFFF',
  x: 0.5,
  y: 0.85,
  ...overrides,
})

describe('segment hide/mute + undo', () => {
  beforeEach(() => {
    useAppStore.setState({ segments: [], _history: [], _future: [] })
  })

  it('updateSegment sets hidden:true', () => {
    useAppStore.getState().addSegment(makeSeg('a'))
    useAppStore.getState().updateSegment('a', { hidden: true })
    expect(useAppStore.getState().segments.find((s) => s.id === 'a')?.hidden).toBe(true)
  })

  it('updateSegment sets hidden:false', () => {
    useAppStore.getState().addSegment(makeSeg('a', { hidden: true }))
    useAppStore.getState().updateSegment('a', { hidden: false })
    expect(useAppStore.getState().segments.find((s) => s.id === 'a')?.hidden).toBe(false)
  })

  it('updateSegment sets muted:true', () => {
    useAppStore.getState().addSegment(makeSeg('a'))
    useAppStore.getState().updateSegment('a', { muted: true })
    expect(useAppStore.getState().segments.find((s) => s.id === 'a')?.muted).toBe(true)
  })

  it('undo restores hidden to undefined after updateSegment', () => {
    useAppStore.getState().addSegment(makeSeg('a'))
    useAppStore.getState().updateSegment('a', { hidden: true })
    useAppStore.getState().undo()
    expect(useAppStore.getState().segments.find((s) => s.id === 'a')?.hidden).toBeUndefined()
  })

  it('undo restores muted to undefined after updateSegment', () => {
    useAppStore.getState().addSegment(makeSeg('a'))
    useAppStore.getState().updateSegment('a', { muted: true })
    useAppStore.getState().undo()
    expect(useAppStore.getState().segments.find((s) => s.id === 'a')?.muted).toBeUndefined()
  })
})

describe('textOverlay store actions', () => {
  beforeEach(() => {
    useAppStore.setState({ textOverlays: [] })
  })

  it('addTextOverlay appends to the list', () => {
    const overlay = makeOverlay('a')
    useAppStore.getState().addTextOverlay(overlay)
    expect(useAppStore.getState().textOverlays).toHaveLength(1)
    expect(useAppStore.getState().textOverlays[0].id).toBe('a')
  })

  it('addTextOverlay preserves existing overlays', () => {
    useAppStore.getState().addTextOverlay(makeOverlay('a'))
    useAppStore.getState().addTextOverlay(makeOverlay('b'))
    expect(useAppStore.getState().textOverlays).toHaveLength(2)
  })

  it('updateTextOverlay patches the correct entry', () => {
    useAppStore.getState().addTextOverlay(makeOverlay('a', { text: 'Old' }))
    useAppStore.getState().addTextOverlay(makeOverlay('b', { text: 'Other' }))
    useAppStore.getState().updateTextOverlay('a', { text: 'New' })
    const { textOverlays } = useAppStore.getState()
    expect(textOverlays.find((o) => o.id === 'a')?.text).toBe('New')
    expect(textOverlays.find((o) => o.id === 'b')?.text).toBe('Other')
  })

  it('updateTextOverlay is a no-op for unknown id', () => {
    useAppStore.getState().addTextOverlay(makeOverlay('a'))
    useAppStore.getState().updateTextOverlay('unknown', { text: 'X' })
    expect(useAppStore.getState().textOverlays[0].text).toBe('Hello')
  })

  it('removeTextOverlay removes only the target', () => {
    useAppStore.getState().addTextOverlay(makeOverlay('a'))
    useAppStore.getState().addTextOverlay(makeOverlay('b'))
    useAppStore.getState().removeTextOverlay('a')
    const { textOverlays } = useAppStore.getState()
    expect(textOverlays).toHaveLength(1)
    expect(textOverlays[0].id).toBe('b')
  })

  it('removeTextOverlay is a no-op for unknown id', () => {
    useAppStore.getState().addTextOverlay(makeOverlay('a'))
    useAppStore.getState().removeTextOverlay('unknown')
    expect(useAppStore.getState().textOverlays).toHaveLength(1)
  })
})

describe('loadProject', () => {
  beforeEach(() => {
    useAppStore.setState({
      projectName: 'Old Name',
      segments: [],
      clips: [],
      textOverlays: [],
      transitions: [],
      adjustmentLayers: [],
      isPlaying: true,
      playheadPosition: 5,
      _history: [{ segments: [], textOverlays: [] }],
      _future: [{ segments: [], textOverlays: [] }],
    })
  })

  const minimalData = {
    segments: [],
    clips: [],
    projectSettings: { resolution: '1920x1080', fps: 30, format: 'mp4', quality: 'good', autoDetectBpm: true, snapToBeat: true, hardwareAcceleration: false, showClipThumbnails: false },
    transitions: [],
    adjustmentLayers: [],
    textOverlays: [],
  }

  it('sets clips with file=null', () => {
    const data = { ...minimalData, clips: [{ id: 'c1', name: 'test.mp4', duration: 5, width: 1920, height: 1080, type: 'video' }] }
    useAppStore.getState().loadProject(data as Record<string, unknown>)
    const { clips } = useAppStore.getState()
    expect(clips).toHaveLength(1)
    expect(clips[0].id).toBe('c1')
    expect(clips[0].file).toBeNull()
  })

  it('resets isPlaying to false', () => {
    useAppStore.getState().loadProject(minimalData as Record<string, unknown>)
    expect(useAppStore.getState().isPlaying).toBe(false)
  })

  it('resets playheadPosition to 0', () => {
    useAppStore.getState().loadProject(minimalData as Record<string, unknown>)
    expect(useAppStore.getState().playheadPosition).toBe(0)
  })

  it('clears undo history', () => {
    useAppStore.getState().loadProject(minimalData as Record<string, unknown>)
    expect(useAppStore.getState()._history).toHaveLength(0)
    expect(useAppStore.getState()._future).toHaveLength(0)
  })

  it('restores projectName from data', () => {
    useAppStore.getState().loadProject({ ...minimalData, projectName: 'New Name' } as Record<string, unknown>)
    expect(useAppStore.getState().projectName).toBe('New Name')
  })

  it('falls back to existing projectName when missing in data', () => {
    useAppStore.getState().loadProject(minimalData as Record<string, unknown>)
    expect(useAppStore.getState().projectName).toBe('Old Name')
  })
})

describe('masterVolume', () => {
  beforeEach(() => {
    useAppStore.setState({ masterVolume: 1 })
  })

  it('defaults to 1', () => {
    expect(useAppStore.getState().masterVolume).toBe(1)
  })

  it('setMasterVolume updates the value', () => {
    useAppStore.getState().setMasterVolume(0.5)
    expect(useAppStore.getState().masterVolume).toBe(0.5)
  })

  it('setMasterVolume accepts 0', () => {
    useAppStore.getState().setMasterVolume(0)
    expect(useAppStore.getState().masterVolume).toBe(0)
  })
})
