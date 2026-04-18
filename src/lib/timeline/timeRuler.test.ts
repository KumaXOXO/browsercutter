import { describe, it, expect } from 'vitest'

function timeFromClick(x: number, zoom: number, pxPerSec: number): number {
  return Math.max(0, x / (pxPerSec * zoom))
}

describe('timeFromClick', () => {
  it('converts pixel offset to seconds', () => {
    expect(timeFromClick(100, 1, 20)).toBe(5)
  })
  it('clamps negative to zero', () => {
    expect(timeFromClick(-50, 1, 20)).toBe(0)
  })
  it('respects zoom', () => {
    expect(timeFromClick(100, 2, 20)).toBe(2.5)
  })
})
