<script setup lang="ts">
/**
 * 证件照制作（UX1.0 四处方）：
 * - 排版不变形（rx2）：六寸相纸按所选规格动态计算行列，格子恒为规格原比例（cover 居中裁切）。
 * - 参考线与成品分离（rx3）：预览带线，导出默认无线，「导出带参考线」为显式选项。
 * - 背景换色（rx4）：白/蓝 #438EDB/红 #FF0000，纯色背景按容差软替换（发丝边缘渐变过渡）。
 * - 规格库扩充（rx5）：≥10 规格，标注用途与毫米数（chips 悬停可见）。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const spec = ref(0)
const guides = ref(true)
const exportGuides = ref(false)
const bgMode = ref<'white' | 'blue' | 'red'>('white')
const swapBg = ref(false)
const tolerance = ref(40)
const result = shallowRef<HTMLCanvasElement | null>(null)
const printing = ref(false)

/** 规格（rx5）：mm 为物理毫米，用途标注（悬停 chips 可见） */
const SPECS = [
  { label: '一寸 295×413', mm: '25×35mm', use: '通用简历 / 教资 / 普通考试报名', w: 295, h: 413 },
  { label: '二寸 413×579', mm: '35×49mm', use: '普通证件 / 档案', w: 413, h: 579 },
  { label: '小二寸 413×531', mm: '35×45mm', use: '签证 / 港澳台通行证', w: 413, h: 531 },
  { label: '美签 600×600', mm: '51×51mm', use: '美国签证 DS-160', w: 600, h: 600 },
  { label: '申根 413×531', mm: '35×45mm', use: '欧洲申根签证', w: 413, h: 531 },
  { label: '港澳通行证 390×567', mm: '33×48mm', use: '港澳通行证 / 往来台湾', w: 390, h: 567 },
  { label: '教资 295×413', mm: '25×35mm', use: '教师资格证认定（白底）', w: 295, h: 413 },
  { label: '四六级 240×320', mm: '—', use: '大学英语四六级报名', w: 240, h: 320 },
  { label: '驾照 260×378', mm: '22×32mm', use: '机动车驾驶证（白底）', w: 260, h: 378 },
  { label: '社保照 26×32mm', mm: '26×32mm', use: '社保卡（268×330）', w: 268, h: 330 },
]
const BG_COLORS: Record<string, string> = { white: '#ffffff', blue: '#438EDB', red: '#FF0000' }

const sheetCount = computed(() => {
  const s = SPECS[spec.value]!
  return Math.max(1, Math.floor(1800 / (s.w + 16)) * Math.floor(1200 / (s.h + 16)))
})

/** 纯色背景软替换（rx4）：角点取色 + 色距软过渡，发丝边缘无明显白晕 */
function replaceBackground(c: HTMLCanvasElement, target: string): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const ctx = out.getContext('2d')!
  const [tr, tg, tb] = [parseInt(target.slice(1, 3), 16), parseInt(target.slice(3, 5), 16), parseInt(target.slice(5, 7), 16)]
  // 取四角平均作为背景参考色
  const d0 = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  const d = d0.data
  const W = c.width
  const corners = [0, (W - 1) * 4, (d.length - W * 4), d.length - 4]
  let sr = 0, sg = 0, sb = 0
  for (const ci of corners) {
    sr += d[ci]!
    sg += d[ci + 1]!
    sb += d[ci + 2]!
  }
  sr /= 4; sg /= 4; sb /= 4
  const t2 = (tolerance.value / 100) * 260 // 全替换阈值
  const t1 = t2 * 0.55 // 软过渡起点
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i]! - sr) ** 2 + (d[i + 1]! - sg) ** 2 + (d[i + 2]! - sb) ** 2)
    if (dist < t1) {
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb
    } else if (dist < t2) {
      const k = (t2 - dist) / (t2 - t1)
      d[i] = d[i]! * (1 - k) + tr * k
      d[i + 1] = d[i + 1]! * (1 - k) + tg * k
      d[i + 2] = d[i + 2]! * (1 - k) + tb * k
    }
  }
  ctx.putImageData(d0, 0, 0)
  return out
}

function render(withGuides: boolean): HTMLCanvasElement | null {
  const s = SPECS[spec.value]!
  const src = base.value?.source
  if (!src) return null
  let photo = applyOps(src, [{ op: 'resize', width: s.w, height: s.h, mode: 'cover' }])
  // rx4 背景换色（cover 后按角点参考色替换）
  if (swapBg.value) photo = replaceBackground(photo, BG_COLORS[bgMode.value]!)
  const out = document.createElement('canvas')
  out.width = s.w
  out.height = s.h
  const ctx = out.getContext('2d')!
  ctx.fillStyle = BG_COLORS[bgMode.value]!
  ctx.fillRect(0, 0, s.w, s.h)
  ctx.drawImage(photo, 0, 0)
  if (withGuides) {
    ctx.strokeStyle = 'rgba(255,80,80,0.75)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    const lines = [s.h * 0.1, s.h * 0.45, s.h * 0.75]
    for (const y of lines) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(s.w, y)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(s.w / 2, 0)
    ctx.lineTo(s.w / 2, s.h)
    ctx.stroke()
    ctx.setLineDash([])
  }
  return out
}

function refresh() {
  result.value = render(guides.value)
  base.value?.setOutput(result.value)
}

/** rx3：导出默认无参考线（显式勾选才带） */
async function produceClean(): Promise<Blob> {
  const c = render(exportGuides.value)
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, 'image/jpeg', 0.95)
}

function onLoaded() {
  refresh()
}

let timer = 0
watch([spec, guides, bgMode, swapBg, tolerance], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(refresh, 100)
})

/** 六寸相纸排版：行列按规格动态计算，格子恒为规格原比例（rx2 不变形） */
async function printSheet() {
  const photo = render(false)
  if (!photo) return
  const s = SPECS[spec.value]!
  const W = 1800
  const H = 1200
  printing.value = true
  try {
    const cols = Math.max(1, Math.floor(W / (s.w + 12)))
    const rows = Math.max(1, Math.floor(H / (s.h + 12)))
    const gapX = (W - cols * s.w) / (cols + 1)
    const gapY = (H - rows * s.h) / (rows + 1)
    const sheet = document.createElement('canvas')
    sheet.width = W
    sheet.height = H
    const ctx = sheet.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gapX + c * (s.w + gapX)
        const y = gapY + r * (s.h + gapY)
        ctx.drawImage(photo, x, y, s.w, s.h)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, s.w, s.h)
      }
    }
    const blob = await canvasToBlob(sheet, 'image/jpeg', 0.95)
    saveBlob(blob, '六寸相纸排版.jpg')
    toast.ok(`已排版 ${cols}×${rows} = ${cols * rows} 张（无参考线）`)
  } catch (e) {
    toast.err((e as Error).message || '排版失败')
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <div>
    <p class="muted small mt-1">
      照片按所选规格居中「裁满」（cover）。参考线仅用于预览对齐，导出默认不含（可显式勾选）。
    </p>
    <div class="chips mt-2">
      <button
        v-for="(s, i) in SPECS"
        :key="s.label + s.use"
        class="chip"
        :class="{ active: spec === i }"
        :title="`${s.mm} · ${s.use}`"
        @click="spec = i"
      >
        {{ s.label }}
      </button>
    </div>
    <p class="muted small mt-1">悬停规格可看毫米数与用途；共 {{ SPECS.length }} 种规格。</p>

    <div class="row row-wrap mt-2" style="gap: 16px; align-items: center">
      <span class="field-label">背景</span>
      <button class="chip" :class="{ active: bgMode === 'white' }" @click="bgMode = 'white'">白底</button>
      <button class="chip" :class="{ active: bgMode === 'blue' }" @click="bgMode = 'blue'">蓝底 #438EDB</button>
      <button class="chip" :class="{ active: bgMode === 'red' }" @click="bgMode = 'red'">红底 #FF0000</button>
      <label class="check"><input v-model="swapBg" type="checkbox" /> 抠图换底（纯色背景照适用）</label>
      <label v-if="swapBg" class="row" style="gap: 6px">
        <span class="field-label">容差 {{ tolerance }}</span>
        <input v-model.number="tolerance" type="range" min="10" max="90" style="width: 120px" />
      </label>
      <label class="check"><input v-model="guides" type="checkbox" /> 预览参考线</label>
      <label class="check"><input v-model="exportGuides" type="checkbox" /> 导出带参考线</label>
    </div>

    <ImageToolBase
      ref="base"
      mime="image/jpeg"
      :quality="0.95"
      suffix="-photo"
      button-text="下载证件照 JPG"
      :produce-blob="produceClean"
      label="拖放正面半身照到此处"
      hint="建议纯色背景、肩部以上、光线均匀"
      @loaded="onLoaded"
    >
      <div class="row mt-2">
        <button class="btn btn-ghost" :disabled="!result || printing" @click="printSheet">
          <Download :size="15" /> 生成六寸相纸排版（{{ sheetCount }} 张）
        </button>
        <span class="muted small">格子恒为当前规格原比例，居中裁切，不拉伸变形；排版不含参考线</span>
      </div>
    </ImageToolBase>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
