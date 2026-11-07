<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

/** PDF 转 Markdown：标题/段落/列表/表格启发式转换 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const md = ref('')

const isCJK = (s: string) => (s.match(/[\u4e00-\u9fff]/g) ?? []).length > s.replace(/\s/g, '').length / 2
const joiner = (lines: string[]) => (isCJK(lines.join('')) ? '' : ' ')

const gfmTable = (rows: string[][]): string => {
  const cols = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')])
  const head = `| ${norm[0].join(' | ')} |`
  const sep = `| ${Array(cols).fill('---').join(' | ')} |`
  const body = norm.slice(1).map((r) => `| ${r.join(' | ')} |`)
  return [head, sep, ...body].join('\n')
}

/** 单页 → Markdown 片段（启发式） */
function pageToMd(text: string): string {
  const out: string[] = []
  let para: string[] = []
  let table: string[][] = []
  const flushPara = () => {
    if (para.length) {
      out.push(para.join(joiner(para)))
      out.push('')
      para = []
    }
  }
  const flushTable = () => {
    if (table.length >= 2) {
      out.push(gfmTable(table))
      out.push('')
    } else if (table.length === 1) {
      para.push(table[0].join('  '))
    }
    table = []
  }
  for (const raw of text.split('\n')) {
    const t = raw.trim()
    if (!t) {
      flushPara()
      flushTable()
      continue
    }
    // 列表项
    if (/^[-•·*]\s+/.test(t)) {
      flushPara()
      flushTable()
      out.push('- ' + t.replace(/^[-•·*]\s+/, ''))
      continue
    }
    // 表格行：2 个以上连续空格/制表符分列
    const cells = t.split(/\t| {2,}/).map((c) => c.trim()).filter(Boolean)
    if (cells.length >= 2) {
      flushPara()
      table.push(cells)
      continue
    }
    flushTable()
    // 中文编号标题
    if (/^第[一二三四五六七八九十百千\d]+[章节篇部分][\s、.．]/.test(t) && t.length < 50) {
      flushPara()
      out.push('## ' + t, '')
      continue
    }
    // 全大写西文短行视为标题
    if (/^[A-Z0-9][A-Z0-9 &,.:'\/\-]{2,60}$/.test(t) && /[A-Z]{2,}/.test(t)) {
      flushPara()
      out.push('## ' + t, '')
      continue
    }
    para.push(t)
  }
  flushPara()
  flushTable()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  md.value = ''
  try {
    const texts = await pdfPageTexts(file)
    const parts: string[] = []
    texts.forEach((t, i) => {
      if (texts.length > 1) parts.push(`<!-- 第 ${i + 1} 页 -->`)
      const frag = pageToMd(t)
      if (frag) parts.push(frag)
    })
    md.value = parts.join('\n\n')
    if (!md.value.replace(/<!--[^>]*-->/g, '').trim()) {
      toast.warn('未提取到文本：该 PDF 可能是扫描图片，无文本层')
    }
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (md = '')" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 Markdown
      </button>
      <span class="small muted">多页文档以 HTML 注释标记分页</span>
    </div>

    <ResultBox v-model="md" title="Markdown 结果" :readonly="true" download="md" :min-height="'300px'" class="mt-2" />

    <p class="notice notice-info mt-2 small">
      转换规则：中文「第 X 章/节」与全大写西文短行识别为二级标题；空行分段、段内行合并；「- / •」开头转列表；同行 2 个以上空格分列且连续 ≥2 行时转 GFM 表格。启发式转换，请人工校对标题层级。
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
