<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, Smartphone } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas, applyOps, encodeIco, canvasToBlob } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * App 图标生成（UX1.0 五处方）：
 * - 逐尺寸预览网格（rx1）：生成前渲染全部勾选尺寸，小尺寸实际像素渲染放大对照，圆角/fit 即时反映。
 * - Contents.json（rx2）：iOS 追加 AppIcon.appiconset/Contents.json 全映射，可整体拖入 Xcode。
 * - 自适应图标（rx3）：Android foreground 432px（安全区 66% 提示）+ 背景色 + ic_launcher.xml + colors.xml。
 * - 圆角指引（rx4）：勾选圆角且含 iOS 时提示 Apple 自动蒙版。
 * - 结果清单（rx5）：ZIP 落盘后逐行列出文件名与尺寸。
 */
interface SizeItem {
  s: number
  name: string
}

const IOS_SIZES: SizeItem[] = [
  { s: 1024, name: 'AppIcon-1024.png' }, { s: 180, name: 'AppIcon-180.png' },
  { s: 152, name: 'AppIcon-152.png' }, { s: 120, name: 'AppIcon-120.png' },
  { s: 87, name: 'AppIcon-87.png' }, { s: 80, name: 'AppIcon-80.png' },
  { s: 76, name: 'AppIcon-76.png' }, { s: 60, name: 'AppIcon-60.png' },
  { s: 58, name: 'AppIcon-58.png' }, { s: 40, name: 'AppIcon-40.png' },
  { s: 29, name: 'AppIcon-29.png' }, { s: 20, name: 'AppIcon-20.png' },
]
const ANDROID_SIZES: SizeItem[] = [
  { s: 512, name: 'playstore-icon.png' }, { s: 192, name: 'mipmap-xxxhdpi/ic_launcher.png' },
  { s: 144, name: 'mipmap-xxhdpi/ic_launcher.png' }, { s: 96, name: 'mipmap-xhdpi/ic_launcher.png' },
  { s: 72, name: 'mipmap-hdpi/ic_launcher.png' }, { s: 48, name: 'mipmap-mdpi/ic_launcher.png' },
]

/** iOS Contents.json 的 size/idiom/scale 映射（rx2） */
const IOS_CONTENT_MAP: { s: number; size: string; idiom: string; scale: string }[] = [
  { s: 20, size: '20x20', idiom: 'iphone', scale: '2x' },
  { s: 20, size: '20x20', idiom: 'iphone', scale: '3x' },
  { s: 20, size: '20x20', idiom: 'ipad', scale: '1x' },
  { s: 20, size: '20x20', idiom: 'ipad', scale: '2x' },
  { s: 29, size: '29x29', idiom: 'iphone', scale: '1x' },
  { s: 29, size: '29x29', idiom: 'iphone', scale: '2x' },
  { s: 29, size: '29x29', idiom: 'iphone', scale: '3x' },
  { s: 29, size: '29x29', idiom: 'ipad', scale: '1x' },
  { s: 29, size: '29x29', idiom: 'ipad', scale: '2x' },
  { s: 40, size: '40x40', idiom: 'iphone', scale: '2x' },
  { s: 40, size: '40x40', idiom: 'iphone', scale: '3x' },
  { s: 40, size: '40x40', idiom: 'ipad', scale: '1x' },
  { s: 40, size: '40x40', idiom: 'ipad', scale: '2x' },
  { s: 60, size: '60x60', idiom: 'iphone', scale: '2x' },
  { s: 60, size: '60x60', idiom: 'iphone', scale: '3x' },
  { s: 76, size: '76x76', idiom: 'ipad', scale: '1x' },
  { s: 80, size: '40x40', idiom: 'ipad', scale: '2x' },
  { s: 87, size: '29x29', idiom: 'iphone', scale: '3x' },
  { s: 120, size: '60x60', idiom: 'iphone', scale: '3x' },
  { s: 152, size: '76x76', idiom: 'ipad', scale: '2x' },
  { s: 180, size: '60x60', idiom: 'iphone', scale: '3x' },
  { s: 1024, size: '1024x1024', idiom: 'ios-marketing', scale: '1x' },
]

const toast = useToast()
const file = ref<File | null>(null)
const srcCanvas = ref<HTMLCanvasElement | null>(null)
const srcUrl = ref('')
const rounded = ref(false)
const radiusPct = ref(22)
const includeIos = ref(true)
const includeAndroid = ref(true)
const includeFavicon = ref(true)
const adaptive = ref(false)
const bgColor = ref('#3ddc84')
const busy = ref(false)
const progress = ref(0)
const done = ref(false)
const manifest = ref<{ name: string; label: string }[]>([])
const safeWarn = ref(false)

/** 预览网格（rx1）：勾选尺寸全部渲染（URL 预生成，避免模板反复 toDataURL） */
const previewCells = ref<{ name: string; url: string }[]>([])

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.png$/i.test(f.name) && f.type !== 'image/png') {
    toast.warn('建议使用正方形透明底 PNG 作为图标源图')
  }
  file.value = f
  done.value = false
  manifest.value = []
  try {
    srcCanvas.value = await decodeToCanvas(f)
    srcUrl.value = srcCanvas.value.toDataURL('image/png')
    if (srcCanvas.value.width !== srcCanvas.value.height) {
      toast.warn(`源图为 ${srcCanvas.value.width}×${srcCanvas.value.height}（非正方形），将按 fit 等比缩放并留透明边`)
    }
    if (srcCanvas.value.width < 1024) {
      toast.warn('源图小于 1024px，1024 尺寸会放大输出，建议提供更大的原图')
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
    srcCanvas.value = null
  }
}

const renderSize = (s: number): HTMLCanvasElement => {
  const base = srcCanvas.value!
  const ops = [
    { op: 'resize', width: s, height: s, mode: 'fit' } as const,
    ...(rounded.value ? [{ op: 'round', radius: Math.round((s * radiusPct.value) / 100) } as const] : []),
  ]
  return applyOps(base, ops)
}

/** 自适应前景：内容缩至 66% 安全区内居中（rx3） */
const renderForeground = (): HTMLCanvasElement => {
  const base = srcCanvas.value!
  const c = document.createElement('canvas')
  c.width = 432
  c.height = 432
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, 432, 432)
  const inner = Math.round(432 * 0.66)
  const sc = Math.min(inner / base.width, inner / base.height)
  const w = base.width * sc
  const h = base.height * sc
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base, (432 - w) / 2, (432 - h) / 2, w, h)
  return c
}

let timer = 0
const refreshPreview = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    if (!srcCanvas.value) {
      previewCells.value = []
      return
    }
    const sizes = [
      ...(includeIos.value ? IOS_SIZES : []),
      ...(includeAndroid.value ? ANDROID_SIZES : []),
    ]
    previewCells.value = sizes.map((it) => ({ name: it.name, url: renderSize(it.s).toDataURL('image/png') }))
  }, 150)
}
watch([srcCanvas, rounded, radiusPct, includeIos, includeAndroid], refreshPreview)

/** 安全区粗检（rx3）：不透明内容是否超出中心 66% */
function checkSafeZone() {
  const c = srcCanvas.value
  if (!c) return
  const t = document.createElement('canvas')
  t.width = 96
  t.height = 96
  const ctx = t.getContext('2d')!
  ctx.drawImage(c, 0, 0, 96, 96)
  const d = ctx.getImageData(0, 0, 96, 96).data
  let minX = 96
  let maxX = 0
  let minY = 96
  let maxY = 0
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      if (d[(y * 96 + x) * 4 + 3]! > 32) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const wRatio = (maxX - minX) / 96
  const hRatio = (maxY - minY) / 96
  safeWarn.value = wRatio > 0.7 || hRatio > 0.7
}

const generate = async () => {
  if (!srcCanvas.value || !file.value) {
    toast.warn('请先上传 PNG 源图')
    return
  }
  if (!includeIos.value && !includeAndroid.value && !includeFavicon.value && !adaptive.value) {
    toast.warn('请至少选择一种输出')
    return
  }
  busy.value = true
  progress.value = 0
  done.value = false
  try {
    const items: SizeItem[] = [
      ...(includeIos.value ? IOS_SIZES : []),
      ...(includeAndroid.value ? ANDROID_SIZES : []),
    ]
    const files: { name: string; blob: Blob }[] = []
    const total = items.length + (includeFavicon.value ? 1 : 0) + (adaptive.value ? 3 : 0)
    manifest.value = []
    for (let i = 0; i < items.length; i++) {
      const c = renderSize(items[i]!.s)
      files.push({ name: items[i]!.name, blob: await canvasToBlob(c, 'image/png') })
      manifest.value.push({ name: items[i]!.name, label: `${items[i]!.s}×${items[i]!.s}` })
      progress.value = (i + 1) / total
    }
    if (includeIos.value) {
      // rx2：AppIcon.appiconset/Contents.json 全映射
      const images = IOS_CONTENT_MAP.map((m) => ({
        filename: `AppIcon-${m.s}.png`,
        idiom: m.idiom,
        scale: m.scale,
        size: m.size,
      }))
      const json = JSON.stringify({ images, info: { author: 'ToolHub', version: 1 } }, null, 2)
      files.push({ name: 'AppIcon.appiconset/Contents.json', blob: new Blob([json], { type: 'application/json' }) })
      manifest.value.push({ name: 'AppIcon.appiconset/Contents.json', label: 'Xcode 映射' })
    }
    if (includeFavicon.value) {
      files.push({ name: 'favicon.ico', blob: await encodeIco(renderSize(256), [16, 32, 48, 64, 128, 256]) })
      manifest.value.push({ name: 'favicon.ico', label: '16–256 多帧' })
      progress.value = Math.min(1, (items.length + 1) / total)
    }
    if (adaptive.value) {
      // rx3：自适应图标三件套
      files.push({ name: 'mipmap-xxxhdpi/ic_launcher_foreground.png', blob: await canvasToBlob(renderForeground(), 'image/png') })
      manifest.value.push({ name: 'mipmap-xxxhdpi/ic_launcher_foreground.png', label: '432×432（内容 66% 安全区）' })
      const xml =
        `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`
      files.push({ name: 'mipmap-anydpi-v26/ic_launcher.xml', blob: new Blob([xml], { type: 'text/xml' }) })
      manifest.value.push({ name: 'mipmap-anydpi-v26/ic_launcher.xml', label: '自适应声明' })
      const colors = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgColor.value}</color>\n</resources>\n`
      files.push({ name: 'values/ic_launcher_colors.xml', blob: new Blob([colors], { type: 'text/xml' }) })
      manifest.value.push({ name: 'values/ic_launcher_colors.xml', label: `背景色 ${bgColor.value}` })
    }
    await saveMany(files, 'app-icons.zip')
    progress.value = 1
    done.value = true
    toast.ok(`已生成 ${files.length} 个文件并打包下载`)
  } catch (e) {
    toast.err(`生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

watch(adaptive, () => {
  if (adaptive.value) checkSafeZone()
})
</script>

<template>
  <div>
    <FileDrop accept=".png,image/png" :multiple="false" label="拖入一张 PNG 图标源图（建议 1024×1024 正方形透明底）" hint="本地缩放生成全尺寸图标，打包 ZIP 下载" @files="open" />

    <div v-if="srcCanvas" class="mt-2">
      <div class="row row-wrap" style="gap: 8px; align-items: center">
        <span class="small muted">源图 {{ srcCanvas.width }}×{{ srcCanvas.height }}</span>
        <img :src="srcUrl" class="thumb" alt="源图预览" />
      </div>

      <!-- 逐尺寸预览网格（rx1） -->
      <div v-if="previewCells.length" class="pv-grid mt-2">
        <div v-for="cell in previewCells" :key="cell.name" class="pv-cell">
          <img :src="cell.url" :alt="cell.name" class="pv-img" />
          <span class="pv-name" :title="cell.name">{{ cell.name.split('/').pop() }}</span>
        </div>
      </div>

      <div class="grid-2 mt-2">
        <div class="row" style="gap: 8px">
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer">
            <input v-model="rounded" type="checkbox" /> <span class="small">圆角</span>
          </label>
          <input v-if="rounded" v-model.number="radiusPct" type="range" min="5" max="50" step="1" style="max-width: 140px" />
          <span v-if="rounded" class="small muted">{{ radiusPct }}%</span>
        </div>
        <div class="row" style="gap: 14px; flex-wrap: wrap">
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeIos" type="checkbox" /> <span class="small">iOS 12 尺寸</span></label>
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeAndroid" type="checkbox" /> <span class="small">Android 6 尺寸</span></label>
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeFavicon" type="checkbox" /> <span class="small">favicon.ico</span></label>
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="adaptive" type="checkbox" /> <span class="small">Android 自适应图标</span></label>
        </div>
      </div>

      <div v-if="adaptive" class="row row-wrap mt-1" style="gap: 14px; align-items: center">
        <label style="display: flex; gap: 6px; align-items: center">
          <span class="small">前景背景色</span>
          <input v-model="bgColor" type="color" />
        </label>
        <span v-if="safeWarn" class="notice notice-warn small" style="padding: 4px 10px">
          主体内容可能超出安全区（中心 66%），启动器圆形蒙版下边缘可能被裁切，建议前景四周留白
        </span>
      </div>

      <!-- 圆角指引（rx4） -->
      <p v-if="rounded && includeIos" class="notice notice-info mt-2 small">
        Apple 会自动对图标应用圆角蒙版，App Store 提交建议使用直角（1024 尺寸不要加圆角）；此处圆角仅用于 Android / 网页等场景预览。
      </p>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="generate">
          <Loader2 v-if="busy" :size="16" class="spin" /> <Smartphone v-else :size="16" /> 生成图标 ZIP
        </button>
      </div>

      <div v-if="busy" class="progress mt-2">
        <div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" />
      </div>

      <!-- 结果清单（rx5） -->
      <div v-if="done && manifest.length" class="mt-2">
        <span class="field-label">ZIP 内容清单（{{ manifest.length }} 项）</span>
        <ul class="manifest">
          <li v-for="m in manifest" :key="m.name">
            <code class="mono">{{ m.name }}</code>
            <span class="muted small">{{ m.label }}</span>
          </li>
        </ul>
      </div>

      <p class="notice notice-warn mt-2 small">
        尺寸命名遵循 Apple App Icon 与 Android mipmap 惯例，可直接放进资源目录后微调配置；
        非正方形源图会等比缩放并留透明边（fit 模式）。
      </p>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.thumb {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.1) 0% 25%, transparent 0% 50%) 50% / 12px 12px;
}
.pv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}
.pv-cell {
  display: grid;
  gap: 3px;
  justify-items: center;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.08) 0% 25%, transparent 0% 50%) 50% / 12px 12px;
}
.pv-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.pv-name {
  font-size: 10.5px;
  color: var(--text-3);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.manifest {
  margin: 6px 0 0;
  padding: 0 0 0 4px;
  list-style: none;
  display: grid;
  gap: 3px;
  max-height: 240px;
  overflow: auto;
}
.manifest li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  border-bottom: 1px dashed var(--border);
  padding: 2px 0;
}
</style>
