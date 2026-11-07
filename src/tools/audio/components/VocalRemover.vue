<script setup lang="ts">
/**
 * 人声消除 / 伴奏提取：中置声像抵消（L−R 得伴奏）或仅保留中置（(L+R)/2 得人声），
 * 无需 AI 即时完成；单声道文件给出明确错误提示。
 */
import { computed, ref } from 'vue'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3, vocalCancel } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'remove' | 'keep'>('remove')
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

const channels = computed(() => base.value?.buffer?.numberOfChannels ?? 0)
const stereo = computed(() => channels.value >= 2)
const loaded = computed(() => !!base.value?.buffer)

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  // vocalCancel 内部对单声道抛出中文错误，这里提前校验给出更明确提示
  if (b.buffer.numberOfChannels < 2) {
    throw new Error('人声消除需要立体声文件：当前文件是单声道，请换一首立体声音乐再试')
  }
  b.setBusy(true)
  try {
    const out = vocalCancel(b.buffer, mode.value)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(
  () => `${baseName(base.value?.file?.name ?? 'audio')}-${mode.value === 'remove' ? '伴奏' : '人声'}.${fmt.value}`,
)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'remove' }" @click="mode = 'remove'">消除人声（提取伴奏）</button>
      <button class="chip" :class="{ active: mode === 'keep' }" @click="mode = 'keep'">仅保留中置（提取人声）</button>
    </div>

    <div v-if="loaded && !stereo" class="notice notice-err mt-2">
      <span>当前文件是单声道，无法做声像抵消。请换一首立体声（双声道）音乐——大多数流媒体与 CD 音源都是立体声。</span>
    </div>
    <p class="small muted mt-1">
      原理：立体声混音中主唱通常位于正中（左右声道相同），对左右声道做 L−R 抵消即可去掉中置人声得到伴奏；
      反之取 (L+R)/2 只保留中置成分。位于两侧的乐器与人声和声会留在伴奏中，这是该类算法的固有特性。
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="处理并下载" :disabled="loaded && !stereo" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
