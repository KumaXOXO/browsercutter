// src/components/timeline/ThumbnailLayer.tsx
import { useState, useEffect } from 'react'
import { getThumbnail } from '../../lib/video/thumbnails'

interface Props {
  clipId: string
  file: File | null
  inPoint: number
}

export default function ThumbnailLayer({ clipId, file, inPoint }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    getThumbnail(clipId, file, inPoint).then((result) => {
      if (!cancelled) setUrl(result)
    })
    return () => { cancelled = true }
  }, [clipId, inPoint]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!url) return null

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${url})`,
        backgroundSize: 'auto 100%',
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left center',
        opacity: 0.55,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
