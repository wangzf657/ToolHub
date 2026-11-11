<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Minus, Square, Circle, Type, Undo2, Redo2, Trash2, Download } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'text'
interface Shape { tool: Tool; color: string; width: number; pts: { x: number; y: number }[]; text?: string }
const tool = ref<Tool>('pen')
const color = ref('#4f46e5')
const width = ref(3)
const shapes = ref<Shape[]>([])
/** 撤销/重做均为「全量形状快照」栈：任何变更（画一笔、加文字、清空）前先存快照，清空因此可整体撤销 */
const undoStack = ref<Shape[][]>([])
const redoStack = ref<Shape[][]>([])
const drawing = ref<Shape | null>(null)

const canvasRef = ref<HTMLCanvasElement | null>(null)

const pos = (e: PointerEvent): { x: number; y: number } => {
  const cv = canvasRef.value!
  const r = cv.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }
}

/** 深拷贝当前形状列表为历史快照（点位逐点复制，避免栈内外互相影响） */
const snapshot = (): Shape[] => shapes.value.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p })) }))

/** 每次变更前调用：快照入撤销栈并作废重做分支 */
const pushHistory = () => {
  undoStack.value.push(snapshot())
  redoStack.value = []
}

const drawShape = (g: CanvasRenderingContext2D, s: Shape) => {
  g.strokeStyle = s.color
  g.fillStyle = s.color
  g.lineWidth = s.width
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const p = s.pts
  if (s.tool === 'pen' || p.length < 2) {
    if (s.tool === 'text') {
      g.font = `${s.width * 8 + 8}px sans-serif`
      g.fillText(s.text ?? '', p[0]?.x ?? 0, p[0]?.y ?? 0)
      return
    }
    if (p.length < 2) {
      g.beginPath()
      g.arc(p[0]?.x ?? 0, p[0]?.y ?? 0, s.width / 2, 0, Math.PI * 2)
      g.fill()
      return
    }
    g.beginPath()
    g.moveTo(p[0]!.x, p[0]!.y)
    for (let i = 1; i < p.length; i++) g.lineTo(p[i]!.x, p[i]!.y)
    g.stroke()
    return
  }
  const [a, b] = [p[0]!, p[p.length - 1]!]
  g.beginPath()
  if (s.tool === 'line') {
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
    g.stroke()
  } else if (s.tool === 'rect') {
    g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
  } else {
    g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2)
    g.stroke()
  }
}

const render = () => {
  const cv = canvasRef.value
  if (!cv) return
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, cv.width, cv.height)
  for (const s of shapes.value) drawShape(g, s)
  if (drawing.value) drawShape(g, drawing.value)
}

const down = (e: PointerEvent) => {
  canvasRef.value?.setPointerCapture(e.pointerId)
  const p = pos(e)
  if (tool.value === 'text') {
    const t = window.prompt('输入文字内容')
    if (!t) return
    pushHistory()
    shapes.value.push({ tool: 'text', color: color.value, width: width.value, pts: [p], text: t })
    render()
    return
  }
  drawing.value = { tool: tool.value, color: color.value, width: width.value, pts: [p] }
}

const move = (e: PointerEvent) => {
  if (!drawing.value) return
  drawing.value.pts.push(pos(e))
  render()
}

const up = () => {
  if (!drawing.value) return
  pushHistory()
  shapes.value.push(drawing.value)
  drawing.value = null
  render()
}

const undo = () => {
  const prev = undoStack.value.pop()
  if (!prev) return
  redoStack.value.push(snapshot())
  shapes.value = prev
  render()
}

const redo = () => {
  const next = redoStack.value.pop()
  if (!next) return
  undoStack.value.push(snapshot())
  shapes.value = next
  render()
}

const clearAll = () => {
  if (!shapes.value.length) return
  // 清空作为一次可撤销操作推入历史栈：误触清空后撤销即可整体恢复（旧实现的快照从不被 undo 消费）
  pushHistory()
  shapes.value = []
  render()
}

const exportPng = () => {
  const cv = canvasRef.value
  if (!cv) return
  cv.toBlob((b) => {
    if (b) {
      saveBlob(b, '白板.png')
      toast.ok('已导出 PNG')
    }
  }, 'image/png')
}

onMounted(render)
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <button v-for="t in ([['pen', Pencil, '画笔'], ['line', Minus, '直线'], ['rect', Square, '矩形'], ['ellipse', Circle, '椭圆'], ['text', Type, '文字']] as [Tool, unknown, string][])" :key="t[0]" class="seg" :class="{ active: tool === t[0] }" @click="tool = t[0]">
          <component :is="t[1]" :size="14" style="vertical-align: -2px" /> {{ t[2] }}
        </button>
        <input v-model="color" type="color" class="input" style="width: 40px; height: 30px; padding: 2px" />
        <span class="field-label">线宽</span>
        <input v-model.number="width" type="range" min="1" max="16" style="width: 90px" />
        <span class="spacer"></span>
        <button class="mini-btn" title="撤销" @click="undo"><Undo2 :size="15" /></button>
        <button class="mini-btn" title="重做" @click="redo"><Redo2 :size="15" /></button>
        <button class="mini-btn" title="清空" @click="clearAll"><Trash2 :size="15" /></button>
        <button class="btn btn-primary btn-sm" @click="exportPng"><Download :size="14" /> 导出 PNG</button>
      </div>
    </div>
    <canvas
      ref="canvasRef"
      width="820"
      height="460"
      class="board mt-2"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
    ></canvas>
  </div>
</template>

<style scoped>
.gap { gap: 8px; align-items: center; }
.spacer { flex: 1; }
.seg { padding: 5px 11px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 12.5px; background: transparent; color: var(--text); }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.mini-btn { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 7px; width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; }
.mini-btn:hover { border-color: var(--accent); }
.board { width: 100%; max-width: 820px; display: block; margin: 0 auto; border: 1px solid var(--border); border-radius: 12px; background: var(--panel-solid, #fff); cursor: crosshair; touch-action: none; }
</style>
