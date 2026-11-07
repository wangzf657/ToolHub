/**
 * 音频工具本目录共享的小工具函数：
 * 浏览器语音识别（webkitSpeechRecognition）类型与检测、时间/体积格式化、
 * Uint8Array → Blob 转换、多声道混合为单声道。
 */

/* ---------- 浏览器语音识别（Chrome/Edge 的 webkitSpeechRecognition） ---------- */

export interface SRAlternative {
  transcript: string
  confidence: number
}
export interface SRResult {
  isFinal: boolean
  length: number
  [index: number]: SRAlternative
}
export interface SRResultList {
  length: number
  [index: number]: SRResult
}
export interface SREvent extends Event {
  resultIndex: number
  results: SRResultList
}
export interface SRErrorEvent extends Event {
  error: string
  message?: string
}
export interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** 检测当前浏览器的语音识别支持，未支持返回 null */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ---------- 格式化 ---------- */

/** 秒 → m:ss 显示 */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

/** 字节数 → 人类可读体积 */
export function sizeLabel(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

/* ---------- 数据转换 ---------- */

/** Uint8Array → Blob（显式复制，规避 TS ArrayBuffer 泛型差异） */
export function u8ToBlob(data: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(data.length)
  copy.set(data)
  return new Blob([copy.buffer as ArrayBuffer], { type: mime })
}

/** 多声道混合为单声道（各声道取平均） */
export function toMono(buffer: AudioBuffer): AudioBuffer {
  const { length, sampleRate, numberOfChannels } = buffer
  const out = new OfflineAudioContext(1, length, sampleRate).createBuffer(1, length, sampleRate)
  const dst = out.getChannelData(0)
  for (let c = 0; c < numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) dst[i] += src[i] / numberOfChannels
  }
  return out
}
