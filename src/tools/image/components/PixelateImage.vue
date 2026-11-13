<script setup lang="ts">
/**
 * 像素化马赛克（UX1.0 五处方）：
 * - 互链引导（rx1）：hint 指向「图片区域打码」。
 * - 快捷档（rx2）：8/16/32/64 chips 与滑杆双向同步。
 * - 框选模式（rx3）：拖出矩形仅该区域像素化，支持多个区域；拖动过程实时预览。
 * - 数值输入（rx4）：滑杆旁数字输入框。
 * - 极端值警告（rx5）：块 ≥ 图片短边 1/2 时提示。
 */
import { nextTick, ref, shallowRef, watch } from 'vue'
import { applyOps } from '@/lib/imageEngine'
import ImageToolBase from './ImageToolBase.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const size = ref(8)
const regionMode = ref(false)
interface Rgn {
  x: number
  y: number
  w: number
  h: number
}
const regions = ref<Rgn[]>([])
const out = shallowRef<HTMLCanvasElement | null>(null)

const PRESETS = [8, 16, 32, 64]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  regions.value = []
  render()
}

function pixelateRegion(s: HTMLCanvasElement, r: Rgn): HTMLCanvasElement {
  const out2 = document.createElement('canvas')
  out2.width = s.width
  out2.height = s.height
  const ctx = out2.getContext('2d')!
  ctx.drawImage(s, 0, 0)
  const px = Math.max(2, Math.round(r.w * (size.value / 100) * (s.width / 100)))
  const block = Math.max(2, Math.min(size.value, px))
  const rx = Math.round((r.x / 100) * s.width)
  const ry = Math.round((r.y / 100) * s.height)
  const rw = Math.max(2, Math.round((r.w / 100) * s.width))
  const rh = Math.max(2, Math.round((r.h / 100) * s.height))
  const sub = document.createElement('canvas')
  sub.width = rw
  sub.height = rh
  sub.getContext('2d')!.drawImage(s, rx, ry, rw, rh, 0, 0, rw, rh)
  ctx.drawImage(applyOps(sub, [{ op: 'pixelate', size: block }]), rx, ry)
  return out2
}

function render() {
  const s = src.value
  if (!s) return
  let o: HTMLCanvasElement
  if (regionMode.value && regions.value.length) {
    o = document.createElement('canvas')
    o.width = s.width
    o.height = s.height
    const ctx = o.getContext('2d')!
    ctx.drawImage(s, 0, 0)
    for (const r of regions.value) {
      const px = Math.max(2, Math.min(size.value, Math.round((r.w / 100) * s.width)))
      const rx = Math.round((r.x / 100) * s.width)
      const ry = Math.round((r.y / 100) * s.height)
      const rw = Math.max(2, Math.round((r.w / 100) * s.width))
      const rh = Math.max(2, Math.round((r.h / 100) * s.height))
      const sub = document.createElement('canvas')
      sub.width = rw
      sub.height = rh
      sub.getContext('2d')!.drawImage(s, rx, ry, rw, rh, 0, 0, rw, rh)
      ctx.drawImage(applyOps(sub, [{ op: 'pixelate', size: px }]), rx, ry)
    }
  } else if (regionMode.value && temp.value) {
    o = pixelateRegion(s, temp.value)
  } else {
    o = applyOps(s, [{ op: 'pixelate', size: size.value }])
  }
  out.value = o
  base.value?.setOutput(o)
}

/** 框选拖拽（挂基座输出画布）：拖动即实时预览像素化效果 */
const temp = ref<Rgn | null>(null)
let down: { x: number; y: number } | null = null
function bindDrag() {
  const c = base.value?.output ?? null
  if (!c) return
  c.style.touchAction = 'none'
  c.style.cursor = regionMode.value ? 'crosshair' : 'default'
  c.onpointerdown = (e: PointerEvent) => {
    if (!regionMode.value) return
    e.preventDefault()
    c.setPointerCapture(e.pointerId)
    const rect = c.getBoundingClientRect()
    down = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 }
  }
  c.onpointermove = (e: PointerEvent) => {
    if (!regionMode.value || !down) return
    const rect = c.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    temp.value = {
      x: Math.min(x, down.x),
      y: Math.min(y, down.y),
      w: Math.abs(x - down.x),
      h: Math.abs(y - down.y),
    }
    render()
  }
  c.onpointerup = () => {
    if (temp.value && temp.value.w > 2 && temp.value.h > 2) regions.value.push(temp.value)
    temp.value = null
    down = null
    render()
  }
}
watch([out, regionMode], () => {
  void nextTick()
  bindDrag()
})

/** rx5 极端值警告 */
const extreme = () => src.value && size.value >= Math.min(src.value.width, src.value.height) / 2

let timer = 0
watch([size, regionMode, regions], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
}, { deep: true })
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label">快捷档</span>
      <button v-for="p in PRESETS" :key="p" class="chip" :class="{ active: size === p }" @click="size = p">{{ p }}</button>
    </div>
    <div class="row mt-2" style="gap: 14px; max-width: 460px; align-items: flex-end">
      <div style="flex: 1">
        <span class="field-label">马赛克块大小：{{ size }} px</span>
        <input v-model.number="size" type="range" min="2" max="64" step="1" />
      </div>
      <label class="opt">
        <span class="field-label">数值</span>
        <input v-model.number="size" type="number" min="2" max="64" class="input" style="width: 90px" />
      </label>
    </div>
    <div class="row row-wrap mt-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="regionMode" type="checkbox" /> 框选模式（仅选中区域像素化）</label>
      <button v-if="regionMode && regions.length" class="btn btn-ghost btn-sm" @click="((regions = []), render())">清空 {{ regions.length }} 个区域</button>
      <span v-if="regionMode" class="muted small">在预览图上按住拖出矩形，松手定格；可连续框选多个</span>
    </div>
    <p v-if="extreme()" class="notice notice-warn mt-2 small">块大小已达图片短边的一半以上 —— 输出将近乎纯色色块，通常不是你想要的效果。</p>
    <p class="muted small mt-1">
      块越大越抽象；用于遮挡人脸、车牌等敏感信息时建议 12px 以上。需要模糊 / 涂黑 / 多区域精细打码，请用
      <RouterLink to="/t/blur-region" class="link">图片区域打码</RouterLink>。
    </p>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.link {
  color: var(--accent-text);
  text-decoration: underline;
}
</style>
