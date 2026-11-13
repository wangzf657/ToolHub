<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Download, Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { extractImagesCore, type ExtractedImage } from './extractImagesCore'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 提取 PDF 内嵌图片：去重标注、最小尺寸过滤、CMYK 转换与解码失败披露 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const minSize = ref(0)
const results = ref<(ExtractedImage & { url: string })[]>([])
const failedCount = ref(0)
const cmykCount = ref(0)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  results.value.forEach((r) => URL.revokeObjectURL(r.url))
  results.value = []
  failedCount.value = 0
  cmykCount.value = 0
  try {
    const r = await extractImagesCore(file, { minSize: minSize.value, onProgress: (p) => (progress.value = p) })
    results.value = r.images.map((o) => ({ ...o, url: URL.createObjectURL(o.blob) }))
    failedCount.value = r.failed
    cmykCount.value = r.cmykCount
    const dupTotal = r.images.filter((x) => x.refs > 1).length
    if (!r.images.length) {
      toast.warn('未找到内嵌图片：该 PDF 可能是矢量图形或纯文本')
    } else {
      const extras: string[] = []
      if (dupTotal) extras.push(`${dupTotal} 张去重（多处引用只保留一份）`)
      if (r.failed) extras.push(`${r.failed} 张编码不支持（如 JPEG2000）未提取`)
      if (r.cmykCount) extras.push(`${r.cmykCount} 张 CMYK 已转 RGB`)
      toast.ok(`找到 ${r.images.length} 张图片${extras.length ? ` · ${extras.join(' · ')}` : ''}`)
    }
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  } finally {
    busy.value = false
  }
}

const pack = () => void saveMany(results.value.map(({ name, blob }) => ({ name, blob })), 'PDF图片.zip')

onBeforeUnmount(() => results.value.forEach((r) => URL.revokeObjectURL(r.url)))
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (results = [])" />

    <div class="row row-wrap mt-2">
      <div>
        <span class="field-label">过滤小于 N px 的图（0 = 不过滤）</span>
        <input v-model.number="minSize" type="number" class="input" style="width: 130px" min="0" step="50" />
      </div>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 提取图片
      </button>
      <button v-if="results.length" class="btn btn-soft" @click="pack">
        <PackageOpen :size="15" /> 打包下载全部（{{ results.length }} 张）
      </button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="results.length" class="grid mt-2">
      <div v-for="r in results" :key="r.hash + r.name" class="cell">
        <img :src="r.url" :alt="r.name" loading="lazy" />
        <div class="cell-ops">
          <span class="small muted">
            {{ r.name }} · {{ (r.blob.size / 1024).toFixed(0) }}KB
            <span v-if="r.refs > 1" class="dup-badge">重复引用 {{ r.refs }} 处</span>
            <span v-if="r.cmyk" class="dup-badge">CMYK→RGB</span>
          </span>
          <button class="mini" title="下载" aria-label="下载" @click="saveBlob(r.blob, r.name)"><Download :size="13" /></button>
        </div>
      </div>
    </div>

    <p v-if="failedCount" class="notice notice-warn mt-2 small">
      {{ failedCount }} 张图片编码不支持（如 JPEG2000 / 不常见的色彩空间），未能提取。
    </p>

    <p v-if="!busy && base?.files.length && !results.length" class="notice notice-info mt-2 small">
      未发现内嵌位图。原因可能：页面由矢量图形绘制，或为纯文字文档——矢量内容无法以图片形式提取。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.cell {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--panel);
}
.cell img {
  width: 100%;
  height: 110px;
  object-fit: contain;
  background: var(--bg-soft);
  display: block;
}
.cell-ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
}
.dup-badge {
  display: inline-block;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 999px;
  padding: 0 6px;
  font-size: 10.5px;
  margin-left: 4px;
}
.mini {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 24px;
  height: 22px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--accent);
  color: var(--text);
}
</style>
