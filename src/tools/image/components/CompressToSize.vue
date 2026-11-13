<script setup lang="ts">
/**
 * 压缩图片到指定大小（UX1.0 六处方）：
 * - 进度反馈（rx2/P0）：二分每轮上报「试探中：档位 i/7 · 质量 60% · 183KB」，无卡死感。
 * - 场景预设（rx3）：30KB / 100KB / 200KB / 1MB chips 一键填入。
 * - 批量模式（rx4）：多图逐张压缩，ZIP 打包；逐行体积对比。
 * - 未达标引导（rx5）：最小档兜底时提示切换 JPG/WebP 再压。
 * - 偏好记忆（rx7）：目标体积与格式写入 localStorage（toolhub. 前缀）。
 * - GIF 拦截（rx8）：拖入 GIF 提示只保留首帧（知情可继续）。
 */
import { onMounted, ref } from 'vue'
import { Loader2, Download, Package } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const files = ref<File[]>([])
const targetKB = ref(200)
const format = ref<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg')
const running = ref(false)
const status = ref('') // 试探中文案
interface Row {
  name: string
  before: number
  after: number
  quality: number
  w: number
  h: number
  scale: number
  blob: Blob
  missed: boolean
}
const rows = ref<Row[]>([])

const KB_PRESETS = [30, 100, 200, 1024]
const LS_KB = 'toolhub.compressToSize.kb'
const LS_FMT = 'toolhub.compressToSize.format'
const gifWarn = ref(false)

onMounted(() => {
  try {
    const kb = Number(localStorage.getItem(LS_KB))
    if (Number.isFinite(kb) && kb >= 5) targetKB.value = kb
    const f = localStorage.getItem(LS_FMT)
    if (f === 'image/jpeg' || f === 'image/webp' || f === 'image/png') format.value = f
  } catch { /* 忽略 */ }
})

/** 等比缩放比例序列：从 100% 一路降到 32% */
const SCALES = [1, 0.85, 0.7, 0.58, 0.48, 0.4, 0.32]

async function encode(c0: HTMLCanvasElement, scale: number, q: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(c0.width * scale))
  c.height = Math.max(1, Math.round(c0.height * scale))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(c0, 0, 0, c.width, c.height)
  const blob = await canvasToBlob(c, format.value, q)
  return { blob, w: c.width, h: c.height }
}

/** 对单张做二分压缩（rx2：每轮上报试探状态） */
async function compressOne(c0: HTMLCanvasElement): Promise<Row> {
  const targetBytes = Math.max(1, targetKB.value) * 1024
  const isPng = format.value === 'image/png'
  let fallback: Awaited<ReturnType<typeof encode>> | null = null
  for (let si = 0; si < SCALES.length; si++) {
    const scale = SCALES[si]!
    let best = await encode(c0, scale, isPng ? 1 : 0.05)
    let bestQ = isPng ? 1 : 0.05
    fallback = best
    if (best.blob.size <= targetBytes && !isPng) {
      let lo = 0.05
      let hi = 0.95
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        const r = await encode(c0, scale, mid)
        status.value = `试探中：档位 ${si + 1}/${SCALES.length} · 质量 ${Math.round(mid * 100)}% · ${Math.ceil(r.blob.size / 1024)} KB`
        if (r.blob.size <= targetBytes) {
          best = r
          bestQ = mid
          lo = mid
        } else {
          hi = mid
        }
        if (hi - lo < 0.03) break
      }
    }
    if (best.blob.size <= targetBytes) {
      return { name: '', before: 0, after: best.blob.size, quality: bestQ, w: best.w, h: best.h, scale, blob: best.blob, missed: false }
    }
  }
  if (fallback) {
    return { name: '', before: 0, after: fallback.blob.size, quality: 0.05, w: fallback.w, h: fallback.h, scale: SCALES[SCALES.length - 1]!, blob: fallback.blob, missed: true }
  }
  throw new Error('压缩失败')
}

async function run() {
  if (!files.value.length) {
    toast.warn('请先选择图片')
    return
  }
  running.value = true
  rows.value = []
  try {
    try {
      localStorage.setItem(LS_KB, String(targetKB.value))
      localStorage.setItem(LS_FMT, format.value)
    } catch { /* 忽略 */ }
    for (let i = 0; i < files.value.length; i++) {
      const f = files.value[i]!
      status.value = `正在压缩 ${i + 1}/${files.value.length}：${f.name}`
      try {
        const c0 = await decodeToCanvas(f)
        const r = await compressOne(c0)
        r.name = f.name
        r.before = f.size
        rows.value.push(r)
      } catch (e) {
        toast.warn(`「${f.name}」压缩失败：${(e as Error).message}`)
      }
    }
    const missed = rows.value.filter((r) => r.missed).length
    if (missed) {
      toast.warn(`${missed} 张已压到最小档位仍超目标 —— 可尝试切换 JPG / WebP 格式再压（体积更小）`)
    } else {
      toast.ok(`已压缩 ${rows.value.length} 张`)
    }
  } finally {
    running.value = false
    status.value = ''
  }
}

function download(r: Row) {
  if (!r) return
  const ext = format.value === 'image/jpeg' ? 'jpg' : format.value.split('/')[1]
  saveBlob(r.blob, `${baseName(r.name)}-compressed.${ext}`)
}

async function zipAll() {
  const ok = rows.value
  if (!ok.length) return
  await saveMany(
    ok.map((r) => ({
      name: `${baseName(r.name)}-compressed.${format.value === 'image/jpeg' ? 'jpg' : format.value.split('/')[1]}`,
      blob: r.blob,
    })),
    `已压缩-${ok.length}张.zip`,
  )
  toast.ok(`已打包 ${ok.length} 张`)
}

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

async function onFiles(list: File[]) {
  files.value = list
  rows.value = []
  // rx8 GIF 拦截（知情可继续）
  gifWarn.value = list.some((f) => f.type === 'image/gif' || /\.gif$/i.test(f.name))
  if (gifWarn.value) {
    toast.warn('动图请使用 GIF 压缩工具；此处继续将只保留首帧')
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      :multiple="true"
      label="拖放 JPG / PNG / WebP 到此处（可批量）"
      hint="按目标体积自动二分质量，必要时等比降分辨率"
      @files="onFiles"
    />
    <div v-if="gifWarn" class="notice notice-warn mt-1">检测到 GIF 动图：动图请使用「GIF 压缩」工具；在此继续仅处理首帧。</div>

    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">目标大小（KB）</span>
        <input v-model.number="targetKB" type="number" min="5" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">预设</span>
        <span class="row" style="gap: 6px">
          <button v-for="kb in KB_PRESETS" :key="kb" class="chip" :class="{ active: targetKB === kb }" @click="targetKB = kb">
            {{ kb >= 1024 ? '1MB' : kb + 'KB' }}
          </button>
        </span>
      </label>
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="width: 180px">
          <option value="image/jpeg">JPG（体积最小）</option>
          <option value="image/webp">WebP</option>
          <option value="image/png">PNG（无损，靠降尺寸）</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="running || !files.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" /> 开始压缩
      </button>
    </div>

    <p v-if="status" class="muted small mt-2 mono">{{ status }}</p>

    <div v-if="rows.length" class="mt-2">
      <div class="row" style="justify-content: space-between; margin-bottom: 6px">
        <span class="field-label">压缩结果（{{ rows.length }} 张）</span>
        <button v-if="rows.length > 1" class="btn btn-soft btn-sm" @click="zipAll"><Package :size="14" /> 打包下载 ZIP</button>
      </div>
      <div v-for="(r, i) in rows" :key="i" class="row notice notice-ok mb-1" style="flex-wrap: wrap; gap: 8px">
        <span class="ellipsis-name" :title="r.name">{{ r.name }}</span>
        <span class="muted small">{{ sizeLabel(r.before) }} → <strong>{{ sizeLabel(r.after) }}</strong>（{{ Math.round((1 - r.after / Math.max(1, r.before)) * 100) }}%）</span>
        <span class="muted small">质量 {{ Math.round(r.quality * 100) }}% · {{ r.w }}×{{ r.h }}<template v-if="r.scale < 1">（缩放 {{ Math.round(r.scale * 100) }}%）</template></span>
        <span v-if="r.missed" class="small" style="color: var(--warn)">未达标（已最小档）</span>
        <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="download(r)"><Download :size="14" /> 下载</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.ellipsis-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.mb-1 {
  margin-bottom: 6px;
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
