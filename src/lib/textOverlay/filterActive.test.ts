import { describe, it, expect } from 'vitest'
import type { TextOverlay } from '../../types'

function filterActive(overlays: TextOverlay[], playheadPosition: number): TextOverlay[] {
  return overlays.filter(
    (o) => playheadPosition >= o.startOnTimeline &&
            playheadPosition < o.startOnTimeline + o.duration,
  )
}

const makeOverlay = (id: string, startOnTimeline: number, duration: number): TextOverlay => ({
  id, text: 'T', startOnTimeline, duration, font: 'Inter', size: 32, color: '#FFF', x: 0.5, y: 0.85,
})

describe('filterActive (mirrors TextOverlayRenderer logic)', () => {
  it('includes an overlay when playhead is at its start', () => {
    const overlays = [makeOverlay('a', 5, 3)]
    expect(filterActive(overlays, 5)).toHaveLength(1)
  })

  it('includes an overlay in the middle of its duration', () => {
    const overlays = [makeOverlay('a', 5, 3)]
    expect(filterActive(overlays, 6.5)).toHaveLength(1)
  })

  it('excludes an overlay when playhead is exactly at its end', () => {
    const overlays = [makeOverlay('a', 5, 3)]
    expect(filterActive(overlays, 8)).toHaveLength(0)
  })

  it('excludes an overlay before its start', () => {
    const overlays = [makeOverlay('a', 5, 3)]
    expect(filterActive(overlays, 4.99)).toHaveLength(0)
  })

  it('excludes an overlay after its end', () => {
    const overlays = [makeOverlay('a', 5, 3)]
    expect(filterActive(overlays, 8.01)).toHaveLength(0)
  })

  it('returns multiple overlays when playhead overlaps both', () => {
    const overlays = [makeOverlay('a', 0, 10), makeOverlay('b', 5, 10)]
    expect(filterActive(overlays, 6)).toHaveLength(2)
  })

  it('returns empty for empty input', () => {
    expect(filterActive([], 5)).toHaveLength(0)
  })
})
