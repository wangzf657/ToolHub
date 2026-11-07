<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { addPageNumbers, loadPdfLib } from '@/lib/pdfEngine'
import { hasCJK, stampImageTexts, textToPng } from './cjkText'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页码：位置 / 格式模板 / 起始号 / 字号 / 边距 / 跳过首页 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const position = ref('bottom-center')
const format = ref('第 {n} 页 / 共 {total} 页')
const start = ref(1)
const fontSize = ref(11)
const margin = ref(28)
const skipFirst = ref(false)
const busy = ref(false)

type Pos = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    let blob: Blob
    if (hasCJK(format.value)) {
      // 中文模板：StandardFonts 不支持，改用「每页按实际尺寸贴图」方案
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const sizes = probe.getPages().map((p) => p.getSize())
      const items: Parameters<typeof stampImageTexts>[1] = []
      for (let i = 0; i < total; i++) {
        if (skipFirst.value && i === 0) continue
        const n = i + start.value
        const text = format.value.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total))
        const png = textToPng(text, { sizePt: fontSize.value, color: [0.35, 0.38, 0.45] })
        const { width: W, height: H } = sizes[i] ?? { width: 595, height: 842 }
        const x = position.value.includes('left')
          ? margin.value
          : position.value.includes('right')
            ? W - png.wPt - margin.value
            : (W - png.wPt) / 2
        const yPt = position.value.startsWith('top') ? H - margin.value - png.hPt : margin.value
        items.push({ page: i, xPt: x, yPt, png })
      }
      blob = await stampImageTexts(file, items)
    } else {
      blob = await addPageNumbers(file, {
        position: position.value as Pos,
        start: start.value,
        format: format.value,
        fontSize: fontSize.value,
        margin: margin.value,
        skipFirst: skipFirst.value,
      })
    }
    saveBlob(blob, '加页码后.pdf')
    toast.ok('页码已添加')
  } catch (e) {
    toast.err((e as Error).message || '添加页码失败')
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
        <span class="field-label">位置</span>
        <select v-model="position" class="select">
          <option value="bottom-center">底部居中</option>
          <option value="bottom-right">底部右侧</option>
          <option value="bottom-left">底部左侧</option>
          <option value="top-center">顶部居中</option>
          <option value="top-right">顶部右侧</option>
          <option value="top-left">顶部左侧</option>
        </select>
      </div>
      <div>
        <span class="field-label">格式模板</span>
        <input v-model="format" class="input" placeholder="{n} / {total}" />
      </div>
      <div>
        <span class="field-label">起始页号</span>
        <input v-model.number="start" type="number" class="input" min="1" />
      </div>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="6" max="36" />
      </div>
      <div>
        <span class="field-label">边距（pt）</span>
        <input v-model.number="margin" type="number" class="input" min="0" max="120" />
      </div>
      <div>
        <span class="field-label">其他</span>
        <label class="check mt-1"><input v-model="skipFirst" type="checkbox" /> 跳过首页（如封面）</label>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加页码并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      模板变量：<code>{n}</code> 当前页号、<code>{total}</code> 总页数。页码文字含中文时自动以高清贴图方式嵌入。
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
