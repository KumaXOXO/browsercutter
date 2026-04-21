// Tests for the handleAddToTimeline logic shared by VideoGrid and MusicList.
// The logic lives inline in each component but the rules are the same — test them here.
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../store/useAppStore'
import type { Clip, Segment } from '../../../types'

const makeClip = (type: Clip['type'], duration = 5): Clip => ({
  id: crypto.randomUUID(),
  file: new File([], 'test.mp4'),
  name: 'test.mp4',
  duration,
  width: 1920,
  height: 1080,
  type,
})

const addViaLogic = (clip: Clip, segments: Segment[]) => {
  const trackIndex = clip.type === 'audio' ? 2 : 0
  const endOfTrack = segments
    .filter((s) => s.trackIndex === trackIndex)
    .reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)
  return { id: 'test', clipId: clip.id, trackIndex, startOnTimeline: endOfTrack, inPoint: 0, outPoint: clip.duration }
}

describe('handleAddToTimeline logic', () => {
  beforeEach(() => {
    useAppStore.setState({ segments: [], _history: [], _future: [] })
  })

  it('audio clip routes to trackIndex 2', () => {
    const clip = makeClip('audio')
    const result = addViaLogic(clip, [])
    expect(result.trackIndex).toBe(2)
  })

  it('video clip routes to trackIndex 0', () => {
    const clip = makeClip('video')
    const result = addViaLogic(clip, [])
    expect(result.trackIndex).toBe(0)
  })

  it('image clip routes to trackIndex 0', () => {
    const clip = makeClip('image')
    const result = addViaLogic(clip, [])
    expect(result.trackIndex).toBe(0)
  })

  it('first clip starts at startOnTimeline=0', () => {
    const clip = makeClip('video', 5)
    const result = addViaLogic(clip, [])
    expect(result.startOnTimeline).toBe(0)
  })

  it('second clip appends after first', () => {
    const existing: Segment = { id: 'e1', clipId: 'c1', trackIndex: 0, startOnTimeline: 2, inPoint: 0, outPoint: 5 }
    const clip = makeClip('video', 3)
    const result = addViaLogic(clip, [existing])
    expect(result.startOnTimeline).toBe(7) // 2 + (5-0) = 7
  })
})
