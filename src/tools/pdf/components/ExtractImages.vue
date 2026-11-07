<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { extractImages } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 提取 PDF 内嵌图片 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const results = ref<{ name: string; blob: Blob; url: string }[]>([])

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
  try {
    const out = await extractImages(file, (p) => (progress.value = p))
    results.value = out.map((o) => ({ ...o, url: URL.createObjectURL(o.blob) }))
    if (!out.length) {
      toast.warn('未找到内嵌图片：该 PDF 可能是矢量图形或纯文本')
    } else {
      toast.ok(`找到 ${out.length} 张图片`)
    }
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  } finally {
    busy.value = false
  }
}

const pack = () => void saveMany(results.value.map(({ name, blob }) => ({ name, blob })), 'PDF图片.zip')
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (results = [])" />

    <div class="row row-wrap mt-2">
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
      <div v-for="r in results" :key="r.name" class="cell">
        <img :src="r.url" :alt="r.name" loading="lazy" />
        <div class="cell-ops">
          <span class="small muted">{{ r.name }} · {{ (r.blob.size / 1024).toFixed(0) }}KB</span>
          <button class="mini" title="下载" aria-label="下载" @click="saveBlob(r.blob, r.name)"><Download :size="13" /></button>
        </div>
      </div>
    </div>

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
