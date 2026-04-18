// src/lib/video/effectsFilter.test.ts
import { describe, it, expect } from 'vitest'
import { buildCSSFilter, hasVignette, vignetteOpacity } from './effectsFilter'
import type { Effect } from '../../types'

describe('buildCSSFilter', () => {
  it('returns empty string for empty effects', () => {
    expect(buildCSSFilter([])).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(buildCSSFilter(undefined as unknown as Effect[])).toBe('')
  })

  it('maps brightness correctly', () => {
    expect(buildCSSFilter([{ type: 'brightness', value: 150 }])).toBe('brightness(150%)')
  })

  it('maps contrast correctly', () => {
    expect(buildCSSFilter([{ type: 'contrast', value: 80 }])).toBe('contrast(80%)')
  })

  it('maps saturation correctly', () => {
    expect(buildCSSFilter([{ type: 'saturation', value: 200 }])).toBe('saturate(200%)')
  })

  it('maps grayscale correctly', () => {
    expect(buildCSSFilter([{ type: 'grayscale', value: 100 }])).toBe('grayscale(100%)')
  })

  it('maps blur correctly (value 50 → 5px)', () => {
    expect(buildCSSFilter([{ type: 'blur', value: 50 }])).toBe('blur(5px)')
  })

  it('omits vignette from CSS filter string', () => {
    expect(buildCSSFilter([{ type: 'vignette', value: 80 }])).toBe('')
  })

  it('combines multiple effects', () => {
    const result = buildCSSFilter([
      { type: 'brightness', value: 120 },
      { type: 'grayscale', value: 50 },
    ])
    expect(result).toBe('brightness(120%) grayscale(50%)')
  })
})

describe('hasVignette', () => {
  it('returns true when vignette effect is present', () => {
    expect(hasVignette([{ type: 'vignette', value: 60 }])).toBe(true)
  })

  it('returns false when no vignette', () => {
    expect(hasVignette([{ type: 'brightness', value: 100 }])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasVignette([])).toBe(false)
  })
})

describe('vignetteOpacity', () => {
  it('returns value/100 for vignette effect', () => {
    expect(vignetteOpacity([{ type: 'vignette', value: 80 }])).toBe(0.8)
  })

  it('returns 0 when no vignette', () => {
    expect(vignetteOpacity([])).toBe(0)
  })
})
