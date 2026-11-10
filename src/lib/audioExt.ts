/** 音频扩展：10 段 EQ 链（实时 + 离线渲染）与分贝计算共享逻辑 */

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

export interface EqPreset {
  name: string
  gains: number[] // 与 EQ_BANDS 对齐，单位 dB
}

export const EQ_PRESETS: EqPreset[] = [
  { name: '平坦', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: '低音增强', gains: [8, 7, 5, 2, 0, 0, 0, 0, 1, 2] },
  { name: '人声突出', gains: [-3, -2, 0, 2, 4, 5, 4, 2, 0, -1] },
  { name: '高音清亮', gains: [-2, -1, 0, 0, 0, 1, 3, 5, 6, 7] },
  { name: '电子乐', gains: [6, 5, 1, 0, -2, 1, 2, 4, 5, 6] },
]

/** 在给定 context 上构建 10 段 peaking 链，返回首尾节点便于串联 */
export function buildEqChain(ctx: BaseAudioContext, gains: number[]): { input: BiquadFilterNode; output: BiquadFilterNode; filters: BiquadFilterNode[] } {
  const filters = EQ_BANDS.map((freq, i) => {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = freq
    f.Q.value = 1.1
    f.gain.value = gains[i] ?? 0
    return f
  })
  for (let i = 0; i < filters.length - 1; i++) filters[i]!.connect(filters[i + 1]!)
  return { input: filters[0]!, output: filters[filters.length - 1]!, filters }
}

/** 均方根振幅 */
export function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!
  return Math.sqrt(sum / buf.length)
}

/** dBFS → 供显示的相对声级（校准偏移后） */
export function toDb(rms: number, offsetDb = 0): number {
  if (rms <= 1e-6) return -100
  return Math.min(120, 20 * Math.log10(rms) + offsetDb + 100) // 把满量程 0dBFS 映射到 100，贴近日常声级观感
}
