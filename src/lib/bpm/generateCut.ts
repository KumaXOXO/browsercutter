// src/lib/bpm/generateCut.ts
import { v4 as uuidv4 } from 'uuid'
import type { Clip, Segment, BpmConfig } from '../../types'

export function generateCut(clips: Clip[], config: BpmConfig, targetTrackIndex = 0, startOffset = 0): Segment[] {
  const { bpm, mode, segmentLength, outputDuration, outputUnit, selectedClipIds, onlyWholeClips, importMode } = config

  const pool = clips.filter((c) => selectedClipIds.includes(c.id) && c.type === 'video')
  if (pool.length === 0) return []

  // Full-length mode: each clip placed at its complete duration, ordered by cutting mode
  if (importMode === 'full') {
    const segs = generateFullLength(pool, mode)
    return segs.map((s) => ({ ...s, trackIndex: targetTrackIndex, startOnTimeline: s.startOnTimeline + startOffset }))
  }

  const beatDuration = 60 / bpm
  const segDuration = beatDuration * segmentLength
  const totalSeconds = outputUnit === 'beats' ? outputDuration * beatDuration : outputDuration

  let segs: Segment[]
  if (mode === 'sequential') segs = generateSequential(pool, segDuration, totalSeconds)
  else if (mode === 'random') segs = generateRandom(pool, segDuration, totalSeconds)
  else if (mode === 'normal') segs = generateNormal(pool, segDuration, totalSeconds)
  else segs = generateForfeit(pool, segDuration, totalSeconds)

  if ((onlyWholeClips ?? true) && segDuration > 0.001) {
    segs = segs.filter((s) => (s.outPoint - s.inPoint) >= segDuration * 0.99)
  }

  return segs.map((s) => ({
    ...s,
    trackIndex: targetTrackIndex,
    startOnTimeline: s.startOnTimeline + startOffset,
  }))
}

function generateFullLength(pool: Clip[], mode: BpmMode): Segment[] {
  let ordered: Clip[]
  if (mode === 'random') {
    ordered = [...pool]
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    }
  } else if (mode === 'forfeit') {
    // Alternating pattern: slot A and slot B interleaved
    const a = pool.filter((_, i) => i % 2 === 0)
    const b = pool.filter((_, i) => i % 2 === 1)
    ordered = []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i < a.length) ordered.push(a[i])
      if (i < b.length) ordered.push(b[i])
    }
  } else {
    // sequential / normal: clips in pool order
    ordered = pool
  }
  let timeline = 0
  return ordered.map((clip) => {
    const seg: Segment = {
      id: uuidv4(),
      clipId: clip.id,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint: 0,
      outPoint: clip.duration,
    }
    timeline += clip.duration
    return seg
  })
}

function generateSequential(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))
  const exhausted = new Set<string>()
  let timeline = 0
  let poolIndex = 0

  while (timeline < totalSeconds - 0.001 && exhausted.size < pool.length) {
    const clip = pool[poolIndex % pool.length]
    const inPoint = bookmarks[clip.id]
    const remaining = clip.duration - inPoint

    if (remaining <= 0.001) {
      exhausted.add(clip.id)
      poolIndex++
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
    poolIndex++
  }

  return segments
}

function generateRandom(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  // Build all possible beat segments from every clip in the pool
  const allSlices: { clipId: string; inPoint: number; outPoint: number }[] = []
  for (const clip of pool) {
    let cursor = 0
    while (cursor < clip.duration - 0.1) {
      const outPoint = Math.min(cursor + segDuration, clip.duration)
      allSlices.push({ clipId: clip.id, inPoint: cursor, outPoint })
      cursor = outPoint
    }
  }
  // Fisher-Yates shuffle
  for (let i = allSlices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allSlices[i], allSlices[j]] = [allSlices[j], allSlices[i]]
  }
  // Sequence shuffled slices up to totalSeconds
  const segments: Segment[] = []
  let timeline = 0
  for (const slice of allSlices) {
    if (timeline >= totalSeconds - 0.001) break
    const duration = Math.min(slice.outPoint - slice.inPoint, totalSeconds - timeline)
    if (duration < 0.001) continue
    segments.push({
      id: uuidv4(),
      clipId: slice.clipId,
      trackIndex: 0,
      startOnTimeline: timeline,
      inPoint: slice.inPoint,
      outPoint: slice.inPoint + duration,
    })
    timeline += duration
  }
  return segments
}

function generateNormal(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  const segments: Segment[] = []
  let timeline = 0
  for (const clip of pool) {
    if (timeline >= totalSeconds - 0.001) break
    let cursor = 0
    while (cursor < clip.duration - 0.001 && timeline < totalSeconds - 0.001) {
      const duration = Math.min(segDuration, clip.duration - cursor, totalSeconds - timeline)
      if (duration < 0.001) break
      segments.push({
        id: uuidv4(),
        clipId: clip.id,
        trackIndex: 0,
        startOnTimeline: timeline,
        inPoint: cursor,
        outPoint: cursor + duration,
      })
      cursor += duration
      timeline += duration
    }
  }
  return segments
}

function generateForfeit(pool: Clip[], segDuration: number, totalSeconds: number): Segment[] {
  if (pool.length === 0) return []

  const segments: Segment[] = []
  const bookmarks: Record<string, number> = Object.fromEntries(pool.map((c) => [c.id, 0]))

  let slotA: Clip | null = pool[0]
  let slotB: Clip | null = pool.length > 1 ? pool[1] : null
  const remaining = pool.slice(2)

  let timeline = 0
  let turn = 0

  while (timeline < totalSeconds - 0.001) {
    const clip = turn === 0 ? slotA : slotB

    if (!clip) {
      // This slot is permanently gone — try the other
      turn = 1 - turn
      const other = turn === 0 ? slotA : slotB
      if (!other) break // both slots empty
      continue
    }

    const inPoint = bookmarks[clip.id]
    const clipRemaining = clip.duration - inPoint

    if (clipRemaining <= 0.001) {
      const next = remaining.shift() ?? null
      if (turn === 0) slotA = next
      else slotB = next
      // Don't advance turn — retry this slot with the replacement (or null)
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
