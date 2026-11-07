<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { reorderPages } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 调整 PDF 页序：拖动或上下移按钮重排页面 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const order = ref<PageEntry[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  order.value = []
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const idx = order.value.map((e) => e.index)
  if (idx.length && idx.every((v, i) => v === i)) {
    toast.warn('当前顺序与原文件相同，请先调整页面顺序')
    return
  }
  busy.value = true
  try {
    const blob = await reorderPages(file.value, idx)
    saveBlob(blob, '重排后.pdf')
    toast.ok('页面顺序已重排')
  } catch (e) {
    toast.err((e as Error).message || '重排失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="file" class="small muted mt-1">拖动缩略图（或使用 ↑↓ 按钮）调整顺序，缩略图左上角为原始页码。</p>

    <PageThumbs v-if="file" v-model:order="order" :file="file" :movable="true" :rotatable="false" :removable="false" class="mt-2" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 按新顺序重建并下载
      </button>
    </div>
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
</style>
