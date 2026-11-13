<script setup lang="ts">
/** 音频变速：变速不变调（颗粒）/ 变调变速（重采样）双模式；试听轻量化（前 30s）可停止；导出带编码进度 */
import { computed, ref } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { changeSpeed, createBuffer, encodeWav, encodeMp3 } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const speed = ref(1)
const keepPitch = ref(true)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

const durText = computed(() => {
  const buf = base.value?.buffer
  if (!buf) return ''
  return `处理后时长约 ${fmtTime(buf.duration / speed.value)}`
})

/* ---------- 变调变速：线性插值重采样（速度与音高联动，标注音质降级） ---------- */
function resampleSpeed(buf: AudioBuffer, v: number): AudioBuffer {
  const newLen = Math.max(1, Math.floor(buf.length / v))
  const out = createBuffer(buf.numberOfChannels, newLen, buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch)
    const dst = out.getChannelData(ch)
    for (let i = 0; i < newLen; i++) {
      const pos = i * v
      const i0 = Math.floor(pos)
      const frac = pos - i0
      const a = src[i0] ?? 0
      const b2 = src[i0 + 1] ?? a
      dst[i] = a + (b2 - a) * frac
    }
  }
  return out
}

/** 试听轻量化：仅取前 30 秒计算，1 小时文件 1 秒内出声 */
const trim30 = (buf: AudioBuffer): AudioBuffer => {
  if (buf.duration <= 30) return buf
  const n = Math.floor(30 * buf.sampleRate)
  const out = createBuffer(buf.numberOfChannels, n, buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buf.getChannelData(ch).subarray(0, n))
  }
  return out
}

/* ---------- 试听：防叠播 + 可停止 ---------- */
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
function preview() {
  const b = base.value
  if (!b?.buffer) return
  stopPreview()
  const src = trim30(b.buffer)
  const out = keepPitch.value ? changeSpeed(src, speed.value) : resampleSpeed(src, speed.value)
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

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  if (speed.value === 1) throw new Error('速度为 1.00×（无变化），请先调整速度')
  b.setBusy(true)
  try {
    const out = keepPitch.value ? changeSpeed(b.buffer, speed.value) : resampleSpeed(b.buffer, speed.value)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-${speed.value.toFixed(2)}x.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="mt-2 sp-slider">
      <span class="field-label">播放速度 {{ speed.toFixed(2) }}×</span>
      <div class="row" style="gap: 12px; align-items: center">
        <input v-model.number="speed" type="range" min="0.25" max="4" step="0.05" class="grow" />
        <input
          v-model.number="speed" type="number" min="0.25" max="4" step="0.01" class="input"
          style="width: 92px" title="直接输入精确速度（0.25~4）"
        />
      </div>
      <div class="row row-wrap sp-marks">
        <button v-for="p in [0.5, 0.75, 1, 1.25, 1.5, 2, 3]" :key="p" class="chip" :class="{ active: Math.abs(speed - p) < 0.001 }" @click="speed = p">
          {{ p }}×
        </button>
      </div>
    </div>

    <div class="row row-wrap mt-1">
      <label class="check">
        <input v-model="keepPitch" type="checkbox" />
        变速不变调（颗粒拼接）<template v-if="!keepPitch">｜当前：变调变速（音高随速度升降，音质有降级）</template>
      </label>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="preview"><Play v-if="!playing" :size="14" /><Square v-else :size="14" /> {{ playing ? '停止试听' : '试听（前 30 秒）' }}</button>
      <span class="small muted">试听仅计算前 30 秒样本 · {{ durText }}</span>
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

    <AudioExport :produce="produce" :default-name="outName" button-text="变速并生成" />
  </AudioToolBase>
</template>

<style scoped>
.sp-slider {
  max-width: 520px;
}
.grow {
  flex: 1;
}
.sp-marks {
  gap: 8px;
  margin-top: 6px;
}
.opt {
  min-width: 130px;
}
</style>
