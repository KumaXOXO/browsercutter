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

export function buildFFmpegFilter(effects: Effect[]): string {
  if (!effects || effects.length === 0) return ''

  // eq filter is stateful — brightness/contrast/saturation must be combined into one eq call
  const eqParts: string[] = []
  const otherParts: string[] = []

  for (const effect of effects) {
    switch (effect.type) {
      case 'brightness':
        eqParts.push(`brightness=${(effect.value / 100 - 1).toFixed(4)}`)
        break
      case 'contrast':
        eqParts.push(`contrast=${(effect.value / 100).toFixed(4)}`)
        break
      case 'saturation':
        eqParts.push(`saturation=${(effect.value / 100).toFixed(4)}`)
        break
      case 'grayscale':
        if (effect.value > 0) otherParts.push('hue=s=0')
        break
      case 'blur':
        otherParts.push(`gblur=sigma=${(effect.value / 100 * 10).toFixed(2)}`)
        break
      case 'sharpen':
        otherParts.push(`unsharp=5:5:${(effect.value / 100).toFixed(4)}:5:5:0`)
        break
      case 'vignette':
        otherParts.push(`vignette=angle=${(Math.PI / 4).toFixed(6)}`)
        break
    }
  }

  const parts: string[] = []
  if (eqParts.length > 0) parts.push(`eq=${eqParts.join(':')}`)
  parts.push(...otherParts)
  return parts.join(',')
}

export { DEFAULTS as EFFECT_DEFAULTS }
