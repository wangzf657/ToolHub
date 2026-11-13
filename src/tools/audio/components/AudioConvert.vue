<script setup lang="ts">
/**
 * 音频格式转换（convert-audio 与 13 个「X 转 Y」入口共用）：
 * WAV / MP3 目标走 WebAudio 快路径（带编码进度与结果卡）；M4A / FLAC / OGG / AAC / OPUS 目标，
 * 或 WMA / OPUS 等浏览器无法解码的源，自动切换到 ffmpeg 兜底（首用显示核心下载进度）。
 * 挂载时按 slug 预设目标格式（如 mp3-to-wav 默认 WAV），避免「转无损页默认出有损」。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download, Info, Loader2 } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import FfAudioBase from './FfAudioBase.vue'
import { encodeWav, encodeMp3 } from '@/lib/audioEngine'
import { getFf } from '@/lib/ffmpeg'
import { saveBlob, baseName } from '@/lib/download'
import { toMono, sizeLabel } from './shared'
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
const slug = String(route.params.slug ?? '')
const presetTarget = SLUG_TARGET[slug]
const MEM_KEY = 'toolhub.convert-audio-prefs'
/** 母工具页记忆用户偏好；X-to-Y 入口页保持语义预设 */
const target = ref<Target>(presetTarget ?? loadMem().target ?? 'mp3')
const kbps = ref(loadMem().kbps ?? 192)
const mono = ref(loadMem().mono ?? false)

function loadMem(): { target?: Target; kbps?: number; mono?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(MEM_KEY) || '{}') as { target?: Target; kbps?: number; mono?: boolean }
  } catch {
    return {}
  }
}
if (!presetTarget) {
  watch([target, kbps, mono], () => {
    try {
      localStorage.setItem(MEM_KEY, JSON.stringify({ target: target.value, kbps: kbps.value, mono: mono.value }))
    } catch {
      /* 隐私模式忽略 */
    }
  })
}

/** 有损目标标准码率档位（64~320） */
const RATE_STEPS = [320, 256, 192, 128, 96, 64]

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const ffBase = ref<InstanceType<typeof FfAudioBase> | null>(null)
const lastFile = ref<File | null>(null)
const running = ref(false)
const encProgress = ref(0)
const toast = useToast()

/* ---------- 结果卡：试听 + 体积对比 + 输出规格（不点下载不落盘） ---------- */
const result = ref<{ url: string; blob: Blob; name: string; srcSize: number } | null>(null)
const outSpec = ref('')
onBeforeUnmount(() => {
  if (result.value) URL.revokeObjectURL(result.value.url)
})

const showResult = (blob: Blob, name: string) => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = { url: URL.createObjectURL(blob), blob, name, srcSize: lastFile.value?.size ?? 0 }
  const b = base.value
  if (b?.meta) outSpec.value = `输出 ${(b.meta.sampleRate / 1000).toFixed(1)} kHz · ${b.meta.channels === 1 ? '单声道' : '立体声'} · 16 bit`
  toast.ok('转换完成，请试听并在结果卡下载')
}

const srcExt = computed(() => {
  const n = lastFile.value?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
})
/** 浏览器 AudioContext 解不了的源格式，强制走 ffmpeg（ogg/opus 容器 Chrome 可直接解码，走快路径） */
const srcNeedsFf = computed(() => /^(wma|amr|ac3|ape|mka|aif|aiff|wv|tta|silk)$/.test(srcExt.value))
const targetNeedsFf = computed(() => /^(m4a|flac|ogg|aac|opus)$/.test(target.value))
const useFf = computed(() => targetNeedsFf.value || srcNeedsFf.value)

/** 微信语音 SILK 格式探测：ffmpeg 标准核心不支持，给诚实指引而非失败堆栈 */
const silkDetected = ref(false)
function sniffSilk(f: File) {
  silkDetected.value = false
  if (!/^(silk|slk|opus)$/.test(srcExt.value)) return
  const reader = new FileReader()
  reader.onload = () => {
    const head = new TextDecoder().decode(new Uint8Array((reader.result as ArrayBuffer).slice(0, 16)))
    if (head.startsWith('#!SILK') || head.includes('SILK')) {
      silkDetected.value = true
      toast.warn('检测到微信 SILK 语音格式：浏览器与 ffmpeg 标准核心都无法解码，请先用微信客户端「收藏→转存」或 silk-v3-decoder 类工具转成 MP3/AMR 再处理')
    }
  }
  reader.readAsArrayBuffer(f.slice(0, 16))
}

/** 底座切换时把已选文件带到新底座，避免重新选择 */
watch(useFf, async (ff) => {
  const f = lastFile.value
  if (!f) return
  await nextTick()
  if (ff) ffBase.value?.loadFile(f)
  else void base.value?.loadFile(f)
})

function onLoaded(_buf: unknown, f: File) {
  lastFile.value = f
  silkDetected.value = false
}
function onClear() {
  lastFile.value = null
  silkDetected.value = false
}
function onFfFile(f: File) {
  lastFile.value = f
  sniffSilk(f)
}
function onFfClear() {
  lastFile.value = null
}

/* ---------- WebAudio 快路径（WAV / MP3 目标）：带 MP3 编码进度 ---------- */

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  encProgress.value = 0
  try {
    const src = mono.value ? toMono(b.buffer) : b.buffer
    const blob = target.value === 'mp3' ? await encodeMp3(src, kbps.value, (p) => (encProgress.value = p)) : encodeWav(src)
    showResult(blob, `${baseName(b.file.name)}-converted.${target.value}`)
    return blob
  } finally {
    b.setBusy(false)
  }
}

/** WAV 输出体积预估（>50MB 提前预警） */
const wavEstimate = computed(() => {
  const b = base.value
  if (!b?.meta) return 0
  const ch = mono.value ? 1 : b.meta.channels
  return Math.round(b.meta.duration * b.meta.sampleRate * ch * 2)
})

const outName = computed(() => `${baseName(lastFile.value?.name ?? 'audio')}-converted.${target.value}`)

/* ---------- ffmpeg 兜底路径：首用显示核心下载进度，失败给分型诊断 ---------- */

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
const dlLoaded = ref(0)
const dlTotal = ref(0)
const preloading = ref(false)

async function preloadCore() {
  preloading.value = true
  dlLoaded.value = 0
  dlTotal.value = 0
  try {
    const res = await fetch(`${CORE_BASE}/ffmpeg-core.wasm`)
    const total = Number(res.headers.get('content-length')) || 0
    dlTotal.value = total
    if (res.body && total > 0) {
      const reader = res.body.getReader()
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value?.length ?? 0
        dlLoaded.value = received
      }
    } else await res.arrayBuffer()
  } catch {
    /* 预取失败不拦流程，getFf 自会下载 */
  } finally {
    preloading.value = false
  }
  await getFf()
}

async function runFf() {
  const fb = ffBase.value
  if (!fb?.file) return
  running.value = true
  try {
    await preloadCore()
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
        args.push('-c:a', 'libmp3lame', '-b:a', `${kbps.value}k`, '-id3v2_version', '3')
      } else {
        args.push('-c:a', 'pcm_s16le')
      }
      args.push(o)
      return args
    }, target.value)
    showResult(blob, `${baseName(fb.file.name)}-converted.${target.value}`)
  } catch (e) {
    const msg = (e as Error).message || ''
    // 分型诊断：优先指出最常见的不兼容原因，而非裸抛 ffmpeg 输出
    if (/Invalid data|moov|muxing/i.test(msg)) toast.err('解码失败：文件数据不完整或容器损坏，可用「视频格式转换」先修复容器再试')
    else if (/Unknown format|Unsupported/i.test(msg)) toast.err('暂不支持该编码：浏览器与 ffmpeg 引擎都无法识别此格式')
    else toast.err(msg || 'ffmpeg 转换失败，请换目标格式重试')
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
        <span v-if="t.value === presetTarget" class="preset-tag">本页预设</span>
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
        <template v-if="target === 'mp3'">
          <span class="field-label">MP3 码率</span>
          <button v-for="r in RATE_STEPS" :key="r" class="chip" :class="{ active: kbps === r }" @click="kbps = r">{{ r }}k</button>
        </template>
        <label class="check"><input v-model="mono" type="checkbox" /> 混为单声道（信息量减半，同码率中频更集中；体积变化取决于编码器）</label>
        <span v-if="target === 'wav' && wavEstimate > 50 * 1024 * 1024" class="warn-line">预计 WAV 输出 ≈ {{ sizeLabel(wavEstimate) }}，体积较大；如需小体积建议改用 M4A</span>
        <span v-if="target === 'wav' && (base?.file?.size ?? 0) > 100 * 1024 * 1024" class="warn-line">源文件超过 100MB：解码大文件可能占用大量内存，建议先转 M4A</span>
        <span v-if="targetNeedsFf && lastFile" class="warn-line-soft">预计输出 ≈ {{ sizeLabel(((target === 'flac' ? 900 : kbps) * 1000 * (base?.meta?.duration ?? 0)) / 8) }}</span>
      </div>

      <div v-if="running || encProgress > 0" class="prog mt-2">
        <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, Math.round(encProgress * 100))}%` }"></div></div>
        <span class="muted small">{{ target === 'mp3' ? `MP3 编码中 ${Math.round(encProgress * 100)}%` : '转换中…' }}</span>
      </div>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="running || !base?.buffer" @click="produce">
          <Loader2 v-if="running" :size="16" class="spin" />
          <Download v-else :size="16" />
          开始转换
        </button>
      </div>
    </AudioToolBase>

    <FfAudioBase v-else ref="ffBase" class="mt-2" @file="onFfFile" @clear="onFfClear">
      <div class="row row-wrap mt-2">
        <template v-if="target !== 'flac'">
          <span class="field-label">码率</span>
          <button v-for="r in RATE_STEPS" :key="r" class="chip" :class="{ active: kbps === r }" @click="kbps = r">{{ r }}k</button>
        </template>
        <label class="check"><input v-model="mono" type="checkbox" /> 混为单声道（-ac 1，信息量减半）</label>
      </div>
      <p v-if="silkDetected" class="warn-line mt-1">⚠ 微信 SILK 格式无法被本工具解码：请先转换为 MP3/AMR 等通用格式（见上方提示）</p>
      <div v-if="preloading" class="dl-card mt-1">
        <span>正在加载编解码核心（约 25MB）…</span>
        <div class="prog-track"><div class="prog-fill" :style="{ width: dlTotal ? `${Math.max(2, Math.round((dlLoaded / dlTotal) * 100))}%` : '40%' }"></div></div>
        <span class="muted small">{{ dlTotal ? `已下载 ${sizeLabel(dlLoaded)} / ${sizeLabel(dlTotal)}` : '准备下载…' }}</span>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="running" @click="runFf">
          <Loader2 v-if="running" :size="16" class="spin" />
          <Download v-else :size="16" />
          开始转换
        </button>
      </div>
    </FfAudioBase>

    <div v-if="result" class="result-card mt-2">
      <p class="rc-title">转换结果</p>
      <audio :src="result.url" controls class="rc-audio"></audio>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">源 {{ sizeLabel(result.srcSize) }} → 输出 {{ sizeLabel(result.blob.size) }}</span>
        <span v-if="outSpec" class="muted small">{{ outSpec }}</span>
        <a class="btn btn-primary btn-sm" :href="result.url" :download="result.name"><Download :size="14" /> 下载 {{ target.toUpperCase() }}</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preset-tag {
  font-size: 10px;
  color: var(--accent-text);
  margin-left: 4px;
}
.warn-line {
  font-size: 12.5px;
  color: #d97706;
}
.warn-line-soft {
  font-size: 12.5px;
  color: var(--text-3);
}
.prog { display: grid; gap: 5px; max-width: 560px; }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.dl-card { display: grid; gap: 6px; max-width: 560px; font-size: 13px; color: var(--text-2); }
.result-card { max-width: 620px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.rc-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.rc-audio { width: 100%; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
