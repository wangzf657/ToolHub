<script setup lang="ts">
/**
 * PNG 转 ICO（UX1.0 五处方）：
 * - 裁剪确认（rx2）：非方形先出「居中裁切预览」+ 可拖动裁切框，确认后才进入结果。
 * - 体积优化（rx3）：ICO 改用 PNG 帧内嵌（Vista+ 支持），1024 源产物 <80KB。
 * - 尺寸勾选（rx4）：六档复选框默认全选，仅导出勾选尺寸。
 * - 使用指引（rx5）：部署指引折叠面板 + 一键复制 <link> 片段。
 * - 站内互链（rx6）：→ App 图标生成。
 */
import { ref, shallowRef } from 'vue'
import { Check, Copy, Download } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName, copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
/** 裁切窗口：中心比例 + 边长比例（占短边） */
const cx = ref(0.5)
const cy = ref(0.5)
const SIZES = [16, 32, 48, 64, 128, 256]
const checked = ref<number[]>([16, 32, 48, 64, 128, 256])
const confirmed = ref(false)
const copied = ref(false)

async function onFiles(files: File[]) {
  if (!files.length) return
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
    cx.value = 0.5
    cy.value = 0.5
    confirmed.value = false
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function confirmCrop() {
  confirmed.value = true
}

/** 应用裁切：按当前窗口裁出正方形 */
function cropSquare(): HTMLCanvasElement | null {
  const c = src.value
  if (!c) return null
  const s = Math.min(c.width, c.height)
  const d = s // 裁切边长 = 短边（窗口仅决定位置）
  const rx = cx.value * c.width
  const ry = cy.value * c.height
  const x0 = Math.max(0, Math.min(c.width - d, rx - d / 2))
  const y0 = Math.max(0, Math.min(c.height - d, ry - d / 2))
  const t = document.createElement('canvas')
  t.width = d
  t.height = d
  t.getContext('2d')!.drawImage(c, x0, y0, d, d, 0, 0, d, d)
  return t
}

/** rx3：PNG 帧内嵌 ICO（自研编码，体积远小于 BMP 帧） */
async function encodeIcoPng(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const pngs: { size: number; blob: Blob }[] = []
  for (const c of canvases) {
    pngs.push({ size: c.width, blob: await canvasToBlob(c, 'image/png') })
  }
  const headerSize = 6 + pngs.length * 16
  const head = new Uint8Array(headerSize)
  const hv = new DataView(head.buffer)
  hv.setUint16(0, 0, true)
  hv.setUint16(2, 1, true)
  hv.setUint16(4, pngs.length, true)
  let off = headerSize
  const blobs: Blob[] = []
  pngs.forEach((p, i) => {
    const e = 6 + i * 16
    hv.setUint8(e, p.size >= 256 ? 0 : p.size)
    hv.setUint8(e + 1, p.size >= 256 ? 0 : p.size)
    hv.setUint8(e + 2, 0)
    hv.setUint8(e + 3, 0)
    hv.setUint16(e + 4, 1, true)
    hv.setUint16(e + 6, 32, true)
    hv.setUint32(e + 8, p.blob.size, true)
    hv.setUint32(e + 12, off, true)
    off += p.blob.size
    blobs.push(p.blob)
  })
  return new Blob([head, ...blobs], { type: 'image/x-icon' })
}

async function download() {
  const sq = cropSquare()
  if (!sq) return
  const sizes = checked.value.length ? checked.value : SIZES
  const canvases = sizes.map((s) => {
    const t = document.createElement('canvas')
    t.width = s
    t.height = s
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(sq, 0, 0, s, s)
    return t
  })
  const blob = await encodeIcoPng(canvases)
  saveBlob(blob, `${baseName(file.value?.name ?? 'icon')}.ico`)
  toast.ok(`已生成 ICO（${sizes.join('/')} px，PNG 帧内嵌 ${(blob.size / 1024).toFixed(0)} KB）`)
}

/* rx2 裁切框拖动 */
let dragging = false
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  onMove(e)
}
function onMove(e: PointerEvent) {
  if (!dragging || !src.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  cx.value = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  cy.value = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
}
function onUp() {
  dragging = false
}

async function copySnippet() {
  const ok = await copyText('<link rel="icon" href="/favicon.ico" sizes="any" />')
  if (ok) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('已复制部署片段')
  } else toast.err('复制失败')
}
</script>

<template>
  <div>
    <p class="muted small mt-1">
      生成 Windows 标准 .ico（PNG 帧内嵌，体积更小）。非方形图片先确认居中裁切窗口。
      需要 iOS/Android 全套图标？请用
      <RouterLink to="/t/app-icon-generator" class="link">App 图标生成</RouterLink>。
    </p>

    <FileDrop v-if="!src" accept="image/png,image/*" :multiple="false" label="拖入 PNG 图片" hint="建议正方形透明底；非方形可拖动裁切窗口" @files="onFiles" />

    <template v-else>
      <!-- rx2 裁切确认 -->
      <div v-if="!confirmed" class="mt-2">
        <div class="crop-stage" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
          <img :src="src.toDataURL('image/png')" alt="裁切预览" class="crop-img" />
          <div
            class="crop-frame"
            :style="{ left: `${cx * 100}%`, top: `${cy * 100}%`, width: `${(Math.min(src.width, src.height) / src.width) * 100}%` }"
          ></div>
        </div>
        <p class="muted small mt-1">虚线框为 ICO 取图窗口（按住拖动微调位置）。</p>
        <div class="row mt-2">
          <button class="btn btn-primary" @click="confirmCrop"><Check :size="16" /> 确认裁切</button>
          <button class="btn btn-ghost" @click="((src = null), (file = null))">换一张</button>
        </div>
      </div>

      <div v-else>
        <div class="row row-wrap mt-2" style="gap: 8px">
          <span class="field-label">包含尺寸</span>
          <label v-for="s in SIZES" :key="s" class="check" style="gap: 4px">
            <input v-model="checked" type="checkbox" :value="s" /> {{ s }}
          </label>
          <button class="btn btn-ghost btn-sm" @click="((src = null), (confirmed = false))">换一张</button>
        </div>
        <div class="row mt-2">
          <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载 .ico（{{ checked.length || 6 }} 档尺寸）</button>
        </div>

        <!-- rx5 部署指引 -->
        <details class="deploy mt-2">
          <summary>部署指引（HTML 引用片段）</summary>
          <div class="row mt-1" style="gap: 8px">
            <code class="mono snippet">&lt;link rel="icon" href="/favicon.ico" sizes="any" /&gt;</code>
            <button class="btn btn-soft btn-sm" @click="copySnippet"><Copy :size="13" /> {{ copied ? '已复制' : '复制' }}</button>
          </div>
          <p class="muted small mt-1">把 .ico 放到网站根目录并在 &lt;head&gt; 中加入上面一行即可。</p>
        </details>
      </div>
    </template>
  </div>
</template>

<style scoped>
.crop-stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  touch-action: none;
  line-height: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: move;
}
.crop-img {
  max-width: 100%;
  max-height: 46vh;
  display: block;
}
.crop-frame {
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: 1 / 1;
  border: 2px dashed #ff8a3d;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.deploy {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  max-width: 640px;
}
.deploy summary {
  cursor: pointer;
  color: var(--text-2);
  font-size: 13.5px;
  user-select: none;
}
.snippet {
  font-size: 12.5px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-solid);
}
.link {
  color: var(--accent-text);
  text-decoration: underline;
}
</style>
