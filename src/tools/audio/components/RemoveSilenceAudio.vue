<script setup lang="ts">
/** 音频去静音：检测预演（静音段列表+时间轴可视化）→ 阈值预设 chips → AB 试听 → 编码进度结果卡 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { encodeWav, encodeMp3, removeSilence } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'onlyEdges' | 'compress'>('onlyEdges')
const thresholdDb = ref(-45)
const minSilenceMs = ref(500)
const paddingMs = ref(100)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

/** 阈值预设：常用场景一键回填 */
const PRESETS = [
  { label: '口播 -40', db: -40, min: 400 },
  { label: '播客 -35', db: -35, min: 500 },
  { label: '音乐 -50', db: -50, min: 800 },
]
const applyPreset = (p: { db: number; min: number }) => {
  thresholdDb.value = p.db
  minSilenceMs.value = p.min
}

/* ---------- 检测预演：本地扫描静音段（与引擎同口径），列表 + 时间轴可视化 ---------- */
interface Seg {
  start: number
  end: number
}
const segs = ref<Seg[]>([])
const scanning = ref(false)
const segTotal = ref(0)

const PRE = 1024
function rmsAt(buf: AudioBuffer, i0: number, i1: number, chN: number): number {
  let sum = 0
  let n = 0
  const lim = Math.min(i1, buf.length)
  for (let ch = 0; ch < chN; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = i0; i < lim; i += 4) {
      sum += d[i] * d[i]
      n++
    }
  }
  return Math.sqrt(sum / Math.max(1, n))
}

async function detect() {
  const b = base.value
  if (!b?.buffer) return
  scanning.value = true
  const buf = b.buffer
  const thr = Math.pow(10, thresholdDb.value / 20)
  const minN = Math.floor((minSilenceMs.value / 1000) * buf.sampleRate)
  const win = PRE
  const out: Seg[] = []
  let runStart = -1
  for (let i = 0; i < buf.length; i += win) {
    const r = rmsAt(buf, i, i + win, Math.min(2, buf.numberOfChannels))
    const quiet = r < thr
    if (quiet && runStart < 0) runStart = i
    if ((!quiet || i + win >= buf.length) && runStart >= 0) {
      const end = quiet ? buf.length : i
      if (end - runStart >= minN) out.push({ start: runStart / buf.sampleRate, end: end / buf.sampleRate })
      runStart = -1
    }
    if (i % (win * 512) === 0) await new Promise((r) => setTimeout(r, 0)) // 让出主线程
  }
  segs.value = out
  segTotal.value = out.reduce((a, s) => a + (s.end - s.start), 0)
  scanning.value = false
}

/* ---------- AB 试听：原声 | 处理后，各自可播防叠播 ---------- */
let node: AudioBufferSourceNode | null = null
const playing = ref<'src' | 'out' | null>(null)
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
  playing.value = null
}
function playBuf(buf: AudioBuffer, which: 'src' | 'out') {
  const b = base.value
  if (!b) return
  stopPreview()
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = buf
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = null
      void ctx.close()
    }
  }
  n.start()
  node = n
  playing.value = which
}
const playSrc = () => base.value?.buffer && playBuf(base.value.buffer, 'src')
const playOut = () => {
  const b = base.value
  if (!b?.buffer) return
  const out = removeSilence(b.buffer, {
    thresholdDb: thresholdDb.value,
    minSilenceMs: minSilenceMs.value,
    paddingMs: paddingMs.value,
    onlyEdges: mode.value === 'onlyEdges',
  })
  playBuf(out, 'out')
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = removeSilence(b.buffer, {
      thresholdDb: thresholdDb.value,
      minSilenceMs: minSilenceMs.value,
      paddingMs: paddingMs.value,
      onlyEdges: mode.value === 'onlyEdges',
    })
    if (out.duration === b.buffer.duration) {
      // 引擎未剪掉任何内容：如实告知而非静默输出
      toast.warn('按当前阈值未检测到可剪除的静音段：可尝试提高阈值（如 -40）或缩短最短静音时长')
    }
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-no-silence.${fmt.value}`)
onBeforeUnmount(stopPreview)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'onlyEdges' }" @click="mode = 'onlyEdges'">仅掐头去尾</button>
      <button class="chip" :class="{ active: mode === 'compress' }" @click="mode = 'compress'">全篇压缩停顿</button>
      <span class="field-label">阈值预设</span>
      <button v-for="p in PRESETS" :key="p.label" class="chip" @click="applyPreset(p)">{{ p.label }}</button>
    </div>

    <div class="grid-3 mt-2">
      <label>
        <span class="field-label">静音阈值 {{ thresholdDb }} dB</span>
        <input v-model.number="thresholdDb" type="range" min="-60" max="-30" step="1" />
      </label>
      <label>
        <span class="field-label">最短静音（毫秒）</span>
        <input v-model.number="minSilenceMs" class="input" type="number" min="50" max="5000" step="50" />
      </label>
      <label>
        <span class="field-label">保留边缘 padding（毫秒）</span>
        <input v-model.number="paddingMs" class="input" type="number" min="0" max="1000" step="50" />
      </label>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer || scanning" @click="detect">
        {{ scanning ? '检测中…' : '检测静音段（预演）' }}
      </button>
      <span v-if="segs.length" class="small muted">检测到 <b>{{ segs.length }}</b> 处静音，共 {{ segTotal.toFixed(1) }} 秒</span>
      <span v-else-if="!scanning && segs.length === 0 && base?.buffer" class="small muted">尚未检测</span>
    </div>

    <div v-if="segs.length" class="timeline mt-1">
      <span
        v-for="(s, i) in segs" :key="i" class="seg"
        :style="{ left: `${(s.start / (base?.buffer?.duration || 1)) * 100}%`, width: `${((s.end - s.start) / (base?.buffer?.duration || 1)) * 100}%` }"
        :title="`静音 ${fmtTime(s.start)} ~ ${fmtTime(s.end)}`"
      ></span>
    </div>
    <div v-if="segs.length && segs.length <= 12" class="seg-list mt-1">
      <span v-for="(s, i) in segs" :key="i" class="seg-chip">{{ fmtTime(s.start) }}–{{ fmtTime(s.end) }}</span>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="playSrc">
        <Play v-if="playing !== 'src'" :size="14" /><Square v-else :size="14" /> {{ playing === 'src' ? '停止' : '原声' }}
      </button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="playOut">
        <Play v-if="playing !== 'out'" :size="14" /><Square v-else :size="14" /> {{ playing === 'out' ? '停止' : '处理后（AB 对比）' }}
      </button>
      <span class="small muted">两个按钮分别试听原声与剪除效果，自行对比</span>
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

    <AudioExport :produce="produce" :default-name="outName" button-text="去静音并生成" />
  </AudioToolBase>
</template>

<style scoped>
.opt { min-width: 130px; }
.timeline {
  position: relative;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  max-width: 640px;
}
.seg { position: absolute; top: 2px; bottom: 2px; background: rgba(248, 113, 113, 0.55); border-radius: 3px; min-width: 2px; }
.seg-list { display: flex; flex-wrap: wrap; gap: 6px; }
.seg-chip { font-size: 12px; color: var(--text-3); padding: 2px 8px; border: 1px solid var(--border); border-radius: 999px; font-variant-numeric: tabular-nums; }
</style>
