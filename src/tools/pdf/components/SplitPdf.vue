<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { splitPdf } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 拆分 PDF：每页一个文件，逐个下载或打包 ZIP */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const results = ref<{ name: string; blob: Blob }[]>([])

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  results.value = []
  try {
    results.value = await splitPdf(file, (p) => (progress.value = p))
    toast.ok(`已拆分为 ${results.value.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '拆分失败，请确认文件有效')
  } finally {
    busy.value = false
  }
}

const dl = (item: { name: string; blob: Blob }) => saveBlob(item.blob, item.name)
const pack = () => void saveMany(results.value, '拆分结果.zip')
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (results = [])" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始拆分
      </button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="results.length" class="mt-2">
      <div class="row row-wrap mb-2">
        <button class="btn btn-soft" @click="pack"><PackageOpen :size="15" /> 打包下载全部（ZIP）</button>
        <span class="small muted">共 {{ results.length }} 个单页文件</span>
      </div>
      <div class="list">
        <div v-for="r in results" :key="r.name" class="item">
          <span class="name">{{ r.name }}</span>
          <span class="small muted">{{ (r.blob.size / 1024).toFixed(0) }} KB</span>
          <button class="btn btn-ghost btn-sm" @click="dl(r)"><Download :size="14" /> 下载</button>
        </div>
      </div>
    </div>
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
.list {
  display: grid;
  gap: 6px;
  max-height: 320px;
  overflow: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.name {
  flex: 1;
  font-size: 13px;
}
</style>
