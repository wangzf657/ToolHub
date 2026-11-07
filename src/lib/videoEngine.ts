/** 视频引擎：Canvas/MediaRecorder 快路径 */
import { canvasToBlob } from './imageEngine'

export interface VideoMeta {
  width: number
  height: number
  duration: number
  video: HTMLVideoElement
  url: string
}

/** 加载视频并读取元信息（调用方负责 revokeObjectURL(url)） */
export function loadVideo(file: File | Blob): Promise<VideoMeta> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        video,
        url,
      })
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法解析该视频文件（编码可能不受浏览器支持，可尝试 ffmpeg 转码类工具）'))
    }
  })
}

/** 抓取指定时间点的帧 */
export function captureFrame(meta: VideoMeta, t: number, scale = 1): HTMLCanvasElement {
  const v = meta.video
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(v.videoWidth * scale))
  c.height = Math.max(1, Math.round(v.videoHeight * scale))
  const ctx = c.getContext('2d')!
  ctx.drawImage(v, 0, 0, c.width, c.height)
  return c
}

export function seekTo(meta: VideoMeta, t: number): Promise<void> {
  return new Promise((resolve) => {
    const v = meta.video
    const onSeek = () => {
      v.removeEventListener('seeked', onSeek)
      resolve()
    }
    v.addEventListener('seeked', onSeek)
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, meta.duration - 0.05))
  })
}

/** 逐帧导出（fps 控制），回调每帧画布 */
export async function exportFrames(
  meta: VideoMeta,
  opts: {
    fps: number
    start?: number
    end?: number
    scale?: number
    format?: 'image/jpeg' | 'image/png'
    onFrame?: (canvas: HTMLCanvasElement, index: number, t: number) => Promise<void> | void
    onProgress?: (p: number) => void
  },
): Promise<void> {
  const start = opts.start ?? 0
  const end = opts.end ?? meta.duration
  const step = 1 / opts.fps
  let idx = 0
  const total = Math.max(1, Math.floor((end - start) / step))
  for (let t = start; t < end && idx < total; t += step, idx++) {
    await seekTo(meta, t)
    const c = captureFrame(meta, t, opts.scale ?? 1)
    await opts.onFrame?.(c, idx, t)
    opts.onProgress?.((idx + 1) / total)
  }
}

/** Canvas 录制：实时重绘 + MediaRecorder 编码（快路径导出） */
export class CanvasRecorder {
  private rec: MediaRecorder
  private stream: MediaStream
  private chunks: Blob[] = []
  readonly canvas: HTMLCanvasElement
  readonly mime: string

  constructor(canvas: HTMLCanvasElement, fps = 30, withAudio?: MediaStreamTrack) {
    this.canvas = canvas
    this.stream = canvas.captureStream(fps)
    if (withAudio) this.stream.addTrack(withAudio)
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]
    this.mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
    this.rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 8_000_000 })
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
  }

  start(): void {
    this.rec.start(200)
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mime })
        this.stream.getTracks().forEach((t) => t.stop())
        resolve(blob)
      }
      this.rec.stop()
    })
  }
}

/** 播放视频并把帧实时绘制到 canvas（供 CanvasRecorder 使用） */
export async function playToCanvas(
  meta: VideoMeta,
  canvas: HTMLCanvasElement,
  opts: { start?: number; end?: number; onProgress?: (p: number) => void } = {},
): Promise<void> {
  const v = meta.video
  const ctx = canvas.getContext('2d')!
  const start = opts.start ?? 0
  const end = opts.end ?? meta.duration
  await seekTo(meta, start)
  canvas.width = v.videoWidth
  canvas.height = v.videoHeight
  return new Promise((resolve) => {
    const draw = () => {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      opts.onProgress?.(Math.min(1, (v.currentTime - start) / Math.max(0.01, end - start)))
      if (v.currentTime >= end || v.ended) {
        v.pause()
        resolve()
        return
      }
      requestAnimationFrame(draw)
    }
    v.play()
    requestAnimationFrame(draw)
  })
}

/** 提取音频轨（供配乐等场景混合） */
export async function extractAudioBuffer(
  file: File | Blob,
  videoUrl: string,
  start?: number,
  end?: number,
): Promise<AudioBuffer | null> {
  try {
    const ctx = new AudioContext()
    const resp = await fetch(videoUrl)
    const buf = await resp.arrayBuffer()
    const decoded = await ctx.decodeAudioData(buf)
    void ctx.close()
    if (start === undefined && end === undefined) return decoded
    const sr = decoded.sampleRate
    const s = Math.floor((start ?? 0) * sr)
    const e = Math.min(decoded.length, Math.floor((end ?? decoded.duration) * sr))
    const out = new OfflineAudioContext(decoded.numberOfChannels, Math.max(1, e - s), sr).createBuffer(
      decoded.numberOfChannels,
      Math.max(1, e - s),
      sr,
    )
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      out.getChannelData(c).set(decoded.getChannelData(c).subarray(s, e))
    }
    return out
  } catch {
    return null
  }
}

export { canvasToBlob }
