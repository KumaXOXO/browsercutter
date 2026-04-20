// src/lib/audio/waveform.worker.ts
// Runs in a Web Worker. Receives ArrayBuffer, decodes audio, returns downsampled Float32Array.

const SAMPLE_COUNT = 200

self.onmessage = async (e: MessageEvent<{ buffer: ArrayBuffer; clipId: string }>) => {
  const { buffer, clipId } = e.data

  // OOM guard: skip files over 500MB
  if (buffer.byteLength > 500_000_000) {
    self.postMessage({ clipId, samples: new Float32Array(0) })
    return
  }

  try {
    const sampleRate = 22050
    const offlineCtx = new OfflineAudioContext(1, sampleRate, sampleRate)
    const decoded = await offlineCtx.decodeAudioData(buffer)

    const rawSamples = decoded.getChannelData(0)
    const blockSize = Math.floor(rawSamples.length / SAMPLE_COUNT)
    const samples = new Float32Array(SAMPLE_COUNT)

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      let sum = 0
      const offset = i * blockSize
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawSamples[offset + j] ?? 0)
      }
      samples[i] = sum / blockSize
    }

    // Normalize to 0-1
    const max = samples.reduce((m, v) => Math.max(m, v), 0)
    if (max > 0) {
      for (let i = 0; i < samples.length; i++) samples[i] /= max
    }

    ;(self as unknown as Worker).postMessage({ clipId, samples }, [samples.buffer])
  } catch {
    self.postMessage({ clipId, samples: new Float32Array(0) })
  }
}
