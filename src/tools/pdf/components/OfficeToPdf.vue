<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { docxToHtml, htmlToPdfBlob, readXlsx, rowsToHtmlTable } from '@/lib/officeEngine'
import { pdfInfo, renderPageToBlob } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** Office 转 PDF：docx（mammoth）/ xlsx（多 sheet 勾选）/ pptx（抽取幻灯片文本）；先确认再下载 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const stage = ref('')
/** xlsx 多 sheet 勾选（默认全选） */
const sheets = ref<{ name: string; header: string[]; rows: string[][]; checked: boolean }[]>([])
/** 结果确认：页数 + 首页预览 */
const result = ref<{ blob: Blob; url: string; pages: number } | null>(null)
/** 旧格式拦截 */
const legacyErr = ref('')

const onFiles = async (list: File[]) => {
  file.value = list[0] ?? null
  sheets.value = []
  clearResult()
  legacyErr.value = ''
  const f = file.value
  if (!f) return
  const e = (f.name.split('.').pop() ?? '').toLowerCase()
  if (['doc', 'xls', 'ppt'].includes(e)) {
    legacyErr.value = '不支持旧格式 .doc / .xls / .ppt，请先在 Office 中另存为 .docx / .xlsx / .pptx'
    file.value = null
    toast.warn(legacyErr.value)
    return
  }
  if (e === 'xlsx') {
    try {
      const list2 = await readXlsx(f)
      sheets.value = list2.map((s) => ({ ...s, checked: true }))
    } catch {
      /* 解析失败在转换时报错 */
    }
  }
}

const ext = (f: File) => (f.name.split('.').pop() ?? '').toLowerCase()

/** 从 pptx 中按幻灯片顺序抽取 <a:t> 文本 */
async function pptxToHtml(f: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await f.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''))
      const nb = parseInt(b.replace(/\D/g, ''))
      return na - nb
    })
  const blocks: string[] = []
  for (let i = 0; i < names.length; i++) {
    const xml = await zip.files[names[i]].async('string')
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter((t) => t.trim())
    blocks.push(`<h2>幻灯片 ${i + 1}</h2>`)
    if (texts.length) {
      blocks.push(...texts.map((t) => `<p>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`))
    } else {
      blocks.push('<p>（此页无可提取文本，可能为纯图片页）</p>')
    }
  }
  return blocks.join('\n')
}

const clearResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}

const run = async () => {
  const f = file.value
  if (!f) {
    toast.warn('请先选择 docx / xlsx / pptx 文件')
    return
  }
  busy.value = true
  try {
    const e = ext(f)
    let html = ''
    if (e === 'docx') {
      stage.value = '正在解析 Word 文档…'
      html = await docxToHtml(f)
    } else if (e === 'xlsx') {
      const use = sheets.value.filter((s) => s.checked)
      if (!use.length) {
        toast.warn('请至少勾选一个工作表')
        return
      }
      stage.value = '正在解析 Excel 工作表…'
      html = use.map((s) => `<h2>${s.name}</h2>` + rowsToHtmlTable(s.header, s.rows)).join('\n')
    } else if (e === 'pptx') {
      stage.value = '正在提取幻灯片文本…'
      html = await pptxToHtml(f)
    } else {
      toast.warn('仅支持 .docx / .xlsx / .pptx 文件')
      return
    }
    stage.value = '正在排版生成 PDF…'
    const blob = await htmlToPdfBlob(html)
    const info = await pdfInfo(blob)
    const jpg = await renderPageToBlob(blob, 0, { format: 'image/jpeg', quality: 0.85, scale: 1.2 })
    clearResult()
    result.value = { blob, url: URL.createObjectURL(jpg), pages: info.pages }
    stage.value = ''
    toast.ok(`PDF 已生成：共 ${info.pages} 页，请预览确认后下载`)
  } catch (err) {
    toast.err((err as Error).message || '转换失败，请确认文件未加密且格式正确')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (result.value && file.value) saveBlob(result.value.blob, file.value.name.replace(/\.[^.]+$/, '') + '.pdf')
}
</script>

<template>
  <div>
    <FileDrop accept=".docx,.xlsx,.pptx" :multiple="false" label="拖入 Word / Excel / PowerPoint 文件" hint="仅支持 .docx/.xlsx/.pptx（.doc/.xls/.ppt 请先另存为新格式）；docx 按段落排版；xlsx 可勾选工作表；pptx 提取每页幻灯片文本" @files="onFiles" />

    <p v-if="legacyErr" class="notice notice-warn mt-2 small">{{ legacyErr }}</p>

    <div v-if="sheets.length" class="mt-2 sheet-pick">
      <span class="field-label">工作表（默认全选）</span>
      <label v-for="s in sheets" :key="s.name" class="check">
        <input v-model="s.checked" type="checkbox" /> {{ s.name }}（{{ s.rows.length }} 行）
      </label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PDF（先预览）
      </button>
      <span v-if="stage" class="small muted">{{ stage }}</span>
    </div>

    <div v-if="result" class="mt-2 result-card">
      <span class="small muted">共 <b>{{ result.pages }}</b> 页 · 首页预览（应与源文档首段一致）：</span>
      <img :src="result.url" alt="转换结果首页预览" class="result-img" />
      <div class="row mt-1">
        <button class="btn btn-primary" @click="download"><Download :size="15" /> 确认并下载 PDF</button>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">
      说明：pptx 不做整页截图（浏览器本地无法无损解析幻灯片版式），改为提取每页文本块重排为 PDF；docx 的图片与复杂样式会被简化。中文按高清贴图嵌入（不乱码）。首次解析对应格式需下载解析组件。
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
.sheet-pick {
  display: grid;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}
.result-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 8px;
  justify-items: start;
}
.result-img {
  max-width: 420px;
  max-height: min(60vh, 560px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
</style>
