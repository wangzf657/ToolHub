<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, RotateCw, X } from 'lucide-vue-next'
import { pdfInfo, renderPageToCanvas } from '@/lib/pdfEngine'

/** 页面条目：index 为原始页索引（0 基），rotation 为额外旋转角 */
export interface PageEntry {
  index: number
  rotation: number
}

/**
 * PDF 页面缩略图墙：懒加载渲染（IntersectionObserver + 顺序队列）、
 * 每页勾选（v-model:checked）、排序/旋转/删除（v-model:order）、旋转角标。
 * 结构变化（排序/删除/旋转）时 emit('render') 供父组件刷新预览。
 */
const props = withDefaults(
  defineProps<{
    file: File | Blob
    movable?: boolean
    removable?: boolean
    rotatable?: boolean
    selectable?: boolean
  }>(),
  { movable: true, removable: false, rotatable: true, selectable: false },
)

const checked = defineModel<number[]>('checked', { default: () => [] })
const order = defineModel<PageEntry[]>('order', { default: () => [] })
const emit = defineEmits<{ render: [] }>()

const total = ref(0)
const rendered = ref<Record<number, string>>({})
const failed = ref<Set<number>>(new Set())
const doneCount = ref(0)

const observed = new Set<number>()
let io: IntersectionObserver | null = null
const queue: number[] = []
let pumping = false
let token = 0

const reset = async () => {
  const my = ++token
  rendered.value = {}
  failed.value = new Set()
  doneCount.value = 0
  total.value = 0
  queue.length = 0
  observed.clear()
  try {
    const info = await pdfInfo(props.file)
    if (my !== token) return
    total.value = info.pages
    if (!order.value.length || order.value.length !== info.pages) {
      order.value = Array.from({ length: info.pages }, (_, i) => ({ index: i, rotation: 0 }))
    }
  } catch {
    /* 文件读取失败由父组件提示 */
  }
}

watch(() => props.file, reset, { immediate: true })

const register = (idx: number, el: unknown) => {
  const el2 = el as HTMLElement | null
  if (el2) {
    el2.dataset.idx = String(idx)
    if (!observed.has(idx)) {
      observed.add(idx)
      io?.observe(el2)
    }
  }
}

// 懒加载：滚动到视口附近才入队渲染
if (typeof IntersectionObserver !== 'undefined') {
  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const idx = Number((en.target as HTMLElement).dataset.idx)
          if (!Number.isNaN(idx)) enqueue(idx)
        }
      }
    },
    { rootMargin: '300px' },
  )
} else {
  // 降级：直接顺序渲染
  watch(total, (n) => n && Array.from({ length: n }, (_, i) => enqueue(i)))
}

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

const enqueue = (idx: number) => {
  if (rendered.value[idx] || failed.value.has(idx) || queue.includes(idx)) return
  queue.push(idx)
  void pump()
}

const pump = async () => {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const idx = queue.shift()!
    if (rendered.value[idx] || failed.value.has(idx)) continue
    try {
      const canvas = await renderPageToCanvas(props.file, idx, 0.35)
      if (canvas.width > 0) rendered.value[idx] = canvas.toDataURL('image/png')
      else failed.value.add(idx)
    } catch {
      failed.value.add(idx)
    }
    doneCount.value++
  }
  pumping = false
}

/* ---- 交互：勾选 / 排序 / 旋转 / 删除 ---- */

const toggle = (idx: number) => {
  if (!props.selectable) return
  const cur = checked.value.includes(idx) ? checked.value.filter((i) => i !== idx) : [...checked.value, idx]
  checked.value = cur.sort((a, b) => a - b)
}

const move = (pos: number, dir: -1 | 1) => {
  const j = pos + dir
  if (j < 0 || j >= order.value.length) return
  const arr = [...order.value]
  ;[arr[pos], arr[j]] = [arr[j], arr[pos]]
  order.value = arr
  emit('render')
}

const rotate = (pos: number) => {
  const arr = [...order.value]
  arr[pos] = { ...arr[pos], rotation: (arr[pos].rotation + 90) % 360 }
  order.value = arr
  emit('render')
}

const remove = (pos: number) => {
  const arr = [...order.value]
  arr.splice(pos, 1)
  order.value = arr
  emit('render')
}

/* ---- HTML5 拖拽排序 ---- */
const dragFrom = ref(-1)
const onDropAt = (pos: number) => {
  const from = dragFrom.value
  dragFrom.value = -1
  if (from < 0 || from === pos) return
  const arr = [...order.value]
  const [it] = arr.splice(from, 1)
  arr.splice(pos, 0, it)
  order.value = arr
  emit('render')
}

const pct = () => (total.value ? Math.round((doneCount.value / total.value) * 100) : 0)
</script>

<template>
  <div class="pt-wrap">
    <div v-if="doneCount < total" class="pt-progress">
      <div class="bar"><div class="fill" :style="{ width: pct() + '%' }" /></div>
      <span class="small muted">{{ doneCount }}/{{ total }}</span>
    </div>
    <div class="thumbs">
      <div
        v-for="(e, pos) in order"
        :key="e.index"
        class="cell"
        :ref="(el) => register(e.index, el)"
        :draggable="movable"
        @dragstart="dragFrom = pos"
        @dragover.prevent
        @drop.prevent="onDropAt(pos)"
      >
        <div class="thumb" :class="{ pickable: selectable, sel: selectable && checked.includes(e.index) }" @click="toggle(e.index)">
          <img v-if="rendered[e.index]" :src="rendered[e.index]" alt="" draggable="false" />
          <div v-else-if="failed.has(e.index)" class="thumb-err">失败</div>
          <div v-else class="skeleton" />
          <span class="pno">{{ e.index + 1 }}</span>
          <span v-if="e.rotation" class="badge-rot">{{ e.rotation }}°</span>
          <span v-if="selectable" class="tick" :class="{ on: checked.includes(e.index) }">✓</span>
        </div>
        <div v-if="movable || rotatable || removable" class="ops">
          <button v-if="movable" class="mini" title="上移" @click="move(pos, -1)"><ChevronUp :size="13" /></button>
          <button v-if="movable" class="mini" title="下移" @click="move(pos, 1)"><ChevronDown :size="13" /></button>
          <button v-if="rotatable" class="mini" title="旋转 90°" @click="rotate(pos)"><RotateCw :size="13" /></button>
          <button v-if="removable" class="mini danger" title="删除此页" @click="remove(pos)"><X :size="13" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pt-wrap { display: grid; gap: 8px; }
.pt-progress { display: flex; align-items: center; gap: 10px; }
.bar, .fill { height: 6px; border-radius: 999px; }
.bar { flex: 1; background: var(--bg-soft); overflow: hidden; }
.fill { background: var(--accent); transition: width 0.2s; }
.thumbs { display: flex; flex-wrap: wrap; gap: 10px; }
.cell { display: grid; gap: 4px; justify-items: center; }
.thumb { position: relative; width: 104px; height: 140px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg-soft); }
.thumb.pickable { cursor: pointer; }
.thumb.sel { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.thumb img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.skeleton {
  width: 100%; height: 100%;
  background: linear-gradient(90deg, var(--bg-soft) 25%, var(--panel-hover) 50%, var(--bg-soft) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
.thumb-err { display: grid; place-items: center; height: 100%; font-size: 11px; color: var(--text-3); }
.pno, .badge-rot, .tick { position: absolute; display: grid; place-items: center; border-radius: 999px; font-size: 10.5px; font-weight: 700; }
.pno { left: 4px; top: 4px; min-width: 18px; height: 18px; padding: 0 4px; background: rgba(20, 20, 30, 0.65); color: #fff; }
.badge-rot { right: 4px; bottom: 4px; padding: 1px 6px; background: rgba(20, 20, 30, 0.65); color: #ffd479; }
.tick { right: 4px; top: 4px; width: 18px; height: 18px; border: 1.5px solid rgba(255, 255, 255, 0.9); background: rgba(20, 20, 30, 0.45); color: transparent; }
.tick.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.ops { display: flex; gap: 4px; }
.mini {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 24px;
  height: 22px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini:hover { border-color: var(--accent); color: var(--text); }
.mini.danger:hover { border-color: var(--err); color: var(--err); }
</style>

