<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { resizePdfTo } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页面缩放：统一到目标纸张尺寸，居中适配 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const size = ref('A4')
const landscape = ref(false)
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const blob = await resizePdfTo(file, size.value, landscape.value)
    saveBlob(blob, `缩放-${landscape.value ? '横' : '纵'}版-${size.value}.pdf`)
    toast.ok(`已统一为 ${size.value} 尺寸`)
  } catch (e) {
    toast.err((e as Error).message || '缩放失败')
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
        <span class="field-label">目标尺寸</span>
        <select v-model="size" class="select">
          <option value="A3">A3</option>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
        </select>
      </div>
      <div>
        <span class="field-label">方向</span>
        <label class="check mt-1"><input v-model="landscape" type="checkbox" /> 横向</label>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 缩放并下载
      </button>
      <span class="small muted">原页面按比例整体缩放并居中，不会变形或裁切</span>
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
