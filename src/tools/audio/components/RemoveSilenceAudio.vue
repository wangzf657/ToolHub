<script setup lang="ts">
/** 音频去静音：仅掐头去尾 / 全篇压缩两种模式，阈值 dB + 最短静音 + padding → removeSilence → 下载 */
import { computed, ref } from 'vue'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3, removeSilence } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'onlyEdges' | 'compress'>('onlyEdges')
const thresholdDb = ref(-45)
const minSilenceMs = ref(500)
const paddingMs = ref(100)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)
const beforeDur = ref(0)
const afterDur = ref(0)

function onClear() {
  beforeDur.value = 0
  afterDur.value = 0
}

const savedPct = computed(() => {
  if (!beforeDur.value || !afterDur.value) return ''
  const p = ((beforeDur.value - afterDur.value) / beforeDur.value) * 100
  return p > 0.1 ? `（缩短 ${p.toFixed(0)}%）` : ''
})

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    beforeDur.value = b.buffer.duration
    const out = removeSilence(b.buffer, {
      thresholdDb: thresholdDb.value,
      minSilenceMs: minSilenceMs.value,
      paddingMs: paddingMs.value,
      onlyEdges: mode.value === 'onlyEdges',
    })
    afterDur.value = out.duration
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-no-silence.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base" @clear="onClear">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'onlyEdges' }" @click="mode = 'onlyEdges'">仅掐头去尾</button>
      <button class="chip" :class="{ active: mode === 'compress' }" @click="mode = 'compress'">全篇压缩停顿</button>
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
    <p class="small muted mt-1">
      低于阈值视为静音：超过「最短静音」的片段会被裁掉（全篇模式逐段移除，掐头去尾模式只处理首尾），并在切口两侧保留 padding 避免声音发紧。
    </p>

    <div v-if="afterDur" class="small mt-1 cmp">
      时长对比：{{ fmtTime(beforeDur) }} → {{ fmtTime(afterDur) }} {{ savedPct }}
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="去静音并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
.cmp {
  color: var(--ok);
}
</style>
