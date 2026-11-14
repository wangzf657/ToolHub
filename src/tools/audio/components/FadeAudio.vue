<script setup lang="ts">
/**
 * 音频淡入淡出：线性走 transformBuffer；指数（立方近似）/ S 形曲线组件内逐样本渐变。
 * 淡入淡出区域可视化（包络小图）+ 分段试听定位 + 时长钳制反馈 + 编码进度结果卡。
 */
import { computed, ref } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { createBuffer, encodeWav, encodeMp3, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

type Curve = 'linear' | 'exp' | 'sigmoid'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const fadeIn = ref(2)
const fadeOut = ref(2)
const curve = ref<Curve>('linear')
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

const curves: { value: Curve; label: string }[] = [
  { value: 'linear', label: '线性' },
  { value: 'exp', label: '指数（立方近似）' },
  { value: 'sigmoid', label: 'S 形' },
]

/** 渐变形状：t ∈ [0,1] → 增益系数 */
function shape(t: number, kind: Curve): number {
  if (kind === 'linear') return t
  if (kind === 'exp') return Math.pow(t, 3)
  return 0.5 - 0.5 * Math.cos(Math.PI * t)
}

/** 独立的曲线淡入淡出实现（transformBuffer 仅支持线性） */
function curvedFade(buf: AudioBuffer, fin: number, fout: number, kind: Curve): AudioBuffer {
  const sr = buf.sampleRate
  const len = buf.length
  const out = createBuffer(buf.numberOfChannels, len, sr)
  const fi = Math.min(len, Math.round(Math.max(0, fin) * sr))
  const fo = Math.min(len, Math.round(Math.max(0, fout) * sr))
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    dst.set(src)
    for (let i = 0; i < fi; i++) dst[i] *= shape(i / fi, kind)
    for (let i = 0; i < fo; i++) dst[len - 1 - i] *= shape(i / fo, kind)
  }
  return out
}

/** 钳制反馈：淡入/淡出超过音频时长时提示并按半长钳制 */
const dur = computed(() => base.value?.buffer?.duration ?? 0)
const clampWarn = computed(() => dur.value > 0 && (fadeIn.value > dur.value || fadeOut.value > dur.value))
const safeIn = computed(() => Math.max(0, Math.min(fadeIn.value, dur.value / 2)))
const safeOut = computed(() => Math.max(0, Math.min(fadeOut.value, dur.value / 2)))

function apply(buf: AudioBuffer): AudioBuffer {
  if (curve.value === 'linear') {
    return transformBuffer(buf, { fadeIn: safeIn.value, fadeOut: safeOut.value })
  }
  return curvedFade(buf, safeIn.value, safeOut.value, curve.value)
}

/* ---------- 试听定位：整段 / 淡入段 / 淡出段 ---------- */
let node: AudioBufferSourceNode | null = null
const playing = ref<'' | 'all' | 'in' | 'out'>('')
function stopPreview() {
  if (node) {
    try {
      node.onended = null
      node.stop()
    } catch {
      /* 已停止 */
    }
    node = null
  }
  playing.value = ''
}
function playRange(from: number, to: number, which: 'all' | 'in' | 'out') {
  const b = base.value
  if (!b?.buffer) return
  stopPreview()
  const out = apply(b.buffer)
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = out
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = ''
      void ctx.close()
    }
  }
  n.start(0, Math.max(0, from), Math.max(0.05, to - from))
  node = n
  playing.value = which
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = apply(b.buffer)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-fade.${fmt.value}`)

/** 包络小图：SVG 折线渲染增益曲线（淡入 + 平段 + 淡出） */
const envPoints = computed(() => {
  const d = dur.value || 10
  const fin = Math.min(safeIn.value, d / 2)
  const fout = Math.min(safeOut.value, d / 2)
  const W = 100
  const pts: string[] = []
  const finN = Math.max(2, Math.round((fin / d) * W))
  const foutN = Math.max(2, Math.round((fout / d) * W))
  for (let i = 0; i <= finN; i++) {
    const t = i / finN
    pts.push(`${((t * fin) / d) * W},${(1 - shape(t, curve.value)) * 24}`)
  }
  pts.push(`${W},${(1 - shape(1, curve.value)) * 24}`) // 中段满幅（近似）
  for (let i = foutN; i >= 0; i--) {
    const t = i / foutN
    pts.push(`${W - ((t * fout) / d) * W},${(1 - shape(t, curve.value)) * 24}`)
  }
  return pts.join(' ')
})
</script>

<template>
  <AudioToolBase ref="base" :fade="{ in: safeIn, out: safeOut }">
    <div class="grid-2 mt-2">
      <label>
        <span class="field-label">淡入时长（秒，0 为关闭）</span>
        <input v-model.number="fadeIn" class="input" type="number" min="0" step="0.5" />
      </label>
      <label>
        <span class="field-label">淡出时长（秒，0 为关闭）</span>
        <input v-model.number="fadeOut" class="input" type="number" min="0" step="0.5" />
      </label>
    </div>
    <p v-if="clampWarn" class="clamp-warn">⚠ 淡入/淡出超过音频时长（{{ fmtTime(dur) }}），将按半长钳制实际生效：淡入 {{ safeIn.toFixed(1) }}s、淡出 {{ safeOut.toFixed(1) }}s</p>

    <div class="row row-wrap mt-2">
      <span class="field-label" style="margin: 0">渐变曲线</span>
      <button v-for="c in curves" :key="c.value" class="chip" :class="{ active: curve === c.value }" @click="curve = c.value">
        {{ c.label }}
      </button>
    </div>

    <svg viewBox="0 0 100 24" class="env mt-2" preserveAspectRatio="none">
      <polyline :points="envPoints" fill="none" stroke="var(--accent)" stroke-width="1.2" vector-effect="non-scaling-stroke" />
    </svg>
    <p class="small muted">增益包络（左 → 右 = 播放方向）：两端即淡入/淡出范围</p>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="playRange(0, dur, 'all')">
        <Play v-if="playing !== 'all'" :size="14" /><Square v-else :size="14" /> {{ playing === 'all' ? '停止' : '试听整段' }}
      </button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer || safeIn <= 0" @click="playRange(0, safeIn + 0.5, 'in')">
        {{ playing === 'in' ? '停止' : '试听淡入段' }}
      </button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer || safeOut <= 0" @click="playRange(Math.max(0, dur - safeOut - 0.5), dur, 'out')">
        {{ playing === 'out' ? '停止' : '试听淡出段' }}
      </button>
    </div>

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">导出格式</span>
        <select v-model="fmt" class="select">
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </select>
      </label>
      <label v-if="fmt === 'mp3'" class="opt grow">
        <span class="field-label">MP3 码率 {{ kbps }} kbps</span>
        <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
      </label>
    </div>

    <AudioExport :produce="produce" :default-name="outName" button-text="添加淡入淡出并生成" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
.env {
  width: 100%;
  max-width: 480px;
  height: 56px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  display: block;
}
.clamp-warn { font-size: 12.5px; color: #d97706; margin: 6px 0 0; }
</style>
