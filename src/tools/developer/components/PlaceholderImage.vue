<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Image as ImageIcon, Download } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const width = ref(600)
const height = ref(300)
const bg = ref('#6366f1')
const fg = ref('#ffffff')
const label = ref('600 × 300')
const canvas = ref<HTMLCanvasElement | null>(null)

const draw = () => {
  const c = canvas.value
  if (!c) return
  const w = Math.min(Math.max(Math.floor(width.value) || 1, 1), 4000)
  const h = Math.min(Math.max(Math.floor(height.value) || 1, 1), 4000)
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = bg.value
  ctx.fillRect(0, 0, w, h)
  // 对角线交叉
  ctx.strokeStyle = fg.value
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w, h)
  ctx.moveTo(w, 0)
  ctx.lineTo(0, h)
  ctx.stroke()
  ctx.globalAlpha = 1
  const text = label.value.trim() || `${w} × ${h}`
  const fontSize = Math.max(14, Math.min(Math.floor(Math.min(w, h) / 6), 96))
  ctx.fillStyle = fg.value
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
}

onMounted(draw)
watch([width, height, bg, fg, label], draw)

const download = () => {
  const c = canvas.value
  if (!c) return
  c.toBlob((blob) => {
    if (!blob) return toast.err('导出失败')
    saveBlob(blob, `placeholder-${c.width}x${c.height}.png`)
    toast.ok('已下载 PNG 占位图')
  }, 'image/png')
}
</script>

<template>
  <div class="placeholder-img">
    <div class="row row-wrap" style="gap: 14px; align-items: end">
      <div>
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" class="input mono" style="width: 110px" min="1" max="4000" />
      </div>
      <div>
        <span class="field-label">高度（px）</span>
        <input v-model.number="height" type="number" class="input mono" style="width: 110px" min="1" max="4000" />
      </div>
      <div>
        <span class="field-label">背景色</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="bg" type="color" class="color-pick" />
          <input v-model="bg" type="text" class="input mono" style="width: 100px" />
        </div>
      </div>
      <div>
        <span class="field-label">文字色</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="fg" type="color" class="color-pick" />
          <input v-model="fg" type="text" class="input mono" style="width: 100px" />
        </div>
      </div>
      <div class="grow" style="min-width: 150px">
        <span class="field-label">文字（留空显示尺寸）</span>
        <input v-model="label" type="text" class="input" placeholder="600 × 300" />
      </div>
    </div>

    <div class="mt-3 preview-stage">
      <canvas ref="canvas" class="preview-canvas"></canvas>
    </div>

    <div class="row mt-3">
      <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载 PNG</button>
      <button class="btn btn-ghost" @click="label = ''">清空文字</button>
      <span class="muted small"><ImageIcon :size="13" style="vertical-align: -2px" /> 实时 Canvas 绘制，导出尺寸即设定尺寸</span>
    </div>
  </div>
</template>

<style scoped>
.color-pick {
  width: 42px;
  height: 36px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: none;
  padding: 2px;
  cursor: pointer;
}
.preview-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: grid;
  place-items: center;
  background:
    conic-gradient(rgba(128, 128, 128, 0.12) 0 25%, transparent 0 50%, rgba(128, 128, 128, 0.12) 0 75%, transparent 0) 0 0 / 18px 18px;
  overflow: auto;
}
.preview-canvas {
  max-width: 100%;
  max-height: 360px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  border-radius: 4px;
}
</style>
