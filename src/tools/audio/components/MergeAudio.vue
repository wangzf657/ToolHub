<script setup lang="ts">
/** 合并音频：多文件按序拼接（FileDrop 内置排序）+ 间隔秒数 → mergeBuffers → WAV/MP3 下载 */
import { computed, ref, shallowRef } from 'vue'
import { Info, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { decodeAudio, encodeWav, encodeMp3, mergeBuffers } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const files = ref<File[]>([])
const buffers = shallowRef<AudioBuffer[]>([])
const decoding = ref(false)
const gap = ref(0.5)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

/** 解码缓存：排序/增删时避免重复解码 */
const cache = new Map<string, AudioBuffer>()

async function onFiles(list: File[]) {
  files.value = list
  if (!list.length) {
    buffers.value = []
    return
  }
  decoding.value = true
  try {
    const out: AudioBuffer[] = []
    for (const f of list) {
      const key = `${f.name}:${f.size}:${f.lastModified}`
      let b = cache.get(key)
      if (!b) {
        b = await decodeAudio(f)
        cache.set(key, b)
      }
      out.push(b)
    }
    buffers.value = out
  } catch (e) {
    toast.err((e as Error).message || '部分音频解码失败，请检查文件格式')
  } finally {
    decoding.value = false
  }
}

const totalDur = computed(
  () => buffers.value.reduce((s, b) => s + b.duration, 0) + Math.max(0, buffers.value.length - 1) * gap.value,
)

async function produce(): Promise<Blob> {
  if (!buffers.value.length) throw new Error('请先添加至少一个音频文件')
  const merged = mergeBuffers(buffers.value, gap.value)
  return fmt.value === 'mp3' ? await encodeMp3(merged, kbps.value) : encodeWav(merged)
}

const outName = computed(() => `${baseName(files.value[0]?.name ?? 'merged')}-merged.${fmt.value}`)
</script>

<template>
  <div>
    <FileDrop accept="audio/*" :multiple="true" label="拖放多个音频到此处（可拖拽排序）" hint="按列表顺序首尾拼接；不同采样率/声道会自动对齐" @files="onFiles" />

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">片段间隔（秒）</span>
        <input v-model.number="gap" class="input" type="number" min="0" max="30" step="0.1" />
      </label>
      <span class="small muted">
        <template v-if="decoding"><Loader2 :size="13" class="spin" /> 正在解码…</template>
        <template v-else-if="buffers.length">已解码 {{ buffers.length }} 段 · 合并后约 {{ fmtTime(totalDur) }}</template>
        <template v-else>添加文件后自动解码</template>
      </span>
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

    <DownloadButton :produce="produce" :default-name="outName" button-text="合并并下载" :disabled="decoding" />

    <p class="notice notice-info mt-2">
      <Info :size="15" />
      <span>合并以第一段音频的采样率为基准，其余片段自动重采样对齐；单/多声道混排时统一为最多声道数。列表可用 ↑ ↓ 按钮调整顺序。</span>
    </p>
  </div>
</template>

<style scoped>
.opt {
  min-width: 150px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
