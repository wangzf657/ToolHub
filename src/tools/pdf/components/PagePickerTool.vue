<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs from './PageThumbs.vue'
import { deletePages, extractPages } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 删除/提取 PDF 页面（delete-pdf-pages 与 extract-pdf-pages 共用） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const mode = ref<'delete' | 'keep'>('delete')
const checked = ref<number[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  checked.value = []
}

const label = computed(() => (mode.value === 'delete' ? '删除选中页' : '仅保留选中页'))

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!checked.value.length) {
    toast.warn('请先在缩略图上勾选页面')
    return
  }
  busy.value = true
  try {
    const spec = checked.value.map((i) => i + 1).join(',')
    const blob = mode.value === 'delete' ? await deletePages(file.value, spec) : await extractPages(file.value, spec)
    saveBlob(blob, mode.value === 'delete' ? '删除后.pdf' : '提取页.pdf')
    toast.ok(mode.value === 'delete' ? `已删除 ${checked.value.length} 页` : `已提取 ${checked.value.length} 页`)
  } catch (e) {
    toast.err((e as Error).message || '操作失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="mode" type="radio" value="delete" /> 删除选中页</label>
      <label class="check"><input v-model="mode" type="radio" value="keep" /> 仅保留选中页</label>
      <span class="small muted">已选 {{ checked.length }} 页</span>
    </div>

    <PageThumbs v-if="file" v-model:checked="checked" :file="file" :selectable="true" :movable="false" :rotatable="false" class="mt-2" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !checked.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> {{ label }}并下载
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
