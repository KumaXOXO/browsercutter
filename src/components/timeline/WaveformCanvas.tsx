// src/components/timeline/WaveformCanvas.tsx
import { useEffect, useRef, useState } from 'react'
import { getWaveformSamples } from '../../lib/audio/waveform'

interface Props {
  clipId: string
  file: File | null
}

export default function WaveformCanvas({ clipId, file }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'decoding' | 'done'>('idle')

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setStatus('decoding')

    getWaveformSamples(file, clipId).then((samples) => {
      if (cancelled) return
      setStatus('done')
      const canvas = canvasRef.current
      if (!canvas || samples.length === 0) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'

      const barWidth = width / samples.length
      for (let i = 0; i < samples.length; i++) {
        const barH = Math.max(1, samples[i] * height)
        ctx.fillRect(i * barWidth, (height - barH) / 2, Math.max(1, barWidth - 0.5), barH)
      }
    })

    return () => { cancelled = true }
  }, [clipId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null

  return (
    <>
      {status === 'decoding' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>DECODING</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 2,
        }}
      />
    </>
  )
}
