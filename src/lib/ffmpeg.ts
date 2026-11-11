/** ffmpeg.wasm 懒加载封装（视频/音频重编码兜底） */
import type { FFmpeg } from '@ffmpeg/ffmpeg'

let ffInstance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

const CORE_VERSION = '0.12.10'
const BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`

/**
 * 获取 ffmpeg 实例（首次调用会从 CDN 下载 ~25MB 核心，之后浏览器缓存）。
 * UI 需要在调用前提示用户。
 */
export async function getFf(log?: (msg: string) => void): Promise<FFmpeg> {
  if (ffInstance) return ffInstance
  if (loading) return loading
  loading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    const ff = new FFmpeg()
    ff.on('log', ({ message }) => log?.(message))
    await ff.load({
      coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffInstance = ff
    return ff
  })()
  return loading
}

/** 执行一条 ffmpeg 命令。输出文件 = 命令最后一个非选项参数（ffmpeg 约定）。 */
export async function ffRun(
  ff: FFmpeg,
  args: string[],
  files: { name: string; data: File | Blob | Uint8Array }[],
  onProgress?: (ratio: number) => void,
): Promise<Map<string, Uint8Array>> {
  const outNames = new Set<string>()
  const last = args[args.length - 1]
  if (last && !last.startsWith('-')) outNames.add(last)

  if (onProgress) {
    const handler = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)))
    ff.on('progress', handler)
    try {
      await doRun(ff, args, files)
    } finally {
      ff.off('progress', handler)
    }
  } else {
    await doRun(ff, args, files)
  }
  const results = new Map<string, Uint8Array>()
  for (const name of outNames) {
    try {
      const data = await ff.readFile(name)
      results.set(name, data as Uint8Array)
    } catch {
      /* 输出缺失时由调用方报告 */
    }
  }
  for (const name of outNames) {
    try {
      await ff.deleteFile(name)
    } catch {
      /* 忽略 */
    }
  }
  return results
}

async function doRun(
  ff: FFmpeg,
  args: string[],
  files: { name: string; data: File | Blob | Uint8Array }[],
): Promise<void> {
  for (const f of files) {
    const data =
      f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer())
    try {
      await ff.writeFile(f.name, data)
    } catch {
      /* 已存在则覆盖 */
      await ff.deleteFile(f.name)
      await ff.writeFile(f.name, data)
    }
  }
  await ff.exec(args)
  for (const f of files) {
    try {
      await ff.deleteFile(f.name)
    } catch {
      /* 忽略 */
    }
  }
}

/**
 * 探测输入文件音频采样率（Hz）：干跑 `-i` 从 stderr 流信息行解析，失败返回 null。
 * 供 asetrate 等需按源采样率计算的滤镜使用，避免硬编码采样率导致变速倍率错误。
 */
export async function probeAudioRate(ff: FFmpeg, name: string, data: Uint8Array): Promise<number | null> {
  const lines: string[] = []
  const h = ({ message }: { message: string }) => lines.push(message)
  ff.on('log', h)
  try {
    await ff.writeFile(name, data)
    // 无输出文件的 `-i` 以非零码退出属预期，不影响流信息打印
    await ff.exec(['-hide_banner', '-i', name])
  } catch {
    /* 解析不到由调用方回退 */
  } finally {
    ff.off('log', h)
    try {
      await ff.deleteFile(name)
    } catch {
      /* 忽略 */
    }
  }
  // 形如 "  Stream #0:1: Audio: aac (LC), 48000 Hz, stereo, fltp, 128 kb/s"
  for (const l of lines) {
    const m = /Audio:.*?,\s*(\d{2,9})\s*Hz/.exec(l)
    if (m) return Number(m[1])
  }
  return null
}

export interface SilenceRange {
  /** 静音起点（秒） */
  start: number
  /** 静音终点（秒） */
  end: number
}

/**
 * 干跑 silencedetect 检测静音区间：写入文件 → `-vn -af silencedetect -f null -` → 解析日志。
 * 返回总时长与静音区间列表；解析不到时长或音频流（无音轨等异常）返回 null。
 */
export async function detectSilences(
  ff: FFmpeg,
  name: string,
  data: Uint8Array,
  thresholdDb: number,
  minSilence = 0.05,
): Promise<{ duration: number; silences: SilenceRange[] } | null> {
  const lines: string[] = []
  const h = ({ message }: { message: string }) => lines.push(message)
  ff.on('log', h)
  try {
    await ff.writeFile(name, data)
    await ff.exec([
      '-hide_banner', '-i', name, '-vn',
      '-af', `silencedetect=noise=${thresholdDb}dB:d=${minSilence}`,
      '-f', 'null', '-',
    ])
  } catch {
    /* 干跑失败按无法解析处理 */
  } finally {
    ff.off('log', h)
    try {
      await ff.deleteFile(name)
    } catch {
      /* 忽略 */
    }
  }
  if (!lines.some((l) => /Stream #\d+:\d+.*:\s*Audio:/.test(l))) return null
  // 总时长：形如 "  Duration: 00:01:23.45, start: 0.000000, bitrate:"
  let duration = 0
  for (const l of lines) {
    const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(l)
    if (m) {
      duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
      break
    }
  }
  if (!duration) return null
  // 静音区间：silence_start / silence_end 交替配对；以静音收尾时只有 start，补到结尾
  const silences: SilenceRange[] = []
  let pending = -1
  for (const l of lines) {
    const ms = /silence_start:\s*(-?[\d.]+)/.exec(l)
    const me = /silence_end:\s*([\d.]+)/.exec(l)
    if (ms) {
      if (pending >= 0) silences.push({ start: pending, end: Math.max(pending, Number(ms[1])) })
      pending = Math.max(0, Number(ms[1]))
    } else if (me && pending >= 0) {
      silences.push({ start: pending, end: Math.max(pending, Number(me[1])) })
      pending = -1
    }
  }
  if (pending >= 0) silences.push({ start: pending, end: duration })
  return { duration, silences }
}

export interface SyncRemovePlan {
  /** filter_complex：视频与音频按同一组保留区间剪除后 concat，保证音画同步 */
  filter: string
  /** 保留区间数（输出段数） */
  segments: number
  /** 剪除区间数（含掐头去尾） */
  cutCount: number
  /** 剪除总时长（秒） */
  cutTotal: number
}

/**
 * 由静音区间计算音视频同步剪除方案：掐头去尾各保留 edgePad 秒缓冲，
 * inner=true 时中间超过 innerMin 秒的停顿整段剪除。
 * 两轨使用同一组保留区间（trim/atrim + concat），从根本上消除
 * "音频时间轴压缩、视频原时间轴保留"导致的音画失步。
 */
export function buildSyncRemoveFilter(
  duration: number,
  silences: SilenceRange[],
  opts: { edgePad: number; inner: boolean; innerMin: number },
): SyncRemovePlan | null {
  const cuts: [number, number][] = []
  for (let i = 0; i < silences.length; i++) {
    const s = silences[i]
    if (i === 0 && s.start <= 0.01) {
      // 开头静音：保留 edgePad 秒缓冲后剪除
      if (s.end - opts.edgePad > 0) cuts.push([0, s.end - opts.edgePad])
    } else if (i === silences.length - 1 && s.end >= duration - 0.01) {
      // 结尾静音：保留 edgePad 秒缓冲后剪除
      if (s.start + opts.edgePad < duration) cuts.push([s.start + opts.edgePad, duration])
    } else if (opts.inner && s.end - s.start > opts.innerMin) {
      cuts.push([s.start, s.end])
    }
  }
  // 保留区间 = [0, duration] 减去 cuts
  const keep: [number, number][] = []
  let cur = 0
  for (const [a, b] of cuts) {
    if (a > cur) keep.push([cur, Math.min(a, duration)])
    cur = Math.max(cur, b)
  }
  if (cur < duration) keep.push([cur, duration])
  const segs = keep.filter(([a, b]) => b - a > 0.05)
  if (!segs.length) return null // 整段都是静音，无可保留内容
  const cutTotal = duration - segs.reduce((acc, [a, b]) => acc + (b - a), 0)
  const fmt = (n: number) => n.toFixed(3)
  const vParts: string[] = []
  const aParts: string[] = []
  segs.forEach(([a, b], i) => {
    vParts.push(`[0:v]trim=start=${fmt(a)}:end=${fmt(b)},setpts=PTS-STARTPTS[v${i}]`)
    aParts.push(`[0:a]atrim=start=${fmt(a)}:end=${fmt(b)},asetpts=PTS-STARTPTS[a${i}]`)
  })
  const vOut =
    segs.length === 1 ? '[v0]null[vout]' : `${vParts.map((_, i) => `[v${i}]`).join('')}concat=n=${segs.length}:v=1:a=0[vout]`
  const aOut =
    segs.length === 1 ? '[a0]anull[aout]' : `${aParts.map((_, i) => `[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[aout]`
  return {
    filter: [...vParts, ...aParts, vOut, aOut].join(';'),
    segments: segs.length,
    cutCount: cuts.length,
    cutTotal,
  }
}

/** 输出文件扩展名 → mime */
export function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    png: 'image/png',
    jpg: 'image/jpeg',
    zip: 'application/zip',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
