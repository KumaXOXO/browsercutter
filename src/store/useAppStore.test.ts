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
