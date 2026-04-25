import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

interface ProxyRequest {
  clipId: string
  fileName: string
  blobUrl: string
}

type ProxyMsg =
  | { type: 'progress'; value: number; label: string }
  | { type: 'done'; buffer: ArrayBuffer; clipId: string }
  | { type: 'error'; message: string; clipId: string }

const ffmpeg = new FFmpeg()
let loaded = false

self.onmessage = async (e: MessageEvent<ProxyRequest>) => {
  const { clipId, fileName, blobUrl } = e.data
  try {
    post({ type: 'progress', value: 0, label: 'Loading FFmpeg...' })
    if (!loaded) {
      const base = new URL('/', self.location.href).href
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
      })
      loaded = true
    }

    post({ type: 'progress', value: 0.05, label: 'Reading file...' })
    const buf = await fetch(blobUrl).then((r) => r.arrayBuffer())

    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
    const inputFile = `input_proxy.${ext}`
    await ffmpeg.writeFile(inputFile, new Uint8Array(buf))

    ffmpeg.on('progress', ({ progress }) => {
      post({ type: 'progress', value: 0.1 + progress * 0.9, label: 'Generating proxy...' })
    })

    await ffmpeg.exec([
      '-i', inputFile,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      'proxy_out.mp4',
    ])

    const data = await ffmpeg.readFile('proxy_out.mp4') as Uint8Array
    const outBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    self.postMessage({ type: 'done', buffer: outBuf, clipId } satisfies ProxyMsg, { transfer: [outBuf] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', message: msg, clipId } satisfies ProxyMsg)
  }
}

function post(msg: ProxyMsg) {
  self.postMessage(msg)
}
