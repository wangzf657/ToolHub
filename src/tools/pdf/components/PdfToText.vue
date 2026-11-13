<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { loadPdfJs, parsePageSpec } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

/**
 * PDF 提取文本：支持页范围（"1-5,8"）、页分隔符选项与逐页进度。
 * 引擎 pdfText/pdfPageTexts 不带范围/进度参数（lib 只读），这里基于 loadPdfJs 做组件级提取，
 * 行拼装口径与引擎 pdfPageTexts 一致（y 变化断行 + hasEOL）。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const text = ref('')
const pageRange = ref('')
const separator = ref<'blank' | 'marker'>('blank')
const progress = ref(0)
const progressLabel = ref('')

const pageCount = computed(() => base.value?.pageCount ?? 0)

/** 提取指定页（0 基索引数组）的文本 */
const extractPages = async (file: File, indices: number[], onProgress: (p: number) => void): Promise<string[]> => {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const texts: string[] = []
  try {
    let done = 0
    for (const idx of indices) {
      const page = await doc.getPage(idx + 1)
      const tc = await page.getTextContent()
      let last = 0
      let t = ''
      for (const item of tc.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
        if (item.str === undefined) continue
        const y = item.transform?.[5] ?? 0
        if (last !== 0 && Math.abs(y - last) > 2) t += '\n'
        t += item.str
        if (item.hasEOL) t += '\n'
        last = y
      }
      texts.push(t.trim())
      done++
      onProgress(done / indices.length)
    }
  } finally {
    doc.destroy()
  }
  return texts
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return
  const total = pageCount.value
  const indices = parsePageSpec(pageRange.value || 'all', total || 1)
  if (pageRange.value.trim() && !indices.length) {
    toast.warn(`页范围「${pageRange.value}」没有匹配到任何页（文档共 ${total} 页）`)
    return
  }
  busy.value = true
  text.value = ''
  progress.value = 0
  progressLabel.value = ''
  try {
    const texts = await extractPages(file, indices, (p) => {
      progress.value = p
      progressLabel.value = `已提取 ${Math.round(p * indices.length)} / ${indices.length} 页`
    })
    if (separator.value === 'marker') {
      text.value = texts.map((t, i) => `--- 第 ${indices[i] + 1} 页 ---\n${t}`).join('\n\n')
    } else {
      text.value = texts.join('\n\n')
    }
    toast.ok(`已提取 ${indices.length} 页文本`)
  } catch (e) {
    const msg = (e as Error)?.message || ''
    text.value = ''
    if (/password/i.test(msg) || (e as { name?: string })?.name === 'PasswordException') {
      toast.err('该 PDF 已加密，无法提取文本；请先用「PDF 解密」工具解除密码后再试')
    } else {
      toast.err(msg ? `提取失败：${msg}` : '提取失败，请确认文件未损坏')
    }
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (text = '')" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">页范围（空 = 全部）</span>
        <input v-model="pageRange" type="text" class="input" placeholder="如 1-5,8" />
      </div>
      <div>
        <span class="field-label">页间分隔</span>
        <select v-model="separator" class="select">
          <option value="blank">空行分隔</option>
          <option value="marker">标记行（--- 第 n 页 ---）</option>
        </select>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 提取文本
      </button>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else class="small muted">提取可选中文字；扫描图片型 PDF 无文本层</span>
    </div>

    <div v-if="busy" class="progress mt-1">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
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
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
