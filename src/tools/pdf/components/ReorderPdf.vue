<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { reorderPages } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 调整 PDF 页序：拖动或上下移按钮重排页面 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const order = ref<PageEntry[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  order.value = []
  moveSpec.value = ''
}

/** 重置顺序：恢复 1..N 原始顺序（防呆拦截随之解除） */
const resetOrder = () => {
  const n = order.value.length
  if (!n) return
  const idx = order.value.map((e) => e.index).sort((a, b) => a - b)
  order.value = idx.map((index) => ({ index, rotation: 0 }))
  toast.ok('已重置为原始顺序')
}

/** 页码直达：支持「3→15」式移动（原第 3 页移到第 15 位） */
const moveSpec = ref('')
const applyMove = () => {
  const m = moveSpec.value.trim().match(/^(\d+)\s*[→>]\s*(\d+)$/)
  if (!m) {
    toast.warn('格式：3→15（把原第 3 页移到第 15 位）')
    return
  }
  const from = parseInt(m[1]!) - 1
  const to = parseInt(m[2]!) - 1
  const n = order.value.length
  if (from < 0 || from >= n || to < 0 || to >= n) {
    toast.warn(`页码超出范围（共 ${n} 页）`)
    return
  }
  const arr = [...order.value]
  const [it] = arr.splice(from, 1)
  arr.splice(to, 0, it!)
  order.value = arr
  toast.ok(`已把原第 ${from + 1} 页移到第 ${to + 1} 位`)
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const idx = order.value.map((e) => e.index)
  if (idx.length && idx.every((v, i) => v === i)) {
    toast.warn('当前顺序与原文件相同，请先调整页面顺序')
    return
  }
  busy.value = true
  try {
    const blob = await reorderPages(file.value, idx)
    saveBlob(blob, '重排后.pdf')
    toast.ok('页面顺序已重排')
  } catch (e) {
    toast.err((e as Error).message || '重排失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="file" class="small muted mt-1">
      拖动缩略图（或使用 ↑↓ 按钮）调整顺序，缩略图左上角为原始页码。
      <button class="btn btn-ghost btn-sm" style="margin-left: 8px" @click="resetOrder">重置顺序</button>
    </p>

    <div v-if="file" class="row row-wrap mt-2" style="align-items: flex-end">
      <div>
        <span class="field-label">页码直达（可选）</span>
        <input v-model="moveSpec" type="text" class="input" style="width: 160px" placeholder="如 3→15" />
      </div>
      <button class="btn btn-soft btn-sm" @click="applyMove">执行移动</button>
    </div>

    <PageThumbs v-if="file" v-model:order="order" :file="file" :movable="true" :rotatable="false" :removable="false" class="mt-2" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 按新顺序重建并下载
      </button>
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
</style>
