<script setup lang="ts">
/**
 * 旋转图片（UX1.0）：
 * - F-导出格式（rx1/P0）：下载行 PNG｜JPG｜WebP chips + 质量滑杆 + 实时体积（localStorage 记忆）。
 * - 数值角度（rx2）：滑杆旁数字输入（-180~180，0.1 步进）双向同步。
 * - 裁回原矩形（rx3）：自由角度勾选「裁掉透明边」后输出原图内接矩形，无透明角。
 * - 键盘快捷（rx5）：R / Shift+R 直角旋转、0 复位（输入框聚焦时不响应）。
 * - 批量引导（rx6）：结果区「带图去批量处理」入口，当前图片自动带入 batch-image-process。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RotateCw, RotateCcw, Undo2, Layers } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { applyOps, canvasToBlob } from '@/lib/imageEngine'
import { useToast } from '@/composables/useToast'
import { handoffImage } from './handoff'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const quarter = ref(0)
const angle = ref(0)
const cropBack = ref(false)
const out = shallowRef<HTMLCanvasElement | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  quarter.value = 0
  angle.value = 0
  render()
}

function rotate(dir: 1 | -1) {
  quarter.value = (quarter.value + dir * 90 + 360) % 360
  render()
}

function resetAngle() {
  quarter.value = 0
  angle.value = 0
  render()
}

/** 主渲染：直角旋转 + 自由角度（外接画布），可选裁回原图内接矩形 */
function render(): HTMLCanvasElement | null {
  const s = src.value
  if (!s) return null
  let c = s
  if (quarter.value !== 0) {
    const deg = quarter.value === 90 ? 90 : quarter.value === 180 ? 180 : 270
    c = applyOps(c, [{ op: 'rotate', deg: deg as 90 | 180 | 270 }])
  }
  if (angle.value !== 0) {
    const rad = (angle.value * Math.PI) / 180
    const w = c.width
    const h = c.height
    const nw = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)))
    const nh = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)))
    const t = document.createElement('canvas')
    t.width = nw
    t.height = nh
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(nw / 2, nh / 2)
    ctx.rotate(rad)
    ctx.drawImage(c, -w / 2, -h / 2)
    if (cropBack.value) {
      // 原图内接矩形（同宽高比）：Y = min(w/(a·cosθ+h…) 标准公式
      let a0 = Math.abs(angle.value) % 180
      if (a0 > 90) a0 = 180 - a0
      if (a0 > 0.05) {
        const rad2 = (a0 * Math.PI) / 180
        const cs = Math.abs(Math.cos(rad2))
        const sn = Math.abs(Math.sin(rad2))
        const ar = w / h
        const Y = Math.min(w / (ar * cs + sn), h / (ar * sn + cs))
        const X = ar * Y
        const out2 = document.createElement('canvas')
        out2.width = Math.round(X)
        out2.height = Math.round(Y)
        out2.getContext('2d')!.drawImage(t, (nw - X) / 2, (nh - Y) / 2, X, Y, 0, 0, out2.width, out2.height)
        c = out2
      } else {
        c = t
      }
    } else {
      c = t
    }
  }
  out.value = c
  base.value?.setOutput(c)
  return c
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = out.value ?? render()
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, mime, quality)
}

/* 键盘快捷：R/Shift+R 直角、0 复位（输入控件聚焦时不响应） */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return
  if (e.key === 'r' || e.key === 'R') {
    rotate(e.shiftKey ? -1 : 1)
  } else if (e.key === '0') {
    resetAngle()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function goBatch() {
  const f = base.value?.file
  if (f) handoffImage(f)
  toast.ok('已带入批量处理')
}

let timer = 0
watch([quarter, angle, cropBack], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-rotated" @loaded="onLoaded">
    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost btn-sm" @click="rotate(-1)"><RotateCcw :size="15" /> 逆时针 90°（R）</button>
      <button class="btn btn-ghost btn-sm" @click="rotate(1)"><RotateCw :size="15" /> 顺时针 90°</button>
      <button class="btn btn-ghost btn-sm" @click="((rotate(1), rotate(1)))">180°</button>
      <button class="btn btn-ghost btn-sm" @click="resetAngle"><Undo2 :size="15" /> 复位（0）</button>
    </div>
    <div class="row mt-2" style="gap: 14px; flex-wrap: wrap">
      <div style="max-width: 380px; flex: 1">
        <span class="field-label">自由角度：{{ angle }}°（扩展画布填透明）</span>
        <input v-model.number="angle" type="range" min="-180" max="180" step="0.1" />
      </div>
      <label class="opt">
        <span class="field-label">角度数值（°）</span>
        <input v-model.number="angle" type="number" min="-180" max="180" step="0.1" class="input" style="width: 110px" />
      </label>
      <label class="check" style="margin-top: 20px">
        <input v-model="cropBack" type="checkbox" /> 裁掉透明边（输出原图内接矩形）
      </label>
    </div>
    <div class="row row-wrap mt-2">
      <ExportBar
        :produce="produce"
        :base-name="base?.file ? base.file.name.replace(/\.[^.]+$/, '') : 'image'"
        :dirty-token="`${quarter}-${angle}-${cropBack}`"
      />
      <button class="btn btn-soft btn-sm" @click="goBatch"><Layers :size="14" /> 带图去批量处理</button>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
</style>
