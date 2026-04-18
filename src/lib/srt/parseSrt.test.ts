import { describe, it, expect } from 'vitest'
import { parseSrt } from './parseSrt'

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:09,200
Second subtitle
with two lines`

describe('parseSrt', () => {
  it('parses two subtitle blocks', () => {
    const result = parseSrt(SRT)
    expect(result).toHaveLength(2)
  })

  it('first block has correct timing', () => {
    const [first] = parseSrt(SRT)
    expect(first.startOnTimeline).toBe(1)
    expect(first.duration).toBeCloseTo(3)
    expect(first.text).toBe('Hello world')
  })

  it('second block joins multi-line text', () => {
    const [, second] = parseSrt(SRT)
    expect(second.text).toBe('Second subtitle\nwith two lines')
    expect(second.startOnTimeline).toBeCloseTo(5.5)
    expect(second.duration).toBeCloseTo(3.7)
  })

  it('returns empty array for invalid input', () => {
    expect(parseSrt('')).toHaveLength(0)
    expect(parseSrt('not an srt')).toHaveLength(0)
  })

  it('parses a single-block SRT', () => {
    const single = `1\n00:00:00,500 --> 00:00:02,000\nOnly line`
    const result = parseSrt(single)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Only line')
    expect(result[0].startOnTimeline).toBeCloseTo(0.5)
    expect(result[0].duration).toBeCloseTo(1.5)
  })

  it('clamps zero-duration subtitles to 0.1s', () => {
    const zeroDur = `1\n00:00:01,000 --> 00:00:01,000\nInstant`
    const [block] = parseSrt(zeroDur)
    expect(block.duration).toBe(0.1)
  })

  it('skips blocks with malformed timestamps', () => {
    const bad = `1\nnot-a-timestamp\nText`
    expect(parseSrt(bad)).toHaveLength(0)
  })

  it('sets default overlay properties', () => {
    const single = `1\n00:00:01,000 --> 00:00:02,000\nTest`
    const [block] = parseSrt(single)
    expect(block.font).toBe('Inter')
    expect(block.size).toBe(32)
    expect(block.color).toBe('#FFFFFF')
    expect(block.x).toBeCloseTo(0.5)
    expect(block.y).toBeCloseTo(0.85)
  })
})
