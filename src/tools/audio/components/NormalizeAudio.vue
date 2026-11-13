<script setup lang="ts">
/** 音量标准化：峰值 / 响度(近似LUFS) 模式，目标可调、电平前置显示、削波预警、试听与编码进度 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { createBuffer, encodeWav, encodeMp3, normalizeBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'peak' | 'lufs'>('peak')
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)
/** 目标可调：峰值 0.5~1.0（默认 0.95）；响度 -24~-10 LUFS（默认 -16） */
const peakTarget = ref(0.95)
const lufsTarget = ref(-16)

const measuredPeak = ref(0)
const measuredLufs = ref(-70)

function measure(buf: AudioBuffer) {
  let peak = 0
  let sumSq = 0
  let n = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > peak) peak = a
      sumSq += d[i] * d[i]
      n++
    }
  }
  measuredPeak.value = peak
  const rms = Math.sqrt(sumSq / Math.max(1, n))
  // 近似 LUFS（无 K 加权的简化口径）
  measuredLufs.value = rms > 0 ? -0.691 + 10 * Math.log10(sumSq / Math.max(1, n)) : -70
}

function onLoaded(buf: AudioBuffer) {
  measure(buf)
}
function onClear() {
  measuredPeak.value = 0
  measuredLufs.value = -70
}

/** 电平前置：加载即显示当前电平与建议增益（不处理也能看） */
const gainDb = computed(() => {
  if (mode.value === 'peak') {
    if (!measuredPeak.value) return 0
    return Math.max(-20, Math.min(20, 20 * Math.log10(peakTarget.value / measuredPeak.value)))
  }
  return Math.max(-20, Math.min(20, lufsTarget.value - measuredLufs.value))
})
const gainText = computed(() => `${gainDb.value >= 0 ? '+' : ''}${gainDb.value.toFixed(1)} dB`)
/** 削波预警：应用增益后峰值将超过 0dBFS */
const clipWarn = computed(() => measuredPeak.value > 0 && measuredPeak.value * Math.pow(10, gainDb.value / 20) > 1)

/* ---------- 试听（防叠播可停止，仅算前 30 秒样本） ---------- */
let node: AudioBufferSourceNode | null = null
const playing = ref(false)
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
  playing.value = false
}
function previewNorm() {
  const b = base.value
  if (!b?.buffer) return
  stopPreview()
  const src = b.buffer.duration > 30 ? slice30(b.buffer) : b.buffer
  const target = mode.value === 'peak' ? peakTarget.value : undefined
  const out = normalizeBuffer(src, mode.value === 'peak' ? 'peak' : 'rms', target ?? lufsRmsTarget.value)
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = out
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = false
      void ctx.close()
    }
  }
  n.start()
  node = n
  playing.value = true
}
/** LUFS 目标换算为等效 RMS 目标供引擎使用 */
const lufsRmsTarget = computed(() => Math.pow(10, (lufsTarget.value + 0.691) / 10))
function slice30(buf: AudioBuffer): AudioBuffer {
  const n = Math.floor(30 * buf.sampleRate)
  const out = createBuffer(buf.numberOfChannels, n, buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buf.getChannelData(ch).subarray(0, n))
  }
  return out
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  measure(b.buffer)
  if (clipWarn.value && mode.value === 'lufs') {
    throw new Error('当前目标响度会使峰值超出 0dBFS（削波）：请降低目标响度或改用峰值模式')
  }
  b.setBusy(true)
  try {
    const out = normalizeBuffer(b.buffer, mode.value === 'peak' ? 'peak' : 'rms', mode.value === 'peak' ? peakTarget.value : lufsRmsTarget.value)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-normalized.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base" @loaded="onLoaded" @clear="onClear">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'peak' }" @click="mode = 'peak'">峰值标准化</button>
      <button class="chip" :class="{ active: mode === 'lufs' }" @click="mode = 'lufs'">响度标准化（近似 LUFS）</button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="previewNorm">
        <Play v-if="!playing" :size="14" /><Square v-else :size="14" />
        {{ playing ? '停止试听' : '试听效果（前 30 秒）' }}
      </button>
    </div>

    <div class="level-card mt-2">
      <span>当前峰值 {{ measuredPeak > 0 ? `${(20 * Math.log10(measuredPeak)).toFixed(1)} dBFS` : '—' }}</span>
      <span>当前响度 ≈ {{ measuredLufs > -69 ? `${measuredLufs.toFixed(1)} LUFS` : '—' }}（简化口径）</span>
      <span class="gain">建议增益 {{ gainText }}</span>
    </div>

    <div class="row row-wrap mt-2">
      <label v-if="mode === 'peak'" class="opt grow">
        <span class="field-label">峰值目标 {{ peakTarget.toFixed(2) }}（0~1，1 为满幅）</span>
        <input v-model.number="peakTarget" type="range" min="0.5" max="1" step="0.01" />
      </label>
      <label v-else class="opt grow">
        <span class="field-label">目标响度 {{ lufsTarget }} LUFS</span>
        <input v-model.number="lufsTarget" type="range" min="-24" max="-10" step="0.5" />
      </label>
    </div>
    <p v-if="clipWarn" class="clip-warn">⚠ 应用该增益后峰值将超过 0dBFS（会削波）：请降低目标或改用峰值模式；导出时会直接拦截</p>
    <p class="small muted mt-1">
      峰值模式保证不削波、适合音乐；响度模式按整体响度拉齐、适合人声录音（近似 LUFS 口径，无 K 加权，非广播级表）。
      增益上限 +20 dB 以免放大底噪。
    </p>

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

    <AudioExport :produce="produce" :default-name="outName" button-text="标准化并生成" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
.level-card {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.gain {
  color: var(--accent-text);
  font-weight: 700;
}
.clip-warn {
  font-size: 12.5px;
  color: #d97706;
  margin: 6px 0 0;
}
</style>
