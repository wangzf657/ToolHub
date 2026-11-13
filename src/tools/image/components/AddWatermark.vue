<script setup lang="ts">
/**
 * 图片加水印（UX1.0 五处方）：
 * - 真平铺（rx1）：斜排模式按密度 1~20 条沿两条对角线重复绘制，整组随九宫位置偏移。
 * - 角度可调（rx2）：-90°~90° 滑杆（默认 -30°），预览与导出一致。
 * - 描边兜底（rx3）：1/2px 描边开关，描边色自动取文字反色，白字白底可辨。
 * - 统一水印范式（rx4）：位置九宫 + 边距 0~200px + 不透明度，命名与 video-watermark 一致。
 * - 批量水印（rx5）：多图统一参数导出 ZIP；首张作实时预览。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Package } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ExportBar from './ExportBar.vue'

const toast = useToast()
interface Item {
  file: File
  cv: HTMLCanvasElement
}
const items = shallowRef<Item[]>([])
const text = ref('')
const position = ref('bottom-right')
const size = ref(0) // 0 = 自动（图宽 / 24）
const color = ref('#ffffff')
const opacity = ref(60)
const margin = ref(40) // 统一范式：边距 0~200px
const tiled = ref(false) // 斜排平铺
const angle = ref(-30)
const density = ref(8)
const outline = ref(false)
const outlineW = ref(2)
const preview = shallowRef<HTMLCanvasElement | null>(null)

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

async function onFiles(list: File[]) {
  const arr: Item[] = []
  for (const f of list.slice(0, 30)) {
    try {
      arr.push({ file: f, cv: await decodeToCanvas(f) })
    } catch {
      toast.warn(`「${f.name}」解码失败，已跳过`)
    }
  }
  items.value = arr
  render()
}

/** 反色（描边色，rx3） */
function inverseColor(hex: string): string {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return `#${((0xffffff ^ n) & 0xffffff).toString(16).padStart(6, '0')}`
}

/** 在画布上绘制水印（单点 / 双对角平铺），参数与预览/导出共用 */
function drawTo(cv: HTMLCanvasElement): HTMLCanvasElement {
  const t = document.createElement('canvas')
  t.width = cv.width
  t.height = cv.height
  const ctx = t.getContext('2d')!
  ctx.drawImage(cv, 0, 0)
  if (!text.value.trim()) return t
  const fs = size.value > 0 ? size.value : Math.max(18, Math.round(cv.width / 24))
  ctx.font = `600 ${fs}px sans-serif`
  ctx.fillStyle = color.value
  ctx.globalAlpha = opacity.value / 100
  ctx.textBaseline = 'middle'
  const m = ctx.measureText(text.value)
  const pad = Math.min(margin.value, Math.max(0, cv.width - m.width) / 2, Math.max(0, cv.height - fs) / 2)
  const drawOne = (x: number, y: number, ang: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((ang * Math.PI) / 180)
    if (outline.value) {
      ctx.strokeStyle = inverseColor(color.value)
      ctx.lineWidth = outlineW.value
      ctx.lineJoin = 'round'
      ctx.strokeText(text.value, -m.width / 2, 0)
    }
    ctx.fillText(text.value, -m.width / 2, 0)
    ctx.restore()
  }
  if (tiled.value) {
    // 双对角各 density 条，整组随九宫位置偏移（rx1/rx2）
    const dx = position.value.includes('left') ? -pad : position.value.includes('right') ? pad : 0
    const dy = position.value.includes('top') ? -pad : position.value.includes('bottom') ? pad : 0
    const n = Math.max(1, Math.min(20, density.value))
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      drawOne(cv.width * k + dx, cv.height * k + dy, angle.value)
      drawOne(cv.width * (1 - k) + dx, cv.height * k + dy, angle.value)
    }
  } else {
    const x = position.value.includes('right')
      ? cv.width - m.width / 2 - pad
      : position.value.includes('left')
        ? m.width / 2 + pad
        : cv.width / 2
    const y = position.value.includes('top')
      ? pad + fs / 2
      : position.value.includes('bottom')
        ? cv.height - pad - fs / 2
        : cv.height / 2
    drawOne(x, y, 0)
  }
  ctx.globalAlpha = 1
  return t
}

/* 预览画布挂载（避免反复 toDataURL 的大图开销） */
const stageEl = ref<HTMLElement | null>(null)
let mounted: HTMLCanvasElement | null = null
function render() {
  if (!items.value.length) {
    preview.value = null
    if (mounted) {
      mounted.remove()
      mounted = null
    }
    return
  }
  const c = drawTo(items.value[0]!.cv)
  preview.value = c
  if (stageEl.value) {
    if (mounted) mounted.remove()
    c.style.maxWidth = '100%'
    c.style.maxHeight = '46vh'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stageEl.value.appendChild(c)
    mounted = c
  }
}

async function produce(mime: string, quality: number): Promise<Blob> {
  if (!items.value.length) throw new Error('请先添加图片')
  return canvasToBlob(drawTo(items.value[0]!.cv), mime, quality)
}

/** 批量：统一参数导出 ZIP（rx5） */
const zipping = ref(false)
async function zipAll() {
  if (!items.value.length) return
  zipping.value = true
  try {
    const files: { name: string; blob: Blob }[] = []
    for (const it of items.value) {
      const blob = await canvasToBlob(drawTo(it.cv), 'image/png')
      const base = it.file.name.replace(/\.[^.]+$/, '')
      files.push({ name: `${base}-watermark.png`, blob })
    }
    await saveMany(files, `水印-${files.length}张.zip`)
    toast.ok(`已打包 ${files.length} 张带水印图片`)
  } finally {
    zipping.value = false
  }
}

const dirtyToken = computed(
  () => `${text.value}-${position.value}-${size.value}-${color.value}-${opacity.value}-${margin.value}-${tiled.value}-${angle.value}-${density.value}-${outline.value}-${outlineW.value}`,
)

let timer = 0
watch(dirtyToken, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放图片到此处（可批量，统一参数加水印）"
      hint="首张作实时预览；全部处理完可打包 ZIP 下载"
      @files="onFiles"
    />

    <template v-if="items.length">
      <div ref="stageEl" class="stage mt-2"></div>

      <div class="mt-2" style="max-width: 460px">
        <span class="field-label">要叠加的文字</span>
        <input v-model="text" type="text" class="input" placeholder="输入要叠加的文字，如 @我的名字" />
      </div>

      <div class="row row-wrap mt-2" style="gap: 24px; align-items: flex-start">
        <div>
          <span class="field-label">位置（九宫）</span>
          <div class="pos-grid">
            <button
              v-for="p in POSITIONS"
              :key="p"
              class="pos-cell"
              :class="{ active: position === p }"
              :aria-label="'水印位置：' + p"
              @click="position = p"
            ></button>
          </div>
        </div>
        <div class="grow" style="min-width: 230px">
          <span class="field-label">字号：{{ size > 0 ? size + ' px' : '自动' }}</span>
          <input v-model.number="size" type="range" min="0" max="200" step="2" />
          <span class="field-label mt-1">不透明度：{{ opacity }}%</span>
          <input v-model.number="opacity" type="range" min="10" max="100" step="5" />
          <span class="field-label mt-1">边距：{{ margin }} px</span>
          <input v-model.number="margin" type="range" min="0" max="200" step="4" />
          <div class="row mt-1" style="gap: 16px">
            <label class="opt"><span class="field-label">颜色</span><input v-model="color" type="color" /></label>
            <label class="check" style="margin-top: 18px"><input v-model="tiled" type="checkbox" /> 斜排平铺</label>
          </div>
          <template v-if="tiled">
            <span class="field-label mt-1">平铺角度：{{ angle }}°</span>
            <input v-model.number="angle" type="range" min="-90" max="90" step="1" />
            <span class="field-label mt-1">平铺密度：{{ density }} 条（沿两条对角线）</span>
            <input v-model.number="density" type="range" min="1" max="20" step="1" />
          </template>
          <label class="check mt-1"><input v-model="outline" type="checkbox" /> 文字描边（白字白底可辨）</label>
          <label v-if="outline" class="row mt-1" style="gap: 8px">
            <input v-model.number="outlineW" type="range" min="1" max="2" step="1" style="width: 90px" />
            <span class="muted small">{{ outlineW }}px · 颜色自动取文字反色</span>
          </label>
        </div>
      </div>

      <div class="row row-wrap mt-2" style="align-items: center">
        <ExportBar
          :produce="produce"
          :base-name="items[0]!.file.name.replace(/\.[^.]+$/, '')"
          :dirty-token="dirtyToken"
          button-text="下载首图"
        />
        <button class="btn btn-soft" :disabled="zipping" @click="zipAll">
          <Package :size="15" /> {{ zipping ? '打包中…' : `全部打 ZIP（${items.length} 张）` }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stage {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}
.pv {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 46vh;
}
.opt {
  display: grid;
  gap: 4px;
}
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
</style>
