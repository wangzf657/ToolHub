<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, Download, RotateCcw } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const exprText = ref('sin(x)\nx^2 / 4 - 2\n2x + 1')
const xmin = ref(-10)
const xmax = ref(10)
const colors = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#eab308', '#14b8a6', '#ef4444']

interface Series {
  expr: string
  color: string
  fn: ((x: number) => number) | null
  error: string
  /** 每像素采样点（null 表示断开/无效） */
  pts: (number | null)[]
}
const series = ref<Series[]>([])
const canvas = ref<HTMLCanvasElement | null>(null)
const tip = ref<{ x: number; y: number; lines: string[] } | null>(null)
let math: typeof import('mathjs') | null = null
let ro: ResizeObserver | null = null
let drawTimer: number | null = null

async function loadMath() {
  if (!math) {
    const m = (await import('mathjs')) as unknown as typeof import('mathjs')
    math = (m as { compile?: unknown }).compile ? m : ((m as { default?: typeof m }).default as typeof import('mathjs'))
  }
  return math
}

const exprList = computed(() => exprText.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8))

/** 编译每行表达式并采样 */
async function rebuild() {
  const m = await loadMath()
  const out: Series[] = []
  exprList.value.forEach((expr, i) => {
    const s: Series = { expr, color: colors[i % colors.length]!, fn: null, error: '', pts: [] }
    try {
      const c = m.compile(expr)
      const probe = (x: number) => {
        const r = c.evaluate({ x })
        return typeof r === 'number' ? r : null
      }
      probe(1); probe(-1)
      s.fn = (x: number) => {
        try {
          const r = c.evaluate({ x })
          return typeof r === 'number' && Number.isFinite(r) ? r : null as unknown as number
        } catch {
          return null as unknown as number
        }
      }
    } catch (e) {
      s.error = `无法解析：${(e as Error).message}（可用 sin(x)、sqrt(x)、x^2、2x、exp(x) 等写法）`
    }
    out.push(s)
  })
  series.value = out
  draw()
}

/** 1-2-5 步长 */
function niceStep(span: number, target = 8): number {
  const raw = span / Math.max(2, target)
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const c of [1, 2, 5, 10].map((k) => k * p)) if (c >= raw) return c
  return 10 * p
}

const fmt = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e5 || (a > 0 && a < 1e-4) ? v.toExponential(1) : String(Math.round(v * 1e6) / 1e6)
  return s
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const W = cv.clientWidth
  const H = cv.clientHeight
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const style = getComputedStyle(document.body)
  ctx.fillStyle = style.backgroundColor || '#ffffff'
  ctx.fillRect(0, 0, W, H)

  let lo = Math.min(xmin.value, xmax.value)
  let hi = Math.max(xmin.value, xmax.value)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 1e-9) { lo = -10; hi = 10 }
  const N = Math.max(100, Math.min(1200, Math.round(W)))
  // 采样
  for (const s of series.value) {
    s.pts = []
    if (!s.fn) continue
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N
      const y = s.fn(x)
      s.pts.push(y === null || !Number.isFinite(y) ? null : y)
    }
  }
  // y 范围：用有限样本的 2%~98% 分位防渐近线撑爆画布
  const ys = series.value.flatMap((s) => s.pts.filter((v): v is number => v !== null)).sort((a, b) => a - b)
  let yLo = -1
  let yHi = 1
  if (ys.length) {
    const q = (p: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round((ys.length - 1) * p)))]!
    yLo = q(0.02)
    yHi = q(0.98)
    if (yHi - yLo < 1e-9) { yLo -= 1; yHi += 1 }
    const pad = (yHi - yLo) * 0.12
    yLo -= pad; yHi += pad
  }
  const X = (x: number) => ((x - lo) / (hi - lo)) * W
  const Y = (y: number) => H - ((y - yLo) / (yHi - yLo)) * H

  // 网格与刻度
  ctx.font = '11px ui-monospace, monospace'
  const sx = niceStep(hi - lo), sy = niceStep(yHi - yLo)
  ctx.lineWidth = 1
  for (let gx = Math.ceil(lo / sx) * sx; gx <= hi; gx += sx) {
    ctx.strokeStyle = 'rgba(127,127,127,0.18)'
    ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke()
    ctx.fillStyle = 'rgba(127,127,127,0.75)'
    ctx.textAlign = 'center'
    ctx.fillText(fmt(gx), X(gx), Math.min(H - 4, Math.max(12, Y(0) + 14)))
  }
  for (let gy = Math.ceil(yLo / sy) * sy; gy <= yHi; gy += sy) {
    ctx.strokeStyle = 'rgba(127,127,127,0.18)'
    ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(W, Y(gy)); ctx.stroke()
    ctx.fillStyle = 'rgba(127,127,127,0.75)'
    ctx.textAlign = 'left'
    ctx.fillText(fmt(gy), Math.max(2, Math.min(W - 40, X(0) + 4)), Y(gy) - 3)
  }
  // 坐标轴
  ctx.strokeStyle = 'rgba(127,127,127,0.6)'
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke()
  // 曲线
  ctx.lineWidth = 1.8
  for (const s of series.value) {
    if (!s.fn) continue
    ctx.strokeStyle = s.color
    ctx.beginPath()
    let pen = false
    s.pts.forEach((y, i) => {
      if (y === null) { pen = false; return }
      const px = (i / N) * W
      const py = Y(y)
      if (py < -2000 || py > H + 2000) { pen = false; return }
      if (!pen) { ctx.moveTo(px, py); pen = true } else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
}

watch([exprText], () => {
  if (drawTimer !== null) window.clearTimeout(drawTimer)
  drawTimer = window.setTimeout(rebuild, 300)
})
watch([xmin, xmax], () => draw())

const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  const cv = canvas.value
  if (!cv) return
  const rect = cv.getBoundingClientRect()
  const cx = xmin.value + ((e.clientX - rect.left) / rect.width) * (xmax.value - xmin.value)
  const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2
  let span = (xmax.value - xmin.value) * factor
  span = Math.min(1e8, Math.max(1e-6, span))
  const half = span / 2
  xmin.value = Math.round((cx - half) * 1e6) / 1e6
  xmax.value = Math.round((cx + half) * 1e6) / 1e6
}
const resetView = () => { xmin.value = -10; xmax.value = 10 }

const onMove = (e: MouseEvent) => {
  const cv = canvas.value
  if (!cv) return
  const rect = cv.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const lo = Math.min(xmin.value, xmax.value)
  const hi = Math.max(xmin.value, xmax.value)
  const x = lo + (mx / rect.width) * (hi - lo)
  const lines = [`x = ${fmt(Math.round(x * 1e6) / 1e6)}`]
  for (const s of series.value) {
    if (!s.fn) continue
    const y = s.fn(x)
    lines.push(`${s.expr} = ${y === null || !Number.isFinite(y) ? '未定义' : fmt(y)}`)
  }
  tip.value = { x: mx, y: e.clientY - rect.top, lines }
}

const exportPng = () => {
  const cv = canvas.value
  if (!cv) return
  cv.toBlob((b) => {
    if (b) { saveBlob(b, 'function-plot.png'); toast.ok('已导出 PNG 图像') } else toast.err('导出失败')
  }, 'image/png')
}

onMounted(async () => {
  await rebuild()
  ro = new ResizeObserver(() => draw())
  if (canvas.value) ro.observe(canvas.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (drawTimer !== null) window.clearTimeout(drawTimer)
})
</script>

<template>
  <div class="plot">
    <div class="row row-wrap" style="gap: 14px; align-items: flex-end">
      <div>
        <span class="field-label">x 最小值</span>
        <input v-model.number="xmin" type="number" class="input" style="width: 110px" step="any" />
      </div>
      <div>
        <span class="field-label">x 最大值</span>
        <input v-model.number="xmax" type="number" class="input" style="width: 110px" step="any" />
      </div>
      <button class="btn btn-soft btn-sm" @click="resetView"><RotateCcw :size="14" /> 重置视图</button>
      <button class="btn btn-primary btn-sm" @click="exportPng"><Download :size="14" /> 导出 PNG</button>
      <span class="muted small">在图上滚动滚轮可缩放（以鼠标为中心），移动鼠标可查看取值</span>
    </div>

    <div class="mt-2">
      <span class="field-label">表达式（每行一条，最多 8 条，自动配色）</span>
      <textarea v-model="exprText" class="textarea mono" style="min-height: 84px" placeholder="如 sin(x)*x^2、sqrt(x)、1/x、exp(-x/3)"></textarea>
    </div>

    <div class="cv-wrap mt-2">
      <canvas ref="canvas" class="cv" @wheel="onWheel" @mousemove="onMove" @mouseleave="tip = null"></canvas>
      <div v-if="tip" class="tip mono" :style="{ left: Math.min(tip.x + 14, (canvas?.clientWidth ?? 400) - 170) + 'px', top: Math.max(6, tip.y - 10) + 'px' }">
        <div v-for="(l, i) in tip.lines" :key="i">{{ l }}</div>
      </div>
    </div>

    <div class="legend mt-2">
      <span v-for="s in series" :key="s.expr + s.color" class="lg">
        <i :style="{ background: s.color }"></i>
        <code class="mono">{{ s.expr }}</code>
        <em v-if="s.error" class="err">{{ s.error }}</em>
      </span>
    </div>

    <div class="notice notice-info mt-2 small">
      <Activity :size="14" style="vertical-align: -2px" /> 表达式由 math.js 解析，支持 <code>sin cos tan asin sqrt abs log exp min max</code>、幂运算 <code>x^2</code>、省略乘号的 <code>2x</code> 与常量 <code>pi e</code>；除零、负数开方等会自动断线而不是报错。全程本地计算，PNG 导出经 canvas.toBlob 生成。
    </div>
  </div>
</template>

<style scoped>
.cv-wrap { position: relative; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.cv { display: block; width: 100%; height: 400px; cursor: crosshair; }
.tip {
  position: absolute;
  pointer-events: none;
  background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-2);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}
.legend { display: flex; flex-wrap: wrap; gap: 12px; }
.lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
.lg i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.lg .err { color: var(--err); font-style: normal; font-size: 12px; }
</style>
