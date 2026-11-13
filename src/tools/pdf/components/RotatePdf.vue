<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, parsePageSpec } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 旋转 PDF：整档/指定页 90/180/270°，或「清除旋转（归零）」。
 * 组件级批量旋转（单次 load/save），不再逐页往返。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const deg = ref<0 | 90 | 180 | 270>(90)
const pages = ref('') // 空 = 全部页
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const { PDFDocument, degrees } = await loadPdfLib()
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const all = doc.getPages()
    const targets = pages.value.trim() && !['all', '全部'].includes(pages.value.trim().toLowerCase())
      ? parsePageSpec(pages.value, all.length).map((i) => all[i]!)
      : all
    if (pages.value.trim() && !['all', '全部'].includes(pages.value.trim().toLowerCase()) && !targets.length) {
      toast.warn(`页码无效：请输入 1-${all.length} 范围内的页码，如 1,3,5-8`)
      return
    }
    for (const page of targets) {
      if (deg.value === 0) {
        // 归零：清除已有旋转角
        page.setRotation(degrees(0))
      } else {
        const cur = page.getRotation().angle ?? 0
        page.setRotation(degrees((cur + deg.value) % 360))
      }
    }
    doc.setProducer('ToolHub')
    if (!doc.getCreator()) doc.setCreator('ToolHub')
    const bytes = await doc.save({ updateMetadata: false } as never)
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, deg.value === 0 ? '旋转已归零.pdf' : '旋转后.pdf')
    toast.ok(deg.value === 0 ? `已清除 ${targets.length} 页的旋转角` : `已旋转 ${targets.length} 页并下载`)
  } catch (e) {
    toast.err((e as Error).message || '旋转失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">旋转角度</span>
        <select v-model.number="deg" class="select">
          <option :value="90">顺时针 90°</option>
          <option :value="180">180°</option>
          <option :value="270">顺时针 270°（= 逆时针 90°）</option>
          <option :value="0">清除旋转（归零）</option>
        </select>
      </div>
      <div class="span2">
        <span class="field-label">应用页面（留空 = 全部页）</span>
        <input v-model="pages" class="input" placeholder="如 1,3,5-8 或 all" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> {{ deg === 0 ? '清除旋转并下载' : '旋转并下载' }}
      </button>
    </div>

    <p class="notice notice-info mt-2 small">旋转会永久写入页面方向属性，阅读器打开即为新方向；「清除旋转」把选中页的方向角归零（修复倒转页）。</p>
  </div>
</template>

<style scoped>
.span2 {
  grid-column: span 2;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
