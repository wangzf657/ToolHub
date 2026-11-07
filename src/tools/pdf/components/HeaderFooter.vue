<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { addHeaderFooter } from '@/lib/pdfEngine'
import { hasCJK, stampImageTexts, textToPng } from './cjkText'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页眉页脚 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const header = ref('')
const footer = ref('')
const fontSize = ref(10)
const withPageNumber = ref(true)
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!header.value.trim() && !footer.value.trim()) {
    toast.warn('请至少填写页眉或页脚文字')
    return
  }
  busy.value = true
  try {
    let blob: Blob
    if (hasCJK(header.value) || hasCJK(footer.value)) {
      // 中文走贴图方案
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const sizes = probe.getPages().map((p) => p.getSize())
      const items: Parameters<typeof stampImageTexts>[1] = []
      const m = 28
      probe.getPages().forEach((_, i) => {
        const num = withPageNumber.value ? ` · ${i + 1}` : ''
        const { width: W, height: H } = sizes[i]
        if (header.value.trim()) {
          const png = textToPng(header.value + num, { sizePt: fontSize.value, color: [0.35, 0.38, 0.45] })
          items.push({ page: i, xPt: (W - png.wPt) / 2, yPt: H - m - png.hPt, png })
        }
        if (footer.value.trim()) {
          const png = textToPng(footer.value + num, { sizePt: fontSize.value, color: [0.35, 0.38, 0.45] })
          items.push({ page: i, xPt: (W - png.wPt) / 2, yPt: m, png })
        }
      })
      blob = await stampImageTexts(file, items)
    } else {
      blob = await addHeaderFooter(file, {
        header: header.value.trim() || undefined,
        footer: footer.value.trim() || undefined,
        fontSize: fontSize.value,
        withPageNumber: withPageNumber.value,
      })
    }
    saveBlob(blob, '加页眉页脚.pdf')
    toast.ok('页眉页脚已添加')
  } catch (e) {
    toast.err((e as Error).message || '添加失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-2 mt-2">
      <div>
        <span class="field-label">页眉文字</span>
        <input v-model="header" class="input" placeholder="如：公司内部资料（留空则不加页眉）" />
      </div>
      <div>
        <span class="field-label">页脚文字</span>
        <input v-model="footer" class="input" placeholder="如：XX 项目部（留空则不加页脚）" />
      </div>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="6" max="24" />
      </div>
      <div>
        <span class="field-label">附带页码</span>
        <label class="check mt-1"><input v-model="withPageNumber" type="checkbox" /> 文字后追加「· 页号」</label>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">文字居中放置在每页顶部/底部；含中文时自动以高清贴图方式嵌入。</p>
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
