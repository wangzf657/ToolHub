<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 插入空白页：开头 / 结尾 / 指定页之后；空白页可选横竖与 A4/Letter（默认跟随原文档） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const position = ref<'start' | 'end' | 'after'>('end')
const after = ref(1)
const count = ref(1)
const sizeMode = ref<'match' | 'A4' | 'Letter'>('match')
const orient = ref<'match' | 'portrait' | 'landscape'>('match')
const busy = ref(false)

const SIZES: Record<string, [number, number]> = { A4: [595.28, 841.89], Letter: [612, 792] }

/** 空白页 pt 尺寸（match=按原文档首页；显式选择时按横竖组合） */
const blankSize = computed<[number, number] | null>(() => {
  if (sizeMode.value === 'match') return null
  const [w, h] = SIZES[sizeMode.value]!
  const landscape = orient.value === 'landscape' || (orient.value === 'match' && false)
  if (landscape) return [h, w]
  return [w, h]
})

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!count.value || count.value < 1 || count.value > 100) {
    toast.warn('插入张数请填写 1-100')
    return
  }
  if (position.value === 'after' && (after.value < 1 || after.value > total)) {
    toast.warn(`「第 n 页之后」请填写 1-${total} 之间的页码`)
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const first = src.getPage(0).getSize()
    // 空白页尺寸：跟随原文档（尺寸+方向取首页）；显式选择按横竖
    const [bw, bh] = sizeMode.value === 'match' ? [first.width, first.height] : blankSize.value!
    const out = await PDFDocument.create()
    const blank = () => out.addPage([bw, bh])
    const pages = await out.copyPages(src, src.getPageIndices())
    if (position.value === 'start') {
      for (let i = 0; i < count.value; i++) blank()
      pages.forEach((p) => out.addPage(p))
    } else if (position.value === 'end') {
      pages.forEach((p) => out.addPage(p))
      for (let i = 0; i < count.value; i++) blank()
    } else {
      pages.forEach((p, i) => {
        out.addPage(p)
        if (i + 1 === after.value) for (let k = 0; k < count.value; k++) blank()
      })
    }
    out.setProducer('ToolHub')
    if (!out.getCreator()) out.setCreator('ToolHub')
    const blob = new Blob([await out.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, '插入空白页.pdf')
    toast.ok(`已插入 ${count.value} 张空白页（${Math.round(bw)}×${Math.round(bh)} pt）`)
  } catch (e) {
    toast.err((e as Error).message || '插入失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">插入位置</span>
        <select v-model="position" class="select">
          <option value="start">文档开头</option>
          <option value="end">文档结尾</option>
          <option value="after">第 n 页之后</option>
        </select>
      </div>
      <div v-if="position === 'after'">
        <span class="field-label">在哪一页之后</span>
        <input v-model.number="after" type="number" class="input" min="1" />
      </div>
      <div>
        <span class="field-label">插入张数</span>
        <input v-model.number="count" type="number" class="input" min="1" max="100" />
      </div>
      <div>
        <span class="field-label">空白页尺寸</span>
        <select v-model="sizeMode" class="select">
          <option value="match">跟随原文档首页</option>
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </div>
      <div v-if="sizeMode !== 'match'">
        <span class="field-label">方向</span>
        <select v-model="orient" class="select">
          <option value="portrait">纵向</option>
          <option value="landscape">横向</option>
        </select>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 插入并下载
      </button>
      <span class="small muted">
        {{ sizeMode === 'match' ? '空白页尺寸与原文档第一页一致（含横竖方向）' : `空白页为固定 ${sizeMode} ${orient === 'landscape' ? '横' : '纵'}版` }}
      </span>
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
</style>
