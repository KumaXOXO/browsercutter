// src/lib/video/fileHandler.ts
import { v4 as uuidv4 } from 'uuid'
import type { Clip } from '../../types'
import { generateThumbnail } from './thumbnail'

export async function openVideoFiles(): Promise<File[]> {
  // File System Access API (Chrome 86+)
  if ('showOpenFilePicker' in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handles = await (window as any).showOpenFilePicker({
      multiple: true,
      types: [
        { description: 'Video files', accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'] } },
        { description: 'Audio files', accept: { 'audio/*': ['.mp3', '.wav', '.aac', '.ogg'] } },
        { description: 'Image files', accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] } },
      ],
    })
    return Promise.all(handles.map((h: FileSystemFileHandle) => h.getFile()))
  }

  // Fallback: standard file input
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*,audio/*,image/*'
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

export async function fileToClip(file: File): Promise<Clip> {
  const type = file.type.startsWith('video/') ? 'video'
    : file.type.startsWith('audio/') ? 'audio'
    : 'image'

  const id = uuidv4()

  if (type === 'video') {
    try {
      const { duration, width, height, thumbnail } = await getVideoMeta(file)
      return { id, file, name: file.name, duration, width, height, type, thumbnail }
    } catch {
      return { id, file, name: file.name, duration: 0, width: 0, height: 0, type }
    }
  }

  if (type === 'audio') {
    const duration = await getAudioDuration(file)
    return { id, file, name: file.name, duration, width: 0, height: 0, type }
  }

  // image
  const thumbnail = URL.createObjectURL(file)
  return { id, file, name: file.name, duration: 5, width: 0, height: 0, type, thumbnail }
}

async function getVideoMeta(file: File): Promise<{ duration: number; width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.preload = 'metadata'
    video.onloadedmetadata = async () => {
      const { duration, videoWidth: width, videoHeight: height } = video
      const thumbnail = await generateThumbnail(video)
      URL.revokeObjectURL(url)
      resolve({ duration, width, height, thumbnail })
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')) }
  })
}

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.onloadedmetadata = () => { resolve(audio.duration); URL.revokeObjectURL(url) }
    audio.onerror = () => { resolve(0); URL.revokeObjectURL(url) }
  })
}
