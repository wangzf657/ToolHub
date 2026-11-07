<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { paragraphsToDocx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 Word：提取文本 → 段落重组 → .docx */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const withTitles = ref(true)
const busy = ref(false)
const stat = ref('')

/** 判断文本是否以中文为主（决定拼接时是否补空格） */
const isCJK = (s: string) => {
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk > s.replace(/\s/g, '').length / 2
}

/** 把一页文本重组为段落：空行分段，段内行拼接 */
function toParagraphs(pageText: string): string[] {
  const blocks = pageText.split(/\n\s*\n+/)
  const out: string[] = []
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    out.push(lines.join(isCJK(lines.join('')) ? '' : ' '))
  }
  return out
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  stat.value = '正在提取文本…'
  try {
    const texts = await pdfPageTexts(file)
    const paragraphs: { text: string; heading?: 1 | 2 | 3 }[] = []
    texts.forEach((t, i) => {
      if (withTitles.value) paragraphs.push({ text: `第 ${i + 1} 页`, heading: 2 })
      for (const p of toParagraphs(t)) paragraphs.push({ text: p })
    })
    if (!paragraphs.length) {
      toast.warn('未能提取到文本：该 PDF 可能是扫描图片，请先使用「扫描件 OCR 可搜索化」')
      return
    }
    stat.value = '正在生成 .docx…'
    const blob = await paragraphsToDocx(paragraphs, { title: 'PDF 转 Word' })
    saveBlob(blob, '文档.docx')
    stat.value = `共 ${paragraphs.length} 个段落`
    toast.ok('Word 文档已生成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (stat = '')" />

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="withTitles" type="checkbox" /> 每页前插入「第 n 页」标题</label>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 Word 并下载
      </button>
      <span v-if="stat" class="small muted">{{ stat }}</span>
    </div>

    <p class="notice notice-info mt-2 small">
      本工具提取 PDF 文本层并按段落重组，排版样式不会 1:1 还原；扫描图片型 PDF 无法提取文字。
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
