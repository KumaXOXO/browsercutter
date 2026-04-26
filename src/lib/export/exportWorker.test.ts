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

  it('segInputIdx: shared input uses split/asplit', () => {
    const segs = [
      makeSeg('s0', 'c0', 0, 2),
      makeSeg('s1', 'c0', 2, 4),
      makeSeg('s2', 'c0', 4, 6),
    ]
    // All 3 segments share input 0
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, [0, 0, 0])
    expect(filterComplex).toContain('[0:v]split=3[vin0_0][vin0_1][vin0_2]')
    expect(filterComplex).toContain('[0:a]asplit=3[ain0_0][ain0_1][ain0_2]')
    expect(filterComplex).toContain('[vin0_0]')
    expect(filterComplex).toContain('[vin0_1]')
    expect(filterComplex).toContain('[vin0_2]')
    expect(filterComplex).not.toContain('[0:v]trim')
    expect(filterComplex).not.toContain('[1:v]')
  })

  it('segInputIdx: unique inputs skip split', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, [0, 1])
    expect(filterComplex).not.toContain('split=')
    expect(filterComplex).toContain('[0:v]')
    expect(filterComplex).toContain('[1:v]')
  })

  it('segInputIdx: mixed shared and unique inputs', () => {
    const segs = [
      makeSeg('s0', 'c0', 0, 3),
      makeSeg('s1', 'c1', 0, 3),
      makeSeg('s2', 'c0', 3, 6),
    ]
    // input 0 shared by s0 and s2, input 1 unique to s1
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, [0, 1, 0])
    expect(filterComplex).toContain('[0:v]split=2[vin0_0][vin0_1]')
    expect(filterComplex).toContain('[0:a]asplit=2[ain0_0][ain0_1]')
    expect(filterComplex).toContain('[1:v]')
    expect(filterComplex).not.toContain('split=2[vin1')
  })

  it('backward compat: no segInputIdx uses segment-index labels', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H)
    expect(filterComplex).toContain('[0:v]')
    expect(filterComplex).toContain('[1:v]')
    expect(filterComplex).not.toContain('split=')
  })
})

describe('buildFilterComplex videoOnly=true', () => {
  it('single segment produces no audio filters', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5)]
    const { filterComplex, videoOut } = buildFilterComplex(segs, [], [], W, H, undefined, true)
    expect(filterComplex).not.toContain('atrim')
    expect(filterComplex).not.toContain('asetpts')
    expect(videoOut).toBe('vs0')
  })

  it('shared input skips asplit but keeps split', () => {
    const segs = [makeSeg('s0', 'c0', 0, 2), makeSeg('s1', 'c0', 2, 4)]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, [0, 0], true)
    expect(filterComplex).toContain('[0:v]split=2')
    expect(filterComplex).not.toContain('asplit')
  })

  it('two segments with cut skips audio concat', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, undefined, true)
    expect(filterComplex).toContain('concat=n=2:v=1:a=0')
    expect(filterComplex).not.toContain('concat=n=2:v=0:a=1')
  })

  it('two segments with fade skips acrossfade but keeps xfade', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5), makeSeg('s1', 'c1', 0, 4)]
    const trans = [makeTrans('t0', 's0', 's1', 'fade', 0.5)]
    const { filterComplex } = buildFilterComplex(segs, trans, [], W, H, undefined, true)
    expect(filterComplex).toContain('xfade=transition=fade')
    expect(filterComplex).not.toContain('acrossfade')
  })

  it('segment with speed and volume skips atempo and volume filters', () => {
    const segs = [makeSeg('s0', 'c0', 0, 5, { speed: 2.0, volume: 0.5 })]
    const { filterComplex } = buildFilterComplex(segs, [], [], W, H, undefined, true)
    expect(filterComplex).toContain('setpts=(1/2.0000)*(PTS-STARTPTS)')
    expect(filterComplex).not.toContain('atempo')
    expect(filterComplex).not.toContain('volume=')
  })
})
