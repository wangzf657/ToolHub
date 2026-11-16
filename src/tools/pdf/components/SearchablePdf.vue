<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 扫描件 OCR：tesseract.js（chi_sim+eng），支持页范围、预期时长、中途停止（保留已完成页） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const stage = ref('')
const progress = ref(0)
const previewText = ref('')
const rangeSpec = ref('')
const cancelFlag = ref(false)
const donePages = ref(0)
const plannedPages = ref(0)

const total = computed(() => base.value?.pageCount ?? 0)
/** 预估时长：约 4 秒/页（视页面积与设备浮动），首次另需下载模型 */
const estimateMin = computed(() => Math.max(1, Math.ceil((targetCount.value || 0) * 4 / 60)))
const targetCount = computed(() => {
  if (!total.value) return 0
  if (!rangeSpec.value.trim()) return total.value
  return parsePageSpec(rangeSpec.value, total.value).length
})

const stop = () => {
  if (!busy.value) return
  cancelFlag.value = true
  toast.warn('正在停止…已完成页的文本会保留')
}

const finish = async (parts: string[], file: File | Blob, partial: boolean) => {
  if (!parts.length) return
  stage.value = '正在打包结果…'
  const name = file instanceof File ? file.name : '原文件.pdf'
  const suffix = partial ? `（已完成${parts.length}页）` : ''
  await saveMany(
    [
      { name: `OCR全文${suffix}.txt`, blob: new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' }) },
      { name, blob: file },
    ],
    `OCR结果${suffix}.zip`,
  )
}

const run = async () => {
  const file = base.value?.files[0]
  const t = total.value
  if (!file) {
    toast.warn('请先选择一个扫描版 PDF')
    return
  }
  if (rangeSpec.value.trim()) {
    const idx = parsePageSpec(rangeSpec.value, t || 1)
    if (!idx.length) {
      toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（共 ${t} 页）`)
      return
    }
  }
  busy.value = true
  cancelFlag.value = false
  progress.value = 0
  previewText.value = ''
  donePages.value = 0
  plannedPages.value = targetCount.value
  const indices = rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, t || 1) : Array.from({ length: t }, (_, i) => i)
  type TesseractWorker = Awaited<ReturnType<typeof createWorker>>
  const { createWorker } = await import('tesseract.js')
  let worker: TesseractWorker | null = null
  let cancelled = false
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
    for (const idx of indices) {
      if (cancelFlag.value) {
        cancelled = true
        break
      }
      stage.value = `正在识别第 ${idx + 1} / ${t} 页…`
      const canvas = await renderPageToCanvas(file, idx, 2)
      const { data } = await worker.recognize(canvas)
      parts.push(`── 第 ${idx + 1} 页 ──\n${data.text.trim()}`)
      donePages.value = parts.length
      progress.value = 20 + Math.round((parts.length / indices.length) * 80)
      previewText.value = parts.join('\n\n')
    }
    if (cancelled && !parts.length) {
      toast.warn('已停止：尚无已完成页可保存')
      return
    }
    await finish(parts, file, cancelled)
    toast.ok(cancelled ? `已停止并保留 ${parts.length} 页文本` : `OCR 完成：共 ${parts.length} 页`)
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

    <p v-if="total && !busy" class="small muted mt-2">
      共 {{ targetCount }} 页待识别，预计约 {{ estimateMin }} 分钟（按约 4 秒/页估算）；首次使用另需下载语言模型（约 20-30 MB）。
    </p>

    <div class="row row-wrap mt-2" style="align-items: flex-end">
      <div>
        <span class="field-label">仅 OCR 页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" style="width: 200px" placeholder="如 1-10" />
      </div>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始 OCR
      </button>
      <button v-if="busy" class="btn btn-soft" @click="stop">停止（保留已完成页）</button>
      <span class="small muted">中文简体 + 英文混合识别，逐页进行</span>
    </div>

    <div v-if="busy" class="mt-2">
      <p class="small muted mb-2">{{ stage }}（已完成 {{ donePages }} / {{ plannedPages }} 页）</p>
      <div class="progress"><div class="fill" :style="{ width: progress + '%' }" /></div>
    </div>

    <div v-if="previewText" class="mt-2">
      <p class="field-label mb-2">OCR 文本预览</p>
      <pre class="preview mono">{{ previewText }}</pre>
    </div>

    <p class="notice notice-warn mt-2 small">
      结果说明：本实现输出「OCR 文本 TXT + 原始 PDF」打包下载。直接在原 PDF 内写入不可见的搜索文字层（双层 PDF）需要逐字符坐标定位，浏览器端暂不提供——OCR 结果可用「PDF 文本对比」与人工校对结合使用，或把文本粘贴到目标文档。首次使用需联网下载语言模型，之后浏览器缓存可离线。
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
/* 预览弹性高度：视口为主，下限 480px，页面少滚动即可通读 */
.preview {
  height: max(480px, calc(100dvh - 320px));
  max-height: 900px;
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
