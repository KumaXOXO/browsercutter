// src/lib/video/transitionStyles.ts
// Pure functions: compute per-frame CSS styles for A (outgoing) and B (incoming) videos.

import type { TransitionType } from '../../types'

export interface VideoStyles {
  opacity: string
  transform: string
  clipPath: string
}

const FULL: VideoStyles = { opacity: '1', transform: '', clipPath: '' }
const HIDDEN: VideoStyles = { opacity: '0', transform: '', clipPath: '' }

export function computeTransitionStyles(
  type: TransitionType,
  progress: number,  // 0 = transition start, 1 = transition end
): { a: VideoStyles; b: VideoStyles } {
  const p = Math.max(0, Math.min(1, progress))

  switch (type) {
    case 'dissolve':
      return {
        a: { opacity: String((1 - p).toFixed(3)), transform: '', clipPath: '' },
        b: { opacity: String(p.toFixed(3)), transform: '', clipPath: '' },
      }

    case 'wipe':
      // B revealed left-to-right via clip-path; A stationary beneath
      return {
        a: FULL,
        b: {
          opacity: '1',
          transform: '',
          clipPath: `polygon(0 0, ${(p * 100).toFixed(2)}% 0, ${(p * 100).toFixed(2)}% 100%, 0 100%)`,
        },
      }

    case 'slide':
      // A slides left; B slides in from the right
      return {
        a: { opacity: '1', transform: `translateX(${(-p * 100).toFixed(2)}%)`, clipPath: '' },
        b: { opacity: '1', transform: `translateX(${((1 - p) * 100).toFixed(2)}%)`, clipPath: '' },
      }

    case 'zoom':
      // A zooms in and fades; B fades in (scales up to full from 0.7)
      return {
        a: {
          opacity: String((1 - p).toFixed(3)),
          transform: `scale(${(1 + p * 0.3).toFixed(3)})`,
          clipPath: '',
        },
        b: {
          opacity: String(p.toFixed(3)),
          transform: `scale(${(0.7 + p * 0.3).toFixed(3)})`,
          clipPath: '',
        },
      }

    default:
      // cut / fade — handled elsewhere; return neutral
      return { a: FULL, b: HIDDEN }
  }
}

// Apply precomputed styles directly to video DOM elements (zero re-renders)
export function applyTransitionStyles(
  type: TransitionType,
  progress: number,
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
): void {
  const { a, b } = computeTransitionStyles(type, progress)
  videoA.style.opacity = a.opacity
  videoA.style.transform = a.transform
  videoA.style.clipPath = a.clipPath
  videoB.style.opacity = b.opacity
  videoB.style.transform = b.transform
  videoB.style.clipPath = b.clipPath
  videoB.style.display = 'block'
}

export function resetTransitionStyles(videoA: HTMLVideoElement, videoB: HTMLVideoElement): void {
  videoA.style.opacity = '1'
  videoA.style.transform = ''
  videoA.style.clipPath = ''
  videoB.style.opacity = '0'
  videoB.style.transform = ''
  videoB.style.clipPath = ''
  videoB.style.display = 'none'
}
