<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Images, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseIcoDirectory } from '@/lib/fileExt'
import type { IcoEntry } from '@/lib/fileExt'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * ICO 转 PNG：零依赖方案。
 * 主图用 createImageBitmap（浏览器原生解码 ICO 多帧取最大帧）；
 * 同时自研解析 ICO 目录头（ICONDIR），逐帧切片再解码导出（PNG 内嵌帧直接解码，
 * BMP 内嵌帧交给浏览器原生 BMP 解码，失败则跳过该帧）。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const format = ref<'image/png' | 'image/jpeg'>('image/png')
const entries = ref<(IcoEntry & { canvas: HTMLCanvasElement | null; error?: string })[]>([])
const mainCanvas = ref<HTMLCanvasElement | null>(null)
const mainUrl = ref('')

const isBitmap = (c: unknown): c is ImageBitmap => !!c && typeof (c as ImageBitmap).close === 'function'

const decodeBlob = async (blob: Blob): Promise<HTMLCanvasElement | null> => {
  const bitmap = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bitmap.width
  c.height = bitmap.height
  c.getContext('2d')!.drawImage(bitmap, 0, 0)
  if (isBitmap(bitmap)) bitmap.close()
  return c
}

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.ico$/i.test(f.name) && f.type !== 'image/x-icon' && f.type !== 'image/vnd.microsoft.icon') {
    toast.err('请选择 .ico 图标文件')
    return
  }
  file.value = f
  busy.value = true
  entries.value = []
  mainCanvas.value = null
  try {
    const buf = await f.arrayBuffer()
    const bytes = new Uint8Array(buf)
    const dir = parseIcoDirectory(bytes)
    if (!dir.length) throw new Error('ICO 目录为空')
    // 主图：原生解码（Chrome/FF 会取最大帧）
    try {
      const mc = await decodeBlob(f)
      if (mc) {
        mainCanvas.value = mc
        mainUrl.value = mc.toDataURL('image/png')
      }
    } catch {
      mainCanvas.value = null
      mainUrl.value = ''
    }
    // 逐帧切片解码
    for (const e of dir) {
      const item: IcoEntry & { canvas: HTMLCanvasElement | null; error?: string } = { ...e, canvas: null }
      try {
        const slice = bytes.slice(e.imageOffset, e.imageOffset + e.bytesInRes)
        const isPng = slice[0] === 0x89 && slice[1] === 0x50 // PNG 签名
        const blob = new Blob([slice as BlobPart], { type: isPng ? 'image/png' : 'image/bmp' })
        item.canvas = await decodeBlob(blob)
        if (item.canvas && isPng && (item.canvas.width !== e.width || item.canvas.height !== e.height)) {
          // PNG 帧的目录声明尺寸可能是 0（表示 256），以真实解码为准
          item.width = item.canvas.width
          item.height = item.canvas.height
        }
      } catch {
        item.error = '该帧无法解码'
      }
      entries.value.push(item)
    }
    if (!mainCanvas.value && !entries.value.some((e) => e.canvas)) {
      throw new Error('浏览器无法解码该 ICO 的任何一帧（Safari 对 ICO 支持有限）')
    }
    toast.ok(`共 ${dir.length} 帧，成功解码 ${entries.value.filter((e) => e.canvas).length} 帧`)
  } catch (e) {
    toast.err((e as Error).message || 'ICO 解析失败')
  } finally {
    busy.value = false
  }
}

/** JPG 输出前铺白底（rx1 缺陷级修复：透明 ICO 转 JPG 不再变黑底） */
const withWhite = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(canvas, 0, 0)
  return c
}

const downloadOne = async (canvas: HTMLCanvasElement, suffix: string) => {
  if (!file.value) return
  const ext = format.value === 'image/png' ? 'png' : 'jpg'
  const src = format.value === 'image/jpeg' ? withWhite(canvas) : canvas
  const blob = await canvasToBlob(src, format.value, format.value === 'image/jpeg' ? 0.92 : undefined)
  saveBlob(blob, `${baseName(file.value.name)}${suffix}.${ext}`)
}

const downloadAll = async () => {
  if (!file.value) return
  const outs: { name: string; blob: Blob }[] = []
  const ext = format.value === 'image/png' ? 'png' : 'jpg'
  for (const e of entries.value) {
    if (!e.canvas) continue
    const src = format.value === 'image/jpeg' ? withWhite(e.canvas) : e.canvas
    outs.push({ name: `${baseName(file.value.name)}-${e.width}x${e.height}.${ext}`, blob: await canvasToBlob(src, format.value, format.value === 'image/jpeg' ? 0.92 : undefined) })
  }
  if (mainCanvas.value) {
    const src = format.value === 'image/jpeg' ? withWhite(mainCanvas.value) : mainCanvas.value
    outs.push({ name: `${baseName(file.value.name)}-主图.${ext}`, blob: await canvasToBlob(src, format.value, format.value === 'image/jpeg' ? 0.92 : undefined) })
  }
  if (!outs.length) return
  saveMany(outs, `${baseName(file.value.name)}-帧.zip`)
}

/** rx5 最大帧：导出目录头中最大的帧并在文件名标注尺寸 */
const maxFrame = computed(() => entries.value.filter((e) => e.canvas).sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null)

/** 帧缩略 URL（避免模板反复 toDataURL） */
const frameUrls = new Map<number, string>()
const frameUrl = (idx: number): string => {
  const e = entries.value[idx]
  let u = frameUrls.get(idx)
  if (!u && e?.canvas) {
    u = e.canvas.toDataURL('image/png')
    frameUrls.set(idx, u)
  }
  return u ?? ''
}
</script>

<template>
  <div>
    <FileDrop accept=".ico,image/x-icon,image/vnd.microsoft.icon" :multiple="false" label="拖入 .ico 图标文件" hint="零依赖原生解码：解析目录头 + 逐帧导出，本地完成" @files="open" />

    <div v-if="busy" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在解析 ICO…</div>

    <div v-if="entries.length" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="max-width: 130px">
          <option value="image/png">PNG（透明）</option>
          <option value="image/jpeg">JPG（白底）</option>
        </select>
        <span class="grow"></span>
        <button class="btn btn-sm" @click="downloadAll"><Images :size="14" /> 全部帧 PNG（ZIP）</button>
      </div>

      <div v-if="mainCanvas" class="mt-2">
        <p class="small muted">主图（浏览器解码的完整图标）· {{ mainCanvas.width }}×{{ mainCanvas.height }} —— 主图通常为最大帧</p>
        <img :src="mainUrl" class="thumb" alt="主图" />
        <button class="btn btn-primary btn-sm" @click="downloadOne(mainCanvas, '')"><Download :size="14" /> 下载主图</button>
        <button v-if="maxFrame?.canvas && maxFrame.width >= 256" class="btn btn-soft btn-sm" @click="downloadOne(maxFrame.canvas, `-${maxFrame.width}px-max`)">
          <Download :size="14" /> 导出最大帧（{{ maxFrame.width }}px）
        </button>
      </div>

      <p class="small muted mt-2">目录头解析出的 {{ entries.length }} 帧（bpp = 色深，32bpp 含透明通道；主图通常为最大帧）：</p>
      <div class="frame-grid">
        <div v-for="(e, i) in entries" :key="i" class="frame-item" :class="{ err: !e.canvas }">
          <template v-if="e.canvas">
            <img :src="frameUrl(i)" class="thumb" alt="" />
            <p class="meta">{{ e.width }}×{{ e.height }} · {{ e.bitCount }}bpp</p>
            <button class="btn btn-sm" @click="downloadOne(e.canvas, `-${e.width}x${e.height}`)"><Download :size="13" /> {{ format === 'image/png' ? 'PNG' : 'JPG' }}</button>
          </template>
          <p v-else class="meta err-text">{{ e.error }}</p>
        </div>
      </div>

      <!-- rx6 站内互链 -->
      <p class="notice notice-info mt-2 small">
        想把 PNG 做回 ICO？请使用
        <RouterLink to="/t/png-to-ico" class="link">PNG 转 ICO</RouterLink>
        工具。
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
.grow {
  flex: 1;
}
.frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}
.frame-item {
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 6px;
  justify-items: center;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.12) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}
.frame-item.err {
  background: none;
}
.thumb {
  max-width: 96px;
  max-height: 96px;
  display: block;
}
.meta {
  font-size: 11.5px;
  color: var(--text-3);
  margin: 0;
}
.err-text {
  color: var(--err, #c0392b);
}
.link {
  color: var(--accent-text);
  text-decoration: underline;
}
</style>
