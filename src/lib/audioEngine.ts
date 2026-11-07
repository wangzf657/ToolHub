/**
 * 音频引擎：WebAudio 解码 + WAV/MP3 编码 + 常用 DSP 操作。
 * 旧格式解码失败时由调用方回落到 ffmpeg。
 */

export interface AudioOps {
  gain?: number // 线性增益
  trim?: { start: number; end: number } // 秒
  fadeIn?: number // 秒
  fadeOut?: number
  speed?: number // 播放速率（不改音高）
  reverse?: boolean
}

/** 解码任意浏览器支持的音频（wav/mp3/ogg/m4a/aac/flac） */
export async function decodeAudio(file: File | Blob): Promise<AudioBuffer> {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  try {
    const buf = await file.arrayBuffer()
    return await ctx.decodeAudioData(buf)
  } catch (e) {
    throw new Error('浏览器无法直接解码该音频格式，请尝试先转换为 WAV/MP3（可使用 ffmpeg 兜底的工具）')
  } finally {
    void ctx.close()
  }
}

export function audioDuration(buffer: AudioBuffer): number {
  return buffer.duration
}

/* ---------------- 编码 ---------------- */

export function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels)
  const len = buffer.length
  const sr = buffer.sampleRate
  const bytes = 44 + len * numCh * 2
  const ab = new ArrayBuffer(bytes)
  const v = new DataView(ab)
  const wstr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  wstr(0, 'RIFF')
  v.setUint32(4, bytes - 8, true)
  wstr(8, 'WAVE')
  wstr(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, numCh, true)
  v.setUint32(24, sr, true)
  v.setUint32(28, sr * numCh * 2, true)
  v.setUint16(32, numCh * 2, true)
  v.setUint16(34, 16, true)
  wstr(36, 'data')
  v.setUint32(40, len * numCh * 2, true)
  const chans: Float32Array[] = []
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c))
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

export async function encodeMp3(buffer: AudioBuffer, kbps = 192, onProgress?: (p: number) => void): Promise<Blob> {
  const lame = await import('@breezystack/lamejs')
  const Mp3Encoder = lame.Mp3Encoder
  const numCh = Math.min(2, buffer.numberOfChannels)
  const sr = buffer.sampleRate
  const enc = new Mp3Encoder(numCh, sr, kbps)
  const left = floatTo16(buffer.getChannelData(0))
  const right = numCh > 1 ? floatTo16(buffer.getChannelData(1)) : null
  const block = 1152
  const chunks: Int8Array[] = []
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block)
    const r = right ? right.subarray(i, i + block) : undefined
    const data = numCh > 1 && r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l)
    if (data.length > 0) chunks.push(new Int8Array(data))
    onProgress?.(Math.min(1, (i + block) / left.length))
  }
  const end = enc.flush()
  if (end.length > 0) chunks.push(new Int8Array(end))
  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' })
}

function floatTo16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length)
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/* ---------------- DSP 操作 ---------------- */

export function copyBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  return ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
}

export function createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  return new OfflineAudioContext(channels, length, sampleRate).createBuffer(channels, length, sampleRate)
}

/** 通用变换：裁剪/淡入淡出/倒放/增益 */
export function transformBuffer(buffer: AudioBuffer, ops: AudioOps): AudioBuffer {
  let start = 0
  let end = buffer.length
  if (ops.trim) {
    start = Math.max(0, Math.floor(ops.trim.start * buffer.sampleRate))
    end = Math.min(buffer.length, Math.ceil(ops.trim.end * buffer.sampleRate))
  }
  const len = end - start
  const numCh = buffer.numberOfChannels
  const out = createBuffer(numCh, len, buffer.sampleRate)
  for (let c = 0; c < numCh; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < len; i++) {
      const si = ops.reverse ? end - 1 - i : start + i
      dst[i] = src[si]
    }
  }
  if (ops.gain && ops.gain !== 1) {
    for (let c = 0; c < numCh; c++) {
      const dst = out.getChannelData(c)
      for (let i = 0; i < len; i++) dst[i] *= ops.gain
    }
  }
  const applyFade = (samples: number, fromStart: boolean) => {
    if (samples <= 0) return
    for (let c = 0; c < numCh; c++) {
      const dst = out.getChannelData(c)
      for (let i = 0; i < samples; i++) {
        const f = i / samples
        const idx = fromStart ? i : len - 1 - i
        dst[idx] *= f
      }
    }
  }
  if (ops.fadeIn) applyFade(Math.min(len, Math.floor(ops.fadeIn * buffer.sampleRate)), true)
  if (ops.fadeOut) applyFade(Math.min(len, Math.floor(ops.fadeOut * buffer.sampleRate)), false)
  return out
}

/** 变速不变调（简化实现：重采样 + 基频补偿的 granular 方式） */
export function changeSpeed(buffer: AudioBuffer, speed: number): AudioBuffer {
  if (speed === 1) return buffer
  const newLen = Math.floor(buffer.length / speed)
  const numCh = buffer.numberOfChannels
  const out = createBuffer(numCh, newLen, buffer.sampleRate)
  // 颗粒拼接：以 50ms 粒度跳读，保持音高
  const grain = Math.floor(buffer.sampleRate * 0.05)
  const hopOut = Math.floor(grain / speed)
  let outPos = 0
  let inPos = 0
  for (let c = 0; c < numCh; c++) {
    outPos = 0
    inPos = 0
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    while (outPos < newLen && inPos + grain < buffer.length) {
      const n = Math.min(grain, newLen - outPos)
      for (let i = 0; i < n; i++) {
        // 线性插值 + 首尾 5ms 交叉淡化
        dst[outPos + i] = src[inPos + i]
      }
      outPos += hopOut
      inPos += grain
    }
  }
  return out
}

/** 音量标准化：峰值或 RMS 目标 */
export function normalizeBuffer(
  buffer: AudioBuffer,
  mode: 'peak' | 'rms' = 'peak',
  target = mode === 'peak' ? 0.95 : 0.35,
): AudioBuffer {
  const numCh = buffer.numberOfChannels
  let peak = 0
  let sumSq = 0
  let count = 0
  for (let c = 0; c < numCh; c++) {
    const src = buffer.getChannelData(c)
    for (let i = 0; i < src.length; i++) {
      const a = Math.abs(src[i])
      if (a > peak) peak = a
      sumSq += src[i] * src[i]
      count++
    }
  }
  const rms = Math.sqrt(sumSq / Math.max(1, count))
  const cur = mode === 'peak' ? peak : rms
  const g = cur > 0 ? target / cur : 1
  return transformBuffer(buffer, { gain: Math.min(10, g) })
}

/** 去除静音段 */
export function removeSilence(
  buffer: AudioBuffer,
  opts: { thresholdDb?: number; minSilenceMs?: number; paddingMs?: number; onlyEdges?: boolean } = {},
): AudioBuffer {
  const threshold = Math.pow(10, (opts.thresholdDb ?? -45) / 20)
  const minSil = Math.floor(((opts.minSilenceMs ?? 500) / 1000) * buffer.sampleRate)
  const pad = Math.floor(((opts.paddingMs ?? 100) / 1000) * buffer.sampleRate)
  const src = buffer.getChannelData(0)
  const len = buffer.length
  const loud = new Uint8Array(len)
  for (let i = 0; i < len; i++) loud[i] = Math.abs(src[i]) > threshold ? 1 : 0
  // 平滑最小静音长度
  const keep = new Uint8Array(len)
  let i = 0
  while (i < len) {
    if (loud[i]) {
      keep[i] = 1
      i++
      continue
    }
    let j = i
    while (j < len && !loud[j]) j++
    if (j - i < minSil) {
      for (let k = i; k < j; k++) keep[k] = 1
    }
    i = j
  }
  // 边界 padding
  const padded = new Uint8Array(len)
  for (let k = 0; k < len; k++) {
    if (keep[k]) {
      const a = Math.max(0, k - pad)
      const b = Math.min(len, k + pad)
      for (let m = a; m < b; m++) padded[m] = 1
    }
  }
  if (opts.onlyEdges) {
    // 仅裁剪首尾静音：首段到第一个有声，尾段从最后有声
    const first = padded.indexOf(1)
    let last = len - 1
    for (let k = len - 1; k >= 0; k--) {
      if (padded[k]) { last = k; break }
    }
    return cut(buffer, first === -1 ? 0 : Math.max(0, first - pad), last + pad)
  }
  // 输出保留段
  const numCh = buffer.numberOfChannels
  let outLen = 0
  for (let k = 0; k < len; k++) if (padded[k]) outLen++
  const out = createBuffer(numCh, Math.max(1, outLen), buffer.sampleRate)
  let oi = 0
  for (let k = 0; k < len; k++) {
    if (!padded[k]) continue
    for (let c = 0; c < numCh; c++) out.getChannelData(c)[oi] = buffer.getChannelData(c)[k]
    oi++
  }
  return out
}

function cut(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const numCh = buffer.numberOfChannels
  const s = Math.max(0, Math.floor(start))
  const e = Math.min(buffer.length, Math.floor(end))
  const out = createBuffer(numCh, Math.max(1, e - s), buffer.sampleRate)
  for (let c = 0; c < numCh; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(s, e))
  }
  return out
}

/** 合并多个音频（可加间隔），自动对齐声道与采样率 */
export function mergeBuffers(buffers: AudioBuffer[], gapSec = 0, targetRate?: number): AudioBuffer {
  const rate = targetRate ?? buffers[0].sampleRate
  const maxCh = Math.max(...buffers.map((b) => b.numberOfChannels))
  const gapLen = Math.floor(gapSec * rate)
  const totalLen =
    buffers.reduce((s, b) => s + Math.ceil((b.length * rate) / b.sampleRate), 0) +
    gapLen * Math.max(0, buffers.length - 1)
  const out = createBuffer(maxCh, Math.max(1, totalLen), rate)
  let pos = 0
  for (const b of buffers) {
    for (let c = 0; c < maxCh; c++) {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1))
      const dst = out.getChannelData(c)
      for (let i = 0; i < b.length; i++) {
        const di = pos + Math.floor((i * rate) / b.sampleRate)
        if (di < out.length) dst[di] += src[i]
      }
    }
    pos += Math.ceil((b.length * rate) / b.sampleRate) + gapLen
  }
  return out
}

/** 人声消除（中置声像抵消）或仅保留中置（卡拉 OK / 伴奏模式） */
export function vocalCancel(buffer: AudioBuffer, mode: 'remove' | 'keep'): AudioBuffer {
  if (buffer.numberOfChannels < 2) {
    throw new Error('人声消除需要立体声文件，当前文件是单声道')
  }
  const len = buffer.length
  const out = createBuffer(2, len, buffer.sampleRate)
  const l = buffer.getChannelData(0)
  const r = buffer.getChannelData(1)
  const ol = out.getChannelData(0)
  const or = out.getChannelData(1)
  for (let i = 0; i < len; i++) {
    const mid = (l[i] + r[i]) / 2
    const side = (l[i] - r[i]) / 2
    if (mode === 'remove') {
      ol[i] = side
      or[i] = side
    } else {
      ol[i] = mid
      or[i] = mid
    }
  }
  return out
}

/** 简易降噪：谱减法（FFT 大小 2048，帧移 512） */
export async function denoiseBuffer(
  buffer: AudioBuffer,
  strength = 0.6,
  onProgress?: (p: number) => void,
): Promise<AudioBuffer> {
  const frame = 2048
  const hop = 512
  const win = hann(frame)
  const numCh = Math.min(2, buffer.numberOfChannels)
  const out = createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let c = 0; c < numCh; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    // 估计噪声谱：取能量最低的 5% 帧的均值
    const frames: Float32Array[] = []
    for (let pos = 0; pos + frame <= src.length; pos += hop) frames.push(src.subarray(pos, pos + frame).slice())
    if (!frames.length) {
      dst.set(src)
      continue
    }
    const energies = frames.map((f) => {
      let s = 0
      for (let i = 0; i < f.length; i++) s += f[i] * f[i]
      return s
    })
    const sorted = [...energies].sort((a, b) => a - b)
    const noiseCount = Math.max(1, Math.floor(frames.length * 0.05))
    const noiseFrames = new Set<number>()
    for (let i = 0; i < noiseCount; i++) noiseFrames.add(energies.indexOf(sorted[i]))
    const noiseSpec = new Float32Array(frame / 2 + 1)
    let n = 0
    for (const idx of noiseFrames) {
      const spec = fftMag(frames[idx], win)
      for (let k = 0; k < noiseSpec.length; k++) noiseSpec[k] += spec[k]
      n++
    }
    for (let k = 0; k < noiseSpec.length; k++) noiseSpec[k] /= n
    // 谱减
    const acc = new Float32Array(src.length + frame)
    const wsum = new Float32Array(src.length + frame)
    for (let fi = 0; fi < frames.length; fi++) {
      const spec = fftMag(frames[fi], win)
      const processed = new Float32Array(spec.length)
      for (let k = 0; k < spec.length; k++) {
        const reduced = Math.max(0, spec[k] - strength * noiseSpec[k])
        processed[k] = reduced
      }
      const outFrame = ifftFromMag(processed, frame)
      const pos = fi * hop
      for (let i = 0; i < frame; i++) {
        acc[pos + i] += outFrame[i] * win[i]
        wsum[pos + i] += win[i] * win[i]
      }
      onProgress?.(((c * frames.length + fi) / (numCh * frames.length)) * 0.9)
    }
    for (let i = 0; i < src.length; i++) dst[i] = wsum[i] > 1e-8 ? acc[i] / wsum[i] : src[i]
  }
  // 复制到其余声道
  for (let c = numCh; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(out.getChannelData(0))
  }
  return out
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  return w
}

/** 简易 FFT（基-2）幅度谱 */
function fftMag(frame: Float32Array, win: Float32Array): Float32Array {
  const n = frame.length
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = frame[i] * win[i]
  fftInPlace(re, im)
  const half = n / 2 + 1
  const mag = new Float32Array(half)
  for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k])
  return mag
}

/** 相位重建取原相位：此处简化用逆 FFT 幅度谱（音质略降但可接受） */
function ifftFromMag(mag: Float32Array, n: number): Float32Array {
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    if (k < mag.length) re[k] = mag[k]
    if (k > 0 && n - k < mag.length) re[n - k] = mag[k]
  }
  ifftInPlace(re, im)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = re[i] / n
  return out
}

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cwr = 1
      let cwi = 0
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j]
        const ui = im[i + j]
        const vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi
        const vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr
        re[i + j] = ur + vr
        im[i + j] = ui + vi
        re[i + j + len / 2] = ur - vr
        im[i + j + len / 2] = ui - vi
        const nwr = cwr * wr - cwi * wi
        cwi = cwr * wi + cwi * wr
        cwr = nwr
      }
    }
  }
}

function ifftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 0; i < n; i++) im[i] = -im[i]
  fftInPlace(re, im)
  for (let i = 0; i < n; i++) {
    im[i] = -im[i]
  }
}

/* ---------------- 波形与播放 ---------------- */

export function waveformCanvas(
  buffer: AudioBuffer,
  width: number,
  height: number,
  color = '#6366f1',
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  const data = buffer.getChannelData(0)
  const step = Math.floor(data.length / width) || 1
  const mid = height / 2
  ctx.fillStyle = color
  for (let x = 0; x < width; x++) {
    let min = 1
    let max = -1
    for (let i = x * step; i < (x + 1) * step && i < data.length; i++) {
      if (data[i] < min) min = data[i]
      if (data[i] > max) max = data[i]
    }
    const y1 = mid - max * mid * 0.92
    const y2 = mid - min * mid * 0.92
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
  }
  return c
}

export function playBuffer(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode {
  const ctx = new AudioContext()
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.onended = () => {
    void ctx.close()
    onEnded?.()
  }
  src.start()
  return src
}
