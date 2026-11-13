<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, renderPageToBlob } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 转图片（pdf-to-jpg / pdf-to-png 复用本组件，默认格式跟随路由 slug）。
 * 支持页范围、逐页进度、DPI 口径标注与体积预估（首页实测 × 页数，标注「估算」）。
 * 引擎 pdfToImages 不带页范围参数（lib 只读），这里组件级逐页渲染。
 */
const toast = useToast()
const route = useRoute()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)

const format = ref<'image/jpeg' | 'image/png'>(
  String(route.params.slug || '').includes('png') ? 'image/png' : 'image/jpeg',
)
const quality = ref(0.9)
const scale = ref(2)
const rangeSpec = ref('')
const busy = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const sampleKB = ref<number | null>(null)

const isJpg = computed(() => format.value === 'image/jpeg')
const pageCount = computed(() => base.value?.pageCount ?? 0)
const targetPages = computed(() =>
  rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, pageCount.value || 1).length : pageCount.value,
)

/** 体积预估：首页实测体积 × 目标页数 */
const estimateMB = computed(() => (sampleKB.value !== null ? (sampleKB.value * targetPages.value) / 1024 : null))
const sizeWarn = computed(() =>
  !isJpg.value && estimateMB.value !== null && estimateMB.value > 300
    ? `预估产物约 ${Math.round(estimateMB.value)} MB，可能导致标签页崩溃，建议降低倍数`
    : '',
)

/* 首页实测（防抖 400ms，随格式/质量/倍数/页范围变化重测） */
let estTimer: number | null = null
const measure = async () => {
  const file = base.value?.files[0]
  if (!file) {
    sampleKB.value = null
    return
  }
  try {
    const blob = await renderPageToBlob(file, 0, { format: format.value, quality: quality.value, scale: scale.value })
    sampleKB.value = blob.size / 1024
  } catch {
    sampleKB.value = null
  }
}
watch([format, quality, scale], () => {
  if (estTimer) window.clearTimeout(estTimer)
  estTimer = window.setTimeout(() => void measure(), 400)
})
watch(() => base.value?.files[0], () => void measure(), { immediate: true })

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const total = pageCount.value
  let indices = parsePageSpec(rangeSpec.value || 'all', total || 1)
  if (rangeSpec.value.trim() && !indices.length) {
    toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（文档共 ${total} 页）`)
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const ext = isJpg.value ? 'jpg' : 'png'
    const out: { name: string; blob: Blob }[] = []
    for (let k = 0; k < indices.length; k++) {
      progressLabel.value = `正在导出第 ${k + 1} / ${indices.length} 页`
      out.push({
        name: `第${indices[k] + 1}页.${ext}`,
        blob: await renderPageToBlob(file, indices[k], { format: format.value, quality: quality.value, scale: scale.value }),
      })
      progress.value = (k + 1) / indices.length
    }
    const srcName = file.name.replace(/\.pdf$/i, '')
    await saveMany(out, `${srcName}-${ext}.zip`)
    toast.ok(`已导出 ${out.length} 张图片`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">图片格式</span>
        <select v-model="format" class="select">
          <option value="image/jpeg">JPG（体积小）</option>
          <option value="image/png">PNG（无损）</option>
        </select>
        <p v-if="!isJpg" class="small muted mt-1">保留页面透明区域（JPG 会铺白底）</p>
      </div>
      <div v-if="isJpg">
        <span class="field-label">JPG 质量：{{ Math.round(quality * 100) }}%</span>
        <input v-model.number="quality" type="range" class="range" min="0.4" max="1" step="0.05" />
      </div>
      <div>
        <span class="field-label">清晰度倍数：{{ scale }}x（约 {{ Math.round(72 * scale) }} DPI）</span>
        <input v-model.number="scale" type="range" class="range" min="1" max="4" step="0.5" />
      </div>
      <div>
        <span class="field-label">页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-3,7" />
      </div>
    </div>

    <p v-if="estimateMB !== null && targetPages" class="small muted mt-2">
      预计导出 {{ targetPages }} 张 · 约 {{ estimateMB >= 1 ? estimateMB.toFixed(1) : Math.max(1, Math.round(estimateMB * 1024)) + ' KB' }} MB（估算：首页实测 × 页数）
    </p>
    <p v-if="sizeWarn" class="notice notice-warn mt-1 small">{{ sizeWarn }}</p>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 导出并打包下载
      </button>
      <span class="small muted">倍数越高越清晰、文件越大；产物名跟随源文件</span>
    </div>

    <div v-if="busy" class="mt-2">
      <p v-if="progressLabel" class="small muted mb-1">{{ progressLabel }}</p>
      <div class="progress">
        <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
