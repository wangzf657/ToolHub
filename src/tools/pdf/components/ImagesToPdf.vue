<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { imagesToPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 图片合成 PDF（jpg-to-pdf / png-to-pdf 复用本组件） */
const toast = useToast()
const files = ref<File[]>([])
const pageSize = ref<'auto' | 'A4' | 'Letter'>('auto')
const margin = ref(0)
const landscape = ref(false)
const busy = ref(false)

const onFiles = (list: File[]) => (files.value = list)

const run = async () => {
  if (!files.value.length) {
    toast.warn('请先添加至少一张图片')
    return
  }
  busy.value = true
  try {
    const blob = await imagesToPdf(files.value, {
      pageSize: pageSize.value,
      margin: margin.value,
      landscape: landscape.value,
    })
    saveBlob(blob, '图片合成.pdf')
    toast.ok(`已生成 ${files.value.length} 页 PDF`)
  } catch (e) {
    toast.err((e as Error).message || '合成失败，请检查图片格式')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept="image/*" :multiple="true" label="拖入图片（可多选），按列表顺序合成" hint="支持 JPG / PNG / WebP / HEIC / TIFF 等，本地处理" @files="onFiles" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">页面尺寸</span>
        <select v-model="pageSize" class="select">
          <option value="auto">跟随图片尺寸</option>
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </div>
      <div>
        <span class="field-label">页边距（pt）</span>
        <input v-model.number="margin" type="number" class="input" min="0" max="120" />
      </div>
      <div>
        <span class="field-label">横向排版（固定尺寸时生效）</span>
        <label class="check mt-1"><input v-model="landscape" type="checkbox" /> 横向</label>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 合成 PDF
      </button>
      <span v-if="files.length" class="small muted">共 {{ files.length }} 张图片，列表顺序即页面顺序（可用 ↑↓ 调整）</span>
    </div>

    <p class="notice notice-info mt-2 small">
      固定 A4/Letter 尺寸时，图片会按比例缩放并居中放置；「跟随图片尺寸」则每页与图片等大（加边距）。
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
</style>
