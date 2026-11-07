<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, rotatePage, rotatePdf, type PageSpec } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 旋转 PDF：整档或指定页旋转 90/180/270 度 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const deg = ref<90 | 180 | 270>(90)
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
    let blob: Blob
    const spec = pages.value.trim()
    if (!spec || spec === 'all' || spec === '全部') {
      blob = await rotatePdf(file, deg.value)
    } else {
      const idx = parsePageSpec(spec as PageSpec, total)
      if (!idx.length) {
        toast.warn(`页码无效：请输入 1-${total} 范围内的页码，如 1,3,5-8`)
        return
      }
      blob = file
      for (const i of idx) blob = await rotatePage(blob, i, deg.value)
    }
    saveBlob(blob, '旋转后.pdf')
    toast.ok('旋转已写入并下载')
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
        </select>
      </div>
      <div class="span2">
        <span class="field-label">应用页面（留空 = 全部页）</span>
        <input v-model="pages" class="input" placeholder="如 1,3,5-8 或 all" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 旋转并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">旋转会永久写入页面方向属性，阅读器打开即为新方向。</p>
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
