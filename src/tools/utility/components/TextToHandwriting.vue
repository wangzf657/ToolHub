<script setup lang="ts">
import { ref } from 'vue'
import { PenLine, Download, Loader2 } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref(`姓名：______  班级：______\n\n一、把下面的词语补充完整。\n波光粼粼  (   )(   )有味\n\n二、按课文内容填空。\n床前明月光，疑是地上霜。`)
const paper = ref<'ruled' | 'grid' | 'blank'>('ruled')
const fontSize = ref(22)
const lineGap = ref(46)
const ink = ref('#1a3a8f')
const jitter = ref(2)
const busy = ref(false)

const FONT_STACK = `'KaiTi','STKaiti','楷体','GC2012Kai','DFKai-SB',cursive`
const canvasRef = ref<HTMLCanvasElement | null>(null)

/** 手写感：每个字带轻微随机位移与旋转 */
const rand = (n: number) => (Math.random() * 2 - 1) * n

const render = () => {
  const cv = canvasRef.value
  if (!cv) return
  const g = cv.getContext('2d')!
  const W = 760
  const pad = 46
  const lines = text.value.split('\n')
  const H = Math.max(560, pad * 2 + lines.length * lineGap.value + 60)
  cv.width = W
  cv.height = H
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  // 纸张底纹
  g.strokeStyle = '#9ec1e0'
  g.lineWidth = 1
  if (paper.value === 'ruled') {
    for (let y = pad + 8; y < H - pad; y += lineGap.value) {
      g.beginPath()
      g.moveTo(pad, y)
      g.lineTo(W - pad, y)
      g.stroke()
    }
  } else if (paper.value === 'grid') {
    for (let y = pad + 8; y < H - pad; y += lineGap.value) {
      g.beginPath()
      g.moveTo(pad, y)
      g.lineTo(W - pad, y)
      g.stroke()
    }
    g.strokeStyle = 'rgba(158,193,224,.4)'
    for (let x = pad; x < W - pad; x += lineGap.value) {
      g.beginPath()
      g.moveTo(x, pad + 8)
      g.lineTo(x, H - pad)
      g.stroke()
    }
    g.strokeStyle = '#9ec1e0'
  }
  // 逐字手写渲染
  g.fillStyle = ink.value
  g.textBaseline = 'alphabetic'
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    const baseY = pad + 24 + li * lineGap.value
    let x = pad
    for (const ch of line) {
      const isSpace = ch === ' '
      const w = isSpace ? fontSize.value * 0.6 : fontSize.value * 1.05
      if (x + w > W - pad) break // 简单换行保护
      if (!isSpace) {
        g.save()
        g.translate(x + rand(jitter.value), baseY + rand(jitter.value))
        g.rotate((rand(jitter.value) * Math.PI) / 180 * 2)
        g.font = `${fontSize.value}px ${FONT_STACK}`
        g.fillText(ch, 0, 0)
        g.restore()
      }
      x += w
    }
  }
}

const exportPng = () => {
  const cv = canvasRef.value
  if (!cv) return
  cv.toBlob((b) => {
    if (b) {
      saveBlob(b, '手写作业.png')
      toast.ok('已导出 PNG')
    }
  }, 'image/png')
}

const exportPdf = async () => {
  busy.value = true
  try {
    const { htmlToPdfBlob } = await import('@/lib/officeEngine')
    const cv = canvasRef.value
    if (!cv) return
    const dataUrl = cv.toDataURL('image/png')
    const html = `<div style="text-align:center"><img src="${dataUrl}" style="max-width:100%"/></div>`
    const blob = await htmlToPdfBlob(html, { pageSize: 'a4' })
    saveBlob(blob, '手写作业.pdf')
    toast.ok('已导出 PDF')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

render()
</script>

<template>
  <div>
    <div class="opts-panel">
      <textarea v-model="text" class="input area" rows="6" @input="render"></textarea>
      <div class="row wrap gap mt-2">
        <span class="field-label">纸张</span>
        <select v-model="paper" class="input" @change="render">
          <option value="ruled">横线纸</option>
          <option value="grid">方格纸</option>
          <option value="blank">空白纸</option>
        </select>
        <span class="field-label">字号</span>
        <input v-model.number="fontSize" type="number" class="input slim" min="14" max="40" @change="render" />
        <span class="field-label">行距</span>
        <input v-model.number="lineGap" type="number" class="input slim" min="30" max="80" @change="render" />
        <span class="field-label">墨色</span>
        <input v-model="ink" type="color" class="input" style="width: 40px; height: 30px; padding: 2px" @change="render" />
        <span class="field-label">手写抖动</span>
        <input v-model.number="jitter" type="range" min="0" max="5" @change="render" />
        <button class="btn btn-sm" @click="render"><PenLine :size="14" /> 重新生成</button>
      </div>
    </div>
    <canvas ref="canvasRef" class="sheet mt-2"></canvas>
    <div class="row gap mt-2">
      <button class="btn btn-primary" @click="exportPng"><Download :size="16" /> 导出 PNG</button>
      <button class="btn" :disabled="busy" @click="exportPdf"><Loader2 v-if="busy" :size="16" class="spin" /><Download v-else :size="16" /> 导出 PDF</button>
    </div>
    <p class="hint mt-1">字体使用系统楷体（Windows: KaiTi / macOS: STKaiti）；未安装楷体的设备会退化为默认字体。抖动参数越大字越「潦草」。本工具仅供练习演示用途。</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 64px; }
.area { width: 100%; resize: vertical; }
.sheet { width: 100%; max-width: 760px; display: block; margin: 0 auto; border: 1px solid var(--border); border-radius: 10px; }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
