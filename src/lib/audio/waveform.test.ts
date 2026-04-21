import { describe, it, expect, vi } from 'vitest'

vi.mock('./waveform.worker?worker', () => ({
  default: vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
  })),
}))

describe('getWaveformSamples', () => {
  it('returns empty Float32Array for files over 500MB (OOM guard)', async () => {
    const { getWaveformSamples } = await import('./waveform')
    const bigFile = { size: 600_000_000, arrayBuffer: vi.fn() } as unknown as File
    const result = await getWaveformSamples(bigFile, 'oom-test')
    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(0)
    // arrayBuffer should never be called — we guard before transferring
    expect((bigFile.arrayBuffer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('returns empty Float32Array for exactly 500MB (boundary)', async () => {
    const { getWaveformSamples } = await import('./waveform')
    const boundaryFile = { size: 500_000_000, arrayBuffer: vi.fn() } as unknown as File
    const result = await getWaveformSamples(boundaryFile, 'boundary-test')
    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(0)
  })
})
