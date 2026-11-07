<script setup lang="ts">
/** 压缩图片到指定大小：二分质量逼近（0.05..0.95，12 次迭代），必要时等比降分辨率（最低 32%） */
import { ref, shallowRef } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const targetKB = ref(200)
const format = ref<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg')
const running = ref(false)
const result = ref<{ size: number; quality: number; w: number; h: number; scale: number } | null>(null)
const outBlob = shallowRef<Blob | null>(null)

/** 等比缩放比例序列：从 100% 一路降到 32% */
const SCALES = [1, 0.85, 0.7, 0.58, 0.48, 0.4, 0.32]

async function encode(scale: number, q: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(src.value!.width * scale))
  c.height = Math.max(1, Math.round(src.value!.height * scale))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(src.value!, 0, 0, c.width, c.height)
  const blob = await canvasToBlob(c, format.value, q)
  return { blob, w: c.width, h: c.height }
}

async function run() {
  if (!src.value) {
    toast.warn('请先选择图片')
    return
  }
  running.value = true
  try {
    const targetBytes = Math.max(1, targetKB.value) * 1024
    const isPng = format.value === 'image/png'
    let fallback: Awaited<ReturnType<typeof encode>> | null = null
    for (const scale of SCALES) {
      // PNG 不支持质量参数，只能靠降分辨率逼近
      let best = await encode(scale, isPng ? 1 : 0.05)
      fallback = best
      if (best.blob.size <= targetBytes) {
        if (!isPng) {
          let lo = 0.05
          let hi = 0.95
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2
            const r = await encode(scale, mid)
            if (r.blob.size <= targetBytes) {
              best = r
              lo = mid
            } else {
              hi = mid
            }
          }
        }
        result.value = { size: best.blob.size, quality: isPng ? 1 : 0.9, w: best.w, h: best.h, scale }
        outBlob.value = best.blob
        toast.ok(`已压到 ${Math.ceil(best.blob.size / 1024)} KB`)
        return
      }
    }
    // 全部档位仍超目标：给出最小档兜底结果
    if (fallback) {
      result.value = {
        size: fallback.blob.size,
        quality: isPng ? 1 : 0.05,
        w: fallback.w,
        h: fallback.h,
        scale: SCALES[SCALES.length - 1],
      }
      outBlob.value = fallback.blob
      toast.warn('已压到最小档位，仍略超目标体积')
    }
  } catch (e) {
    toast.err((e as Error).message || '压缩失败')
  } finally {
    running.value = false
  }
}

function download() {
  if (!outBlob.value || !file.value) return
  const ext = format.value === 'image/jpeg' ? 'jpg' : format.value.split('/')[1]
  saveBlob(outBlob.value, `${baseName(file.value.name)}-compressed.${ext}`)
}

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

async function onFiles(files: File[]) {
  if (!files.length) return
  file.value = files[0]
  result.value = null
  outBlob.value = null
  try {
    src.value = await decodeToCanvas(files[0])
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/jpeg,image/png,image/webp,image/*"
      :multiple="false"
      label="拖放 JPG / PNG / WebP 到此处"
      hint="将按目标体积自动二分质量，必要时等比降分辨率"
      @files="onFiles"
    />
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">目标大小（KB）</span>
        <input v-model.number="targetKB" type="number" min="5" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="width: 180px">
          <option value="image/jpeg">JPG（体积最小）</option>
          <option value="image/webp">WebP</option>
          <option value="image/png">PNG（无损，靠降尺寸）</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="running || !src" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" /> 开始压缩
      </button>
    </div>
    <div v-if="result" class="notice notice-ok mt-2">
      完成：{{ sizeLabel(result.size) }}（目标 {{ targetKB }} KB）· 质量 {{ Math.round(result.quality * 100) }}% ·
      尺寸 {{ result.w }} × {{ result.h }} px<template v-if="result.scale < 1">（已缩放到 {{ Math.round(result.scale * 100) }}%）</template>
      <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="download">
        <Download :size="14" /> 下载
      </button>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
