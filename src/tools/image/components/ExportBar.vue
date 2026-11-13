<script setup lang="ts">
/**
 * 图片家族共享导出行：PNG｜JPG｜WebP 格式 chips + 质量（JPG/WebP）+ 实时体积 + 下载。
 * - 格式与质量写入 localStorage（toolhub. 前缀），全家族记忆（UX1.0 F-导出格式 / F-质量实时）。
 * - 质量/格式/源变化（dirtyToken）后防抖 350ms 重编码测量当前体积，拖动滑杆即可看到体积变化。
 * - 父组件通过 produce(mime, quality) 提供编码能力；本组件不持有画布。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

type Fmt = 'png' | 'jpg' | 'webp'
const MIME: Record<Fmt, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const EXT: Record<Fmt, string> = { png: 'png', jpg: 'jpg', webp: 'webp' }
const LS_FORMAT = 'toolhub.imgExportFormat'
const LS_QUALITY = 'toolhub.imgExportQuality'

const props = withDefaults(
  defineProps<{
    /** 编码函数：按目标 mime/quality 返回 Blob（读取父组件当前画布状态） */
    produce: (mime: string, quality: number) => Promise<Blob>
    /** 输出文件名（不含扩展名） */
    baseName: string
    /** 可选格式 chips（默认三种全给） */
    formats?: Fmt[]
    /** 变化令牌：父组件处理结果更新时递增，触发体积重测 */
    dirtyToken?: number | string
    /** 体积实时测量开关（压缩/转格式类核心反馈） */
    liveSize?: boolean
    buttonText?: string
    disabled?: boolean
    disabledHint?: string
  }>(),
  { formats: () => ['png', 'jpg', 'webp'] as Fmt[], dirtyToken: 0, liveSize: true, buttonText: '下载结果', disabled: false, disabledHint: '' },
)

const toast = useToast()
const emit = defineEmits<{ measured: [size: number] }>()
const LABELS: Record<Fmt, string> = { png: 'PNG', jpg: 'JPG', webp: 'WebP' }

function readStoredFormat(): Fmt {
  try {
    const v = localStorage.getItem(LS_FORMAT) as Fmt | null
    if (v && (v === 'png' || v === 'jpg' || v === 'webp') && props.formats.includes(v)) return v
  } catch { /* 隐私模式忽略 */ }
  return props.formats.includes('png') ? 'png' : props.formats[0]!
}
function readStoredQuality(): number {
  try {
    const n = Number(localStorage.getItem(LS_QUALITY))
    if (Number.isFinite(n) && n >= 0.3 && n <= 1) return n
  } catch { /* 隐私模式忽略 */ }
  return 0.9
}

const format = ref<Fmt>(readStoredFormat())
const quality = ref(readStoredQuality())
const encoding = ref(false)
const sizeText = ref('')
const measuring = ref(false)

watch([format, quality], () => {
  try {
    localStorage.setItem(LS_FORMAT, format.value)
    localStorage.setItem(LS_QUALITY, String(quality.value))
  } catch { /* 忽略 */ }
  scheduleMeasure()
})
watch(() => props.dirtyToken, () => scheduleMeasure())

let timer = 0
let seq = 0
/** 防抖 350ms 后重编码测体积（拖动质量滑杆实时看到体积变化，无卡顿） */
function scheduleMeasure() {
  if (!props.liveSize || props.disabled) return
  window.clearTimeout(timer)
  timer = window.setTimeout(measure, 350)
}

async function measure() {
  const my = ++seq
  measuring.value = true
  try {
    const blob = await props.produce(MIME[format.value], quality.value)
    if (my !== seq) return
    sizeText.value = fmtKB(blob.size)
    lastBlob.value = blob
    emit('measured', blob.size)
  } catch {
    if (my === seq) sizeText.value = ''
  } finally {
    if (my === seq) measuring.value = false
  }
}

const lastBlob = ref<Blob | null>(null)

async function download() {
  if (props.disabled) {
    if (props.disabledHint) toast.warn(props.disabledHint)
    return
  }
  encoding.value = true
  try {
    // 优先复用最近一次测量产物，避免重复编码
    const blob = lastBlob.value ?? (await props.produce(MIME[format.value], quality.value))
    saveBlob(blob, `${props.baseName}.${EXT[format.value]}`)
    toast.ok(`已下载 ${props.baseName}.${EXT[format.value]}（${fmtKB(blob.size)}）`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    encoding.value = false
  }
}

function fmtKB(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

onBeforeUnmount(() => window.clearTimeout(timer))
defineExpose({ measure })
</script>

<template>
  <div class="export-bar">
    <div class="chips" role="group" aria-label="导出格式">
      <button
        v-for="f in props.formats"
        :key="f"
        class="chip"
        :class="{ active: format === f }"
        type="button"
        @click="format = f"
      >
        {{ LABELS[f] }}
      </button>
    </div>
    <label v-if="format !== 'png'" class="q">
      <span class="field-label">质量 {{ Math.round(quality * 100) }}%</span>
      <input v-model.number="quality" type="range" min="0.3" max="1" step="0.05" />
    </label>
    <button class="btn btn-primary" type="button" :disabled="encoding" @click="download">
      <Loader2 v-if="encoding" :size="16" class="spin" />
      <Download v-else :size="16" /> {{ props.buttonText }}
    </button>
    <span v-if="sizeText" class="muted small size-info">
      <Loader2 v-if="measuring" :size="12" class="spin" />
      当前约 {{ sizeText }}
    </span>
  </div>
</template>

<style scoped>
.export-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.chips {
  display: flex;
  gap: 6px;
}
.q {
  display: grid;
  gap: 2px;
  min-width: 190px;
}
.size-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
