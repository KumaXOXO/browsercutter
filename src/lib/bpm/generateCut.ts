// src/lib/bpm/generateCut.ts
import { v4 as uuidv4 } from 'uuid'
import type { Clip, Segment, BpmConfig } from '../../types'

export function generateCut(clips: Clip[], config: BpmConfig): Segment[] {
  const { bpm, mode, segmentLength, outputDuration, outputUnit, selectedClipIds } = config

  const pool = clips.filter((c) => selectedClipIds.includes(c.id) && c.type === 'video')
  if (pool.length === 0) return []

  const beatDuration = 60 / bpm
  const segDuration = beatDuration * segmentLength
  const totalSeconds = outputUnit === 'beats' ? outputDuration * beatDuration : outputDuration

  if (mode === 'sequential') return generateSequential(pool, segDuration, totalSeconds)
  if (mode === 'random') return generateRandom(pool, segDuration, totalSeconds)
  return generateForfeit(pool, segDuration, totalSeconds)
}

function generateSequential(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))
  let timeline = 0
  let poolIndex = 0
  let exhaustedCount = 0

  while (timeline < totalSeconds - 0.001 && exhaustedCount < pool.length) {
    const clip = pool[poolIndex % pool.length]
    const inPoint = bookmarks[clip.id]
    const remaining = clip.duration - inPoint

    if (remaining <= 0.001) {
      poolIndex++
      exhaustedCount++
      continue
    }

    exhaustedCount = 0
    const duration = Math.min(segDuration, remaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
    poolIndex++
  }

  return segments
}

function generateRandom(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))
  let timeline = 0
  const available = [...pool]

  while (timeline < totalSeconds - 0.001 && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length)
    const clip = available[idx]
    const inPoint = bookmarks[clip.id]
    const remaining = clip.duration - inPoint

    if (remaining <= 0.001) {
      available.splice(idx, 1)
      continue
    }

    const duration = Math.min(segDuration, remaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
  }

  return segments
}

function generateForfeit(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  if (pool.length === 0) return []

  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))

  let slotA = pool[0]
  let slotB = pool.length > 1 ? pool[1] : pool[0]
  const remaining = pool.slice(2)

  let timeline = 0
  let turn = 0

  while (timeline < totalSeconds - 0.001) {
    const clip = turn === 0 ? slotA : slotB
    const inPoint = bookmarks[clip.id]
    const clipRemaining = clip.duration - inPoint

    if (clipRemaining <= 0.001) {
      const next = remaining.shift()
      if (!next) break
      if (turn === 0) slotA = next
      else slotB = next
      continue
    }

    const duration = Math.min(segDuration, clipRemaining, totalSeconds - timeline)

    segments.push({
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint,
      outPoint: inPoint + duration,
    })

    bookmarks[clip.id] = inPoint + duration
    timeline += duration
    turn = 1 - turn
  }

  return segments
}
