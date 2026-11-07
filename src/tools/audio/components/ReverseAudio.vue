<script setup lang="ts">
/** 音频倒放：transformBuffer({ reverse: true }) → 原位试听 + WAV/MP3 下载 */
import { computed, ref } from 'vue'
import { Play } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3, playBuffer, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

function preview() {
  const b = base.value
  if (!b?.buffer) return
  playBuffer(transformBuffer(b.buffer, { reverse: true }))
}

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = transformBuffer(b.buffer, { reverse: true })
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-reversed.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="row row-wrap mt-2">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="preview">
        <Play :size="14" /> 试听倒放效果
      </button>
      <span class="small muted">整段音频首尾倒置，采样级精确反转，适合反向镲片与音效设计</span>
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="倒放并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
