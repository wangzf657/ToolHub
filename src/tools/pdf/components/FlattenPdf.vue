<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Layers } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, toPdfBlob } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 扁平化：把表单字段的外观压进页面内容并移除字段，防止再被改写 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const dropAnnots = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return toast.warn('请先选择一个 PDF 文件')
  busy.value = true
  try {
    const { PDFDocument, PDFName } = await loadPdfLib()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    let fieldCount = 0
    let annotCount = 0
    try {
      const form = doc.getForm()
      fieldCount = form.getFields().length
      if (fieldCount > 0) form.flatten({ updateFieldAppearances: true })
    } catch {
      toast.warn('表单结构异常，已跳过表单压平')
    }
    if (dropAnnots.value) {
      for (const page of doc.getPages()) {
        const annots = page.node.Annots()
        if (annots) {
          annotCount += annots.size()
          page.node.delete(PDFName.of('Annots'))
        }
      }
    }
    // 契约：输出文件元数据统一 ToolHub
    doc.setProducer('ToolHub')
    doc.setCreator('ToolHub')
    const out = await doc.save({ useObjectStreams: false })
    saveBlob(toPdfBlob(out), '扁平化.pdf')
    toast.ok(`已完成：压平表单字段 ${fieldCount} 个${dropAnnots.value ? `，移除批注 ${annotCount} 处` : ''}`)
  } catch (e) {
    toast.err(`扁平化失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="row mt-2">
      <label class="check"><input v-model="dropAnnots" type="checkbox" /> 同时移除批注（高亮/便签/划线等）</label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Layers v-else :size="16" /> 扁平化并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      扁平化会把可编辑的表单字段（文本框、勾选框等）固化为普通内容，输出后不能再填改——打印、归档、对外提交前的保险一步。全部本地处理，文件不上传。
    </p>
  </div>
</template>
