<script setup lang="ts">
/**
 * 表情包制作（UX1.0 五处方）：
 * - 自动缩字号 + 折行（rx1）：单行超宽先缩字号（下限 14px），仍超则按字符折行，不出画布。
 * - 黑边格式（rx2）：压图白字｜上下黑边（黑边高 = 图高 × 20%）。
 * - 文字颜色 + 描边粗细（rx3）：颜色选择器 + 1~16px 描边滑杆，100ms 内刷新。
 * - 示例底图（rx4）：空态 3 张运行时自绘示例，点击即进入编辑态。
 * - JPG 导出（rx5）：PNG/JPG chips + 质量 + 实时体积。
 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { canvasToBlob } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const topText = ref('')
const bottomText = ref('')
const size = ref(0) // 0 = 自动（图宽 / 10）
const stroke = ref(true)
const strokeW = ref(8)
const color = ref('#ffffff')
const layout = ref<'classic' | 'bars'>('classic')
const out = shallowRef<HTMLCanvasElement | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  size.value = 0
  render()
}

/** 折行：按字符累计宽度切分（中文/英文通用） */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function render() {
  const s = src.value
  if (!s) return
  const has = topText.value.trim() || bottomText.value.trim()
  if (!has) {
    base.value?.setOutput(null)
    out.value = null
    return
  }
  const c = document.createElement('canvas')
  c.width = s.width
  c.height = s.height
  const ctx = c.getContext('2d')!
  ctx.textAlign = 'center'
  let fs = size.value > 0 ? size.value : Math.max(20, Math.round(c.width / 10))
  let drawTop = s.height * 0.12
  let drawBottom = s.height * 0.92
  if (layout.value === 'bars') {
    // rx2 上下黑边
    const bar = Math.round(c.height * 0.2)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, c.width, bar)
    ctx.fillRect(0, c.height - bar, c.width, bar)
    fs = Math.max(12, Math.round(bar * 0.42))
    drawTop = bar * 0.68
    drawBottom = c.height - bar * 0.28
  }
  const maxW = c.width - Math.round(c.width * 0.04)
  const drawBlock = (text: string, startY: number, fromBottom: boolean) => {
    // rx1：先缩字号（下限 14px），再按字符折行
    let f = fs
    ctx.font = `700 ${f}px Impact, 'Microsoft YaHei', sans-serif`
    const all = text.split('\n')
    let widest = 0
    for (const t of all) widest = Math.max(widest, ctx.measureText(t).width)
    if (widest > maxW) {
      f = Math.max(14, Math.floor((f * maxW) / widest))
      ctx.font = `700 ${f}px Impact, 'Microsoft YaHei', sans-serif`
    }
    const wrapped = all.flatMap((t) => wrapText(ctx, t, maxW))
    const lh = f * 1.12
    wrapped.forEach((t, i) => {
      const y = fromBottom ? startY - (wrapped.length - 1 - i) * lh : startY + i * lh
      if (stroke.value) {
        ctx.lineWidth = Math.max(1, (strokeW.value * f) / Math.max(20, fs || f))
        ctx.strokeStyle = '#000000'
        ctx.lineJoin = 'round'
        ctx.strokeText(t, c.width / 2, y)
      }
      ctx.fillStyle = color.value
      ctx.fillText(t, c.width / 2, y)
    })
  }
  ctx.drawImage(s, 0, 0)
  drawBlock(topText.value.trim(), drawTop, false)
  drawBlock(bottomText.value.trim(), drawBottom, true)
  out.value = c
  base.value?.setOutput(c)
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = out.value
  if (!c) throw new Error('请先输入文字')
  return canvasToBlob(c, mime, quality)
}

/* rx4 示例底图：运行时自绘（原创，无第三方素材） */
function useSample(i: number) {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 480
  const ctx = c.getContext('2d')!
  const grads = [
    ['#7dd3fc', '#a78bfa'],
    ['#fde68a', '#fca5a5'],
    ['#86efac', '#67e8f9'],
  ]
  const g = ctx.createLinearGradient(0, 0, 640, 480)
  g.addColorStop(0, grads[i]![0]!)
  g.addColorStop(1, grads[i]![1]!)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 640, 480)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let k = 0; k < 24; k++) {
    ctx.beginPath()
    ctx.arc(40 + ((k * 97) % 560), 40 + ((k * 61) % 400), 12 + ((k * 31) % 40), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(15,23,42,0.65)'
  ctx.beginPath()
  ctx.roundRect(200, 170, 240, 150, 20)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '600 30px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(['示例底图 A', '示例底图 B', '示例底图 C'][i]!, 320, 255)
  src.value = c
  render()
}

let timer = 0
watch([topText, bottomText, size, stroke, strokeW, color, layout], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-meme" @loaded="onLoaded">
    <!-- rx4 空态示例 -->
    <div v-if="!src" class="row mt-1" style="gap: 10px; align-items: center">
      <span class="muted small">没有素材？试试示例底图：</span>
      <button v-for="i in 3" :key="i" class="chip" @click="useSample(i - 1)">试试看 · 示例 {{ i }}</button>
    </div>

    <div class="row mt-2" style="gap: 8px">
      <button class="chip" :class="{ active: layout === 'classic' }" @click="layout = 'classic'">压图白字</button>
      <button class="chip" :class="{ active: layout === 'bars' }" @click="layout = 'bars'">上下黑边</button>
    </div>

    <div class="mt-2 grid-2" style="max-width: 640px">
      <label class="opt">
        <span class="field-label">顶部文字</span>
        <textarea v-model="topText" class="textarea" style="min-height: 72px" placeholder="WHEN YOU…（支持换行，超宽自动缩字/折行）"></textarea>
      </label>
      <label class="opt">
        <span class="field-label">底部文字</span>
        <textarea v-model="bottomText" class="textarea" style="min-height: 72px" placeholder="…打开这个网站"></textarea>
      </label>
    </div>
    <div class="row row-wrap mt-2" style="gap: 20px; align-items: flex-start">
      <div style="max-width: 340px; min-width: 220px">
        <span class="field-label">字号：{{ size > 0 ? size + ' px' : '自动（图宽 / 10）' }}</span>
        <input v-model.number="size" type="range" min="0" max="160" step="2" />
      </div>
      <div class="row" style="gap: 14px; margin-top: 18px">
        <label class="row" style="gap: 6px"><span class="small">文字颜色</span><input v-model="color" type="color" /></label>
        <label class="check"><input v-model="stroke" type="checkbox" /> 黑色描边</label>
      </div>
      <div v-if="stroke" style="max-width: 240px; min-width: 180px; margin-top: 18px">
        <span class="field-label">描边粗细：{{ strokeW }}px</span>
        <input v-model.number="strokeW" type="range" min="1" max="16" step="1" />
      </div>
    </div>

    <ExportBar
      class="mt-2"
      :formats="['png', 'jpg']"
      :produce="produce"
      :base-name="base?.file ? base.file.name.replace(/\.[^.]+$/, '') : 'meme'"
      :dirty-token="`${topText}-${bottomText}-${size}-${stroke}-${strokeW}-${color}-${layout}`"
    />
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt .textarea {
  min-height: 72px;
  height: auto;
}
</style>
