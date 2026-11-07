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
