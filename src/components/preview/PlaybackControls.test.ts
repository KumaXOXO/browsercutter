import { describe, it, expect } from 'vitest'
import type { Segment } from '../../types'

// Pure logic extracted from PlaybackControls: totalDuration uses ALL segments across all tracks
function computeTotalDuration(segments: Segment[]): number {
  return segments.reduce((max, s) => Math.max(max, s.startOnTimeline + (s.outPoint - s.inPoint)), 0)
}

const makeSeg = (id: string, overrides?: Partial<Segment>): Segment => ({
  id,
  clipId: 'clip1',
  trackIndex: 0,
  startOnTimeline: 0,
  inPoint: 0,
  outPoint: 5,
  ...overrides,
})

describe('totalDuration', () => {
  it('returns 0 for empty timeline', () => {
    expect(computeTotalDuration([])).toBe(0)
  })

  it('includes video track segment', () => {
    const segs = [makeSeg('a', { startOnTimeline: 2, inPoint: 0, outPoint: 8 })]
    expect(computeTotalDuration(segs)).toBe(10) // 2 + (8-0)
  })

  it('includes audio-only segment (trackIndex 2)', () => {
    const segs = [makeSeg('a', { trackIndex: 2, startOnTimeline: 0, inPoint: 0, outPoint: 15 })]
    expect(computeTotalDuration(segs)).toBe(15)
  })

  it('returns max across mixed tracks', () => {
    const segs = [
      makeSeg('v', { trackIndex: 0, startOnTimeline: 0, inPoint: 0, outPoint: 10 }),
      makeSeg('a', { trackIndex: 2, startOnTimeline: 5, inPoint: 0, outPoint: 20 }),
    ]
    // video ends at 10, audio ends at 5+20=25
    expect(computeTotalDuration(segs)).toBe(25)
  })

  it('is not limited to trackIndex 0 only', () => {
    const segs = [
      makeSeg('v', { trackIndex: 0, startOnTimeline: 0, inPoint: 0, outPoint: 5 }),
      makeSeg('a', { trackIndex: 2, startOnTimeline: 10, inPoint: 0, outPoint: 30 }),
    ]
    expect(computeTotalDuration(segs)).toBeGreaterThan(5) // regression: old code would return 5
    expect(computeTotalDuration(segs)).toBe(40)
  })
})
