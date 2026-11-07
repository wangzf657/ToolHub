<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { cleanScannedPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 扫描 PDF 清理：黑白化 / 增强灰度 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const mode = ref<'bw' | 'contrast'>('bw')
const level = ref(180)
const busy = ref(false)
const progress = ref(0)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const blob = await cleanScannedPdf(file, {
      mode: mode.value,
      level: level.value,
      onProgress: (p) => (progress.value = p),
    })
    saveBlob(blob, '清理后.pdf')
    toast.ok('扫描件清理完成')
  } catch (e) {
    toast.err((e as Error).message || '清理失败，页数过多时请耐心等待')
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
        <span class="field-label">清理模式</span>
        <select v-model="mode" class="select">
          <option value="bw">高对比黑白（推荐扫描文字）</option>
          <option value="contrast">增强灰度（保留层次）</option>
        </select>
      </div>
      <div class="span2">
        <span class="field-label">黑白阈值：{{ level }}（仅黑白模式生效，越大文字越少）</span>
        <input v-model.number="level" type="range" class="range" min="100" max="240" step="5" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始清理并下载
      </button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p class="notice notice-warn mt-2 small">
      清理需要逐页高清渲染再重新合成，页数多时耗时较长（每页约 1-3 秒），请保持页面打开。清理后文字会变为图像，体积可能增大。
    </p>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
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
