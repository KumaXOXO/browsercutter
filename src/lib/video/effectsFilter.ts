// src/lib/video/effectsFilter.ts
import type { Effect } from '../../types'

const DEFAULTS: Record<string, number> = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  blur: 0,
  sharpen: 0,
}

export function buildCSSFilter(effects: Effect[]): string {
  if (!effects || effects.length === 0) return ''

  const parts: string[] = []

  for (const effect of effects) {
    switch (effect.type) {
      case 'brightness':
        parts.push(`brightness(${effect.value}%)`)
        break
      case 'contrast':
        parts.push(`contrast(${effect.value}%)`)
        break
      case 'saturation':
        parts.push(`saturate(${effect.value}%)`)
        break
      case 'grayscale':
        parts.push(`grayscale(${effect.value}%)`)
        break
      case 'blur':
        parts.push(`blur(${(effect.value / 100) * 10}px)`)
        break
      case 'sharpen':
        // CSS has no native sharpen; approximate with contrast + brightness
        parts.push(`contrast(${100 + effect.value * 0.5}%)`)
        break
      case 'vignette':
        // Vignette is applied as an overlay element, not a CSS filter
        break
    }
  }

  return parts.join(' ')
}

export function hasVignette(effects: Effect[]): boolean {
  return effects.some((e) => e.type === 'vignette')
}

export function vignetteOpacity(effects: Effect[]): number {
  const v = effects.find((e) => e.type === 'vignette')
  return v ? v.value / 100 : 0
}

export { DEFAULTS as EFFECT_DEFAULTS }
