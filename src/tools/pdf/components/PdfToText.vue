<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { pdfText } from '@/lib/pdfEngine'

/** PDF 提取文本 */
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const text = ref('')

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return
  busy.value = true
  text.value = ''
  try {
    text.value = await pdfText(file)
  } catch {
    text.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (text = '')" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 提取文本
      </button>
      <span class="small muted">提取全部可选中文字，页与页之间以空行分隔</span>
    </div>

    <ResultBox v-model="text" title="提取结果" :readonly="true" download="txt" :min-height="'260px'" class="mt-2" />

    <p v-if="!busy && text === '' && base?.files.length" class="notice notice-warn mt-2 small">
      未提取到文字：该 PDF 可能是扫描图片型，请配合「扫描件 OCR 可搜索化」工具处理。
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
</style>
