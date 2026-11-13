<script setup lang="ts">
/**
 * 图片九宫格切分（UX1.0 三处方）：
 * - 方形优先（rx1）：先中心裁剪为最大正方形再切分，主体不偏移。
 * - 留白模式（rx4）：每片四周加白边（间距 0~20px），拼回与原图对齐。
 * - JPG 选项（rx5）：PNG/JPG + 质量切换。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const rows = ref(3)
const cols = ref(3)
const squareFirst = ref(false)
const padOn = ref(false)
const pad = ref(8)
const format = ref<'image/png' | 'image/jpeg'>('image/png')
const quality = ref(90)
const tiles = shallowRef<HTMLCanvasElement[]>([])
const saving = ref(false)

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    src.value = null
    tiles.value = []
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function render() {
  const s = src.value
  if (!s) {
    tiles.value = []
    return
  }
  let base = s
  if (squareFirst.value) {
    const side = Math.min(s.width, s.height)
    base = document.createElement('canvas')
    base.width = side
    base.height = side
    base.getContext('2d')!.drawImage(s, (s.width - side) / 2, (s.height - side) / 2, side, side, 0, 0, side, side)
  }
  const W = base.width
  const H = base.height
  const tw = Math.floor(W / cols.value)
  const th = Math.floor(H / rows.value)
  const p = padOn.value ? Math.max(0, Math.round(pad.value)) : 0
  const out: HTMLCanvasElement[] = []
  for (let r = 0; r < rows.value; r++) {
    for (let c = 0; c < cols.value; c++) {
      const cv = document.createElement('canvas')
      cv.width = tw + p * 2
      cv.height = th + p * 2
      const ctx = cv.getContext('2d')!
      if (p > 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, cv.width, cv.height)
      }
      // 留白模式下居中取整片原图区域（保证拼回对齐：每片覆盖原图 tw×th 区域）
      ctx.drawImage(base, c * tw, r * th, tw, th, p, p, tw, th)
      out.push(cv)
    }
  }
  tiles.value = out
}

let timer = 0
watch([rows, cols, src, squareFirst, padOn, pad], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

const thumbUrls = shallowRef<string[]>([])
watch(tiles, (list) => {
  thumbUrls.value = list.map((t) => t.toDataURL('image/png'))
})

async function download() {
  if (!tiles.value.length || !file.value) return
  saving.value = true
  try {
    const base = baseName(file.value.name)
    const ext = format.value === 'image/png' ? 'png' : 'jpg'
    const outs: { name: string; blob: Blob }[] = []
    let i = 1
    for (const t of tiles.value) {
      outs.push({ name: `${base}-${i}.${ext}`, blob: await canvasToBlob(t, format.value, format.value === 'image/jpeg' ? quality.value / 100 : undefined) })
      i++
    }
    await saveMany(outs, `${base}-九宫格.zip`)
    const total = outs.reduce((s, o) => s + o.blob.size, 0)
    toast.ok(`已导出 ${outs.length} 张切片（共 ${(total / 1024).toFixed(0)} KB）`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    saving.value = false
  }
}

const tileInfo = computed(() => {
  const t = tiles.value[0]
  return t ? `${t.width} × ${t.height} px` : '—'
})
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="切成等分网格，适合发朋友圈九宫格"
      @files="onFiles"
    />

    <div class="row row-wrap mt-2" style="gap: 20px; align-items: flex-start">
      <div style="min-width: 190px">
        <span class="field-label">行数：{{ rows }}</span>
        <input v-model.number="rows" type="range" min="2" max="5" step="1" />
      </div>
      <div style="min-width: 190px">
        <span class="field-label">列数：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="2" max="5" step="1" />
      </div>
      <div class="col">
        <label class="check"><input v-model="squareFirst" type="checkbox" /> 方形优先（先中心裁最大正方形）</label>
        <label class="check"><input v-model="padOn" type="checkbox" /> 留白模式（每片加白边）</label>
        <div v-if="padOn" style="min-width: 180px">
          <span class="field-label">留白：{{ pad }} px</span>
          <input v-model.number="pad" type="range" min="0" max="20" step="1" />
        </div>
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">格式</span>
        <select v-model="format" class="select" style="width: 110px">
          <option value="image/png">PNG（透明）</option>
          <option value="image/jpeg">JPG（更小）</option>
        </select>
      </label>
      <label v-if="format === 'image/jpeg'" class="opt">
        <span class="field-label">质量：{{ quality }}%</span>
        <input v-model.number="quality" type="range" min="50" max="100" step="5" style="width: 130px" />
      </label>
      <button class="btn btn-primary" :disabled="!tiles.length || saving" @click="download">
        <Download :size="16" /> 打包下载（{{ tiles.length }} 张）
      </button>
    </div>

    <div v-if="thumbUrls.length" class="thumb-grid mt-2">
      <img v-for="(u, i) in thumbUrls" :key="i" :src="u" class="thumb" :style="{ aspectRatio: `${tiles[i]!.width} / ${tiles[i]!.height}` }" />
    </div>
    <p v-if="tiles.length" class="muted small mt-1">
      每片 {{ tileInfo }}（图片边缘不足整除的部分会被裁掉；留白模式白边计入每片，拼回与原图对齐）
    </p>
  </div>
</template>

<style scoped>
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}
.thumb {
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: block;
  object-fit: cover;
}
.opt {
  display: grid;
  gap: 4px;
}
.col {
  display: grid;
  gap: 6px;
}
</style>
