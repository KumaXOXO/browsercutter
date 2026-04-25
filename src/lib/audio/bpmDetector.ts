// src/lib/audio/bpmDetector.ts

export async function detectBpm(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const maxSamples = Math.min(audioBuffer.length, sampleRate * 60) // analyze first 60s
    const data = audioBuffer.getChannelData(0).subarray(0, maxSamples)
    return computeBpm(data, sampleRate)
  } finally {
    await ctx.close()
  }
}

function computeBpm(data: Float32Array, sampleRate: number): number {
  const windowSize = Math.round(sampleRate * 0.05) // 50ms
  const hopSize = Math.round(windowSize / 2)        // 25ms

  // Onset detection function: positive energy increase between windows
  const odf: number[] = []
  let prevEnergy = 0
  for (let i = 0; i + windowSize < data.length; i += hopSize) {
    let energy = 0
    for (let j = 0; j < windowSize; j++) energy += data[i + j] ** 2
    energy /= windowSize
    odf.push(Math.max(0, energy - prevEnergy))
    prevEnergy = energy
  }

  const hopDuration = hopSize / sampleRate

  // Autocorrelation of ODF to find the dominant beat period.
  // BPM 60–200 → period 1.0s–0.3s → lag 40–12 hops at 25ms/hop.
  const minLag = Math.max(1, Math.round(0.3 / hopDuration))
  const maxLag = Math.round(1.0 / hopDuration)

  let bestLag = minLag
  let bestCorr = -Infinity

  for (let lag = minLag; lag <= maxLag; lag++) {
    const n = odf.length - lag
    if (n <= 0) continue
    let corr = 0
    for (let i = 0; i < n; i++) corr += odf[i] * odf[i + lag]
    // Normalize by n so longer lags don't win simply by having more terms
    if (corr / n > bestCorr) {
      bestCorr = corr / n
      bestLag = lag
    }
  }

  const periodSeconds = bestLag * hopDuration
  let bpm = 60 / periodSeconds

  // Normalize to 60–200 BPM
  while (bpm < 60) bpm *= 2
  while (bpm > 200) bpm /= 2

  return Math.round(bpm)
}
