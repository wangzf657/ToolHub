<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { mergePdfs } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 合并 PDF：多文件按列表顺序合并 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)

const run = async () => {
  const files = base.value?.files ?? []
  if (files.length < 2) {
    toast.warn('请至少添加两个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const blob = await mergePdfs(files, (p) => (progress.value = p))
    saveBlob(blob, '合并结果.pdf')
    toast.ok(`已合并 ${files.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '合并失败，请确认文件未损坏（加密文件请先解密）')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入两个或以上 PDF 文件" @files="() => (progress = 0)" />

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || (base?.files.length ?? 0) < 2" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 合并并下载
      </button>
      <span class="small muted">文件列表顺序即合并顺序（可在列表中 ↑↓ 调整）</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
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
