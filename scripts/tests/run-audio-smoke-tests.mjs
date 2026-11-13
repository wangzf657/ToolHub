// audioEngine 冒烟哨兵：变速 OLA 重写 + 合并线性插值重采样（纵深落地轮两项算法重写的回归防线）
// shim OfflineAudioContext/AudioBuffer 后直调真实引擎（与浏览器实现同源），金标准值独立推导
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const outdir = path.join(here, '_engines')

// ---- Web Audio shim（引擎仅用到 createBuffer/getChannelData/length/sampleRate/duration）----
class FakeAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this._ch = Array.from({ length: channels }, () => new Float32Array(length))
  }
  getChannelData(c) { return this._ch[c] }
}
globalThis.AudioBuffer = FakeAudioBuffer
globalThis.OfflineAudioContext = class {
  constructor(channels, length, sampleRate) { this._c = channels; this._l = length; this._r = sampleRate }
  createBuffer(channels, length, sampleRate) { return new FakeAudioBuffer(channels, length, sampleRate) }
  startRendering() { return Promise.resolve(new FakeAudioBuffer(this._c, this._l, this._r)) }
}

await build({
  entryPoints: [path.join(root, 'src/lib/audioEngine.ts')], bundle: true, format: 'esm', platform: 'node',
  outfile: path.join(outdir, 'audioEngine.mjs'), external: ['@breezystack/lamejs'],
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
})
const { changeSpeed, mergeBuffers, createBuffer } = await import(pathToFileURL(path.join(outdir, 'audioEngine.mjs')).href)

// ---- 断言工具 ----
const results = []
let passN = 0, failN = 0, warnN = 0
function rec(name, ok, detail = '') {
  results.push({ name, ok: ok === true, detail: String(detail).slice(0, 260) })
  ok === true ? passN++ : failN++
}
function sineBuf(freq, sec, sr = 44100, amp = 0.8) {
  const len = Math.floor(sec * sr)
  const b = createBuffer(1, len, sr)
  const d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr)
  return b
}
function dcBuf(value, sec, sr = 44100) {
  const len = Math.floor(sec * sr)
  const b = createBuffer(1, len, sr)
  b.getChannelData(0).fill(value)
  return b
}
function rampBuf(len, sr = 44100) {
  const b = createBuffer(1, len, sr)
  const d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = i
  return b
}
const hasNaN = (b) => {
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) if (!Number.isFinite(d[i])) return true }
  return false
}
const rms = (b) => {
  const d = b.getChannelData(0); let s = 0
  for (let i = 0; i < d.length; i++) s += d[i] * d[i]
  return Math.sqrt(s / d.length)
}
const zeroCrossings = (b, skip = 0.05) => {
  const d = b.getChannelData(0)
  const from = Math.floor(d.length * skip), to = Math.floor(d.length * (1 - skip)) // 跳过首尾边界效应
  let n = 0
  for (let i = from + 1; i < to; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) n++
  return n
}

// ---- 批K-1 验收标准 1：变速 2.0 / 0.5 长度 ≈ len/speed、无 NaN、能量非零 ----
{
  const src = sineBuf(440, 1)
  for (const speed of [2.0, 0.5]) {
    const out = changeSpeed(src, speed)
    const expect = src.length / speed
    rec(`变速 ${speed} 输出长度≈len/speed`, Math.abs(out.length - expect) <= 2205, `${out.length} vs 期望≈${expect.toFixed(0)}(±50ms)`)
    rec(`变速 ${speed} 无 NaN`, !hasNaN(out))
    rec(`变速 ${speed} 能量非零`, rms(out) > 0.3 * rms(src), `rms=${rms(out).toFixed(3)} src=${rms(src).toFixed(3)}`)
  }
  // 变速不变调：输出时长=输入/speed 且音高不变 → 过零密度守恒，即 zcOut/zcIn ≈ 1/speed
  const out2 = changeSpeed(src, 2.0)
  const zcIn = zeroCrossings(src), zcOut = zeroCrossings(out2)
  rec('变速 2.0 不变调(过零密度守恒≈1/speed)', Math.abs(zcOut / zcIn - 0.5) < 0.05, `zc ${zcOut}/${zcIn}=${(zcOut / zcIn).toFixed(3)}`)
  const out05 = changeSpeed(src, 0.5)
  const zcOut05 = zeroCrossings(out05)
  rec('变速 0.5 不变调(过零密度守恒≈1/speed)', Math.abs(zcOut05 / zcIn - 2) < 0.1, `zc ${zcOut05}/${zcIn}=${(zcOut05 / zcIn).toFixed(3)}`)
}
// ---- OLA 窗和归一化精确性：直流输入归一化后仍是直流（爆音/接缝的主要来源）----
{
  const src = dcBuf(0.5, 0.5)
  const out = changeSpeed(src, 1.7)
  const d = out.getChannelData(0)
  const from = 3000, to = d.length - 3000 // 跳过首尾颗粒边界
  let maxErr = 0
  for (let i = from; i < to; i++) maxErr = Math.max(maxErr, Math.abs(d[i] - 0.5))
  rec('OLA 归一化精确(直流保持,无接缝起伏)', maxErr < 1e-3, `内部最大偏差 ${maxErr.toExponential(2)}`)
}
// ---- 边界：speed=1/非法值原样返回；短于颗粒的输入不崩 ----
{
  const src = sineBuf(440, 0.2)
  rec('speed=1 原样返回', changeSpeed(src, 1) === src)
  rec('speed=0 原样返回', changeSpeed(src, 0) === src)
  rec('speed=NaN 原样返回', changeSpeed(src, NaN) === src)
  const tiny = createBuffer(1, 200, 44100)
  tiny.getChannelData(0).fill(0.5)
  const out = changeSpeed(tiny, 2.0)
  rec('短于颗粒输入不崩且无 NaN', !hasNaN(out))
}
// ---- 批K-1 验收标准 2：异采样率合并长度正确 ----
{
  const a = sineBuf(440, 1, 44100)
  const b = sineBuf(440, 1, 22050)
  const m = mergeBuffers([a, b])
  const expect = a.length + Math.ceil((b.length * 44100) / 22050)
  rec('异采样率合并长度(44100+22050→44100)', m.length === expect, `${m.length} vs ${expect}`)
  rec('合并无 NaN', !hasNaN(m))
  // 时间轴不被拉伸：第二段末样位置 = 总长-1（曾出现 (比)² 拉伸回归）
  rec('合并时长≈2s', Math.abs(m.duration - 2) < 0.02, `${m.duration.toFixed(3)}s`)
  // 显式 targetRate 48000
  const m48 = mergeBuffers([a, b], 0, 48000)
  const expect48 = Math.ceil((a.length * 48000) / 44100) + Math.ceil((b.length * 48000) / 22050)
  rec('显式 targetRate=48000 长度正确', m48.length === expect48, `${m48.length} vs ${expect48}`)
  rec('48k 合并无 NaN', !hasNaN(m48))
}
// ---- 线性插值精确性：线性斜坡重采样后仍是精确斜坡 ----
{
  const src = rampBuf(10000, 10000)
  const m = mergeBuffers([src], 0, 20000) // 1:2 上采样
  const d = m.getChannelData(0)
  let maxErr = 0
  for (let di = 0; di < m.length - 1; di++) maxErr = Math.max(maxErr, Math.abs(d[di] - di / 2)) // 末样本 s 越界钳位属固有边界
  rec('线性插值精确(斜坡上采样偏差<1e-3,末样本钳位除外)', maxErr < 1e-3, `最大偏差 ${maxErr.toExponential(2)}`)
}
// ---- 同采样率合并逐样本一致(ratio=1 直拷) + 间隔长度 ----
{
  const a = sineBuf(440, 0.3), b = sineBuf(880, 0.2)
  const m = mergeBuffers([a, b])
  rec('同采样率合并长度=相加', m.length === a.length + b.length, `${m.length}`)
  const da = a.getChannelData(0), dm = m.getChannelData(0)
  let eq = true
  for (let i = 0; i < a.length; i++) if (da[i] !== dm[i]) { eq = false; break }
  rec('ratio=1 逐样本直拷一致', eq)
  const g = mergeBuffers([a, b], 0.5)
  rec('间隔 0.5s 计入长度', g.length === a.length + b.length + Math.floor(0.5 * 44100), `${g.length}`)
}

// ---- 汇总（格式与其余 runner 一致）----
console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : ' | ' + r.detail}`).join('\n'))
console.log(`音频引擎冒烟用例 ${results.length}:${passN} 通过,${failN} 失败,${warnN} 警告`)
if (failN > 0) process.exit(1)
