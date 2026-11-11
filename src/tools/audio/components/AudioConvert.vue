<script setup lang="ts">
/**
 * 音频格式转换（convert-audio 与 13 个「X 转 Y」入口共用）：
 * WAV / MP3 目标走 WebAudio 快路径；M4A / FLAC / OGG / AAC / OPUS 目标，或
 * WMA / OPUS 等浏览器无法解码的源，自动切换到 ffmpeg 兜底。
 * 挂载时按 slug 预设目标格式（如 mp3-to-wav 默认 WAV），避免「转无损页默认出有损」。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download, Info, Loader2 } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import FfAudioBase from './FfAudioBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeWav, encodeMp3 } from '@/lib/audioEngine'
import { saveBlob, baseName } from '@/lib/download'
import { toMono } from './shared'
import { useToast } from '@/composables/useToast'

type Target = 'mp3' | 'wav' | 'm4a' | 'flac' | 'ogg' | 'aac' | 'opus'
const targets: { value: Target; label: string }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'm4a', label: 'M4A · ffmpeg' },
  { value: 'flac', label: 'FLAC · ffmpeg' },
  { value: 'ogg', label: 'OGG · ffmpeg' },
  { value: 'aac', label: 'AAC · ffmpeg' },
  { value: 'opus', label: 'OPUS · ffmpeg' },
]

const route = useRoute()
/** slug → 默认目标：X-to-Y 入口页语义即目标格式，不能让「转 WAV 页」默认出 MP3 */
const SLUG_TARGET: Record<string, Target> = {
  'wav-to-mp3': 'mp3',
  'mp3-to-wav': 'wav',
  'flac-to-mp3': 'mp3',
  'flac-to-wav': 'wav',
  'm4a-to-mp3': 'mp3',
  'm4a-to-wav': 'wav',
  'ogg-to-mp3': 'mp3',
  'aac-to-mp3': 'mp3',
  'mp3-to-m4a': 'm4a',
  'wav-to-m4a': 'm4a',
  'wav-to-flac': 'flac',
  'opus-to-mp3': 'mp3',
  'wma-to-mp3': 'mp3',
}
const target = ref<Target>(SLUG_TARGET[String(route.params.slug ?? '')] ?? 'mp3')
const kbps = ref(192)
const mono = ref(false)

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const ffBase = ref<InstanceType<typeof FfAudioBase> | null>(null)
const lastFile = ref<File | null>(null)
const running = ref(false)
const toast = useToast()

const srcExt = computed(() => {
  const n = lastFile.value?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
})
/** 浏览器 AudioContext 解不了的源格式，强制走 ffmpeg */
const srcNeedsFf = computed(() => /^(wma|opus|amr|ac3|ape|mka|aif|aiff|wv|tta)$/.test(srcExt.value))
const targetNeedsFf = computed(() => /^(m4a|flac|ogg|aac|opus)$/.test(target.value))
const useFf = computed(() => targetNeedsFf.value || srcNeedsFf.value)

/** 底座切换时把已选文件带到新底座，避免重新选择 */
watch(useFf, async (ff) => {
  const f = lastFile.value
  if (!f) return
  await nextTick()
  if (ff) ffBase.value?.loadFile(f)
  else void base.value?.loadFile(f)
})

function onLoaded(_buf: AudioBuffer, f: File) {
  lastFile.value = f
}
function onClear() {
  lastFile.value = null
}
function onFfFile(f: File) {
  lastFile.value = f
}
function onFfClear() {
  lastFile.value = null
}

/* ---------- WebAudio 快路径（WAV / MP3 目标） ---------- */

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const src = mono.value ? toMono(b.buffer) : b.buffer
    return target.value === 'mp3' ? await encodeMp3(src, kbps.value) : encodeWav(src)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(lastFile.value?.name ?? 'audio')}-converted.${target.value}`)

/* ---------- ffmpeg 兜底路径（M4A / FLAC / OGG / AAC / OPUS，及无法解码的源） ---------- */

async function runFf() {
  const fb = ffBase.value
  if (!fb?.file) return
  running.value = true
  try {
    const blob = await fb.run((i, o) => {
      const args: string[] = ['-i', i, '-vn']
      if (mono.value) args.push('-ac', '1')
      if (target.value === 'm4a' || target.value === 'aac') {
        args.push('-c:a', 'aac', '-b:a', `${kbps.value}k`)
      } else if (target.value === 'flac') {
        args.push('-c:a', 'flac')
      } else if (target.value === 'ogg') {
        args.push('-c:a', 'libvorbis', '-b:a', `${kbps.value}k`)
      } else if (target.value === 'opus') {
        args.push('-c:a', 'libopus', '-b:a', `${Math.max(24, Math.min(320, kbps.value))}k`)
      } else if (target.value === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', `${kbps.value}k`)
      } else {
        args.push('-c:a', 'pcm_s16le')
      }
      args.push(o)
      return args
    }, target.value)
    if (fb.file) saveBlob(blob, `${baseName(fb.file.name)}-converted.${target.value}`)
  } catch (e) {
    toast.err((e as Error).message || 'ffmpeg 转换失败')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap">
      <button v-for="t in targets" :key="t.value" class="chip" :class="{ active: target === t.value }" @click="target = t.value">
        {{ t.label }}
      </button>
    </div>
    <div class="notice notice-info mt-1">
      <Info :size="15" />
      <span>
        WAV / MP3 目标解码后即时完成；M4A / FLAC / OGG / AAC / OPUS 目标自动改用 ffmpeg 引擎（首次约 25MB）。
        WMA、OPUS 等浏览器解不了的源文件，选 MP3 / WAV 目标时同样会自动走 ffmpeg。
        已按当前工具预设目标格式，也可点击上方按钮切换。
      </span>
    </div>

    <AudioToolBase v-if="!useFf" ref="base" class="mt-2" @loaded="onLoaded" @clear="onClear">
      <div class="row row-wrap mt-2">
        <label v-if="target === 'mp3'" class="opt grow">
          <span class="field-label">MP3 码率 {{ kbps }} kbps</span>
          <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
        </label>
        <label class="check"><input v-model="mono" type="checkbox" /> 混为单声道（体积约减半）</label>
      </div>
      <DownloadButton :produce="produce" :default-name="outName" button-text="转换并下载" />
    </AudioToolBase>

    <FfAudioBase v-else ref="ffBase" class="mt-2" @file="onFfFile" @clear="onFfClear">
      <div class="row row-wrap mt-2">
        <label v-if="target !== 'flac'" class="opt grow">
          <span class="field-label">码率 {{ kbps }} kbps</span>
          <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
        </label>
        <label class="check"><input v-model="mono" type="checkbox" /> 混为单声道（-ac 1）</label>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="running" @click="runFf">
          <Loader2 v-if="running" :size="16" class="spin" />
          <Download v-else :size="16" />
          开始转换并下载
        </button>
      </div>
    </FfAudioBase>
  </div>
</template>

<style scoped>
.opt {
  min-width: 180px;
  max-width: 380px;
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
