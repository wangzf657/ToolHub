<script setup lang="ts">
/** 字帖生成器：田字格/米字格 A4 画布（系统楷体描红）→ PDF 下载 */
import { ref, shallowRef, watch } from 'vue'
import { Loader2, NotebookPen } from 'lucide-vue-next'
import { imagesToPdf } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('永字八法\n点横竖撇捺提钩连')
const grid = ref<'tian' | 'mi'>('tian')
const trace = ref(true) // 描红字
const busy = ref(false)
const stage = ref<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)

/** A4 @150dpi */
const W = 1240
const H = 1754
const MARGIN = 110
const FONT_STACK = '"KaiTi","STKaiti","楷体","DFKai-SB","BiauKai",serif'

const draw = () => {
  const chars = [...text.value.replace(/\r/g, '')].slice(0, 200)
  if (!chars.length) {
    canvas.value = null
    if (stage.value) stage.value.innerHTML = ''
    return
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  // 每页可容纳的格数（约 100px 格 + 间距）
  const cell = 108
  const gap = 8
  const perRow = Math.floor((W - MARGIN * 2 + gap) / (cell + gap))
  const rows = Math.ceil(chars.length / perRow)
  const startX = (W - (perRow * cell + (perRow - 1) * gap)) / 2
  const startY = Math.min(H - MARGIN - rows * cell, MARGIN + 60)
  ctx.lineWidth = 1.6
  for (let i = 0; i < chars.length; i++) {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    const x = startX + col * (cell + gap)
    const y = startY + row * (cell + gap)
    // 外框
    ctx.strokeStyle = '#e08a8a'
    ctx.strokeRect(x, y, cell, cell)
    ctx.strokeStyle = '#f0c0c0'
    ctx.lineWidth = 1
    if (grid.value === 'tian') {
      // 田字格：十字虚线
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.moveTo(x + cell / 2, y)
      ctx.lineTo(x + cell / 2, y + cell)
      ctx.moveTo(x, y + cell / 2)
      ctx.lineTo(x + cell, y + cell / 2)
      ctx.stroke()
    } else {
      // 米字格：十字 + 对角线
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.moveTo(x + cell / 2, y)
      ctx.lineTo(x + cell / 2, y + cell)
      ctx.moveTo(x, y + cell / 2)
      ctx.lineTo(x + cell, y + cell / 2)
      ctx.moveTo(x, y)
      ctx.lineTo(x + cell, y + cell)
      ctx.moveTo(x + cell, y)
      ctx.lineTo(x, y + cell)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.lineWidth = 1.6
    // 描红字（浅红大字）
    if (trace.value) {
      ctx.fillStyle = 'rgba(224,110,110,0.28)'
      ctx.font = `${Math.round(cell * 0.74)}px ${FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(chars[i], x + cell / 2, y + cell / 2 + 2)
    }
    // 标注拼音位留白（上格），不绘制
  }
  // 页眉
  ctx.fillStyle = '#888888'
  ctx.font = `20px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.fillText('硬笔练习字帖 · ToolHub 百宝工具箱', MARGIN - 60, MARGIN - 20)
  canvas.value = c
  if (stage.value) {
    stage.value.innerHTML = ''
    c.style.maxWidth = '100%'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stage.value.appendChild(c)
  }
}
watch([text, grid, trace], draw, { immediate: true })

const run = async () => {
  if (!canvas.value) return toast.warn('请输入练习汉字')
  busy.value = true
  try {
    const png = await canvasToBlob(canvas.value, 'image/png')
    const pdf = await imagesToPdf([png], { pageSize: 'A4' })
    const { saveBlob } = await import('@/lib/download')
    saveBlob(pdf, '硬笔字帖.pdf')
    toast.ok('字帖 PDF 已生成')
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt wide">
        <span class="field-label">练习汉字（换行分段，上限 200 字）</span>
        <textarea v-model="text" class="textarea" style="min-height: 64px"></textarea>
      </label>
      <label class="opt">
        <span class="field-label">格子类型</span>
        <select v-model="grid" class="select" style="width: 120px">
          <option value="tian">田字格</option>
          <option value="mi">米字格</option>
        </select>
      </label>
      <label class="opt check"><input v-model="trace" type="checkbox" /><span>描红字</span></label>
      <button class="btn btn-primary" :disabled="busy || !canvas" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <NotebookPen v-else :size="16" /> 生成 PDF 字帖
      </button>
    </div>

    <div ref="stage" class="copy-stage mt-2"></div>

    <p class="notice notice-info mt-2 small">描红字体使用系统楷体（KaiTi / 楷体 / DFKai-SB），Windows/macOS 自带；未安装楷体的设备会以衬线体代替。格子为浅红描线，打印友好。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt.wide {
  flex: 1;
  min-width: 260px;
}
.opt.check {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.copy-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  max-height: 560px;
  overflow: auto;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
