<script setup lang="ts">
/**
 * 图片工具基础组件（本目录共享）：
 * 单图载入（FileDrop）→ decodeToCanvas 解码 → 预览容器（canvas 直接插入）→
 * 子组件通过 setOutput 更新渲染结果 → 统一下载（canvasToBlob + saveBlob）/ 换一张重置。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Download, RotateCcw, Loader2 } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob, MIME_EXT } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const props = withDefaults(
  defineProps<{
    accept?: string
    label?: string
    hint?: string
    /** 下载 MIME（默认 PNG） */
    mime?: string
    /** JPG/WebP 下载质量 */
    quality?: number
    /** 输出文件名后缀 */
    suffix?: string
    /** 下载按钮文案 */
    buttonText?: string
    /** 是否显示下载 / 换一张按钮 */
    downloadable?: boolean
    /** 自定义产出 Blob（如 ICO 编码）；缺省用 canvasToBlob(mime, quality) */
    produceBlob?: () => Promise<Blob>
  }>(),
  {
    accept: 'image/*',
    mime: 'image/png',
    quality: 0.92,
    suffix: '-edited',
    buttonText: '下载结果',
    downloadable: true,
  },
)

const emit = defineEmits<{ loaded: [canvas: HTMLCanvasElement]; clear: [] }>()
const toast = useToast()
const loading = ref(false)
const file = ref<File | null>(null)
const source = shallowRef<HTMLCanvasElement | null>(null)
const output = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const shown = computed(() => output.value ?? source.value)

/** 把当前要显示的画布挂到预览容器（flush:post 保证容器已渲染） */
let mounted: HTMLCanvasElement | null = null
watch(
  shown,
  (c) => {
    if (mounted) {
      mounted.remove()
      mounted = null
    }
    if (c && stage.value) {
      c.style.maxWidth = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      c.style.margin = '0 auto'
      stage.value.appendChild(c)
      mounted = c
    }
  },
  { flush: 'post' },
)

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  loading.value = true
  try {
    const c = await decodeToCanvas(files[0])
    source.value = c
    output.value = null
    file.value = files[0]
    emit('loaded', c)
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
    resetAll()
  } finally {
    loading.value = false
  }
}

/** 子组件设置渲染结果画布（传 null 恢复显示原图） */
function setOutput(c: HTMLCanvasElement | null) {
  output.value = c
}

const dims = computed(() => {
  const c = shown.value
  return c ? `${c.width} × ${c.height} px` : ''
})

async function download() {
  const c = output.value ?? source.value
  if (!c) return
  try {
    const blob = props.produceBlob ? await props.produceBlob() : await canvasToBlob(c, props.mime, props.quality)
    const ext = MIME_EXT[props.mime] ?? 'png'
    const base = file.value ? baseName(file.value.name) : 'image'
    saveBlob(blob, `${base}${props.suffix}.${ext}`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  }
}

function resetAll() {
  source.value = null
  output.value = null
  file.value = null
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  emit('clear')
}

defineExpose({ source, output, file, setOutput, download, reset: resetAll })
</script>

<template>
  <div>
    <FileDrop
      v-if="!source && !loading"
      :accept="accept"
      :multiple="false"
      :label="label ?? '拖放图片到此处，或点击选择'"
      :hint="hint ?? '支持 PNG / JPG / WebP / GIF / AVIF / BMP / HEIC / TIFF · 全部本地处理'"
      @files="onFiles"
    />
    <div v-else>
      <div v-if="loading" class="bt-loading"><Loader2 :size="18" class="spin" /> 正在解码图片…</div>
      <div v-show="shown" ref="stage" class="bt-stage"></div>
      <slot />
      <div v-if="!loading" class="row row-wrap mt-2">
        <button v-if="downloadable" class="btn btn-primary" :disabled="!shown" @click="download">
          <Download :size="16" /> {{ buttonText }}
        </button>
        <button class="btn btn-ghost" @click="resetAll">
          <RotateCcw :size="15" /> 换一张
        </button>
        <span v-if="dims && downloadable" class="muted small">{{ dims }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bt-stage {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px,
    color-mix(in srgb, var(--panel-solid) 60%, transparent);
  overflow: hidden;
}
.bt-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0;
  color: var(--text-2);
  font-size: 14px;
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
