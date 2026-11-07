<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { docxToHtml, htmlToPdfBlob, readXlsx, rowsToHtmlTable } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** Office 转 PDF：docx（mammoth）/ xlsx（首表）/ pptx（抽取幻灯片文本） */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const stage = ref('')

const onFiles = (list: File[]) => (file.value = list[0] ?? null)

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
      stage.value = '正在解析 Excel 首个工作表…'
      const sheets = await readXlsx(f)
      if (!sheets.length) throw new Error('该表格没有可读取的数据')
      html = `<h2>${sheets[0].name}</h2>` + rowsToHtmlTable(sheets[0].header, sheets[0].rows)
    } else if (e === 'pptx') {
      stage.value = '正在提取幻灯片文本…'
      html = await pptxToHtml(f)
    } else {
      toast.warn('仅支持 .docx / .xlsx / .pptx 文件')
      return
    }
    stage.value = '正在排版生成 PDF…'
    const blob = await htmlToPdfBlob(html)
    saveBlob(blob, f.name.replace(/\.[^.]+$/, '') + '.pdf')
    toast.ok('PDF 已生成')
  } catch (err) {
    toast.err((err as Error).message || '转换失败，请确认文件未加密且格式正确')
  } finally {
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".docx,.xlsx,.pptx" :multiple="false" label="拖入 Word / Excel / PowerPoint 文件" hint="docx 按段落排版；xlsx 输出首个工作表；pptx 提取每页幻灯片文本" @files="onFiles" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PDF 并下载
      </button>
      <span v-if="stage" class="small muted">{{ stage }}</span>
    </div>

    <p class="notice notice-info mt-2 small">
      说明：pptx 不做整页截图（浏览器本地无法无损解析幻灯片版式），改为提取每页文本块重排为 PDF；docx 的图片与复杂样式会被简化。首次解析对应格式需下载解析组件。
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
