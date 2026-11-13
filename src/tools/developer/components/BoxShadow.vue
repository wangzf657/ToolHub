<script setup lang="ts">
import { computed, ref } from 'vue'
import { Box, Copy, Check, Plus, Trash2 } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Layer {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  alpha: number
  inset: boolean
}
/** 多层阴影（rx1）：默认 1 层，可加至 5 层，CSS 逗号拼接 */
const layers = ref<Layer[]>([{ x: 0, y: 10, blur: 24, spread: 0, color: '#000000', alpha: 30, inset: false }])
const addLayer = () => {
  if (layers.value.length >= 5) return toast.warn('最多 5 层')
  layers.value.push({ x: 0, y: 8, blur: 16, spread: -2, color: '#000000', alpha: 16, inset: false })
}
const removeLayer = (i: number) => {
  if (layers.value.length > 1) layers.value.splice(i, 1)
}

const rgbaOf = (l: Layer) => {
  const hex = l.color.replace('#', '')
  const n = Number.parseInt(hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${(l.alpha / 100).toFixed(2)})`
}

const css = computed(() => layers.value.map((l) => `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${rgbaOf(l)}`).join(', '))

/** 预设库（rx2）：Material 6 级 + 柔和 5 级 */
const PRESETS: { name: string; layers: Layer[] }[] = [
  { name: '扁平 1', layers: [{ x: 0, y: 1, blur: 3, spread: 0, color: '#000000', alpha: 20, inset: false }] },
  { name: '扁平 2', layers: [{ x: 0, y: 1, blur: 5, spread: 0, color: '#000000', alpha: 24, inset: false }] },
  { name: '层次 1', layers: [{ x: 0, y: 2, blur: 4, spread: -1, color: '#000000', alpha: 20, inset: false }, { x: 0, y: 4, blur: 6, spread: -2, color: '#000000', alpha: 12, inset: false }] },
  { name: '层次 2', layers: [{ x: 0, y: 3, blur: 6, spread: -1, color: '#000000', alpha: 20, inset: false }, { x: 0, y: 8, blur: 12, spread: -4, color: '#000000', alpha: 12, inset: false }] },
  { name: '层次 3', layers: [{ x: 0, y: 4, blur: 8, spread: -2, color: '#000000', alpha: 20, inset: false }, { x: 0, y: 12, blur: 20, spread: -6, color: '#000000', alpha: 14, inset: false }] },
  { name: '层次 4', layers: [{ x: 0, y: 6, blur: 10, spread: -2, color: '#000000', alpha: 20, inset: false }, { x: 0, y: 16, blur: 30, spread: -8, color: '#000000', alpha: 14, inset: false }] },
  { name: '层次 5', layers: [{ x: 0, y: 8, blur: 14, spread: -2, color: '#000000', alpha: 20, inset: false }, { x: 0, y: 24, blur: 40, spread: -10, color: '#000000', alpha: 16, inset: false }] },
  { name: '柔和大阴影', layers: [{ x: 0, y: 20, blur: 50, spread: -12, color: '#1e293b', alpha: 25, inset: false }] },
  { name: '聚焦光晕', layers: [{ x: 0, y: 0, blur: 0, spread: 3, color: '#6366f1', alpha: 45, inset: false }, { x: 0, y: 0, blur: 18, spread: 6, color: '#6366f1', alpha: 25, inset: false }] },
  { name: '内凹输入框', layers: [{ x: 0, y: 2, blur: 6, spread: 0, color: '#000000', alpha: 14, inset: true }] },
  { name: '卡片浮起', layers: [{ x: 0, y: 12, blur: 32, spread: -6, color: '#0f172a', alpha: 28, inset: false }] },
]
const applyPreset = (p: { name: string; layers: Layer[] }) => {
  layers.value = p.layers.map((l) => ({ ...l }))
  toast.ok(`已载入预设「${p.name}」`)
}

const copied = ref(false)
const doCopy = async () => {
  const okFlag = await copyText(`box-shadow: ${css.value};`)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('box-shadow 已复制')
  } else toast.err('复制失败')
}

/** 预览底色切换（rx4）：亮/暗/自定义，移除硬编码底色 */
const stageBg = ref<'light' | 'dark' | 'custom'>('light')
const customBg = ref('#e2e8f0')
const stageStyle = computed(() => (stageBg.value === 'light' ? '#f1f5f9' : stageBg.value === 'dark' ? '#0f172a' : customBg.value))

/** 数值手输（rx5）：滑杆旁数字输入框，双向绑定 */
const clampRange = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : 0)))

/** 拖拽偏移（rx3）：拖动演示盒改第 1 层 x/y，Shift 吸附 5px */
const dragBox = ref<HTMLElement | null>(null)
const dragging = ref(false)
let startX = 0
let startY = 0
let baseX = 0
let baseY = 0
const onDragStart = (e: MouseEvent) => {
  dragging.value = true
  startX = e.clientX
  startY = e.clientY
  baseX = layers.value[0]!.x
  baseY = layers.value[0]!.y
  e.preventDefault()
}
const onDragMove = (e: MouseEvent) => {
  if (!dragging.value) return
  const snap = e.shiftKey ? 5 : 1
  const dx = Math.round((e.clientX - startX) / snap) * snap
  const dy = Math.round((e.clientY - startY) / snap) * snap
  layers.value[0]!.x = clampRange(baseX + dx, -200, 200)
  layers.value[0]!.y = clampRange(baseY + dy, -200, 200)
}
const onDragEnd = () => (dragging.value = false)
</script>

<template>
  <div class="shadow-gen">
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">预设</span>
      <button v-for="p in PRESETS" :key="p.name" class="chip" @click="applyPreset(p)">{{ p.name }}</button>
    </div>

    <div class="layout">
      <div class="stage" :style="{ background: stageStyle }">
        <div
          ref="dragBox"
          class="demo-box"
          :style="{ boxShadow: css, cursor: dragging ? 'grabbing' : 'grab' }"
          @mousedown="onDragStart"
          @mousemove="onDragMove"
          @mouseup="onDragEnd"
          @mouseleave="onDragEnd"
        >拖我调偏移</div>
      </div>

      <div class="controls">
        <div class="row row-wrap" style="gap: 8px; align-items: center">
          <span class="field-label" style="margin: 0">预览底色</span>
          <select v-model="stageBg" class="select" style="width: 100px">
            <option value="light">亮</option>
            <option value="dark">暗</option>
            <option value="custom">自定义</option>
          </select>
          <input v-if="stageBg === 'custom'" v-model="customBg" type="color" class="color-pick" />
        </div>

        <div v-for="(l, i) in layers" :key="i" class="layer-box">
          <div class="row row-wrap" style="gap: 8px; align-items: center">
            <b class="small">第 {{ i + 1 }} 层</b>
            <button v-if="layers.length > 1" class="btn btn-ghost btn-sm" @click="removeLayer(i)"><Trash2 :size="13" /> 删除本层</button>
          </div>
          <div class="ctrl"><span>偏移 X</span><input v-model.number="l.x" type="range" min="-200" max="200" /><input v-model.number="l.x" type="number" class="input mono num" /><b class="mono">{{ l.x }}px</b></div>
          <div class="ctrl"><span>偏移 Y</span><input v-model.number="l.y" type="range" min="-200" max="200" /><input v-model.number="l.y" type="number" class="input mono num" /><b class="mono">{{ l.y }}px</b></div>
          <div class="ctrl"><span>模糊</span><input v-model.number="l.blur" type="range" min="0" max="400" /><input v-model.number="l.blur" type="number" class="input mono num" /><b class="mono">{{ l.blur }}px</b></div>
          <div class="ctrl"><span>扩散</span><input v-model.number="l.spread" type="range" min="-100" max="200" /><input v-model.number="l.spread" type="number" class="input mono num" /><b class="mono">{{ l.spread }}px</b></div>
          <div class="ctrl"><span>颜色</span><input v-model="l.color" type="color" class="color-pick" /><input v-model="l.color" type="text" class="input mono" style="width: 96px" /><label class="check" style="gap: 4px; font-size: 12.5px"><input v-model="l.inset" type="checkbox" /> 内阴影</label></div>
          <div class="ctrl"><span>不透明度</span><input v-model.number="l.alpha" type="range" min="0" max="100" /><b class="mono">{{ l.alpha }}%</b></div>
        </div>
        <button class="btn btn-soft btn-sm" @click="addLayer"><Plus :size="13" /> 加一层（最多 5 层）</button>
        <p class="muted small">拖动预览盒可调第 1 层偏移（按住 Shift 吸附 5px）。</p>
      </div>
    </div>

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <span class="field-label" style="margin: 0"><Box :size="14" style="vertical-align: -2px" /> CSS 输出</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy"><Check v-if="copied" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制</button>
      </div>
      <pre class="code mono">box-shadow: {{ css }};</pre>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: stretch;
}
.stage {
  border: 1px solid var(--border);
  border-radius: 14px;
  /* 底色由底色切换控制（rx4），不再硬编码 */
  transition: background 0.2s ease;
  display: grid;
  place-items: center;
  min-height: 220px;
}
.demo-box {
  width: 160px;
  height: 110px;
  border-radius: 12px;
  background: #ffffff;
  color: #475569;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 600;
  transition: box-shadow 0.15s ease;
  user-select: none;
}
.controls {
  display: grid;
  gap: 10px;
  align-content: start;
}
.layer-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: var(--text-2);
}
.ctrl > span:first-child {
  flex: none;
  width: 62px;
}
.ctrl input[type='range'] {
  flex: 1;
}
.num {
  width: 64px;
  padding: 4px 8px;
  font-size: 12.5px;
}
.ctrl b {
  flex: none;
  width: 52px;
  text-align: right;
  font-size: 12.5px;
}
.color-pick {
  width: 36px;
  height: 30px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: none;
  padding: 2px;
  cursor: pointer;
}
.code {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
