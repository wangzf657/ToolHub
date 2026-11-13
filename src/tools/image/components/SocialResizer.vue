<script setup lang="ts">
/**
 * 社媒图片尺寸器（UX1.0）：
 * - 焦点可拖（rx1）：预览上拖动决定 cover 保留区（focus 点百分比），人像不再被居中裁切切头。
 * - 矩阵扩充（rx3）：13 个预设按平台分组（小红书/抖音/快手/微信/微博/B站/知乎），含 9:16 竖版。
 * - F-质量实时（rx4）：下载行 PNG｜JPG chips + 质量滑杆 + 实时体积。
 * - 平台记忆（rx5）：localStorage 记住上次所选平台（toolhub. 前缀）。
 */
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { canvasToBlob } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const platform = ref(0)
const width = ref(900)
const height = ref(383)
const result = shallowRef<HTMLCanvasElement | null>(null)
/** cover 保留区中心（0~1），默认居中 */
const fx = ref(0.5)
const fy = ref(0.5)

const PLATFORMS: { name: string; group: string; w: number; h: number }[] = [
  { name: '小红书竖图', group: '小红书', w: 1080, h: 1440 },
  { name: '小红书方图', group: '小红书', w: 1080, h: 1080 },
  { name: '抖音头像', group: '抖音/快手', w: 640, h: 640 },
  { name: '抖音竖版封面', group: '抖音/快手', w: 1080, h: 1920 },
  { name: '快手竖版封面', group: '抖音/快手', w: 1080, h: 1920 },
  { name: '朋友圈封面', group: '微信', w: 900, h: 383 },
  { name: '视频号封面', group: '微信', w: 1080, h: 1260 },
  { name: '公众号首图', group: '微信', w: 900, h: 383 },
  { name: '公众号次图', group: '微信', w: 383, h: 383 },
  { name: '微博头条图', group: '微博', w: 980, h: 450 },
  { name: 'B站视频封面', group: 'B站', w: 1146, h: 717 },
  { name: '知乎文章首图', group: '知乎', w: 1080, h: 608 },
]
const GROUPS = [...new Set(PLATFORMS.map((p) => p.group))]
const LS_KEY = 'toolhub.socialResizer.platform'

/* 平台记忆（rx5） */
try {
  const saved = Number(localStorage.getItem(LS_KEY))
  if (Number.isInteger(saved) && saved >= 0 && saved < PLATFORMS.length) {
    platform.value = saved
    width.value = PLATFORMS[saved]!.w
    height.value = PLATFORMS[saved]!.h
  }
} catch { /* 忽略 */ }

function pick(i: number) {
  platform.value = i
  width.value = PLATFORMS[i]!.w
  height.value = PLATFORMS[i]!.h
  try {
    localStorage.setItem(LS_KEY, String(i))
  } catch { /* 忽略 */ }
}

/** cover 裁切 + focus 保留区（rx1）：focus 决定裁掉哪一侧 */
function render() {
  const src = base.value?.source
  if (!src || !width.value || !height.value) return
  const W = width.value
  const H = height.value
  const s = Math.max(W / src.width, H / src.height)
  const sw = src.width * s
  const sh = src.height * s
  const left = (sw - W) * fx.value
  const top = (sh - H) * fy.value
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, left / s, top / s, W / s, H / s, 0, 0, W, H)
  result.value = out
  base.value?.setOutput(out)
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = result.value ?? render()
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, mime, quality)
}

function onLoaded() {
  render()
}

/* 预览拖动：把 focus 拖到想要的位置（pointer 事件 + touch-action none） */
let dragging = false
function pos(e: PointerEvent): { x: number; y: number } | null {
  const c = result.value
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }
}
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  onDrag(e)
}
function onDrag(e: PointerEvent) {
  if (!dragging) return
  const p = pos(e)
  if (!p) return
  fx.value = Math.min(1, Math.max(0, p.x))
  fy.value = Math.min(1, Math.max(0, p.y))
}
function onUp() {
  dragging = false
}

function bindDrag() {
  const c = result.value
  if (!c) return
  c.style.touchAction = 'none'
  c.style.cursor = 'grab'
  c.removeEventListener('pointerdown', onDown)
  c.addEventListener('pointerdown', onDown)
}
onBeforeUnmount(() => {
  result.value?.removeEventListener('pointerdown', onDown)
})

let timer = 0
watch([platform, width, height, fx, fy], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    render()
    bindDrag()
  }, 100)
})
watch(result, () => bindDrag(), { flush: 'post' })
</script>

<template>
  <ImageToolBase ref="base" suffix="-social" @loaded="onLoaded">
    <div v-for="g in GROUPS" :key="g" class="grp mt-2">
      <span class="field-label">{{ g }}</span>
      <div class="chips">
        <button
          v-for="(p, i) in PLATFORMS.filter((x) => x.group === g)"
          :key="p.name"
          class="chip"
          :class="{ active: platform === PLATFORMS.indexOf(p) }"
          @click="pick(PLATFORMS.indexOf(p))"
        >
          {{ p.name }} {{ p.w }}×{{ p.h }}
        </button>
      </div>
    </div>
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">宽（px）</span>
        <input v-model.number="width" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">高（px）</span>
        <input v-model.number="height" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <span class="muted small">
        「裁满 cover」不变形；直接在预览图上按住拖动，把保留区对准主体（当前焦点 {{ Math.round(fx * 100) }}%, {{ Math.round(fy * 100) }}%）
      </span>
    </div>
    <ExportBar
      class="mt-2"
      :formats="['png', 'jpg']"
      :produce="produce"
      :base-name="base?.file ? base.file.name.replace(/\.[^.]+$/, '') : 'social'"
      :dirty-token="`${platform}-${width}-${height}-${fx}-${fy}`"
    />
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.grp {
  display: grid;
  gap: 6px;
}
.opt {
  display: grid;
  gap: 4px;
}
</style>
