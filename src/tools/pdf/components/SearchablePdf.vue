<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { renderPageToCanvas } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 扫描件 OCR：tesseract.js（chi_sim+eng），输出 OCR 文本 + 原 PDF 打包 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const stage = ref('')
const progress = ref(0)
const previewText = ref('')

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) {
    toast.warn('请先选择一个扫描版 PDF')
    return
  }
  busy.value = true
  progress.value = 0
  previewText.value = ''
  type TesseractWorker = Awaited<ReturnType<typeof createWorker>>
  const { createWorker } = await import('tesseract.js')
  let worker: TesseractWorker | null = null
  try {
    stage.value = '正在加载 OCR 引擎与语言模型（首次使用需下载约 20-30 MB）…'
    worker = await createWorker('chi_sim+eng', 1, {
      logger: (m: { status?: string; progress?: number }) => {
        if (!m.status) return
        const s = m.status
        if (/loading|initializ/i.test(s)) {
          stage.value = `正在下载模型：${s}`
          progress.value = Math.round((m.progress ?? 0) * 20)
        } else {
          stage.value = `识别中：${s}`
        }
      },
    })
    const parts: string[] = []
    for (let i = 0; i < total; i++) {
      stage.value = `正在识别第 ${i + 1}/${total} 页…`
      const canvas = await renderPageToCanvas(file, i, 2)
      const { data } = await worker.recognize(canvas)
      parts.push(`── 第 ${i + 1} 页 ──\n${data.text.trim()}`)
      progress.value = 20 + Math.round(((i + 1) / total) * 80)
      previewText.value = parts.join('\n\n')
    }
    stage.value = '正在打包结果…'
    const name = file instanceof File ? file.name : '原文件.pdf'
    await saveMany(
      [
        { name: 'OCR全文.txt', blob: new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' }) },
        { name, blob: file },
      ],
      'OCR结果.zip',
    )
    toast.ok('OCR 完成')
  } catch (e) {
    toast.err((e as Error).message || 'OCR 失败：模型下载需要网络，请重试')
  } finally {
    await worker?.terminate().catch(() => undefined)
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (previewText = '')" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始 OCR
      </button>
      <span class="small muted">中文简体 + 英文混合识别，逐页进行</span>
    </div>

    <div v-if="busy" class="mt-2">
      <p class="small muted mb-2">{{ stage }}</p>
      <div class="progress"><div class="fill" :style="{ width: progress + '%' }" /></div>
    </div>

    <div v-if="previewText" class="mt-2">
      <p class="field-label mb-2">OCR 文本预览</p>
      <pre class="preview mono">{{ previewText }}</pre>
    </div>

    <p class="notice notice-warn mt-2 small">
      结果说明：本实现输出「OCR 文本 TXT + 原始 PDF」打包下载。直接在原 PDF 内写入不可见的搜索文字层（双层 PDF）需要逐字符坐标定位，浏览器端暂不提供——如需可搜索 PDF，可将 TXT 内容用「PDF 添加文字」或桌面工具回写。首次使用需联网下载语言模型，之后浏览器缓存可离线。
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
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}
.preview {
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  background: var(--panel);
}
</style>
