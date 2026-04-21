// src/lib/effectDefs.ts
import type { EffectType } from '../types'

export const EFFECT_DEFAULTS: Record<EffectType, number> = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  blur: 0,
  vignette: 60,
  sharpen: 0,
}
