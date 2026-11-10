<script setup lang="ts">
import { ref } from 'vue'
import { ScanEye, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas } from '@/lib/imageEngine'
import { useModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'

/** 图像分类：transformers.js 端侧 MobileViT（ImageNet 1000 类，首次约 20MB，浏览器缓存后离线） */
const toast = useToast()
const model = useModel('image-classifier')

const results = ref<{ label: string; score: number }[]>([])
const previewUrl = ref('')
const topK = ref(5)

interface ClfOut { label: string; score: number }
type Clf = (img: HTMLCanvasElement, opts: { top_k: number }) => Promise<ClfOut[]>

let clf: Clf | null = null

const loadModel = async (): Promise<Clf> => {
  if (clf) return clf
  model.begin()
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    // 国内网络回退镜像
    ;(env as unknown as { remoteHost: string; remotePathTemplate: string }).remoteHost = 'https://hf-mirror.com'
    clf = (await pipeline('image-classification', 'Xenova/mobilevit-small', {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') model.setProgress({ status: p.status, progress: p.progress ?? 0, file: p.file })
        else if (p.status === 'ready' || p.status === 'done') model.setProgress({ status: 'ready', progress: 100 })
      },
    })) as unknown as Clf
    model.done()
    return clf
  } catch (e) {
    model.fail(`模型加载失败：${(e as Error).message}（可尝试切换网络后重试）`)
    throw e
  }
}

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入图片')
  results.value = []
  try {
    const canvas = await decodeToCanvas(f)
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    const fn = await loadModel()
    const out = await fn(canvas, { top_k: Math.max(1, Math.min(10, topK.value)) })
    results.value = out.map((r) => ({ label: r.label, score: r.score }))
    toast.ok('识别完成')
  } catch (e) {
    if (!model.error.value) toast.err(`识别失败：${(e as Error).message}`)
  }
}

const exportCsv = () => {
  if (!results.value.length) return
  const csv = ['类别,置信度', ...results.value.map((r) => `"${r.label}",${(r.score * 100).toFixed(2)}%`)].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '分类结果.csv'
  a.click()
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="image/*" label="拖入一张图片（JPG/PNG/WebP）" hint="端侧模型本地推理，图片不上传；首次使用需下载约 20MB 模型" @files="onFiles" />

    <div v-if="model.state.value === 'loading'" class="mt-2">
      <div class="progress"><div class="fill" :style="{ width: (model.progress.value.progress ?? 0) + '%' }"></div></div>
      <p class="hint mt-1">{{ model.progress.value.status }} {{ model.progress.value.file ?? '' }}（{{ (model.progress.value.progress ?? 0).toFixed(0) }}%）下载完成后浏览器会缓存，下次直接离线推理。</p>
    </div>

    <div v-if="previewUrl" class="two mt-2">
      <div class="left">
        <img :src="previewUrl" class="prev" alt="待识别图片" />
      </div>
      <div>
        <h4 class="h4">识别结果（ImageNet 1000 类，英文标签）</h4>
        <div v-for="(r, i) in results" :key="r.label" class="row mt-1">
          <span class="rk">{{ i + 1 }}</span>
          <span class="lb">{{ r.label }}</span>
          <div class="bar"><div class="bf" :style="{ width: r.score * 100 + '%' }"></div></div>
          <span class="sc">{{ (r.score * 100).toFixed(1) }}%</span>
        </div>
        <p v-if="!results.length" class="hint">模型推理中…</p>
        <div v-if="results.length" class="row gap mt-2">
          <button class="btn btn-sm" @click="exportCsv"><Download :size="14" /> 导出 CSV</button>
          <span class="field-label">Top-K</span>
          <select v-model.number="topK" class="input slim" style="width: 70px">
            <option :value="3">3</option><option :value="5">5</option><option :value="10">10</option>
          </select>
        </div>
        <p class="hint mt-2">口径：MobileViT-Small 在 ImageNet-1k 上训练；标签为英文类别名，置信度仅代表与训练分布的匹配度，非真实世界准确率。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress { height: 6px; border-radius: 3px; background: var(--surface-2, rgba(127,127,127,.15)); overflow: hidden; }
.fill { height: 100%; background: var(--accent); }
.two { display: grid; grid-template-columns: 1fr 1.2fr; gap: 16px; }
.prev { width: 100%; border-radius: 10px; border: 1px solid var(--border); }
.h4 { margin-bottom: 8px; font-size: 14px; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.rk { width: 18px; color: var(--muted); font-size: 12px; }
.lb { flex: 1; font-size: 13.5px; }
.bar { flex: 1.2; height: 8px; border-radius: 4px; background: var(--surface-2, rgba(127,127,127,.15)); }
.bf { height: 100%; border-radius: 4px; background: var(--accent); }
.sc { width: 52px; text-align: right; font-size: 12.5px; color: var(--accent-text); }
.gap { gap: 10px; align-items: center; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 680px) { .two { grid-template-columns: 1fr; } }
</style>
