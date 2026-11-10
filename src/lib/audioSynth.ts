/** 声音工具箱共享引擎：白噪音合成 / 节拍器调度 / 频率发生器 / 麦克风音高检测（全 Web Audio 自研，零依赖） */

let sharedCtx: AudioContext | null = null

/** 共享 AudioContext（浏览器限制每页数量，统一复用） */
export function getAudioCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext()
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

export async function closeAudioCtx(): Promise<void> {
  if (sharedCtx) {
    await sharedCtx.close().catch(() => {})
    sharedCtx = null
  }
}

/* ---------------- 白噪音 / 环境音合成 ---------------- */

export type NoiseKind = 'white' | 'pink' | 'brown' | 'rain' | 'wave' | 'fan'

interface NoiseChain {
  stop: () => void
}

/** 启动一段持续的环境音，返回停止句柄 */
export function startNoise(kind: NoiseKind, gain = 0.5): NoiseChain {
  const ctx = getAudioCtx()
  const master = ctx.createGain()
  master.gain.value = gain
  master.connect(ctx.destination)

  const bufferSize = ctx.sampleRate * 4 // 4 秒循环缓冲
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    let lastOut = 0
    let lp = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      if (kind === 'white') {
        data[i] = white * 0.8
      } else if (kind === 'brown') {
        lastOut = (lastOut + 0.02 * white) / 1.02
        data[i] = lastOut * 3.5
      } else if (kind === 'pink') {
        // Paul Kellet 粉噪近似
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      } else if (kind === 'rain') {
        // 白噪 + 低通 + 随机滴答（高频脉冲模拟雨滴）
        lp = lp * 0.92 + white * 0.08
        const drop = Math.random() < 0.0025 ? (Math.random() * 2 - 1) * 0.6 : 0
        data[i] = lp * 1.6 + drop
      } else if (kind === 'wave') {
        // 棕噪 + 慢速幅度起伏（海浪呼吸感）
        lastOut = (lastOut + 0.02 * white) / 1.02
        const swell = (Math.sin((i / bufferSize) * Math.PI * 4) + 1) / 2
        data[i] = lastOut * 3.5 * (0.35 + 0.65 * swell)
      } else {
        // fan：低频窄带（叶片旋转感）
        lp = lp * 0.97 + white * 0.03
        data[i] = lp * 2.2
      }
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.connect(master)
  src.start()

  let lfoGain: GainNode | null = null
  if (kind === 'wave' || kind === 'rain') {
    // 缓慢起伏的低频调制
    const lfo = ctx.createOscillator()
    lfo.frequency.value = kind === 'wave' ? 0.08 : 0.15
    lfoGain = ctx.createGain()
    lfoGain.gain.value = gain * 0.35
    lfo.connect(lfoGain).connect(master.gain)
    lfo.start()
  }

  return {
    stop: () => {
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
        setTimeout(() => {
          src.stop()
          src.disconnect()
          master.disconnect()
          lfoGain?.disconnect()
        }, 120)
      } catch { /* 已停止 */ }
    },
  }
}

/* ---------------- 节拍器 ---------------- */

export interface MetroHandle {
  stop: () => void
  /** 每拍回调（beatInBar 从 0 开始，重音拍为 0） */
  onBeat?: (beatInBar: number) => void
}

/** Web Audio lookahead 精确节拍调度 */
export function startMetronome(bpm: number, beatsPerBar: number, subdiv = 1, onBeat?: (b: number) => void): MetroHandle {
  const ctx = getAudioCtx()
  let running = true
  let nextNoteTime = ctx.currentTime + 0.05
  let beat = 0
  let sub = 0
  const lookahead = 0.12 // 秒
  const interval = 25 // ms

  const click = (t: number, accent: boolean) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = accent ? 1320 : 880
    o.type = 'square'
    g.gain.setValueAtTime(accent ? 0.5 : 0.28, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.06)
  }

  const schedule = () => {
    if (!running) return
    while (nextNoteTime < ctx.currentTime + lookahead) {
      const accent = sub === 0 && beat % beatsPerBar === 0
      click(nextNoteTime, accent)
      const step = 60 / bpm / subdiv
      // 回调对齐真实节拍（非细分拍）
      if (sub === 0) {
        const delayMs = Math.max(0, (nextNoteTime - ctx.currentTime) * 1000)
        setTimeout(() => onBeat?.(beat % beatsPerBar), delayMs)
      }
      nextNoteTime += step
      sub++
      if (sub >= subdiv) {
        sub = 0
        beat++
      }
    }
  }
  const timer = setInterval(schedule, interval)
  schedule()
  return {
    stop: () => {
      running = false
      clearInterval(timer)
    },
  }
}

/* ---------------- 频率信号发生器 ---------------- */

export type WaveKind = 'sine' | 'square' | 'triangle' | 'sawtooth'

export function startTone(freq: number, kind: WaveKind = 'sine', gain = 0.3): { stop: () => void; setFreq: (f: number) => void } {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = kind
  osc.frequency.value = freq
  g.gain.value = gain
  osc.connect(g).connect(ctx.destination)
  osc.start()
  return {
    setFreq: (f: number) => {
      osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.01)
    },
    stop: () => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); g.disconnect() } catch { /* ignore */ }
      }, 120)
    },
  }
}

/* ---------------- 麦克风音高检测（自相关法） ---------------- */

export interface PitchResult {
  freq: number // 检测到的频率，0 表示未检测到
  clarity: number // 清晰度 0~1
  rms: number // 音量 0~1
}

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** 频率 → 音名与音分（A4=440 基准） */
export function freqToNote(freq: number): { name: string; cents: number; octave: number } {
  const semisFromA4 = 12 * Math.log2(freq / 440)
  const rounded = Math.round(semisFromA4)
  const cents = Math.round((semisFromA4 - rounded) * 100)
  // A4 = MIDI 69 = A3 八度记法下的 A；我们的 octave: MIDI 60 = C4
  const midi = 69 + rounded
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]!
  return { name, cents, octave }
}

/** McLeod 风格归一化自相关（NSDF）音高检测，采样率 44.1k，窗口 ~2048 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchResult {
  let rms = 0
  for (let i = 0; i < buf.length; i++) rms += buf[i]! * buf[i]!
  rms = Math.sqrt(rms / buf.length)
  if (rms < 0.01) return { freq: 0, clarity: 0, rms }

  const nsdf = new Float32Array(buf.length / 2)
  for (let tau = 6; tau < nsdf.length; tau++) {
    let ac = 0
    let m = 0
    for (let i = 0; i < buf.length - tau; i++) {
      ac += buf[i]! * buf[i + tau]!
      m += buf[i]! * buf[i]! + buf[i + tau]! * buf[i + tau]!
    }
    nsdf[tau] = m > 0 ? (2 * ac) / m : 0
  }
  // McLeod MPM 标准口径：先求全局最大峰幅，再取第一个 ≥ 0.9×最大峰的局部极大峰
  //（首个大峰即基音周期；取全局最大会选中周期整数倍的晚峰 → 纯音频率被整除）
  let globalMax = 0
  for (let tau = 7; tau < nsdf.length - 1; tau++) {
    const v = nsdf[tau]!
    if (v >= nsdf[tau - 1]! && v > nsdf[tau + 1]! && v > globalMax) globalMax = v
  }
  let peakIdx = -1
  let peakVal = 0
  const TH = 0.9
  for (let tau = 7; tau < nsdf.length - 1; tau++) {
    const v = nsdf[tau]!
    if (v > 0.3 && v >= globalMax * TH && v >= nsdf[tau - 1]! && v > nsdf[tau + 1]!) {
      peakIdx = tau
      peakVal = v
      break
    }
  }
  if (peakIdx < 0 || peakVal < 0.3) return { freq: 0, clarity: peakVal, rms }
  // 峰邻域最小二乘二次拟合提精度：三点抛物线对噪声敏感，多点拟合把 NSDF 抖动平均掉
  const w = Math.min(8, Math.max(1, peakIdx - 7))
  let sx2 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0
  for (let x = -w; x <= w; x++) {
    const y = Math.max(0, nsdf[peakIdx + x] ?? 0)
    sx2 += x * x
    sx4 += x * x * x * x
    sy += y
    sxy += x * y
    sx2y += x * x * y
  }
  const b = sxy / sx2
  const c = (sx2y - (sx2 * sy) / (2 * w + 1)) / (sx4 - (sx2 * sx2) / (2 * w + 1))
  const shift = c < 0 ? -b / (2 * c) : 0
  const freq = sampleRate / (peakIdx + shift)
  return { freq, clarity: peakVal, rms }
}

/** 麦克风拾音句柄 */
export interface MicHandle {
  stop: () => void
}

export async function startMic(onFrame: (buf: Float32Array, sr: number) => void): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const ctx = getAudioCtx()
  const srcNode = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  srcNode.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  let raf = 0
  const loop = () => {
    analyser.getFloatTimeDomainData(buf)
    onFrame(buf, ctx.sampleRate)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return {
    stop: () => {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      srcNode.disconnect()
      analyser.disconnect()
    },
  }
}

/* ---------------- 分贝仪 ---------------- */

/** RMS → dBFS（负值，参考满量程）；环境声级仅供娱乐参考 */
export function rmsToDb(rms: number): number {
  if (rms <= 0) return -100
  return Math.max(-100, 20 * Math.log10(rms))
}
