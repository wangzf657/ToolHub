<script setup lang="ts">
/** 合并音频：线性插值重采样 + 可选 crossfade 接缝淡化；逐段信息与试听、接缝预览、坏文件跳过、解码进度 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Info, Loader2, Play, Square } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import AudioExport from './AudioExport.vue'
import { decodeAudio, encodeWav, encodeMp3, createBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const files = ref<File[]>([])
const buffers = shallowRef<AudioBuffer[]>([])
const skipped = ref<string[]>([])
const decoding = ref(false)
const decodeLabel = ref('')
const gap = ref(0.5)
const crossfade = ref(0)
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

/** 解码缓存：排序/增删时避免重复解码 */
const cache = new Map<string, AudioBuffer>()

async function onFiles(list: File[]) {
  files.value = list
  skipped.value = []
  if (!list.length) {
    buffers.value = []
    return
  }
  decoding.value = true
  const out: AudioBuffer[] = []
  const bad: string[] = []
  try {
    for (let i = 0; i < list.length; i++) {
      decodeLabel.value = `解码中 ${i + 1}/${list.length}`
      const f = list[i]!
      const key = `${f.name}:${f.size}:${f.lastModified}`
      let b = cache.get(key)
      if (!b) {
        try {
          b = await decodeAudio(f)
          cache.set(key, b)
        } catch {
          bad.push(f.name)
          continue // 坏文件跳过，其余照常合并
        }
      }
      out.push(b)
    }
    buffers.value = out
    if (bad.length) {
      skipped.value = bad
      toast.warn(`已跳过 ${bad.length} 个损坏/无法解码的文件（${bad.join('、')}），其余照常合并`)
    }
  } finally {
    decoding.value = false
    decodeLabel.value = ''
  }
}

/* ---------- 本地合并：线性插值重采样（修毛刺）+ 可选 crossfade 接缝淡化 ---------- */
function mergeLocal(list: AudioBuffer[], gapSec: number, fadeSec: number): AudioBuffer {
  const rate = list[0]!.sampleRate
  const maxCh = Math.max(...list.map((b) => b.numberOfChannels))
  const fadeLen = Math.max(0, Math.floor(fadeSec * rate))
  const gapLen = Math.floor(gapSec * rate)
  const lens = list.map((b) => Math.floor((b.length * rate) / b.sampleRate + 0.5))
  let total = lens.reduce((a, b) => a + b, 0)
  if (fadeLen > 0 && list.length > 1) total -= fadeLen * (list.length - 1)
  else total += gapLen * Math.max(0, list.length - 1)
  const out = createBuffer(maxCh, Math.max(1, total), rate)
  let pos = 0
  list.forEach((b, idx) => {
    const L = lens[idx]!
    for (let c = 0; c < maxCh; c++) {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1))
      const dst = out.getChannelData(c)
      for (let i = 0; i < L; i++) {
        // 线性插值重采样，替代最近邻取样的毛刺
        const p = (i * b.sampleRate) / rate
        const i0 = Math.min(b.length - 1, Math.floor(p))
        const frac = p - i0
        const v = (src[i0] ?? 0) * (1 - frac) + (src[i0 + 1] ?? 0) * frac
        const di = pos + i
        if (di < out.length) dst[di] += v
      }
      // crossfade：本段头部与上一段尾部重叠区做线性渐变
      if (fadeLen > 0 && idx > 0) {
        for (let i = 0; i < Math.min(fadeLen, L); i++) {
          const di = pos + i
          if (di >= 0 && di < out.length) dst[di] *= i / fadeLen
        }
      }
      if (fadeLen > 0 && idx < list.length - 1) {
        const dstT = out.getChannelData(Math.min(c, maxCh - 1))
        for (let i = 0; i < fadeLen; i++) {
          const srcIdx = L - fadeLen + i
          const di = pos + srcIdx
          if (srcIdx >= 0 && di >= 0 && di < out.length) dstT[di] *= 1 - i / fadeLen
        }
      }
    }
    pos += fadeLen > 0 && idx < list.length - 1 ? L - fadeLen : L + gapLen
  })
  return out
}

/* ---------- 逐段信息 + 试听 ---------- */
let node: AudioBufferSourceNode | null = null
const playing = ref(-1)
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
  playing.value = -1
}
function playSeg(i: number) {
  const buf = buffers.value[i]
  if (!buf) return
  stopPreview()
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = buf
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = -1
      void ctx.close()
    }
  }
  n.start()
  node = n
  playing.value = i
}

/** 合并前试听：从第 k 段开头连续播放 15 秒，验证接缝实际效果 */
function previewSeam(k: number) {
  if (!buffers.value.length) return
  stopPreview()
  const merged = mergeLocal(buffers.value, gap.value, crossfade.value)
  let offset = 0
  for (let i = 0; i < k; i++) {
    offset += (buffers.value[i]!.length * merged.sampleRate) / buffers.value[i]!.sampleRate
    offset = Math.floor(offset / merged.sampleRate) * merged.sampleRate
    offset -= crossfade.value > 0 && i > 0 ? crossfade.value * merged.sampleRate : 0
  }
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = merged
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = -1
      void ctx.close()
    }
  }
  n.start(0, Math.max(0, offset / merged.sampleRate), 15)
  node = n
  playing.value = k
}

const totalDur = computed(() => {
  const n = buffers.value.length
  if (!n) return 0
  const sum = buffers.value.reduce((s, b) => s + b.duration, 0)
  const cf = crossfade.value > 0 ? crossfade.value * (n - 1) : Math.max(0, n - 1) * gap.value
  return sum - cf
})

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  if (!buffers.value.length) throw new Error('请先添加至少一个音频文件')
  const merged = mergeLocal(buffers.value, crossfade.value > 0 ? 0 : gap.value, crossfade.value)
  return fmt.value === 'mp3' ? await encodeMp3(merged, kbps.value, onProgress) : encodeWav(merged)
}

const outName = computed(() => `${baseName(files.value[0]?.name ?? 'merged')}-merged.${fmt.value}`)
onBeforeUnmount(stopPreview)
</script>

<template>
  <div>
    <FileDrop accept="audio/*" :multiple="true" label="拖放多个音频到此处（可拖拽排序）" hint="按列表顺序首尾拼接；不同采样率/声道自动线性插值对齐" @files="onFiles" />

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">片段间隔（秒，crossfade>0 时忽略）</span>
        <input v-model.number="gap" class="input" type="number" min="0" max="30" step="0.1" />
      </label>
      <label class="opt">
        <span class="field-label">接缝交叉淡化（0~5 秒）</span>
        <input v-model.number="crossfade" class="input" type="number" min="0" max="5" step="0.5" />
      </label>
      <span class="small muted">
        <template v-if="decoding"><Loader2 :size="13" class="spin" /> {{ decodeLabel }}</template>
        <template v-else-if="buffers.length">已解码 {{ buffers.length }} 段 · 合并后约 {{ fmtTime(totalDur) }}</template>
        <template v-else>添加文件后自动解码</template>
      </span>
    </div>

    <div v-if="buffers.length" class="seg-table mt-2">
      <div v-for="(b, i) in buffers" :key="i" class="seg-row">
        <b class="seg-name">{{ files[i]?.name ?? `片段 ${i + 1}` }}</b>
        <span class="muted small">{{ fmtTime(b.duration) }} · {{ b.numberOfChannels === 1 ? '单声道' : '立体声' }} · {{ (b.sampleRate / 1000).toFixed(1) }} kHz</span>
        <button class="btn btn-ghost btn-sm" @click="playing === i ? stopPreview() : playSeg(i)">
          <Play v-if="playing !== i" :size="13" /><Square v-else :size="13" />
          {{ playing === i ? '停止' : '试听该段' }}
        </button>
        <button v-if="i < buffers.length - 1" class="btn btn-ghost btn-sm" @click="previewSeam(i + 1)">从此段起预览接缝</button>
      </div>
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

    <AudioExport :produce="produce" :default-name="outName" button-text="合并并生成" :disabled="decoding" />

    <p class="notice notice-info mt-2">
      <Info :size="15" />
      <span>合并以第一段采样率为基准，其余片段线性插值重采样对齐（44.1k+48k 混合无毛刺）；单/多声道混排统一为最多声道数；crossfade 与间隔二选一生效。</span>
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
.seg-table { display: grid; gap: 6px; }
.seg-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
.seg-name { font-size: 13.5px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
