<script setup lang="ts">
/** 压缩音频：目标 MB 估算码率（夹值预警）或质量档 + 采样率降档 + 快捷目标 chips → 结果卡闭环 */
import { computed, ref } from 'vue'
import { Info } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { encodeMp3 } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { sizeLabel, toMono } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'size' | 'quality'>('size')
const targetMB = ref(5)
const quality = ref(128)
const mono = ref(false)
/** 采样率降档：0 = 跟随源 */
const sampleRate = ref(0)

const qualities = [320, 192, 128, 96, 64]
const TARGET_CHIPS = [2, 5, 10, 25]

/** 码率估算：目标体积 → 码率；质量档直接用所选值 */
const estimate = computed(() => {
  const buf = base.value?.buffer
  const f = base.value?.file
  if (!buf || !f) return null
  if (mode.value === 'quality') return { kbps: quality.value, dur: buf.duration, curSize: f.size, clamped: false }
  const targetBytes = targetMB.value * 1024 * 1024
  const raw = (targetBytes * 8) / Math.max(0.1, buf.duration) / 1000
  const kbps = Math.max(32, Math.min(320, Math.round(raw / 8) * 8))
  return { kbps, dur: buf.duration, curSize: f.size, clamped: raw < 32 }
})

/** 采样率重采样（OfflineAudioContext，浏览器原生） */
async function resampleTo(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (!rate || rate === buf.sampleRate) return buf
  const frames = Math.ceil((buf.duration * rate) / 1)
  const ctx = new OfflineAudioContext(buf.numberOfChannels, frames, rate)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
  return ctx.startRendering()
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  const est = estimate.value
  if (!est) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const afterMono = mono.value ? toMono(b.buffer) : b.buffer
    const src = await resampleTo(afterMono, sampleRate.value)
    return await encodeMp3(src, est.kbps, onProgress)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-compressed.mp3`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'size' }" @click="mode = 'size'">压到指定大小</button>
      <button class="chip" :class="{ active: mode === 'quality' }" @click="mode = 'quality'">按质量档压缩</button>
    </div>

    <div v-if="mode === 'size'" class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">目标大小（MB）</span>
        <input v-model.number="targetMB" class="input" type="number" min="0.1" max="500" step="0.5" />
      </label>
      <span class="field-label">快捷目标</span>
      <button v-for="m in TARGET_CHIPS" :key="m" class="chip" :class="{ active: targetMB === m }" @click="targetMB = m">{{ m }} MB</button>
    </div>

    <div v-else class="row row-wrap mt-2">
      <span class="field-label">码率档</span>
      <button v-for="q in qualities" :key="q" class="chip" :class="{ active: quality === q }" @click="quality = q">
        {{ q }} kbps
      </button>
    </div>

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="mono" type="checkbox" /> 转为单声道</label>
      <label class="opt">
        <span class="field-label">采样率</span>
        <select v-model.number="sampleRate" class="select" style="width: 150px">
          <option :value="0">跟随源</option>
          <option :value="44100">44100 Hz（标准）</option>
          <option :value="32000">32000 Hz（更小）</option>
          <option :value="22050">22050 Hz（语音足够）</option>
        </select>
      </label>
    </div>
    <p class="small muted mt-1">单声道把声道信息量减半：同码率下中频更集中（人声更清晰），但体积变化取决于编码器分配；想减体积请配合降低码率或采样率。</p>

    <div v-if="estimate" class="notice notice-info mt-2">
      <Info :size="15" />
      <span>
        当前 {{ sizeLabel(estimate.curSize) }} · 时长 {{ estimate.dur.toFixed(1) }} 秒
        <template v-if="mode === 'size'"> → 按目标 {{ targetMB }} MB 估算码率 {{ estimate.kbps }} kbps</template>
        <template v-else> → 使用 {{ estimate.kbps }} kbps，预计约 {{ sizeLabel((estimate.kbps * 1000 * estimate.dur) / 8) }}</template>
      </span>
    </div>
    <p v-if="estimate?.clamped" class="clamp-warn mt-1">⚠ 目标过小（或音频过长），估算码率已被钳到最低 32 kbps：音质将明显下降，建议调大目标体积</p>

    <AudioExport :produce="produce" :default-name="outName" button-text="压缩并生成" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 150px;
}
.clamp-warn {
  font-size: 12.5px;
  color: #d97706;
}
</style>
