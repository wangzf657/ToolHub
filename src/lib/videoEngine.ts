/** 视频引擎：Canvas/MediaRecorder 快路径 + ffmpeg 引擎加载（含下载进度）与轨道探测 */
import { canvasToBlob } from './imageEngine'
import { getFf } from './ffmpeg'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

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
    video.onloadedmetadata = async () => {
      let dur = video.duration
      // UX1-003：MediaRecorder 录屏产物常报 duration=Infinity/0，
      // seek 到极大时间可逼浏览器补全真实时长（超时兜底返回原值，由工具层守卫）
      if (!Number.isFinite(dur) || dur <= 0) {
        dur = await new Promise<number>((res) => {
          const fallback = dur
          const done = () => res(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallback)
          const timer = setTimeout(done, 1500)
          video.addEventListener(
            'seeked',
            () => {
              clearTimeout(timer)
              done()
            },
            { once: true },
          )
          try {
            video.currentTime = 1e101
            // 恢复成功后回零，避免预览停留在片尾
            video.addEventListener('seeked', () => { video.currentTime = 0 }, { once: true })
          } catch {
            clearTimeout(timer)
            res(fallback)
          }
        })
      }
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: dur,
        video,
        url,
      })
    }
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

/* ---------- ffmpeg 引擎层：带进度的加载（FfBase 家族）+ 轨道探测 ---------- */
/** 核心下载进度（字节；total 为 0 表示总大小未知，仅报已下载量） */
export interface FfCoreProgress { loaded: number; total: number }

/** 与 lib/ffmpeg.ts 内置核心地址保持一致（改版本需两处同步） */
const FF_CORE_WASM = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm'
/** 本页会话内引擎已确认就绪（实例本体由 getFf 全局单例持有，此处仅避免重复预取） */
let engineReady = false
/**
 * 带下载进度的 ffmpeg 引擎加载（视频家族基座共用）：先按字节流预取 wasm 核心
 * （有 content-length 时给出真实百分比，命中浏览器缓存则秒过），再交给 getFf 完成
 * 实际加载——复用全局单例不产生第二个实例；预取失败不拦流程（仅失去进度显示）。
 */
export async function loadFfEngine(onProgress?: (p: FfCoreProgress) => void): Promise<FFmpeg> {
  if (engineReady) return getFf()
  try {
    const res = await fetch(FF_CORE_WASM)
    if (!res.ok) throw new Error(String(res.status))
    const total = Number(res.headers.get('content-length')) || 0
    if (res.body && total > 0) {
      const reader = res.body.getReader()
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value?.length ?? 0
        onProgress?.({ loaded: received, total })
      }
    } else {
      // 拿不到流/总大小时退化为一次性报 100%
      const buf = await res.arrayBuffer()
      onProgress?.({ loaded: buf.byteLength, total: buf.byteLength })
    }
  } catch {
    /* 预取失败不拦流程：getFf 自会下载，仅失去进度显示 */
  }
  const ff = await getFf()
  engineReady = true
  return ff
}

/**
 * 探测视频文件的音轨/字幕轨（ffprobe 语义：干跑 `ffmpeg -i` 解析 stderr 流信息）。
 * 每条轨为可读字符串，形如「#0:2 eng · ac3」，前缀 #0:N 为输入流索引（可直接拼 -map 0:N）。
 * 引擎加载失败或解析不出流信息时诚实返回 null；无音轨/字幕轨则是空数组（有效结果而非失败）。
 * 注意：文件会全量写入 wasm 内存，大文件慎用。
 */
export async function probeTracks(file: File): Promise<{ audio: string[]; subtitles: string[] } | null> {
  let ff: FFmpeg
  try {
    ff = await loadFfEngine()
  } catch {
    return null // 引擎加载失败（如网络不可用），诚实返回 null
  }
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => lines.push(message)
  // 保留源扩展名帮助识别容器，无扩展名时用通用名兜底
  const name = `probe_input.${/\.(\w{1,5})$/.exec(file.name)?.[1] ?? 'bin'}`
  ff.on('log', onLog)
  try {
    await ff.writeFile(name, new Uint8Array(await file.arrayBuffer()))
    // 无输出文件的 -i 以非零码退出属预期，流信息已在日志里
    await ff.exec(['-hide_banner', '-i', name])
  } catch {
    /* 解析不到流信息时按 null 返回 */
  } finally {
    ff.off('log', onLog)
    try {
      await ff.deleteFile(name)
    } catch {
      /* 忽略 */
    }
  }
  const audio: string[] = []
  const subtitles: string[] = []
  // 形如 "  Stream #0:2[0x80](eng): Audio: ac3, 48000 Hz, stereo" / "  Stream #0:3(chi): Subtitle: subrip"
  const re = /Stream #0:(\d+)(?:\[[^\]]*\])?(?:\(([^)]*)\))?:\s*(Audio|Subtitle):\s*([^,]+)/
  for (const l of lines) {
    const m = re.exec(l)
    if (!m) continue
    const lang = !m[2] || m[2] === 'und' ? '未标注语言' : m[2]
    ;(m[3] === 'Audio' ? audio : subtitles).push(`#0:${m[1]} ${lang} · ${m[4].trim()}`)
  }
  if (!lines.some((l) => /Stream #0:\d+/.test(l))) return null
  return { audio, subtitles }
}

export { canvasToBlob }
