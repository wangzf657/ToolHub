<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { nupPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 多页合一（N-up）：2/4/6/9 页拼一版 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const per = ref<2 | 4 | 6 | 9>(2)
const perOptions = [2, 4, 6, 9] as const
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const blob = await nupPdf(file, per.value)
    saveBlob(blob, `${per}合1.pdf`)
    toast.ok(`已按每版 ${per} 页重排`)
  } catch (e) {
    toast.err((e as Error).message || '拼页失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="mt-2">
      <span class="field-label">每版页数</span>
      <div class="row gap8">
        <button
          v-for="n in perOptions"
          :key="n"
          class="btn"
          :class="per === n ? 'btn-primary' : 'btn-ghost'"
          @click="per = n"
        >
          {{ n }} 合 1
        </button>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 拼页并下载
      </button>
      <span class="small muted">版面由原页面尺寸拼接而成（2 合 1 为上下排列，4/6/9 为网格），适合讲义与幻灯片打印</span>
    </div>
  </div>
</template>

<style scoped>
.gap8 {
  gap: 8px;
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
