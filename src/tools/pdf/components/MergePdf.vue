<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Download, ExternalLink, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { mergePdfs, pdfInfo } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 合并 PDF：多文件按列表顺序合并；结果先预览（页数/体积/新窗查看），确认后再下载 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const result = ref<{ pages: number; srcKB: number; outKB: number; url: string; blob: Blob } | null>(null)

const fmtKB = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n))} KB`)

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
    const info = await pdfInfo(blob)
    if (result.value) URL.revokeObjectURL(result.value.url)
    result.value = {
      pages: info.pages,
      srcKB: files.reduce((a, f) => a + f.size, 0) / 1024,
      outKB: blob.size / 1024,
      url: URL.createObjectURL(blob),
      blob,
    }
    toast.ok(`已合并 ${files.length} 个文件，共 ${info.pages} 页`)
  } catch (e) {
    toast.err((e as Error).message || '合并失败，请确认文件未损坏（加密文件请先解密）')
  } finally {
    busy.value = false
  }
}

const preview = () => {
  if (result.value) window.open(result.value.url, '_blank')
}

const download = () => {
  if (result.value) saveBlob(result.value.blob, '合并结果.pdf')
}

const clearResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}

onBeforeUnmount(clearResult)
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入两个或以上 PDF 文件" @files="clearResult" />

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || (base?.files.length ?? 0) < 2" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 合并
      </button>
      <span class="small muted">文件列表顺序即合并顺序（可在列表中 ↑↓ 调整）</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <!-- 结果卡：先看页数与体积，预览确认后再下载（不再盲盒直下） -->
    <div v-if="result" class="result-card mt-2">
      <div class="rc-stats">
        <span><strong>{{ result.pages }}</strong> 页</span>
        <span>{{ fmtKB(result.srcKB) }} → <strong>{{ fmtKB(result.outKB) }}</strong></span>
      </div>
      <div class="row">
        <button class="btn btn-soft btn-sm" @click="preview"><ExternalLink :size="14" /> 新窗口预览</button>
        <button class="btn btn-primary btn-sm" @click="download"><Download :size="14" /> 下载合并结果</button>
      </div>
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
  height: 8px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.result-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: 12px;
  background: var(--accent-soft);
}
.rc-stats {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13.5px;
  color: var(--text-2);
}
.rc-stats strong {
  color: var(--accent-text);
  font-size: 16px;
}
</style>
