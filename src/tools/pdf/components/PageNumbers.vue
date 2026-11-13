<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
import { hasCJK, stampImageTexts, textToPng } from './cjkText'
import { addPageNumbers } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页码：九宫格位置 / 格式模板 / 起始页与起始号 / {total} 口径 / 首页实时预览 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const position = ref('bottom-center')
const format = ref('第 {n} 页 / 共 {total} 页')
const start = ref(1)
const applyFrom = ref(1) // 从第 N 页开始编号（此前页不编号）
const fontSize = ref(11)
const margin = ref(28)
const skipFirst = ref(false)
const totalMode = ref<'all' | 'numbered'>('all')
const busy = ref(false)

const previewUrl = ref('')
const previewPt = ref<{ w: number; h: number } | null>(null)

const renderPreview = async () => {
  const file = base.value?.files[0]
  if (!file) {
    previewUrl.value = ''
    previewPt.value = null
    return
  }
  try {
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const page = await doc.getPage(1)
    const vp = page.getViewport({ scale: 1.2 })
    const c = document.createElement('canvas')
    c.width = Math.floor(vp.width)
    c.height = Math.floor(vp.height)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c } as never).promise
    previewUrl.value = c.toDataURL('image/jpeg', 0.85)
    const vp1 = page.getViewport({ scale: 1 })
    previewPt.value = { w: vp1.width, h: vp1.height }
    doc.destroy()
  } catch {
    previewUrl.value = ''
  }
}
watch(() => base.value?.files[0], renderPreview, { immediate: true })

/** 预览叠加样式：位置/边距/字号即时映射 */
const mockText = () => format.value.replace(/\{n\}/g, String(start.value)).replace(/\{total\}/g, '?')
const overlayStyle = () => {
  const pt = previewPt.value
  if (!pt) return {}
  const k = (pt.w * 1.2) / pt.w // 预览图 px / pt
  const v = position.value
  const mid = v.startsWith('top') || v.startsWith('bottom')
  return {
    left: v.includes('left') ? `${margin.value * k}px` : v.includes('right') ? 'auto' : '50%',
    right: v.includes('right') ? `${margin.value * k}px` : 'auto',
    top: v.startsWith('top') ? `${margin.value * k}px` : mid ? 'auto' : '50%',
    bottom: v.startsWith('bottom') ? `${margin.value * k}px` : mid ? 'auto' : '50%',
    transform: !mid && v.includes('center') ? 'translate(-50%,-50%)' : v.includes('center') ? 'translateX(-50%)' : 'none',
    fontSize: `${fontSize.value * k}px`,
  }
}

const grid = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'middle-center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
]

const templates = ['第 {n} 页 / 共 {total} 页', '- {n} -', '{n}']

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) return toast.warn('请先选择一个 PDF 文件')
  if (applyFrom.value < 1) applyFrom.value = 1
  busy.value = true
  try {
    const numbered = Math.max(0, total - applyFrom.value + 1 - (skipFirst.value && applyFrom.value === 1 ? 1 : 0))
    const grand = totalMode.value === 'numbered' ? numbered : total
    const nativeSimple =
      !hasCJK(format.value) &&
      applyFrom.value === 1 &&
      !skipFirst.value &&
      !position.value.startsWith('middle') &&
      totalMode.value === 'all'
    if (nativeSimple) {
      const blob = await addPageNumbers(file, {
        position: position.value as 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left',
        start: start.value, format: format.value, fontSize: fontSize.value, margin: margin.value,
      })
      saveBlob(blob, '加页码后.pdf')
    } else {
      // 通用贴图路径：支持中文/中间位置/范围页码/{total} 口径
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const sizes = probe.getPages().map((p) => p.getSize())
      const items: Parameters<typeof stampImageTexts>[1] = []
      let seq = 0
      for (let i = 0; i < total; i++) {
        if (skipFirst.value && i === 0) continue
        if (i + 1 < applyFrom.value) continue
        seq++
        const n = start.value + seq - 1
        const text = format.value.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(grand))
        const png = textToPng(text, { sizePt: fontSize.value, color: [0.35, 0.38, 0.45] })
        const { width: W, height: H } = sizes[i] ?? { width: 595, height: 842 }
        const x = position.value.includes('left') ? margin.value : position.value.includes('right') ? W - png.wPt - margin.value : (W - png.wPt) / 2
        const yPt = position.value.startsWith('top') ? H - margin.value - png.hPt : position.value.startsWith('bottom') ? margin.value : (H - png.hPt) / 2
        items.push({ page: i, xPt: x, yPt, png })
      }
      if (!items.length) {
        toast.warn('当前设置下没有需要编号的页（起始页超出文档范围）')
        return
      }
      const blob = await stampImageTexts(file, items)
      saveBlob(blob, '加页码后.pdf')
    }
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

    <div class="split mt-2">
      <div>
        <span class="field-label">位置（点击九宫格）</span>
        <div class="nine">
          <template v-for="(row, r) in grid" :key="r">
            <button
              v-for="cell in row"
              :key="cell"
              type="button"
              class="page-icon"
              :class="{ on: position === cell }"
              :title="cell"
              :aria-label="cell"
              @click="position = cell"
            >
              <span class="pn-dot" :class="cell" />
            </button>
          </template>
        </div>
        <div class="grid-2 mt-2">
          <div>
            <span class="field-label">格式模板</span>
            <input v-model="format" class="input" placeholder="{n} / {total}" />
            <div class="row row-wrap mt-1" style="gap: 6px">
              <button v-for="t in templates" :key="t" class="chip" type="button" @click="format = t">{{ t }}</button>
            </div>
          </div>
          <div>
            <span class="field-label">起始页号（第 1 个编号页显示的号）</span>
            <input v-model.number="start" type="number" class="input" min="1" />
            <span class="field-label mt-2">从第 N 页开始编号</span>
            <input v-model.number="applyFrom" type="number" class="input" min="1" />
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
            <label class="check mt-1">
              {total} 口径
              <select v-model="totalMode" class="select" style="width: 130px; margin-left: 6px">
                <option value="all">含全部页</option>
                <option value="numbered">仅编号页</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <div v-if="previewUrl">
        <span class="field-label">首页预览（实时示意）</span>
        <div class="preview-wrap">
          <img :src="previewUrl" alt="首页预览" class="preview-img" />
          <span class="ov-num" :style="overlayStyle()">{{ mockText() }}</span>
        </div>
        <p class="small muted mt-1">位置/模板/字号/边距变更即时反映在示意图上（无需下载）</p>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加页码并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      模板变量：<code>{n}</code> 当前页号、<code>{total}</code> 总页数。含中文、中间位置或范围编号时自动以高清贴图方式嵌入（ASCII 简单场景为可选中原生文字）。
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
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 860px) {
  .split {
    grid-template-columns: 1fr;
  }
}
.nine { display: grid; grid-template-columns: repeat(3, 64px); gap: 8px; }
.page-icon {
  position: relative;
  width: 64px;
  height: 84px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.page-icon.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.pn-dot {
  position: absolute;
  width: 26px;
  height: 4px;
  border-radius: 999px;
  background: var(--text-3);
}
.pn-dot.top-left { top: 8px; left: 8px; }
.pn-dot.top-center { top: 8px; left: 50%; transform: translateX(-50%); }
.pn-dot.top-right { top: 8px; right: 8px; }
.pn-dot.middle-left { top: 50%; left: 8px; transform: translateY(-50%); }
.pn-dot.middle-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.pn-dot.middle-right { top: 50%; right: 8px; transform: translateY(-50%); }
.pn-dot.bottom-left { bottom: 8px; left: 8px; }
.pn-dot.bottom-center { bottom: 8px; left: 50%; transform: translateX(-50%); }
.pn-dot.bottom-right { bottom: 8px; right: 8px; }
.preview-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.preview-img {
  max-width: min(100%, 380px);
  max-height: 60vh;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  display: block;
}
.ov-num {
  position: absolute;
  color: rgba(90, 96, 110, 0.9);
  white-space: nowrap;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.chip {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--accent);
}
</style>
