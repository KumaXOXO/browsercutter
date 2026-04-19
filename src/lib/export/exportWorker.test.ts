// src/lib/export/exportWorker.test.ts
import { describe, it, expect } from 'vitest'
import { calculateXfadeOffsets, buildFilterComplex } from './exportWorkerUtils'
import type { ExportSegment } from './exportWorkerUtils'
import type { Transition, AdjustmentLayer } from '../../types'

const W = 1920
const H = 1080

function makeSeg(id: string, clipId: string, inPoint: number, outPoint: number, opts: Partial<ExportSegment> = {}): ExportSegment {
  return { id, clipId, trackIndex: 0, startOnTimeline: inPoint, inPoint, outPoint, ...opts }
}

function makeTrans(id: string, beforeId: string, afterId: string, type: Transition['type'], duration: number): Transition {
  return { id, beforeSegmentId: beforeId, afterSegmentId: afterId, type, duration }
}

describe('calculateXfadeOffsets', () => {
  it('returns correct offset for a single transition', () => {
    // seg0 = 5s, seg1 = 3s, transition = 0.5s
    // offset should be 5 - 0.5 = 4.5
    const offsets = calculateXfadeOffsets([5, 3], [0.5])
    expect(offsets).toHaveLength(1)
    expect(offsets[0]).toBeCloseTo(4.5)
  })

  it('returns correct offsets for two transitions', () => {
    // seg0=5s, seg1=4s, seg2=3s, t01=0.5s, t12=0.5s
    // offset[0] = 5 - 0.5 = 4.5
    // cumDur after t01 = 5 + 4 - 0.5 = 8.5
    // offset[1] = 8.5 - 0.5 = 8.0
    const offsets = calculateXfadeOffsets([5, 4, 3], [0.5, 0.5])
    expect(offsets[0]).toBeCloseTo(4.5)
    expect(offsets[1]).toBeCloseTo(8.0)
  })

  it('handles zero-duration cuts (tDur=0)', () => {
    // Cuts have tDur=0, offset=cumDur (boundary point)
    const offsets = calculateXfadeOffsets([5, 3], [0])
    expect(offsets[0]).toBeCloseTo(5)
  })

  it('clamps offset to 0 when transition longer than segment', () => {
    // Degenerate case: transition longer than first segment
    const offsets = calculateXfadeOffsets([1, 5], [2])
    expect(offsets[0]).toBe(0)
  })
})

describe('buildFilterComplex', () => {
  it('single segment with no effects produces basic trim+scale filter', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5)]
    const { filterComplex, videoOut, audioOut } = buildFilterComplex(segs, [], [], W, H)
    expect(filterComplex).toContain('[0:v]')
    expect(filterComplex).toContain('trim=start=')
    expect(filterComplex).toContain(`scale=${W}:${H}`)
    expect(filterComplex).toContain('[vs0]')
    expect(videoOut).toBe('vs0')
    expect(audioOut).toBe('as0')
  })

  it('two segments with cut uses concat filter', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const { filterComplex, videoOut } = buildFilterComplex(segs, [], [], W, H)
    expect(filterComplex).toContain('concat=n=2:v=1:a=0')
    expect(videoOut).toBe('vchain1')
  })

  it('two segments with fade transition uses xfade filter', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const trans = [makeTrans('t0', 's0', 's1', 'fade', 0.5)]
    const { filterComplex } = buildFilterComplex(segs, trans, [], W, H)
    expect(filterComplex).toContain('xfade=transition=fade')
    expect(filterComplex).toContain('acrossfade=d=')
  })

  it('xfade offset is calculated correctly', () => {
    // seg0=5s, transition=0.5s → offset=4.5
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const trans = [makeTrans('t0', 's0', 's1', 'fade', 0.5)]
    const { filterComplex } = buildFilterComplex(segs, trans, [], W, H)
    expect(filterComplex).toContain('offset=4.5')
  })

  it('segment with effects includes FFmpeg filter in chain', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5, { effects: [{ type: 'blur', value: 50 }] })]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H)
    expect(filterComplex).toContain('gblur=sigma=')
  })

  it('segment with speed applies setpts and atempo', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5, { speed: 2.0 })]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H)
    expect(filterComplex).toContain('setpts=(1/2.0000)*(PTS-STARTPTS)')
    expect(filterComplex).toContain('atempo=2.0000')
  })

  it('adjustment layer effects are appended to final output', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5)]
    const adjLayer: AdjustmentLayer = {
      id: 'adj0', startOnTimeline: 0, duration: 5,
      effects: [{ type: 'brightness', value: 150 }],
    }
    const { filterComplex, videoOut } = buildFilterComplex(segs, [], [adjLayer], W, H)
    expect(filterComplex).toContain('eq=brightness=')
    expect(videoOut).toBe('vadj')
  })

  it('zoom transition maps to circleopen xfade', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const trans = [makeTrans('t0', 's0', 's1', 'zoom', 0.5)]
    const { filterComplex } = buildFilterComplex(segs, trans, [], W, H)
    expect(filterComplex).toContain('xfade=transition=circleopen')
  })
})
