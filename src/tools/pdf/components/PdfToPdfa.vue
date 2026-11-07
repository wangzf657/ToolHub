<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfToPdfa } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 PDF/A（近似归档转换） */
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
    const blob = await pdfToPdfa(file)
    saveBlob(blob, file.name.replace(/\.pdf$/i, '') + '-PDF-A.pdf')
    toast.ok('已生成归档版本')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
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
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PDF/A 并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      转换内容：补全标题等元数据、写入统一创建程序、关闭对象流（对象引用改直存），便于长期归档与校验。颜色统一按 sRGB 假定处理。
    </p>
    <p class="notice notice-warn mt-2 small">
      诚实说明：完整 PDF/A-2b 还需要嵌入 XMP 元数据流、输出意图（OutputIntent）与全字体子集嵌入，本实现为「归档友好」近似转换；如需严格过 ISO 校验（如 veraPDF），请复核结果。
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
