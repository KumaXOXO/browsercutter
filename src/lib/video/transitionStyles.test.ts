import { describe, it, expect } from 'vitest'
import { computeTransitionStyles } from './transitionStyles'

describe('computeTransitionStyles', () => {
  // ── dissolve ────────────────────────────────────────────
  describe('dissolve', () => {
    it('at progress=0: A fully visible, B hidden', () => {
      const { a, b } = computeTransitionStyles('dissolve', 0)
      expect(a.opacity).toBe('1.000')
      expect(b.opacity).toBe('0.000')
    })

    it('at progress=0.5: both at 50% opacity', () => {
      const { a, b } = computeTransitionStyles('dissolve', 0.5)
      expect(a.opacity).toBe('0.500')
      expect(b.opacity).toBe('0.500')
    })

    it('at progress=1: A hidden, B fully visible', () => {
      const { a, b } = computeTransitionStyles('dissolve', 1)
      expect(a.opacity).toBe('0.000')
      expect(b.opacity).toBe('1.000')
    })

    it('clamps progress above 1', () => {
      const { b } = computeTransitionStyles('dissolve', 1.5)
      expect(b.opacity).toBe('1.000')
    })

    it('clamps progress below 0', () => {
      const { a } = computeTransitionStyles('dissolve', -0.3)
      expect(a.opacity).toBe('1.000')
    })

    it('no transform or clipPath', () => {
      const { a, b } = computeTransitionStyles('dissolve', 0.5)
      expect(a.transform).toBe('')
      expect(b.transform).toBe('')
      expect(a.clipPath).toBe('')
      expect(b.clipPath).toBe('')
    })
  })

  // ── wipe ─────────────────────────────────────────────────
  describe('wipe', () => {
    it('at progress=0: B fully clipped (invisible)', () => {
      const { b } = computeTransitionStyles('wipe', 0)
      expect(b.clipPath).toContain('0.00%')
    })

    it('at progress=0.5: B half revealed', () => {
      const { b } = computeTransitionStyles('wipe', 0.5)
      expect(b.clipPath).toContain('50.00%')
    })

    it('at progress=1: B fully revealed', () => {
      const { b } = computeTransitionStyles('wipe', 1)
      expect(b.clipPath).toContain('100.00%')
    })

    it('A is unaffected (full opacity, no transform)', () => {
      const { a } = computeTransitionStyles('wipe', 0.5)
      expect(a.opacity).toBe('1')
      expect(a.transform).toBe('')
    })
  })

  // ── slide ─────────────────────────────────────────────────
  describe('slide', () => {
    it('at progress=0: A at origin, B off-screen right', () => {
      const { a, b } = computeTransitionStyles('slide', 0)
      expect(a.transform).toContain('0.00%')
      expect(b.transform).toContain('100.00%')
    })

    it('at progress=0.5: A half-exited left, B half-entered', () => {
      const { a, b } = computeTransitionStyles('slide', 0.5)
      expect(a.transform).toContain('-50.00%')
      expect(b.transform).toContain('50.00%')
    })

    it('at progress=1: A off-screen left, B at origin', () => {
      const { a, b } = computeTransitionStyles('slide', 1)
      expect(a.transform).toContain('-100.00%')
      expect(b.transform).toContain('0.00%')
    })
  })

  // ── zoom ──────────────────────────────────────────────────
  describe('zoom', () => {
    it('at progress=0: A at scale 1, B at scale 0.7 invisible', () => {
      const { a, b } = computeTransitionStyles('zoom', 0)
      expect(a.opacity).toBe('1.000')
      expect(b.opacity).toBe('0.000')
      expect(a.transform).toContain('scale(1.000)')
      expect(b.transform).toContain('scale(0.700)')
    })

    it('at progress=1: A faded at scale 1.3, B full at scale 1', () => {
      const { a, b } = computeTransitionStyles('zoom', 1)
      expect(a.opacity).toBe('0.000')
      expect(b.opacity).toBe('1.000')
      expect(a.transform).toContain('scale(1.300)')
      expect(b.transform).toContain('scale(1.000)')
    })
  })

  // ── cut / unsupported ─────────────────────────────────────
  describe('cut (passthrough)', () => {
    it('returns neutral styles for cut', () => {
      const { a, b } = computeTransitionStyles('cut', 0.5)
      expect(a.opacity).toBe('1')
      expect(b.opacity).toBe('0')
    })

    it('returns neutral styles for fade (handled by overlay elsewhere)', () => {
      const { a, b } = computeTransitionStyles('fade', 0.5)
      expect(a.opacity).toBe('1')
      expect(b.opacity).toBe('0')
    })
  })
})
