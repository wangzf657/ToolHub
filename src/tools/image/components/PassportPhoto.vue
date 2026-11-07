<script setup lang="ts">
/** 证件照制作：标准尺寸裁剪（cover + 白底 + 参考线），附六寸相纸排版 */
import { ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const spec = ref(0)
const guides = ref(true)
const result = shallowRef<HTMLCanvasElement | null>(null)
const printing = ref(false)

const SPECS = [
  { label: '一寸 295×413', w: 295, h: 413 },
  { label: '二寸 413×579', w: 413, h: 579 },
  { label: '小二寸 413×531', w: 413, h: 531 },
  { label: '美签 600×600', w: 600, h: 600 },
]

function render() {
  const s = SPECS[spec.value]
  const src = base.value?.source
  if (!src) return
  // cover 裁剪到目标尺寸
  const cover = applyOps(src, [{ op: 'resize', width: s.w, height: s.h, mode: 'cover' }])
  // 铺白底（处理透明 PNG）
  const out = document.createElement('canvas')
  out.width = s.w
  out.height = s.h
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, s.w, s.h)
  ctx.drawImage(cover, 0, 0)
  if (guides.value) {
    ctx.strokeStyle = 'rgba(255,80,80,0.75)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    // 头顶 / 眼睛 / 下巴 三条参考线 + 中线
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
  }
  result.value = out
  base.value?.setOutput(out)
}

function onLoaded() {
  render()
}

let timer = 0
watch([spec, guides], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

/** 六寸相纸（1800×1200）排 8 张一寸照 */
async function printSheet() {
  const out = result.value
  if (!out) return
  printing.value = true
  try {
    const W = 1800
    const H = 1200
    const pw = 295
    const ph = 413
    const cols = 4
    const rows = 2
    const gapX = (W - cols * pw) / (cols + 1)
    const gapY = (H - rows * ph) / (rows + 1)
    const sheet = document.createElement('canvas')
    sheet.width = W
    sheet.height = H
    const ctx = sheet.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    // 裁剪参考线细边框
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gapX + c * (pw + gapX)
        const y = gapY + r * (ph + gapY)
        ctx.drawImage(out, x, y, pw, ph)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, pw, ph)
      }
    }
    const blob = await canvasToBlob(sheet, 'image/jpeg', 0.95)
    saveBlob(blob, '六寸相纸排版.jpg')
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
      照片会按所选规格居中「裁满」（cover），不足处铺白底。参考线辅助对齐头顶 / 眼睛 / 下巴位置，导出同样包含，可关闭。
    </p>
    <div class="chips mt-2">
      <button v-for="(s, i) in SPECS" :key="s.label" class="chip" :class="{ active: spec === i }" @click="spec = i">
        {{ s.label }}
      </button>
      <label class="check" style="margin-left: 8px"><input v-model="guides" type="checkbox" /> 显示参考线</label>
    </div>
    <ImageToolBase
      ref="base"
      mime="image/jpeg"
      :quality="0.95"
      suffix="-photo"
      button-text="下载证件照 JPG"
      label="拖放正面半身照到此处"
      hint="建议纯色背景、肩部以上、光线均匀"
      @loaded="onLoaded"
    >
      <div class="row mt-2">
        <button class="btn btn-ghost" :disabled="!result || printing" @click="printSheet">
          <Download :size="15" /> 生成六寸相纸排版（8 张）
        </button>
        <span class="muted small">排版固定按一寸 295×413 缩放放置</span>
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
