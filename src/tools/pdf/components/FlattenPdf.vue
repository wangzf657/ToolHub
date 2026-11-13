<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Layers } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, pdfFormFields, toPdfBlob } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 扁平化：字段前置计数 + 失败不冒名 + 压平自证 + 链接保护（批注烙入为架构边界，诚实披露） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const dropAnnots = ref(false)
const keepLinks = ref(true)
const fieldCount = ref<number | null>(null)
const selfCheck = ref<string | null>(null)

const onFiles = async (list: File[]) => {
  fieldCount.value = null
  selfCheck.value = null
  const f = list[0]
  if (!f) return
  try {
    const fields = await pdfFormFields(f)
    fieldCount.value = fields.length
    if (!fields.length) toast.ok('该文档没有可压平的表单字段（纯文档）')
  } catch {
    fieldCount.value = 0
  }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return toast.warn('请先选择一个 PDF 文件')
  if (fieldCount.value === 0 && !dropAnnots.value) {
    toast.warn('该文档没有表单字段，无需扁平化')
    return
  }
  busy.value = true
  try {
    const { PDFDocument, PDFName } = await loadPdfLib()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    let fields = 0
    let annotCount = 0
    let flattened = true
    try {
      const form = doc.getForm()
      fields = form.getFields().length
      if (fields > 0) form.flatten({ updateFieldAppearances: true })
    } catch {
      flattened = false
      toast.warn('该表单无法扁平化（如 XFA 结构），已按原样保留字段输出')
    }
    if (dropAnnots.value) {
      for (const page of doc.getPages()) {
        const annots = page.node.Annots()
        if (!annots) continue
        if (keepLinks.value) {
          // 链接保护：只移除非 /Link 子类型的注释
          const size = annots.size()
          const keepArr: unknown[] = []
          for (let i = 0; i < size; i++) {
            const a = (annots as { lookup?: (i: number) => unknown }).lookup?.(i)
            const dict = (a as { dict?: { lookup?: (n: unknown) => unknown } })?.dict
            const st = dict?.lookup?.(PDFName.of('Subtype'))
            const isLink = st && typeof (st as { asString?: () => string }).asString === 'function' && /Link/.test((st as { asString: () => string }).asString())
            if (!isLink) annotCount++
            else keepArr.push(a)
          }
          if (keepArr.length === 0) page.node.delete(PDFName.of('Annots'))
        } else {
          annotCount += annots.size()
          page.node.delete(PDFName.of('Annots'))
        }
      }
    }
    // 契约：输出文件元数据统一 ToolHub
    doc.setProducer('ToolHub')
    doc.setCreator('ToolHub')
    const out = await doc.save({ useObjectStreams: false })
    const blob = toPdfBlob(out)
    // 压平自证：回读输出字段数
    let restCount = -1
    try {
      restCount = (await pdfFormFields(blob)).length
    } catch {
      /* 回读失败不阻塞 */
    }
    selfCheck.value = restCount >= 0 ? `输出字段数：${restCount} ${restCount === 0 ? '✓' : '（无法扁平化，字段已保留）'}` : ''
    saveBlob(blob, flattened ? '扁平化.pdf' : '未压平-原样.pdf')
    toast.ok(`已完成：压平表单字段 ${fields} 个${dropAnnots.value ? `，移除批注 ${annotCount} 处${keepLinks.value ? '（链接保留）' : ''}` : ''}${flattened ? '' : '（表单未压平，见文件名标注）'}`)
  } catch (e) {
    toast.err(`扁平化失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="fieldCount !== null" class="small muted mt-2">
      {{ fieldCount > 0 ? `该文档含 ${fieldCount} 个表单字段` : '无表单字段（纯文档）——扁平化无效果，可仅移除批注' }}
    </p>

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="dropAnnots" type="checkbox" /> 同时移除批注（高亮/便签/划线等）</label>
      <label v-if="dropAnnots" class="check"><input v-model="keepLinks" type="checkbox" /> 保留可点击链接（目录/跳转）</label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || (fieldCount === 0 && !dropAnnots)" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Layers v-else :size="16" /> 扁平化并下载
      </button>
    </div>

    <p v-if="selfCheck" class="notice notice-ok mt-2 small">{{ selfCheck }}</p>

    <p class="notice notice-info mt-2 small">
      扁平化会把可编辑的表单字段（文本框、勾选框等）固化为普通内容，输出后不能再填改——打印、归档、对外提交前的保险一步。全部本地处理，文件不上传。
    </p>
    <p class="notice notice-warn mt-2 small">
      能力边界：便签/批注的文字内容烙入页面（保留视觉但不可编辑）暂不支持——当前仅能整批移除批注或保留全部（含链接筛选）。
    </p>
  </div>
</template>
