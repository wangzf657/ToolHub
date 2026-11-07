<script setup lang="ts">
/** 音频裁剪：起止秒（可试听选区定位）+ 淡入淡出 → transformBuffer → WAV/MP3 下载 */
import { computed, ref } from 'vue'
import { Play } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3, playBuffer, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const duration = ref(0)
const startS = ref(0)
const endS = ref(0)
const fadeIn = ref(0)
const fadeOut = ref(0)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

function onLoaded(buf: AudioBuffer) {
  duration.value = buf.duration
  startS.value = 0
  endS.value = Math.round(buf.duration * 100) / 100
}
function onClear() {
  duration.value = 0
}

/** 播放当前选区（含淡入淡出效果）帮助定位 */
function playSelection() {
  const b = base.value
  if (!b?.buffer || endS.value <= startS.value) return
  playBuffer(
    transformBuffer(b.buffer, {
      trim: { start: startS.value, end: endS.value },
      fadeIn: fadeIn.value,
      fadeOut: fadeOut.value,
    }),
  )
}

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  if (endS.value - startS.value <= 0.01) throw new Error('裁剪区间无效：终点需大于起点')
  b.setBusy(true)
  try {
    const out = transformBuffer(b.buffer, {
      trim: { start: startS.value, end: endS.value },
      fadeIn: Math.max(0, fadeIn.value),
      fadeOut: Math.max(0, fadeOut.value),
    })
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-trimmed.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base" @loaded="onLoaded" @clear="onClear">
    <div class="grid-2 mt-2">
      <label>
        <span class="field-label">起点（秒）</span>
        <input v-model.number="startS" class="input" type="number" min="0" :max="duration" step="0.01" />
      </label>
      <label>
        <span class="field-label">终点（秒）</span>
        <input v-model.number="endS" class="input" type="number" min="0" :max="duration" step="0.01" />
      </label>
      <label>
        <span class="field-label">淡入（秒，0 为关闭）</span>
        <input v-model.number="fadeIn" class="input" type="number" min="0" step="0.1" />
      </label>
      <label>
        <span class="field-label">淡出（秒，0 为关闭）</span>
        <input v-model.number="fadeOut" class="input" type="number" min="0" step="0.1" />
      </label>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer || endS <= startS" @click="playSelection">
        <Play :size="14" /> 试听选区
      </button>
      <span class="small muted">选区 {{ fmtTime(startS) }} – {{ fmtTime(endS) }}，共 {{ Math.max(0, endS - startS).toFixed(2) }} 秒</span>
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="裁剪并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
