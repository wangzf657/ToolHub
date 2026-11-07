<script setup lang="ts">
/** 音量标准化：峰值(0.95) / RMS(0.35) 两种模式 → normalizeBuffer → 下载，显示增益 dB */
import { computed, ref } from 'vue'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3, normalizeBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'peak' | 'rms'>('peak')
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)
const gainDb = ref<number | null>(null)

function onClear() {
  gainDb.value = null
}

/** 测量当前峰值 / RMS 电平，用于展示增益 */
function levelOf(buf: AudioBuffer, m: 'peak' | 'rms'): number {
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
  return m === 'peak' ? peak : Math.sqrt(sumSq / Math.max(1, n))
}

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  const target = mode.value === 'peak' ? 0.95 : 0.35
  const cur = levelOf(b.buffer, mode.value)
  gainDb.value = cur > 0 ? 20 * Math.log10(target / cur) : 0
  b.setBusy(true)
  try {
    const out = normalizeBuffer(b.buffer, mode.value, target)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-normalized.${fmt.value}`)
const gainText = computed(() => {
  if (gainDb.value === null) return ''
  const v = gainDb.value
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`
})
</script>

<template>
  <AudioToolBase ref="base" @clear="onClear">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'peak' }" @click="mode = 'peak'">峰值标准化（目标 0.95）</button>
      <button class="chip" :class="{ active: mode === 'rms' }" @click="mode = 'rms'">响度标准化（RMS 目标 0.35）</button>
    </div>
    <p class="small muted mt-1">
      峰值模式保证不削波、适合音乐；RMS 模式按整体响度拉齐、更适合人声录音。增益上限 +20 dB 以免放大底噪。
    </p>
    <div v-if="gainText" class="small mt-1 gain">应用增益：<b>{{ gainText }}</b></div>

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

    <DownloadButton :produce="produce" :default-name="outName" button-text="标准化并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
.gain {
  color: var(--accent-text);
}
</style>
