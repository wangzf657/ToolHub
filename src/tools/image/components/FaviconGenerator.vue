<script setup lang="ts">
/**
 * 网站图标生成器（UX1.0 五处方）：
 * - 三档预览（rx1）：16/32/64px（16/32 实际像素渲染 + 4x 放大对照）。
 * - manifest 修复（rx2）：name/short_name/theme_color 表单，未填时黄条警告 Lighthouse 扣分。
 * - 尺寸集补全（rx3）：favicon-96 / mstile-150 / browserconfig.xml + HTML 引用同步。
 * - 裁剪微调（rx4）：缩放 + 拖动定位 + 边距 + 透明/纯色底。
 * - 源图警示（rx5）：源图 <512px 时列出会被放大的输出尺寸。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob, encodeIco } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const html = ref('')
const running = ref(false)
const generated = shallowRef<Blob | null>(null)

// rx2 manifest 表单
const siteName = ref('')
const shortName = ref('')
const themeColor = ref('#6366f1')
const manifestWarn = computed(() => !siteName.value.trim() || !shortName.value.trim() || !themeColor.value)

// rx4 裁剪微调
const zoom = ref(1)
const margin = ref(0)
const bgMode = ref<'transparent' | 'color'>('transparent')
const bgColor = ref('#ffffff')
const offX = ref(0.5)
const offY = ref(0.5)

/** 合成 512 方形源（缩放 + 定位 + 边距 + 底色） */
function renderSquare(size = 512): HTMLCanvasElement {
  const c = src.value!
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')!
  if (bgMode.value === 'color') {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, size, size)
  }
  const m = (margin.value / 100) * size
  const box = size - m * 2
  const cover = Math.max(box / c.width, box / c.height)
  const sc = cover * zoom.value
  const dw = c.width * sc
  const dh = c.height * sc
  const dx = m + (box - dw) * offX.value
  const dy = m + (box - dh) * offY.value
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, dx, dy, dw, dh)
  return out
}

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    src.value = null
    generated.value = null
    html.value = ''
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
    offX.value = 0.5
    offY.value = 0.5
    zoom.value = 1
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

/** rx5：源图 <512px 时会被放大的输出尺寸 */
const upscaleSizes = computed(() => {
  if (!src.value) return []
  const s = Math.min(src.value.width, src.value.height)
  const all = [512, 192, 180, 150, 96]
  return all.filter((n) => n > s)
})

// rx1 三档预览 URL + 裁剪预览 URL
const pv16 = ref('')
const pv32 = ref('')
const pv64 = ref('')
const pvCrop = ref('')
function refreshPreviews() {
  if (!src.value) {
    pv16.value = pv32.value = pv64.value = pvCrop.value = ''
    return
  }
  const sq = renderSquare()
  const mk = (n: number) => {
    const t = document.createElement('canvas')
    t.width = n
    t.height = n
    t.getContext('2d')!.imageSmoothingQuality = 'high'
    t.getContext('2d')!.drawImage(sq, 0, 0, n, n)
    return t.toDataURL('image/png')
  }
  pv16.value = mk(16)
  pv32.value = mk(32)
  pv64.value = mk(64)
  pvCrop.value = mk(180)
}
watch([src, zoom, margin, bgMode, bgColor, offX, offY], () => {
  window.clearTimeout((refreshPreviews as unknown as { t?: number }).t)
  ;(refreshPreviews as unknown as { t?: number }).t = window.setTimeout(refreshPreviews, 120)
}, { flush: 'post' })

/* rx4 拖动定位：在预览上拖动调整内容偏移 */
let dragging = false
function pvDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function pvMove(e: PointerEvent) {
  if (!dragging) return
  const r = e.currentTarget as HTMLElement
  const rect = r.getBoundingClientRect()
  offX.value = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  offY.value = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
}
function pvUp() {
  dragging = false
}

async function generate() {
  const sq = renderSquare()
  running.value = true
  try {
    generated.value = await encodeIco(sq, [16, 32, 48])
    html.value = [
      '<link rel="icon" href="/favicon.ico" sizes="any" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
      `<meta name="theme-color" content="${themeColor.value}" />`,
      '<meta name="msapplication-TileColor" content="' + themeColor.value + '" />',
      '<meta name="msapplication-TileImage" content="/mstile-150x150.png" />',
      '<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />',
      '<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />',
      '<link rel="manifest" href="/site.webmanifest" />',
    ].join('\n')
    refreshPreviews()
    toast.ok('已生成图标与引用代码')
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  } finally {
    running.value = false
  }
}

async function downloadAll() {
  if (!src.value || !generated.value) return
  running.value = true
  try {
    const sq = renderSquare()
    const size = (n: number) => {
      const c = document.createElement('canvas')
      c.width = n
      c.height = n
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(sq, 0, 0, n, n)
      return c
    }
    const outs: { name: string; blob: Blob }[] = [
      { name: 'favicon.ico', blob: generated.value },
      { name: 'favicon-16x16.png', blob: await canvasToBlob(size(16), 'image/png') },
      { name: 'favicon-32x32.png', blob: await canvasToBlob(size(32), 'image/png') },
      { name: 'favicon-96x96.png', blob: await canvasToBlob(size(96), 'image/png') },
      { name: 'apple-touch-icon.png', blob: await canvasToBlob(size(180), 'image/png') },
      { name: 'mstile-150x150.png', blob: await canvasToBlob(size(150), 'image/png') },
      { name: 'android-chrome-192x192.png', blob: await canvasToBlob(size(192), 'image/png') },
      { name: 'android-chrome-512x512.png', blob: await canvasToBlob(size(512), 'image/png') },
      {
        name: 'site.webmanifest',
        blob: new Blob([
          JSON.stringify({
            name: siteName.value || '',
            short_name: shortName.value || '',
            theme_color: themeColor.value,
            icons: [
              { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
            ],
            display: 'standalone',
          }, null, 2),
        ], { type: 'application/json' }),
      },
      {
        name: 'browserconfig.xml',
        blob: new Blob([
          `<?xml version="1.0" encoding="utf-8"?>\n<browserconfig><msapplication><tile>\n<square150x150logo src="/mstile-150x150.png"/>\n<TileColor>${themeColor.value}</TileColor>\n</tile></msapplication></browserconfig>\n`,
        ], { type: 'text/xml' }),
      },
    ]
    await saveMany(outs, 'favicon-pack.zip')
    toast.ok(`已打包 ${outs.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '打包失败')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放一张图片（Logo / 照片）到此处"
      hint="自动居中裁成正方形，可缩放/拖动定位/加边距，生成全套网站图标"
      @files="onFiles"
    />

    <div v-if="upscaleSizes.length" class="notice notice-warn mt-2 small">
      源图短边 {{ Math.min(src!.width, src!.height) }}px 小于 512px，以下尺寸将被放大：{{ upscaleSizes.join(' / ') }}px —— 建议提供 ≥512px 的源图。
    </div>

    <div class="row row-wrap mt-2" style="gap: 20px; align-items: flex-start">
      <!-- 裁剪微调预览（rx4）：拖动定位 -->
      <div
        class="crop-pv"
        @pointerdown="pvDown"
        @pointermove="pvMove"
        @pointerup="pvUp"
        @pointercancel="pvUp"
      >
        <img v-if="pvCrop" :src="pvCrop" width="178" height="178" alt="图标内容预览（拖动定位）" />
      </div>

      <div style="min-width: 220px">
        <span class="field-label">缩放：{{ Math.round(zoom * 100) }}%</span>
        <input v-model.number="zoom" type="range" min="0.5" max="2" step="0.05" />
        <span class="field-label mt-1">边距：{{ margin }}%</span>
        <input v-model.number="margin" type="range" min="0" max="20" step="1" />
        <div class="row mt-1" style="gap: 12px">
          <label class="check"><input v-model="bgMode" type="radio" value="transparent" /> 透明底</label>
          <label class="check"><input v-model="bgMode" type="radio" value="color" /> 纯色底</label>
          <input v-if="bgMode === 'color'" v-model="bgColor" type="color" />
        </div>
        <p class="muted small mt-1">在左侧预览图上按住拖动可调整内容位置。</p>
      </div>

      <!-- rx2 manifest 表单 -->
      <div style="min-width: 230px">
        <span class="field-label">manifest 信息</span>
        <input v-model="siteName" type="text" class="input" placeholder="应用名（name）" style="margin-bottom: 6px" />
        <input v-model="shortName" type="text" class="input" placeholder="短名称（short_name）" style="margin-bottom: 6px" />
        <label class="row" style="gap: 8px"><span class="small">主题色</span><input v-model="themeColor" type="color" /></label>
      </div>

      <!-- rx1 三档预览 -->
      <div v-if="pv64" class="pv-triple">
        <div class="pv-cell"><img :src="pv16" width="64" height="64" style="image-rendering: pixelated" alt="16px（4x 放大）" /><span>16px 4x</span></div>
        <div class="pv-cell"><img :src="pv32" width="64" height="64" style="image-rendering: pixelated" alt="32px（2x 放大）" /><span>32px 2x</span></div>
        <div class="pv-cell"><img :src="pv64" width="64" height="64" alt="64px" /><span>64px</span></div>
      </div>
    </div>

    <div v-if="manifestWarn" class="notice notice-warn mt-2 small">
      manifest 的 name / short_name / theme_color 未填完整 —— Lighthouse PWA 项将扣分，建议填写后再打包。
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="!src || running" @click="generate">
        <Download :size="16" /> 生成图标与引用代码
      </button>
      <button class="btn btn-ghost" :disabled="!src || !generated" @click="downloadAll">
        <Download :size="16" /> 打包下载全部文件（ZIP）
      </button>
    </div>

    <div v-if="html" class="mt-3">
      <ResultBox v-model="html" title="HTML 引用代码（放在 <head> 中）" mono readonly min-height="170px" />
      <p class="muted small mt-1">打包内含：favicon.ico（16/32/48）、16/32/96/150/180/192/512 PNG、browserconfig.xml 与 site.webmanifest。</p>
    </div>
  </div>
</template>

<style scoped>
.crop-pv {
  width: 180px;
  height: 180px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px;
  cursor: move;
  touch-action: none;
  overflow: hidden;
  flex: none;
}
.crop-pv img {
  display: block;
  user-select: none;
  pointer-events: none;
}
.pv-triple {
  display: flex;
  gap: 12px;
}
.pv-cell {
  display: grid;
  gap: 4px;
  justify-items: center;
}
.pv-cell img {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px;
}
.pv-cell span {
  font-size: 11px;
  color: var(--text-3);
}
.mt-1 {
  margin-top: 6px;
}
</style>
