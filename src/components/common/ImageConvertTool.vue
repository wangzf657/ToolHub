<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import FileDrop from './FileDrop.vue'
import { convertImage, extFor, type TargetMime } from '@/lib/imageConvert'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { Download, Loader2, Package, FileImage } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    target: TargetMime
    targetLabel: string
    withQuality?: boolean
    withResize?: boolean
  }>(),
  { withQuality: true, withResize: false },
)

const toast = useToast()
const picked = ref<File[]>([])
const qualityVal = ref(0.9)
const widthVal = ref<number | ''>('')
const heightVal = ref<number | ''>('')
const running = ref(false)
const progressPct = ref(0)
const doneCount = ref(0)
/** 完成后自动打包下载（默认关：先看结果再决定下载） */
const autoZip = ref(false)

interface ResultItem {
  name: string
  blob: Blob
  url: string
  srcSize: number
  ok: boolean
  err?: string
}
const results = ref<ResultItem[]>([])

const fmtKB = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

const onFiles = (list: File[]) => {
  picked.value = list
}

const clearResults = () => {
  for (const r of results.value) URL.revokeObjectURL(r.url)
  results.value = []
}

const run = async () => {
  if (!picked.value.length) {
    toast.warn('请先选择要转换的图片')
    return
  }
  running.value = true
  progressPct.value = 0
  doneCount.value = 0
  clearResults()
  try {
    for (let i = 0; i < picked.value.length; i++) {
      const f = picked.value[i]
      try {
        const blob = await convertImage(f, {
          target: props.target,
          quality: qualityVal.value,
          width: widthVal.value === '' ? undefined : Number(widthVal.value),
          height: heightVal.value === '' ? undefined : Number(heightVal.value),
        })
        const base = f.name.replace(/\.[^.]+$/, '')
        const name = `${base}.${extFor(props.target)}`
        results.value.push({ name, blob, url: URL.createObjectURL(blob), srcSize: f.size, ok: true })
      } catch (e) {
        // 单张失败不拖垮整批：以失败卡片留档
        results.value.push({
          name: f.name, blob: new Blob(), url: '', srcSize: f.size, ok: false,
          err: (e as Error).message || '转换失败',
        })
      }
      doneCount.value = i + 1
      progressPct.value = ((i + 1) / picked.value.length) * 100
    }
    const okCount = results.value.filter((r) => r.ok).length
    if (okCount < results.value.length) toast.warn(`${okCount}/${results.value.length} 张成功，失败卡片已标注原因`)
    else toast.ok(`成功转换 ${okCount} 张`)
    if (autoZip.value && okCount) {
      await saveMany(
        results.value.filter((r) => r.ok).map((r) => ({ name: r.name, blob: r.blob })),
        `已转换-${okCount}张.zip`,
      )
    }
  } finally {
    running.value = false
  }
}

const dlOne = (r: ResultItem) => {
  if (r.ok) saveBlob(r.blob, r.name)
}

const zipAll = async () => {
  const ok = results.value.filter((r) => r.ok)
  if (!ok.length) return
  await saveMany(ok.map((r) => ({ name: r.name, blob: r.blob })), `已转换-${ok.length}张.zip`)
}

onBeforeUnmount(clearResults)
</script>

<template>
  <div class="convert-tool">
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放图片到此处，或点击选择（支持批量）"
      hint="支持 PNG / JPG / WebP / GIF / AVIF / BMP / SVG / HEIC / TIFF"
      @files="onFiles"
    />

    <div class="opts row row-wrap mt-2">
      <label v-if="props.withQuality" class="opt">
        <span class="field-label">质量（{{ Math.round(qualityVal * 100) }}%）</span>
        <input v-model.number="qualityVal" type="range" min="0.3" max="1" step="0.05" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">宽度（px，可选）</span>
        <input v-model="widthVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">高度（px，可选）</span>
        <input v-model="heightVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
      <label class="check opt-check"><input v-model="autoZip" type="checkbox" /> 完成后自动打包下载</label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="running || !picked.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" />
        转换为{{ props.targetLabel }}{{ picked.length > 1 ? `（${picked.length} 张）` : '' }}
      </button>
      <span v-if="running" class="muted small">正在处理 {{ doneCount }}/{{ picked.length }}…</span>
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
      <span class="progress-pct">{{ Math.round(progressPct) }}%</span>
    </div>

    <!-- 结果区：缩略图 + 体积对比 + 逐张下载（预览先行，不再盲盒直下 zip） -->
    <div v-if="results.length" class="results mt-2">
      <div class="results-head">
        <span class="field-label">转换结果（{{ results.filter((r) => r.ok).length }}/{{ results.length }}）</span>
        <button class="btn btn-soft btn-sm" @click="zipAll"><Package :size="14" /> 全部打包下载</button>
      </div>
      <div class="cards">
        <div v-for="r in results" :key="r.name + r.srcSize" class="card" :class="{ fail: !r.ok }">
          <div class="thumb">
            <img v-if="r.ok" :src="r.url" :alt="r.name" loading="lazy" />
            <FileImage v-else :size="22" />
          </div>
          <div class="meta">
            <span class="name" :title="r.name">{{ r.name }}</span>
            <span v-if="r.ok" class="size">{{ fmtKB(r.srcSize) }} → <strong>{{ fmtKB(r.blob.size) }}</strong>
              <em v-if="r.blob.size < r.srcSize">（−{{ Math.round((1 - r.blob.size / r.srcSize) * 100) }}%）</em>
            </span>
            <span v-else class="err-text">{{ r.err }}</span>
          </div>
          <button v-if="r.ok" class="btn btn-ghost btn-sm" @click="dlOne(r)"><Download :size="14" /> 下载</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opts {
  gap: 18px;
  align-items: flex-end;
}
.opt {
  display: grid;
  gap: 4px;
}
.opt-check {
  margin-bottom: 8px;
}
.progress {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.progress-pct {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: var(--text-2);
  text-shadow: 0 0 4px var(--bg);
}
.results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}
.card {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.card.fail {
  border-color: color-mix(in srgb, var(--warn) 55%, transparent);
}
.thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px,
    color-mix(in srgb, var(--panel-solid) 60%, transparent);
  color: var(--warn);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.meta {
  min-width: 0;
  display: grid;
  gap: 3px;
  font-size: 12.5px;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.size {
  color: var(--text-3);
}
.size strong {
  color: var(--accent-text);
}
.size em {
  font-style: normal;
  color: #34d399;
}
.err-text {
  color: var(--warn);
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
