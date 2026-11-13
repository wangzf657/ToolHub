<script setup lang="ts">
/**
 * 图片叠加（UX1.0 五处方）：
 * - 混合模式（rx1）：正常/正片叠底/滤色/变亮/变暗（白底印章选正片叠底即去白底）。
 * - 失败提示（rx2）：叠加图解码失败明确 toast 中文报错。
 * - 拖拽定位（rx3）：预览画布拖动叠加图，松手定格，导出像素级一致。
 * - 边距（rx4）：0~200px 滑杆（与 video-watermark 同名同范围）。
 * - 旋转（rx5）：-180°~180°。
 */
import { nextTick, ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { canvasToBlob } from '@/lib/imageEngine'
import FileDrop from '@/components/common/FileDrop.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const top = shallowRef<HTMLCanvasElement | null>(null)
const scale = ref(25) // %
const opacity = ref(100) // %
const position = ref('bottom-right')
const blend = ref('source-over')
const margin = ref(40) // px（rx4，与 video-watermark 一致 0~200）
const rotation = ref(0) // rx5
/** 拖拽定位（rx3）：叠加图中心点比例，null = 使用九宫位置 */
const dragPos = ref<{ x: number; y: number } | null>(null)
const out = shallowRef<HTMLCanvasElement | null>(null)

const BLENDS = [
  { v: 'source-over', t: '正常' },
  { v: 'multiply', t: '正片叠底' },
  { v: 'screen', t: '滤色' },
  { v: 'lighten', t: '变亮' },
  { v: 'darken', t: '变暗' },
]

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  dragPos.value = null
  render()
}

async function onTopFiles(files: File[]) {
  if (!files.length) {
    top.value = null
    render()
    return
  }
  try {
    top.value = await (await import('@/lib/imageEngine')).decodeToCanvas(files[0])
    dragPos.value = null
    render()
  } catch {
    // rx2 明确中文报错
    toast.err('图片解码失败，请检查文件是否为有效图像')
  }
}

function render(): HTMLCanvasElement | null {
  const c = src.value
  const t = top.value
  if (!c) return null
  if (!t) {
    base.value?.setOutput(null)
    out.value = null
    return null
  }
  const w = t.width * (scale.value / 100)
  const h = t.height * (scale.value / 100)
  const pad = Math.max(0, Math.round(margin.value))
  let cx: number
  let cy: number
  if (dragPos.value) {
    cx = dragPos.value.x * c.width
    cy = dragPos.value.y * c.height
  } else {
    const xs = [pad + w / 2, c.width / 2, c.width - pad - w / 2]
    const ys = [pad + h / 2, c.height / 2, c.height - pad - h / 2]
    const col = position.value.includes('left') ? 0 : position.value.includes('right') ? 2 : 1
    const row = position.value.includes('top') ? 0 : position.value.includes('bottom') ? 2 : 1
    cx = xs[col]!
    cy = ys[row]!
  }
  const outCv = document.createElement('canvas')
  outCv.width = c.width
  outCv.height = c.height
  const ctx = outCv.getContext('2d')!
  ctx.drawImage(c, 0, 0)
  ctx.save()
  ctx.globalAlpha = opacity.value / 100
  ctx.globalCompositeOperation = blend.value as GlobalCompositeOperation
  ctx.translate(cx, cy)
  if (rotation.value !== 0) ctx.rotate((rotation.value * Math.PI) / 180)
  ctx.drawImage(t, -w / 2, -h / 2, w, h)
  ctx.restore()
  out.value = outCv
  base.value?.setOutput(outCv)
  return outCv
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = render()
  if (!c) throw new Error('请先添加底图与叠加图')
  return canvasToBlob(c, mime, quality)
}

/* rx3 拖拽定位：挂在基座输出 canvas 上 */
function bindDrag() {
  const c = base.value?.output ?? null
  if (!c) return
  c.style.touchAction = 'none'
  c.style.cursor = 'move'
  c.onpointerdown = (e: PointerEvent) => {
    if (!top.value) return
    e.preventDefault()
    c.setPointerCapture(e.pointerId)
    const rect = c.getBoundingClientRect()
    dragPos.value = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
    render()
  }
}
watch(out, () => {
  void nextTick()
  bindDrag()
})

let timer = 0
watch([top, scale, opacity, position, blend, margin, rotation], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-overlay" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 24px; align-items: flex-start">
      <div style="min-width: 260px">
        <span class="field-label">叠加图（Logo / 印章 / 另一张照片）</span>
        <FileDrop accept="image/*" :multiple="false" label="拖放叠加图到此处" hint="建议使用透明背景 PNG；白底印章可用「正片叠底」去白底" @files="onTopFiles" />
      </div>
      <div class="grow" style="min-width: 250px">
        <span class="field-label">混合模式</span>
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <button v-for="b in BLENDS" :key="b.v" class="chip" :class="{ active: blend === b.v }" @click="blend = b.v">{{ b.t }}</button>
        </div>
        <span class="field-label mt-1">缩放：{{ scale }}%</span>
        <input v-model.number="scale" type="range" min="5" max="100" step="1" />
        <span class="field-label mt-1">不透明度：{{ opacity }}%</span>
        <input v-model.number="opacity" type="range" min="10" max="100" step="5" />
        <span class="field-label mt-1">边距：{{ margin }} px</span>
        <input v-model.number="margin" type="range" min="0" max="200" step="4" />
        <span class="field-label mt-1">旋转：{{ rotation }}°</span>
        <input v-model.number="rotation" type="range" min="-180" max="180" step="1" />
        <div class="row mt-1" style="gap: 6px; align-items: center">
          <span class="field-label">位置</span>
          <button v-if="dragPos" class="chip" @click="((dragPos = null), render())">回到九宫定位</button>
          <span v-else class="muted small">直接在预览上按住拖动，可放到任意位置</span>
        </div>
        <div class="pos-grid mt-1">
          <button
            v-for="p in POSITIONS"
            :key="p"
            class="pos-cell"
            :class="{ active: !dragPos && position === p }"
            :aria-label="'叠加位置：' + p"
            @click="((position = p), (dragPos = null), render())"
          ></button>
        </div>
      </div>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.pos-grid {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 34px);
  gap: 4px;
}
.pos-cell {
  border: 1px solid var(--border-strong);
  background: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.pos-cell:hover {
  border-color: var(--accent);
}
.pos-cell.active {
  background: var(--accent);
  border-color: var(--accent);
}
.mt-1 {
  margin-top: 6px;
}
</style>
