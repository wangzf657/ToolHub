<script setup lang="ts">
/**
 * 视频工具通用底座：导入视频 → 预览/元信息 → 输出名 → 选项插槽 → 统一执行与进度。
 * runWithFf 封装 getFf + ffRun + saveBlob + 错误处理与进度条。
 */
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Clapperboard, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo, type VideoMeta } from '@/lib/videoEngine'
import { getFf, ffRun, mimeFor } from '@/lib/ffmpeg'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { baseName, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

export interface FfFile {
  name: string
  data: File | Blob | Uint8Array | string
}
export interface FfRunOpts {
  /** 覆盖默认输入文件（默认 [{name:'input', data:当前文件}]） */
  files?: FfFile[]
  /** 附加写入虚拟 FS 的文件（字幕/list.txt 等，执行后自动清理） */
  extraFiles?: FfFile[]
  /** 状态文案 */
  status?: string
  /** 自定义结果处理（默认取第一个输出直接下载） */
  onDone?: (results: Map<string, Uint8Array>) => Promise<void> | void
}

const props = withDefaults(
  defineProps<{
    /** 输出扩展名（默认跟随源文件扩展名） */
    outputExt?: string
    multiple?: boolean
    maxFiles?: number
    buttonText?: string
  }>(),
  { multiple: false, maxFiles: 20, buttonText: '开始处理' },
)

const emit = defineEmits<{ run: []; time: [t: number] }>()

const toast = useToast()
const files = ref<File[]>([])
const meta = shallowRef<VideoMeta | null>(null)
/** 浏览器解不出预览（编码不支持）时不再挡门：仍允许走 ffmpeg 处理 */
const previewFailed = ref(false)
const outputName = ref('')
const busy = ref(false)
const status = ref('')
const progress = ref(0)
const loadingFf = ref(false)
const ffReady = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)

const file = () => files.value[0]

watch(files, async (list) => {
  if (meta.value) {
    URL.revokeObjectURL(meta.value.url)
    meta.value = null
  }
  previewFailed.value = false
  const f = list[0]
  if (!f) return
  const ext = props.outputExt ?? (f.name.includes('.') ? f.name.split('.').pop()! : 'mp4')
  outputName.value = `${baseName(f.name)}.${ext}`
  try {
    meta.value = await loadVideo(f)
  } catch (e) {
    // 浏览器预览不了 ≠ 处理不了：ffmpeg 支持的编码远多于 <video>，
    // 放行执行流程并明示「预览不可用」，避免「导入了却哪儿都点不了」
    previewFailed.value = true
    toast.warn('浏览器无法预览该编码，仍可使用下方 ffmpeg 流程处理')
  }
})

const onTime = () => {
  if (videoEl.value) emit('time', videoEl.value.currentTime)
}

const setBusy = (b: boolean, text?: string) => {
  busy.value = b
  if (text) status.value = text
  if (!b) progress.value = 0
}

const fmtDur = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

async function toBytes(d: File | Blob | Uint8Array | string): Promise<Uint8Array | File | Blob> {
  if (typeof d === 'string') return new TextEncoder().encode(d)
  return d
}

/** 统一执行入口：加载核心 → 写文件 → 运行 → 下载/回调 */
async function runWithFf(args: string[], opts: FfRunOpts = {}) {
  const f = file()
  if (!f) {
    toast.warn('请先导入视频文件')
    return null
  }
  let ff: FFmpeg
  const t = window.setTimeout(() => (loadingFf.value = true), 200)
  setBusy(true, '加载编解码核心…')
  try {
    ff = await getFf()
    ffReady.value = true
  } catch {
    toast.err('编解码核心加载失败，请检查网络后重试')
    setBusy(false)
    return null
  } finally {
    clearTimeout(t)
    loadingFf.value = false
  }
  const inputFiles = opts.files ?? [{ name: 'input', data: f }]
  const payload = await Promise.all(
    [...inputFiles, ...(opts.extraFiles ?? [])].map(async (x) => ({ name: x.name, data: await toBytes(x.data) })),
  )
  try {
    setBusy(true, opts.status ?? '处理中…')
    const results = await ffRun(ff, args, payload, (r) => (progress.value = r))
    for (const x of opts.extraFiles ?? []) {
      try {
        await ff.deleteFile(x.name)
      } catch {
        /* 忽略 */
      }
    }
    if (results.size === 0) {
      throw new Error('未生成输出文件，请检查参数，或先用「视频格式转换」处理后再试')
    }
    if (opts.onDone) {
      await opts.onDone(results)
    } else {
      const [out, data] = results.entries().next().value as [string, Uint8Array]
      const ext = out.includes('.') ? out.split('.').pop()! : 'mp4'
      saveBlob(new Blob([data as BlobPart], { type: mimeFor(ext) }), out)
      toast.ok('处理完成，已开始下载')
    }
    return results
  } catch (e) {
    toast.err((e as Error).message || '处理失败，请调整参数后重试')
    return null
  } finally {
    setBusy(false)
  }
}

onBeforeUnmount(() => {
  if (meta.value) URL.revokeObjectURL(meta.value.url)
})

defineExpose({ file, files, meta, outputName, videoEl, ffReady, setBusy, runWithFf })
</script>

<template>
  <div class="ff-base">
    <FileDrop
      :accept="'video/*'"
      :multiple="multiple"
      :max-files="maxFiles"
      label="拖放视频到此处，或点击选择"
      hint="在你的设备上处理 —— 从不上传"
      @files="files = $event"
    />

    <template v-if="(meta || previewFailed) && files.length">
      <div v-if="meta" class="preview-wrap mt-2">
        <video ref="videoEl" :src="meta.url" controls class="preview" @timeupdate="onTime"></video>
        <div class="meta-bar">
          <span>{{ meta.width }}×{{ meta.height }}</span>
          <span>时长 {{ fmtDur(meta.duration) }}</span>
          <span>{{ fmtSize(files[0].size) }}</span>
        </div>
      </div>
      <div v-else class="notice notice-warn mt-2">
        预览不可用（浏览器不支持该编码），但 ffmpeg 仍可处理——直接设置参数并执行即可。
      </div>

      <div v-if="files.length === 1" class="out-row mt-2">
        <span class="field-label" style="margin: 0">输出文件名</span>
        <input v-model="outputName" type="text" class="input" style="max-width: 320px" />
      </div>

      <slot></slot>

      <div v-if="loadingFf" class="notice notice-info mt-2">
        <Loader2 :size="16" class="spin" />
        首次使用需加载编解码核心（约 25MB），完成后可离线使用…
      </div>

      <div v-if="busy" class="prog-wrap mt-2">
        <div class="prog-head">
          <span>{{ status }}</span>
          <span>{{ Math.round(progress * 100) }}%</span>
        </div>
        <div class="prog-track">
          <div class="prog-fill" :style="{ width: `${Math.max(2, Math.round(progress * 100))}%` }"></div>
        </div>
      </div>

      <div class="row row-wrap mt-2" style="align-items: center">
        <button class="btn btn-primary" :disabled="busy || !files.length" @click="$emit('run')">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <Clapperboard v-else :size="16" />
          {{ buttonText }}
        </button>
        <span v-if="!ffReady" class="ff-hint">首次使用需加载编解码核心（约 25MB），完成后可离线</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.preview-wrap {
  max-width: 560px;
}
.preview {
  width: 100%;
  max-height: 340px;
  border-radius: 12px;
  background: #000;
  display: block;
}
.meta-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-3);
  padding: 8px 2px 0;
}
.out-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ff-hint {
  font-size: 12.5px;
  color: var(--text-3);
}
.prog-wrap {
  display: grid;
  gap: 6px;
  max-width: 560px;
}
.prog-head {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--text-2);
}
.prog-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  overflow: hidden;
  border: 1px solid var(--border);
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #7c74f2);
  border-radius: 999px;
  transition: width 0.2s ease;
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
