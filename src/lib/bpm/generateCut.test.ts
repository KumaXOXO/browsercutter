// src/lib/bpm/generateCut.test.ts
import { describe, it, expect } from 'vitest'
import { generateCut } from './generateCut'
import type { Clip, BpmConfig } from '../../types'

function makeClip(id: string, duration: number): Clip {
  return {
    id,
    file: {} as File,
    name: id,
    duration,
    width: 1920,
    height: 1080,
    type: 'video',
  }
}

const clips = [makeClip('a', 10), makeClip('b', 10)]

const baseConfig: BpmConfig = {
  bpm: 120,           // 0.5s per beat
  mode: 'sequential',
  segmentLength: 1,   // 1 beat = 0.5s per segment
  outputDuration: 4,  // 4 seconds total
  outputUnit: 'seconds',
  selectedClipIds: ['a', 'b'],
}

describe('generateCut', () => {
  it('returns empty array when no clips are selected', () => {
    const result = generateCut(clips, { ...baseConfig, selectedClipIds: [] })
    expect(result).toHaveLength(0)
  })

  it('sequential: fills exactly the requested duration', () => {
    const result = generateCut(clips, baseConfig)
    expect(result.length).toBeGreaterThan(0)
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })

  it('sequential: alternates clips A-B-A-B', () => {
    const result = generateCut(clips, baseConfig)
    const ids = result.map((s) => s.clipId)
    expect(ids[0]).toBe('a')
    expect(ids[1]).toBe('b')
    expect(ids[2]).toBe('a')
    expect(ids[3]).toBe('b')
  })

  it('sequential: segments have no gaps', () => {
    const result = generateCut(clips, baseConfig)
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]
      const curr = result[i]
      const prevEnd = prev.startOnTimeline + (prev.outPoint - prev.inPoint)
      expect(curr.startOnTimeline).toBeCloseTo(prevEnd, 5)
    }
  })

  it('random: fills exactly the requested duration', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'random' })
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })

  it('random: segments have no gaps', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'random' })
    for (let i = 1; i < result.length; i++) {
      const prevEnd = result[i - 1].startOnTimeline + (result[i - 1].outPoint - result[i - 1].inPoint)
      expect(result[i].startOnTimeline).toBeCloseTo(prevEnd, 5)
    }
  })

  it('forfeit: alternates two slots initially', () => {
    const result = generateCut(clips, { ...baseConfig, mode: 'forfeit', outputDuration: 2 })
    const ids = result.map((s) => s.clipId)
    expect(ids[0]).toBe('a')
    expect(ids[1]).toBe('b')
  })

  it('forfeit: replaces exhausted slot from remaining pool', () => {
    const shortClips = [makeClip('a', 0.5), makeClip('b', 10), makeClip('c', 10)]
    const result = generateCut(shortClips, {
      ...baseConfig,
      mode: 'forfeit',
      selectedClipIds: ['a', 'b', 'c'],
      outputDuration: 4,
    })
    const ids = result.map((s) => s.clipId)
    expect(ids).toContain('c')
  })

  it('respects outputUnit beats', () => {
    const result = generateCut(clips, {
      ...baseConfig,
      outputDuration: 8,
      outputUnit: 'beats',
    })
    // 8 beats at 120 BPM = 4 seconds
    const end = Math.max(...result.map((s) => s.startOnTimeline + (s.outPoint - s.inPoint)))
    expect(end).toBeCloseTo(4, 5)
  })
})
