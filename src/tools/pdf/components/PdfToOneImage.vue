<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfToOneImage } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转纵向长图 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const scale = ref(1.5)
const gap = ref(8)
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const blob = await pdfToOneImage(file, { format: format.value, scale: scale.value, gap: gap.value })
    saveBlob(blob, format.value === 'image/png' ? '长图.png' : '长图.jpg')
    toast.ok('长图已生成')
  } catch (e) {
    toast.err((e as Error).message || '生成失败，页数过多时请降低清晰度')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">图片格式</span>
        <select v-model="format" class="select">
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
        </select>
      </div>
      <div>
        <span class="field-label">清晰度倍数：{{ scale }}x</span>
        <input v-model.number="scale" type="range" class="range" min="1" max="3" step="0.5" />
      </div>
      <div>
        <span class="field-label">页间留白（px）</span>
        <input v-model.number="gap" type="number" class="input" min="0" max="80" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 生成纵向长图
      </button>
      <span class="small muted">页数较多时长图会非常大，建议倍数 ≤ 1.5x</span>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
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
