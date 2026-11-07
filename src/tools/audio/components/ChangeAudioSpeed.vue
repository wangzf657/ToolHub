<script setup lang="ts">
/** 音频变速：0.25–4× 滑杆 → changeSpeed（颗粒拼接，变速不变调）→ 试听 + 下载 */
import { computed, ref } from 'vue'
import { Play } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { changeSpeed, encodeWav, encodeMp3, playBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const speed = ref(1)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

const durText = computed(() => {
  const buf = base.value?.buffer
  if (!buf) return ''
  return `处理后时长约 ${fmtTime(buf.duration / speed.value)}`
})

function preview() {
  const b = base.value
  if (!b?.buffer) return
  playBuffer(changeSpeed(b.buffer, speed.value))
}

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = changeSpeed(b.buffer, speed.value)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-${speed.value}x.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="mt-2 sp-slider">
      <span class="field-label">播放速度 {{ speed.toFixed(2) }}×</span>
      <input v-model.number="speed" type="range" min="0.25" max="4" step="0.05" />
      <div class="row row-wrap sp-marks">
        <button v-for="p in [0.5, 0.75, 1, 1.25, 1.5, 2, 3]" :key="p" class="chip" :class="{ active: Math.abs(speed - p) < 0.001 }" @click="speed = p">
          {{ p }}×
        </button>
      </div>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="preview"><Play :size="14" /> 试听</button>
      <span class="small muted">变速不变调（颗粒拼接），音高保持原样 · {{ durText }}</span>
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="变速并下载" />
  </AudioToolBase>
</template>

<style scoped>
.sp-slider {
  max-width: 520px;
}
.sp-marks {
  gap: 8px;
  margin-top: 6px;
}
.opt {
  min-width: 130px;
}
</style>
