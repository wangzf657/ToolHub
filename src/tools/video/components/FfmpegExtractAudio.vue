<script setup lang="ts">
/**
 * 提取视频音轨：mp3 / m4a / wav；4 个注册 slug 复用本组件。
 * MP4/MOV/WebM 源优先走浏览器解码快路径（无需 30MB 核心），失败回落 ffmpeg；
 * WAV/MP3 结果内嵌试听播放器，点下载才落盘。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Download, Loader2 } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { decodeAudio, encodeWav, encodeMp3 } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const format = ref('mp3')
const rate = ref(0) // 0 = VBR q3（默认），>0 = CBR kbps
const bitDepth = ref<'16' | '24' | '32f'>('16')

const slug = (route.params.slug as string) ?? ''
const PRESETS: Record<string, string> = { 'mp4-to-mp3': 'mp3', 'mov-to-mp3': 'mp3', 'mp4-to-wav': 'wav' }
if (PRESETS[slug]) format.value = PRESETS[slug]

const srcExt = computed(() => {
  const n = base.value?.files[0]?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
})
const dur = computed(() => base.value?.meta?.duration ?? 0)
/** WAV 输出体积估算（按 44.1kHz 双声道 16bit 口径） */
const wavEstimate = computed(() => {
  if (format.value !== 'wav' || !(dur.value > 0)) return 0
  return Math.round(dur.value * 44100 * 2 * 2)
})
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/* ---------- 结果卡：试听 + 下载（不点下载不落盘） ---------- */
const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')
const fastUsed = ref(false)
const encProgress = ref(0)
const running = ref(false)
onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

/** 快路径：浏览器能解码该容器音轨时直接 WebAudio 编码（无需 ffmpeg 核心） */
const tryFastPath = async (f: File): Promise<Blob | null> => {
  if (!['mp4', 'mov', 'webm', 'm4a', 'mkv'].includes(srcExt.value)) return null
  if (format.value === 'wav' && bitDepth.value !== '16') return null // 特殊位深必须走 ffmpeg
  try {
    const buf = await decodeAudio(f)
    if (format.value === 'mp3') {
      encProgress.value = 0
      return rate.value > 0 ? await encodeMp3(buf, rate.value, (p) => (encProgress.value = p)) : await encodeMp3(buf, 192, (p) => (encProgress.value = p))
    }
    if (format.value === 'wav') return encodeWav(buf)
    return null
  } catch {
    return null // 音轨解不开 → 回落 ffmpeg（音频侧门禁：视频轨不支持不影响提取）
  }
}

const run = async () => {
  const b = base.value
  if (!b || !b.files.length) return
  running.value = true
  const f = b.files[0]!
  const out = format.value
  const name = `${baseName(f.name)}.${out}`
  try {
    const fast = await tryFastPath(f)
    if (fast) {
      fastUsed.value = true
      if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
      resultUrl.value = URL.createObjectURL(fast)
      resultSize.value = fast.size
      resultName.value = name
      toast.ok('提取完成，请在结果区试听并下载')
      return
    }
    fastUsed.value = false
    // ffmpeg 兜底
    const extra: string[] =
      out === 'mp3'
        ? rate.value > 0
          ? ['-c:a', 'libmp3lame', '-b:a', `${rate.value}k`]
          : ['-c:a', 'libmp3lame', '-q:a', '3']
        : out === 'wav'
          ? ['-c:a', `pcm_s${bitDepth.value === '32f' ? 'f32le' : bitDepth.value === '24' ? '24le' : '16le'}`]
          : ['-c:a', 'aac', '-b:a', '192k']
    b.outputName = name
    await b.runWithFf(['-y', '-i', 'input', '-vn', ...extra, name], {
      status: '正在提取音频…',
      onDone: (results) => {
        const [, data] = results.entries().next().value as [string, Uint8Array]
        if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
        const blob = new Blob([data as BlobPart], { type: 'audio/mpeg' })
        resultUrl.value = URL.createObjectURL(blob)
        resultSize.value = blob.size
        resultName.value = name
        toast.ok('提取完成，请在结果区试听并下载')
      },
    })
  } finally {
    running.value = false
  }
}
</script>

<template>
  <FfBase ref="base" :output-ext="format" button-text="提取音频" @run="run">
    <div v-if="base?.files.length && !base?.meta" class="notice notice-warn mt-2">无法预览该视频（可能为 HEVC 编码），仍可尝试提取音频。</div>
    <div class="opts">
      <div class="opt">
        <span class="field-label">音频格式</span>
        <select v-model="format" class="select" style="width: 180px">
          <option value="mp3">MP3（通用，压缩）</option>
          <option value="m4a">M4A / AAC（体积小）</option>
          <option value="wav">WAV（无损，体积大）</option>
        </select>
      </div>
      <div v-if="format === 'mp3'" class="opt">
        <span class="field-label">码率</span>
        <select v-model.number="rate" class="select" style="width: 170px">
          <option :value="0">VBR q3（默认，约 175kbps）</option>
          <option :value="320">320k</option>
          <option :value="192">192k</option>
          <option :value="128">128k</option>
          <option :value="64">64k</option>
        </select>
      </div>
      <div v-if="format === 'wav'" class="opt">
        <span class="field-label">位深</span>
        <select v-model="bitDepth" class="select" style="width: 130px">
          <option value="16">16 bit（兼容最好）</option>
          <option value="24">24 bit</option>
          <option value="32f">32 bit 浮点</option>
        </select>
      </div>
    </div>
    <p v-if="wavEstimate > 0" class="ext-note" :class="{ warn: wavEstimate > 300 * 1024 * 1024 }">
      预计 WAV 输出 ≈ {{ fmtSize(wavEstimate) }}{{ wavEstimate > 300 * 1024 * 1024 ? '，体积较大，如只需通用聆听建议改用 MP3/M4A' : '' }}
    </p>
    <p class="ext-note">
      MP4 / MOV / WebM 等常见容器会优先走浏览器内置解码（无需下载 30MB 核心、约数秒完成）；音轨较特殊时自动回落 ffmpeg。
      MP3 默认 VBR 质量 3，WAV 适合剪辑与语音识别。
    </p>

    <div v-if="running && encProgress > 0" class="prog mt-2">
      <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, Math.round(encProgress * 100))}%` }"></div></div>
      <span class="muted small">MP3 编码中 {{ Math.round(encProgress * 100) }}%</span>
    </div>
    <div v-if="running && !encProgress" class="muted small mt-1"><Loader2 :size="13" class="spin inline" /> 处理中…</div>

    <FfExpectHint text="浏览器解码快路径约数秒完成；ffmpeg 兜底约为视频时长的 1/5~1/10（仅音频编码），首次使用需加载约 30MB 编解码核心。处理期间请保持页面打开。" />

    <div v-if="resultUrl" class="result-card mt-2">
      <p class="rc-title">提取结果<template v-if="fastUsed">（浏览器快路径）</template></p>
      <audio :src="resultUrl" controls class="rc-audio"></audio>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">源 {{ fmtSize(base?.files[0]?.size ?? 0) }} → 输出 {{ fmtSize(resultSize) }}</span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="resultName"><Download :size="14" /> 下载 {{ format.toUpperCase() }}</a>
      </div>
    </div>
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.opt {
  display: grid;
  gap: 4px;
}
.ext-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
}
.ext-note.warn {
  color: #d97706;
}
.prog { display: grid; gap: 5px; max-width: 560px; }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.inline { vertical-align: -2px; }
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.rc-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.rc-audio { width: 100%; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
