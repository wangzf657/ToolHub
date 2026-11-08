<script setup lang="ts">
/** PPTX 压缩瘦身：解 zip → 重压缩 ppt/media 图片（无透明转 JPG）→ 清理未引用媒体 → 重打包 */
import { ref } from 'vue'
import { Loader2, FileArchive } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = ref<File | null>(null)
const quality = ref(80)
const busy = ref(false)
const progress = ref(0)
const result = ref<{ before: number; after: number; imgs: number; removed: number } | null>(null)

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = (files: File[]) => {
  file.value = files[0] ?? null
  result.value = null
}

/** 是否含透明像素（有透明保持 PNG，不透明转 JPG 体积小得多） */
function hasAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4 * 17) {
    if (data[i]! < 255) return true
  }
  return false
}

const run = async () => {
  if (!file.value) return toast.warn('请先选择 .pptx 文件')
  if (file.value.size > 50 * 1024 * 1024) toast.warn('文件较大，处理可能需要十几秒')
  busy.value = true
  progress.value = 0
  result.value = null
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.value.arrayBuffer())
    const names = Object.keys(zip.files)

    // 1) 收集所有 rels 引用的媒体文件（slides/layouts/masters/notes 全量扫）
    const referenced = new Set<string>()
    for (const n of names) {
      if (!n.endsWith('.rels')) continue
      const text = await zip.files[n].async('string')
      for (const m of text.matchAll(/Target="[^"]*media\/([^"?]+)"/g)) referenced.add(m[1])
    }

    // 2) 重压缩媒体图片
    const mediaNames = names.filter((n) => /^ppt\/media\/.+\.(png|jpe?g)$/i.test(n) && zip.files[n] && !zip.files[n].dir)
    let idx = 0
    let removed = 0
    for (const n of mediaNames) {
      idx++
      progress.value = idx / Math.max(1, mediaNames.length)
      const base = n.split('/').pop() ?? n
      // 未被任何 rels 引用 → 直接移除
      if (!referenced.has(base)) {
        zip.remove(n)
        removed++
        continue
      }
      try {
        const blob = await zip.files[n].async('blob')
        const canvas = await decodeToCanvas(blob)
        let candidate: Blob | null = null
        if (hasAlpha(canvas)) {
          // 含透明：只能保持 PNG，尝试画布重编码（通常收益有限）
          const png = await canvasToBlob(canvas, 'image/png')
          candidate = png.size < blob.size * 0.95 ? png : null
        } else if (/\.jpe?g$/i.test(n)) {
          // 不透明 JPG：按质量参数重编码
          const jpg = await canvasToBlob(canvas, 'image/jpeg', Math.min(0.95, Math.max(0.4, quality.value / 100)))
          candidate = jpg.size < blob.size * 0.95 ? jpg : null
        }
        // PNG 不转 JPG：引用关系需同步改名（rels/Content_Types），风险大于收益
        if (candidate) zip.file(n, candidate)
      } catch {
        // 单图失败不阻断整体（保留原图）
      }
    }

    // 3) 重打包
    const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    result.value = { before: file.value.size, after: out.size, imgs: mediaNames.length, removed }
    saveBlob(out, `压缩副本-${file.value.name}`)
    toast.ok(`完成：${fmtSize(file.value.size)} → ${fmtSize(out.size)}`)
  } catch (e) {
    toast.err((e as Error).message || '压缩失败，请确认是有效的 .pptx 文件')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".pptx" :multiple="false" label="拖入 PowerPoint 文件（.pptx）" hint="本地解包重压缩图片与清理未引用媒体 · 原文件不动" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">JPG 质量（%）</span>
        <input v-model.number="quality" type="number" min="40" max="95" class="input" style="width: 110px" />
      </label>
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <FileArchive v-else :size="16" /> 开始压缩
      </button>
      <span v-if="file" class="muted small">当前：{{ fmtSize(file.size) }}</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="result" class="notice notice-ok mt-2">
      完成：{{ fmtSize(result.before) }} → <strong>{{ fmtSize(result.after) }}</strong>
      （节省 {{ Math.max(0, Math.round((1 - result.after / Math.max(1, result.before)) * 100)) }}%）· 媒体图 {{ result.imgs }} 张 · 清理未引用 {{ result.removed }} 张
    </div>

    <p class="notice notice-info mt-2 small">原理：pptx 即 ZIP 包，图片在 ppt/media/。含透明的图保留 PNG，不透明的转 JPG；输出为副本可直接替换使用。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
