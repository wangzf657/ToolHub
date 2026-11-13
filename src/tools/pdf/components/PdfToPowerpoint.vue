<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, renderPageToBlob } from '@/lib/pdfEngine'
import { imagesToPptx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 PPT：每页一张幻灯片图片（标准/高清两档，支持页范围与体积预警） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const quality = ref<'std' | 'hd'>('std')
const rangeSpec = ref('')

const pageCount = computed(() => base.value?.pageCount ?? 0)
const targetPages = computed(() => (rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, pageCount.value || 1).length : pageCount.value))

/** 体积预警：按 页数 × 渲染档 × 格式粗估（经验系数：JPEG85 约 220KB/MP，PNG 约 1.1MB/MP） */
const sizeWarn = computed(() => {
  const n = targetPages.value
  if (!n) return ''
  const mpp = quality.value === 'hd' ? 4 : 2.25 // 2x=4MP、1.5x≈2.25MP（16:9 满版）
  const estMB = n * (quality.value === 'hd' ? mpp * 1.1 : mpp * 0.22)
  return estMB > 50 ? `预估产物约 ${Math.round(estMB)} MB（${n} 页 × ${quality.value === 'hd' ? '高清 2x PNG' : '标准 1.5x JPEG'}），超过 50MB，生成耗时与内存占用较大，建议用标准档或缩小页范围` : ''
})

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const total = pageCount.value
  if (rangeSpec.value.trim()) {
    const idx = parsePageSpec(rangeSpec.value, total || 1)
    if (!idx.length) {
      toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（文档共 ${total} 页）`)
      return
    }
  }
  busy.value = true
  progress.value = 0
  try {
    stage.value = '正在把页面渲染为幻灯片图片…'
    const indices = rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, total) : Array.from({ length: total }, (_, i) => i)
    // 逐页渲染（引擎 pdfToImages 不带页范围参数，lib 只读，这里组件级循环）
    const imgs: { name: string; blob: Blob }[] = []
    for (let k = 0; k < indices.length; k++) {
      imgs.push({
        name: `第${indices[k] + 1}页.png`,
        blob: await renderPageToBlob(file, indices[k], {
          format: quality.value === 'hd' ? 'image/png' : 'image/jpeg',
          quality: quality.value === 'hd' ? undefined : 0.85,
          scale: quality.value === 'hd' ? 2 : 1.5,
        }),
      })
      progress.value = ((k + 1) / indices.length) * 0.7
    }
    stage.value = '正在生成 .pptx（首次使用需下载导出组件）…'
    const blob = await imagesToPptx(imgs.map((i) => ({ blob: i.blob })), '演示文稿')
    const outName = file.name.replace(/\.pdf$/i, '') + '.pptx'
    saveBlob(blob, outName)
    toast.ok(`已生成 ${imgs.length} 页幻灯片（${(blob.size / 1048576).toFixed(1)} MB）`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">清晰度</span>
        <select v-model="quality" class="select">
          <option value="std">标准（1.5x JPEG，体积小）</option>
          <option value="hd">高清（2x PNG，无损）</option>
        </select>
      </div>
      <div>
        <span class="field-label">页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-3,5" />
      </div>
    </div>

    <p v-if="sizeWarn" class="notice notice-warn mt-2 small">{{ sizeWarn }}</p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PPT 并下载
      </button>
      <span class="small muted">每页以图片铺满 16:9 幻灯片；产物名跟随源文件</span>
    </div>

    <div v-if="busy" class="mt-2">
      <p class="small muted mb-2">{{ stage }}</p>
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p class="notice notice-warn mt-2 small">
      首次使用需下载 PPT 导出组件（约 1 MB），完成后浏览器会缓存、离线可用。幻灯片内为页面图片，文字不可直接编辑——需要可编辑文本请用「PDF 转 Word」。
    </p>
  </div>
</template>

<style scoped>
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
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
