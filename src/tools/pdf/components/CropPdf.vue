<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { cropPdf, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 裁边：四边百分比 + 实时裁剪预览 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const top = ref(5)
const right = ref(5)
const bottom = ref(5)
const left = ref(5)
const busy = ref(false)
const previewBox = ref<HTMLDivElement | null>(null)
const file = ref<File | Blob | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
}

const renderPreview = async () => {
  if (!file.value || !previewBox.value) return
  try {
    const canvas = await renderPageToCanvas(file.value, 0, 1)
    canvas.style.clipPath = `inset(${top.value}% ${right.value}% ${bottom.value}% ${left.value}%)`
    canvas.style.maxWidth = '100%'
    previewBox.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}

watch([file, top, right, bottom, left], renderPreview)

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (top.value + bottom.value >= 90 || left.value + right.value >= 90) {
    toast.warn('裁剪比例过大，上下（或左右）合计需小于 90%')
    return
  }
  busy.value = true
  try {
    const blob = await cropPdf(file.value, { top: top.value, right: right.value, bottom: bottom.value, left: left.value })
    saveBlob(blob, '裁边后.pdf')
    toast.ok('裁边完成')
  } catch (e) {
    toast.err((e as Error).message || '裁剪失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="file" class="grid-2 mt-2">
      <div>
        <div class="mb-2">
          <span class="field-label">上边裁掉：{{ top }}%</span>
          <input v-model.number="top" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div class="mb-2">
          <span class="field-label">右边裁掉：{{ right }}%</span>
          <input v-model.number="right" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div class="mb-2">
          <span class="field-label">下边裁掉：{{ bottom }}%</span>
          <input v-model.number="bottom" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div>
          <span class="field-label">左边裁掉：{{ left }}%</span>
          <input v-model.number="left" type="range" class="range" min="0" max="40" step="1" />
        </div>
      </div>
      <div>
        <p class="field-label mb-2">首页预览（虚线内为保留区域）</p>
        <div ref="previewBox" class="preview"></div>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 裁边并下载
      </button>
      <span class="small muted">裁边写入页面 CropBox，内容不丢失，仅改变显示/打印范围</span>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.preview {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  min-height: 200px;
  display: grid;
  place-items: center;
  background: var(--bg-soft);
}
.preview :deep(canvas) {
  max-width: 100%;
  height: auto;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
