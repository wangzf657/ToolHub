<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Repeat } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { reversePages } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页序倒转 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const blob = await reversePages(file)
    saveBlob(blob, '倒序后.pdf')
    toast.ok('页序已倒转')
  } catch (e) {
    toast.err((e as Error).message || '操作失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Repeat v-else :size="16" /> 页序倒转并下载
      </button>
      <span class="small muted">最后一页变为第一页，适合修复倒序扫描件</span>
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
