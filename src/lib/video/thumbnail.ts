// src/lib/video/thumbnail.ts

export function generateThumbnail(video: HTMLVideoElement): Promise<string> {
  return new Promise((resolve) => {
    const seekTo = Math.min(1, video.duration * 0.1)
    video.currentTime = seekTo
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = 320
      canvas.height = Math.round(320 / (video.videoWidth / video.videoHeight))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
  })
}
