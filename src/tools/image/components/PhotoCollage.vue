<script setup lang="ts">
/**
 * 照片拼图（UX1.0 五处方）：
 * - cover 裁切（rx1/rx2）：每格按比例 cover 居中裁切填满，绝不拉伸变形，文案如实描述。
 * - 圆角 + 边框（rx3）：0~24px 圆角、0~10px 描边。
 * - 格子换位（rx4）：点击两格互换图片位置，预览即时刷新。
 * - 版式模板（rx5）：网格 / 1+2 / 2+1 / 海报 ≥4 款。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const files = ref<File[]>([])
const canvases = shallowRef<HTMLCanvasElement[]>([])
const layout = ref<'grid' | '1+2' | '2+1' | 'poster'>('grid')
const cols = ref(3)
const gap = ref(10)
const bg = ref('#ffffff')
const radius = ref(0)
const border = ref(0)
const selIdx = ref(-1)
const out = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const loading = ref(false)
const saving = ref(false)

const TEMPLATES = [
  { v: 'grid', t: '网格' },
  { v: '1+2', t: '1+2' },
  { v: '2+1', t: '2+1' },
  { v: 'poster', t: '海报' },
] as const

interface Cell {
  x: number
  y: number
  w: number
  h: number
}

/** 版式模板 → 格子列表（1600×1200 基准） */
const cells = computed<Cell[]>(() => {
  const W = 1600
  const H = 1200
  const g = gap.value
  const n = Math.max(1, canvases.value.length)
  if (layout.value === 'grid') {
    const c = cols.value
    const rows = Math.ceil(n / c)
    const cw = (W - g * (c + 1)) / c
    const ch = (H - g * (rows + 1)) / rows
    return Array.from({ length: n }, (_, i) => ({
      x: g + (i % c) * (cw + g),
      y: g + Math.floor(i / c) * (ch + g),
      w: cw,
      h: ch,
    }))
  }
  if (layout.value === '1+2') {
    const bigW = (W - g * 3) * 0.62
    const smallW = W - g * 3 - bigW
    const list: Cell[] = [{ x: g, y: g, w: bigW, h: H - g * 2 }]
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const hh = (H - g * 3) / Math.max(1, n - 1)
      list.push({ x: g * 2 + bigW, y: g + i * (hh + g), w: smallW, h: hh })
    }
    return list
  }
  if (layout.value === '2+1') {
    const bigW = (W - g * 3) * 0.62
    const smallW = W - g * 3 - bigW
    const list: Cell[] = []
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const hh = (H - g * 3) / Math.max(1, n - 1)
      list.push({ x: g, y: g + i * (hh + g), w: smallW, h: hh })
    }
    list.push({ x: g * 2 + smallW, y: g, w: bigW, h: H - g * 2 })
    return list
  }
  // 海报：顶部大图 + 底部一行小图
  const topH = (H - g * 3) * 0.62
  const list: Cell[] = [{ x: g, y: g, w: W - g * 2, h: topH }]
  const rest = Math.max(1, n - 1)
  const cw = (W - g * (rest + 1)) / rest
  for (let i = 0; i < rest; i++) {
    list.push({ x: g + i * (cw + g), y: g * 2 + topH, w: cw, h: H - g * 3 - topH })
  }
  return list
})

async function loadAll(list: File[]) {
  files.value = list
  if (!list.length) {
    canvases.value = []
    out.value = null
    return
  }
  loading.value = true
  const arr: HTMLCanvasElement[] = []
  try {
    for (const f of list) arr.push(await decodeToCanvas(f))
    canvases.value = arr
    selIdx.value = -1
    render()
  } catch (e) {
    toast.err((e as Error).message || '有图片解码失败')
  } finally {
    loading.value = false
  }
}

/** rx4 点击换位：第一击选中，第二击交换 */
function pickCell(i: number) {
  if (i >= canvases.value.length) return
  if (selIdx.value === -1) {
    selIdx.value = i
  } else if (selIdx.value === i) {
    selIdx.value = -1
  } else {
    const arr = [...canvases.value]
    ;[arr[selIdx.value], arr[i]] = [arr[i]!, arr[selIdx.value]!]
    canvases.value = arr
    selIdx.value = -1
    render()
  }
}

/** 预览点击坐标 → 格子索引 */
function onStageClick(e: MouseEvent) {
  const cv = out.value
  if (!cv || !stage.value) return
  const rect = cv.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * cv.width
  const y = ((e.clientY - rect.top) / rect.height) * cv.height
  const i = cells.value.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)
  if (i >= 0) pickCell(i)
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function render() {
  if (!canvases.value.length) {
    out.value = null
    return
  }
  const cs = cells.value
  const W = Math.max(...cs.map((c) => c.x + c.w)) + gap.value
  const H = Math.max(...cs.map((c) => c.y + c.h)) + gap.value
  const cv = document.createElement('canvas')
  cv.width = Math.round(W)
  cv.height = Math.round(H)
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = bg.value
  ctx.fillRect(0, 0, cv.width, cv.height)
  cs.forEach((cell, i) => {
    const img = canvases.value[i]
    if (!img) return
    ctx.save()
    // rx3 圆角 + rx1 cover 裁切
    roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius.value)
    ctx.clip()
    const s = Math.max(cell.w / img.width, cell.h / img.height)
    const dw = img.width * s
    const dh = img.height * s
    ctx.drawImage(img, cell.x + (cell.w - dw) / 2, cell.y + (cell.h - dh) / 2, dw, dh)
    ctx.restore()
    if (border.value > 0) {
      roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius.value)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = border.value * 2 // 一半压在图内
      ctx.stroke()
    }
    if (i === selIdx.value) {
      ctx.strokeStyle = '#4f7dff'
      ctx.lineWidth = 4
      ctx.setLineDash([10, 6])
      ctx.strokeRect(cell.x + 3, cell.y + 3, cell.w - 6, cell.h - 6)
      ctx.setLineDash([])
    }
  })
  out.value = cv
}

watch(out, (c) => {
  if (mounted_) {
    mounted_.remove()
    mounted_ = null
  }
  if (c && stage.value) {
    c.style.maxWidth = '100%'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stage.value.appendChild(c)
    mounted_ = c
  }
})

let mounted_: HTMLCanvasElement | null = null

let timer = 0
watch([canvases, cols, gap, bg, radius, border, layout], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

async function download() {
  if (!out.value) return
  saving.value = true
  try {
    const blob = await canvasToBlob(out.value, 'image/png')
    saveBlob(blob, 'photo-collage.png')
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放多张照片到此处（支持批量）"
      hint="列表顺序即拼图顺序；点击预览两格可互换位置"
      @files="loadAll"
    />

    <div class="row row-wrap mt-2" style="gap: 14px">
      <span class="field-label">版式</span>
      <button v-for="t in TEMPLATES" :key="t.v" class="chip" :class="{ active: layout === t.v }" @click="layout = t.v">{{ t.t }}</button>
    </div>

    <div class="row row-wrap mt-2" style="gap: 18px">
      <div v-if="layout === 'grid'" style="min-width: 190px">
        <span class="field-label">列数：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="2" max="5" step="1" />
      </div>
      <div style="min-width: 190px">
        <span class="field-label">间距：{{ gap }} px</span>
        <input v-model.number="gap" type="range" min="0" max="40" step="1" />
      </div>
      <div style="min-width: 190px">
        <span class="field-label">圆角：{{ radius }} px</span>
        <input v-model.number="radius" type="range" min="0" max="24" step="1" />
      </div>
      <div style="min-width: 190px">
        <span class="field-label">描边：{{ border }} px</span>
        <input v-model.number="border" type="range" min="0" max="10" step="1" />
      </div>
      <label class="opt">
        <span class="field-label">背景色</span>
        <input v-model="bg" type="color" />
      </label>
    </div>

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="15" class="spin" /> 正在解码 {{ files.length }} 张图片…</div>
    <div v-else-if="files.length" class="muted small mt-2">
      已加载 {{ canvases.length }} 张
      <template v-if="selIdx >= 0"> · 已选中第 {{ selIdx + 1 }} 格，点击另一格互换</template>
      <template v-else> · 点击任意一格开始换位</template>
    </div>

    <div v-show="out" ref="stage" class="stage mt-2" @click="onStageClick"></div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!out || saving" @click="download">
        <Loader2 v-if="saving" :size="16" class="spin" /><Download v-else :size="16" /> 下载拼图 PNG
      </button>
      <span class="muted small">每格按比例 cover 居中裁切填满，不拉伸变形；圆角处透出背景色</span>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.stage {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
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
