<script setup lang="ts">
/** 图片对比找不同：归一化到相同尺寸 → 逐像素比较 → 差异热力图 + 占比 */
import { ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const fileA = shallowRef<HTMLCanvasElement | null>(null)
const fileB = shallowRef<HTMLCanvasElement | null>(null)
const nameA = ref('')
const nameB = ref('')
const threshold = ref(30)
const diffRatio = ref(0)
const views = shallowRef<{ a: HTMLCanvasElement; b: HTMLCanvasElement; diff: HTMLCanvasElement } | null>(null)
const tab = ref<'a' | 'b' | 'diff'>('diff')
const stage = ref<HTMLElement | null>(null)

let mounted: HTMLCanvasElement | null = null

async function load(files: File[], which: 'a' | 'b') {
  if (!files.length) return
  try {
    const c = await decodeToCanvas(files[0])
    if (which === 'a') {
      fileA.value = c
      nameA.value = files[0].name
    } else {
      fileB.value = c
      nameB.value = files[0].name
    }
    compute()
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function compute() {
  const a = fileA.value
  const b = fileB.value
  if (!a || !b) return
  // 归一化到两者中较小的尺寸
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  const norm = (c: HTMLCanvasElement) => {
    const t = document.createElement('canvas')
    t.width = w
    t.height = h
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(c, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  }
  const da = norm(a)
  const db = norm(b)
  const heat = new ImageData(w, h)
  let diffCount = 0
  const thr = threshold.value
  for (let i = 0; i < da.data.length; i += 4) {
    const dr = Math.abs(da.data[i] - db.data[i])
    const dg = Math.abs(da.data[i + 1] - db.data[i + 1])
    const dbl = Math.abs(da.data[i + 2] - db.data[i + 2])
    const sum = dr + dg + dbl
    if (sum > thr * 3) {
      diffCount++
      // 热力图：差异越大越亮
      const k = Math.min(1, sum / 384)
      heat.data[i] = 255
      heat.data[i + 1] = Math.round(60 * (1 - k))
      heat.data[i + 2] = Math.round(60 * (1 - k))
      heat.data[i + 3] = 255
    } else {
      // 差异小处显示暗化的 A 图
      heat.data[i] = da.data[i] * 0.35
      heat.data[i + 1] = da.data[i + 1] * 0.35
      heat.data[i + 2] = da.data[i + 2] * 0.35
      heat.data[i + 3] = 255
    }
  }
  diffRatio.value = diffCount / (w * h)
  const toCanvas = (id: ImageData) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.putImageData(id, 0, 0)
    return c
  }
  const aSmall = toCanvas(da)
  const bSmall = toCanvas(db)
  const dSmall = toCanvas(heat)
  views.value = { a: aSmall, b: bSmall, diff: dSmall }
}

watch([views, tab], (v) => {
  const cur = v[0]
  if (!cur) return
  const show = tab.value === 'a' ? cur.a : tab.value === 'b' ? cur.b : cur.diff
  if (mounted) mounted.remove()
  if (stage.value) {
    show.style.maxWidth = '100%'
    show.style.height = 'auto'
    show.style.display = 'block'
    show.style.margin = '0 auto'
    stage.value.appendChild(show)
    mounted = show
  }
})

watch(threshold, () => compute())

async function download() {
  if (!views.value) return
  const blob = await canvasToBlob(views.value.diff, 'image/png')
  saveBlob(blob, 'image-diff.png')
}

const sizeText = (c: HTMLCanvasElement | null) => (c ? `${c.width} × ${c.height}` : '—')
</script>

<template>
  <div class="grid-2">
    <div>
      <div class="field-label">图片 A（{{ nameA || '未选择' }}，{{ sizeText(fileA) }}）</div>
      <FileDrop accept="image/*" :multiple="false" label="拖放图片 A" @files="(f) => load(f, 'a')" />
    </div>
    <div>
      <div class="field-label">图片 B（{{ nameB || '未选择' }}，{{ sizeText(fileB) }}）</div>
      <FileDrop accept="image/*" :multiple="false" label="拖放图片 B" @files="(f) => load(f, 'b')" />
    </div>
  </div>

  <template v-if="views">
    <div class="row row-wrap mt-2" style="gap: 14px">
      <div class="tabs">
        <button class="chip" :class="{ active: tab === 'a' }" @click="tab = 'a'">图 A</button>
        <button class="chip" :class="{ active: tab === 'b' }" @click="tab = 'b'">图 B</button>
        <button class="chip" :class="{ active: tab === 'diff' }" @click="tab = 'diff'">差异热力图</button>
      </div>
      <div style="min-width: 220px">
        <span class="field-label">差异阈值：{{ threshold }}</span>
        <input v-model.number="threshold" type="range" min="2" max="120" step="1" />
      </div>
    </div>

    <div v-if="tab === 'diff'" class="row row-wrap mt-1" style="gap: 12px">
      <span class="badge">差异像素占比：{{ (diffRatio * 100).toFixed(2) }}%</span>
      <span class="badge badge-plain">对比区域：{{ views.diff.width }} × {{ views.diff.height }}（取两图较小尺寸）</span>
    </div>

    <div ref="stage" class="stage mt-2"></div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载热力图 PNG</button>
      <span class="muted small">红色 = 有差异（越亮差异越大），暗部 = 一致区域</span>
    </div>
  </template>
  <p v-else class="muted small mt-2">两张图都载入后自动开始对比；尺寸不同时会被缩放到相同大小再比较。</p>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  overflow: hidden;
}
</style>
