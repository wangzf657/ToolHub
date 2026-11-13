<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Image as ImageIcon, Download, Copy } from 'lucide-vue-next'
import { saveBlob, copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const width = ref(600)
const height = ref(300)
const bg = ref('#6366f1')
const fg = ref('#ffffff')
const label = ref('600 × 300')
const canvas = ref<HTMLCanvasElement | null>(null)
/** 非法输入提示（rx5） */
const widthInvalid = computed(() => !Number.isFinite(width.value) || Math.floor(width.value) < 1)
const heightInvalid = computed(() => !Number.isFinite(height.value) || Math.floor(height.value) < 1)
/** 导出体积预估（rx4） */
const estKb = ref(0)
/** 导出格式（rx3） */
const fmt = ref<'png' | 'svg' | 'jpeg'>('png')

/** 尺寸预设 chips（rx2） */
const PRESETS = [
  { label: 'OG 1200×630', w: 1200, h: 630 },
  { label: 'Hero 1200×400', w: 1200, h: 400 },
  { label: '微信封面 900×383', w: 900, h: 383 },
  { label: 'Banner 970×250', w: 970, h: 250 },
  { label: '头像 256', w: 256, h: 256 },
  { label: 'Favicon 64', w: 64, h: 64 },
]
const applyPreset = (p: { w: number; h: number }) => {
  width.value = p.w
  height.value = p.h
}

/** SVG 版本（rx1）：与 Canvas 渲染同构 */
const svgCode = () => {
  const w = Math.min(Math.max(Math.floor(width.value) || 1, 1), 4000)
  const h = Math.min(Math.max(Math.floor(height.value) || 1, 1), 4000)
  const text = label.value.trim() || `${w} × ${h}`
  const fontSize = Math.max(14, Math.min(Math.floor(Math.min(w, h) / 6), 96))
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${esc(bg.value)}"/>` +
    `<g stroke="${esc(fg.value)}" stroke-opacity="0.25" stroke-width="1">` +
    `<line x1="0" y1="0" x2="${w}" y2="${h}"/><line x1="${w}" y1="0" x2="0" y2="${h}"/></g>` +
    `<text x="50%" y="50%" fill="${esc(fg.value)}" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${esc(text)}</text></svg>`
}

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
watch([width, height, bg, fg, label], () => {
  if (widthInvalid.value || heightInvalid.value) return // 非法值保持上次画布（rx5）
  draw()
  estimate()
})

/** 体积预估（rx4）：300ms 防抖 toBlob 测算 */
let estDeb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  estDeb = debounceRun(async () => {
    const c = canvas.value
    if (!c) return
    const mime = fmt.value === 'jpeg' ? 'image/jpeg' : 'image/png'
    if (fmt.value === 'svg') {
      estKb.value = Math.max(1, Math.round(new Blob([svgCode()]).size / 1024))
      return
    }
    c.toBlob(
      (b) => {
        if (b) estKb.value = Math.max(1, Math.round(b.size / 1024))
      },
      mime,
      0.9,
    )
  }, 300)
  estimate()
})
const estimate = () => estDeb?.call()

const download = () => {
  const c = canvas.value
  if (!c) return
  if (fmt.value === 'svg') {
    saveBlob(new Blob([svgCode()], { type: 'image/svg+xml' }), `placeholder-${c.width}x${c.height}.svg`)
    toast.ok('已下载 SVG 占位图')
    return
  }
  c.toBlob(
    (blob) => {
      if (!blob) return toast.err('导出失败')
      saveBlob(blob, `placeholder-${c.width}x${c.height}.${fmt.value === 'jpeg' ? 'jpg' : 'png'}`)
      toast.ok(`已下载 ${fmt.value.toUpperCase()} 占位图`)
    },
    fmt.value === 'jpeg' ? 'image/jpeg' : 'image/png',
    0.9,
  )
}

const copySvg = async (as: 'code' | 'uri') => {
  const svg = svgCode()
  const text = as === 'code' ? svg : `data:image/svg+xml,${encodeURIComponent(svg)}`
  const ok = await copyText(text)
  ok ? toast.ok(as === 'code' ? 'SVG 代码已复制' : 'SVG data URI 已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="placeholder-img">
    <div class="row row-wrap" style="gap: 14px; align-items: end">
      <div>
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" class="input mono" style="width: 110px" min="1" max="4000" :class="{ 'input-bad': widthInvalid }" />
        <p v-if="widthInvalid" class="small" style="margin: 3px 0 0; color: var(--err)">最小 1px</p>
      </div>
      <div>
        <span class="field-label">高度（px）</span>
        <input v-model.number="height" type="number" class="input mono" style="width: 110px" min="1" max="4000" :class="{ 'input-bad': heightInvalid }" />
        <p v-if="heightInvalid" class="small" style="margin: 3px 0 0; color: var(--err)">最小 1px</p>
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

    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">尺寸预设</span>
      <button v-for="p in PRESETS" :key="p.label" class="chip" @click="applyPreset(p)">{{ p.label }}</button>
    </div>

    <div class="mt-3 preview-stage">
      <canvas ref="canvas" class="preview-canvas"></canvas>
    </div>

    <div class="row mt-3 row-wrap" style="gap: 10px; align-items: center">
      <span class="field-label" style="margin: 0">格式</span>
      <select v-model="fmt" class="select" style="width: 110px">
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
        <option value="svg">SVG</option>
      </select>
      <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载 {{ fmt.toUpperCase() }}</button>
      <button class="btn btn-ghost" @click="copySvg('code')"><Copy :size="15" /> 复制 SVG 代码</button>
      <button class="btn btn-ghost" @click="copySvg('uri')"><Copy :size="15" /> 复制 data URI</button>
      <button class="btn btn-ghost" @click="label = ''">清空文字</button>
      <span v-if="estKb" class="muted small"><ImageIcon :size="13" style="vertical-align: -2px" /> 导出约 {{ estKb }} KB</span>
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
.input-bad {
  border-color: var(--err);
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
