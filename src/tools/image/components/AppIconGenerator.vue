<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Smartphone } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas, applyOps, encodeIco, canvasToBlob } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * App 图标生成：上传一张 PNG → iOS / Android 全尺寸图标 + favicon.ico → 打包 ZIP。
 * 等比缩放（fit，非正方形留透明边），可选圆角。
 */
interface SizeItem {
  s: number
  name: string
}

const IOS_SIZES: SizeItem[] = [
  { s: 1024, name: 'AppIcon-1024.png' },
  { s: 180, name: 'AppIcon-180.png' },
  { s: 152, name: 'AppIcon-152.png' },
  { s: 120, name: 'AppIcon-120.png' },
  { s: 87, name: 'AppIcon-87.png' },
  { s: 80, name: 'AppIcon-80.png' },
  { s: 76, name: 'AppIcon-76.png' },
  { s: 60, name: 'AppIcon-60.png' },
  { s: 58, name: 'AppIcon-58.png' },
  { s: 40, name: 'AppIcon-40.png' },
  { s: 29, name: 'AppIcon-29.png' },
  { s: 20, name: 'AppIcon-20.png' },
]
const ANDROID_SIZES: SizeItem[] = [
  { s: 512, name: 'playstore-icon.png' },
  { s: 192, name: 'mipmap-xxxhdpi/ic_launcher.png' },
  { s: 144, name: 'mipmap-xxhdpi/ic_launcher.png' },
  { s: 96, name: 'mipmap-xhdpi/ic_launcher.png' },
  { s: 72, name: 'mipmap-hdpi/ic_launcher.png' },
  { s: 48, name: 'mipmap-mdpi/ic_launcher.png' },
]

const toast = useToast()
const file = ref<File | null>(null)
const srcCanvas = ref<HTMLCanvasElement | null>(null)
const rounded = ref(false)
const radiusPct = ref(22)
const includeIos = ref(true)
const includeAndroid = ref(true)
const includeFavicon = ref(true)
const busy = ref(false)
const progress = ref(0)
const done = ref(false)
const count = ref(0)

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.png$/i.test(f.name) && f.type !== 'image/png') {
    toast.warn('建议使用正方形透明底 PNG 作为图标源图')
  }
  file.value = f
  done.value = false
  try {
    srcCanvas.value = await decodeToCanvas(f)
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

/** 生成单个尺寸（正方形画布 + fit + 可选圆角） */
const renderSize = (s: number): HTMLCanvasElement => {
  const base = srcCanvas.value!
  const ops = [
    { op: 'resize', width: s, height: s, mode: 'fit' } as const,
    ...(rounded.value ? [{ op: 'round', radius: Math.round((s * radiusPct.value) / 100) } as const] : []),
  ]
  return applyOps(base, ops)
}

const generate = async () => {
  if (!srcCanvas.value || !file.value) {
    toast.warn('请先上传 PNG 源图')
    return
  }
  if (!includeIos.value && !includeAndroid.value && !includeFavicon.value) {
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
    const total = items.length + (includeFavicon.value ? 1 : 0)
    for (let i = 0; i < items.length; i++) {
      const c = renderSize(items[i].s)
      files.push({ name: items[i].name, blob: await canvasToBlob(c, 'image/png') })
      progress.value = (i + 1) / total
    }
    if (includeFavicon.value) {
      files.push({ name: 'favicon.ico', blob: await encodeIco(renderSize(256), [16, 32, 48, 64, 128, 256]) })
      progress.value = 1
    }
    await saveMany(files, 'app-icons.zip')
    count.value = files.length
    done.value = true
    toast.ok(`已生成 ${files.length} 个图标文件并打包下载`)
  } catch (e) {
    toast.err(`生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".png,image/png" :multiple="false" label="拖入一张 PNG 图标源图（建议 1024×1024 正方形透明底）" hint="本地缩放生成全尺寸图标，打包 ZIP 下载" @files="open" />

    <div v-if="srcCanvas" class="mt-2">
      <div class="row row-wrap" style="gap: 8px; align-items: center">
        <span class="small muted">源图 {{ srcCanvas.width }}×{{ srcCanvas.height }}</span>
        <img :src="srcCanvas.toDataURL('image/png')" class="thumb" alt="源图预览" />
      </div>

      <div class="grid-2 mt-2">
        <div class="row" style="gap: 8px">
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer">
            <input v-model="rounded" type="checkbox" /> <span class="small">圆角</span>
          </label>
          <input v-if="rounded" v-model.number="radiusPct" type="range" min="5" max="50" step="1" style="max-width: 140px" />
          <span v-if="rounded" class="small muted">{{ radiusPct }}%</span>
        </div>
        <div class="row" style="gap: 14px">
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeIos" type="checkbox" /> <span class="small">iOS 12 尺寸</span></label>
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeAndroid" type="checkbox" /> <span class="small">Android 6 尺寸</span></label>
          <label style="display: flex; gap: 6px; align-items: center; cursor: pointer"><input v-model="includeFavicon" type="checkbox" /> <span class="small">favicon.ico</span></label>
        </div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="generate">
          <Loader2 v-if="busy" :size="16" class="spin" /> <Smartphone v-else :size="16" /> 生成图标 ZIP
        </button>
      </div>

      <div v-if="busy" class="progress mt-2">
        <div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" />
      </div>

      <p v-if="done" class="small muted mt-1">
        共 {{ count }} 个文件：iOS 按 AppIcon-尺寸 命名；Android 按 mipmap-*dpi/ic_launcher.png 命名（含 512 Play Store 图）；
        favicon.ico 含 16–256 多尺寸帧。
      </p>

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
</style>
