<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Repeat } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, reorderPages, reversePages } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页序倒转：整册 / 区间倒转（1-4 → 4,3,2,1,5…）；支持多文件批量 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const rangeSpec = ref('')
const busy = ref(false)

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先选择一个 PDF 文件（可多选批量倒转）')
    return
  }
  busy.value = true
  try {
    const out: { name: string; blob: Blob }[] = []
    for (const f of files) {
      let blob: Blob
      if (rangeSpec.value.trim() && !['all', '全部'].includes(rangeSpec.value.trim().toLowerCase())) {
        // 区间倒转：范围内页倒序、范围外保持原序（组件级 reorder 实现）
        const { PDFDocument } = await loadPdfLibSafe()
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
        const n = doc.getPageCount()
        const inRange = new Set(parsePageSpec(rangeSpec.value, n))
        const rev = [...inRange].sort((a, b) => b - a)
        const order: number[] = []
        let p = 0
        for (let i = 0; i < n; i++) {
          if (inRange.has(i)) order.push(rev[p++]!)
          else order.push(i)
        }
        blob = await reorderPages(f, order)
      } else {
        blob = await reversePages(f)
      }
      out.push({ name: `${f.name.replace(/\.pdf$/i, '')}-倒序.pdf`, blob })
    }
    if (out.length === 1) saveBlob(out[0]!.blob, out[0]!.name)
    else await saveMany(out, '批量倒转.zip')
    toast.ok(files.length > 1 ? `已批量倒转 ${out.length} 个文件` : '页序已倒转')
  } catch (e) {
    toast.err((e as Error).message || '操作失败')
  } finally {
    busy.value = false
  }
}

const loadPdfLibSafe = () => import('@/lib/pdfEngine').then((m) => m.loadPdfLib())
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入 PDF（可多选批量倒转）" />

    <div class="row row-wrap mt-2" style="align-items: flex-end">
      <div>
        <span class="field-label">倒转范围（空 = 整册倒转）</span>
        <input v-model="rangeSpec" type="text" class="input" style="width: 200px" placeholder="如 1-4" />
      </div>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Repeat v-else :size="16" /> 页序倒转并下载
      </button>
      <span class="small muted">最后一页变为第一页，适合修复倒序扫描件；多文件时 zip 内文件名与原文件一一对应</span>
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
