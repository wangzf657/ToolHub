<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs from './PageThumbs.vue'
import { deletePages, extractPages, parsePageSpec } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 删除/提取 PDF 页面（delete-pdf-pages 与 extract-pdf-pages 共用）。
 * 删除模式：页码输入双通道 + 过半警示；提取模式：勾选即序、仅看已选过滤、分段批量提取。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const mode = ref<'delete' | 'keep'>('delete')
const checked = ref<number[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const pageSpecInput = ref('')
const filterOnly = ref(false)
const segmentSpec = ref('')

const isDelete = computed(() => mode.value === 'delete')

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  checked.value = []
  pageSpecInput.value = ''
  segmentSpec.value = ''
}

/** 页码输入双通道：解析"3-12,15"并入勾选态 */
const applySpec = () => {
  const total = base.value?.pageCount ?? 0
  if (!file.value || !total) return
  const idx = parsePageSpec(pageSpecInput.value, total)
  if (!idx.length) {
    toast.warn(`页码「${pageSpecInput.value}」没有匹配到任何页（共 ${total} 页）`)
    return
  }
  const set = new Set(checked.value)
  for (const i of idx) set.add(i)
  checked.value = isDelete.value ? [...set].sort((a, b) => a - b) : [...set]
  toast.ok(`已勾选 ${idx.length} 页`)
}

/** 过半警示：删除模式勾选 >50% */
const overHalf = computed(() => {
  const total = base.value?.pageCount ?? 0
  return isDelete.value && total > 0 && checked.value.length > total / 2
})

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  // 分段批量提取：仅提取模式，"1-10;20-30" 各成一档
  if (!isDelete.value && segmentSpec.value.trim()) {
    const total = base.value?.pageCount ?? 0
    const parts = segmentSpec.value.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
    const out: { name: string; blob: Blob }[] = []
    for (const part of parts) {
      const idx = parsePageSpec(part, total || 1)
      if (!idx.length) {
        toast.warn(`分段「${part}」没有匹配到任何页（共 ${total} 页），已跳过`)
        continue
      }
      const spec = idx.map((i) => i + 1).join(',')
      out.push({ name: `提取-${part.replace(/[,，\s]+/g, '_')}.pdf`, blob: await extractPages(file.value, spec) })
    }
    if (!out.length) return
    if (out.length === 1) saveBlob(out[0]!.blob, out[0]!.name)
    else await saveMany(out, '分段提取.zip')
    toast.ok(`已按 ${out.length} 个分段各自成档导出`)
    return
  }
  if (!checked.value.length) {
    toast.warn('请先在缩略图上勾选页面')
    return
  }
  busy.value = true
  try {
    const spec = checked.value.map((i) => i + 1).join(',')
    const blob = isDelete.value ? await deletePages(file.value, spec) : await extractPages(file.value, spec)
    saveBlob(blob, isDelete.value ? '删除后.pdf' : '提取页.pdf')
    toast.ok(isDelete.value ? `已删除 ${checked.value.length} 页` : `已提取 ${checked.value.length} 页（顺序=点击顺序）`)
  } catch (e) {
    toast.err((e as Error).message || '操作失败')
  } finally {
    busy.value = false
  }
}

const runLabel = computed(() => {
  const n = checked.value.length
  if (isDelete.value) return `删除选中页${n ? `（${n} 页）` : ''}并下载`
  if (segmentSpec.value.trim()) return '按分段批量提取并下载'
  return n ? `仅保留选中页（${n} 页）并下载` : '仅保留选中页并下载'
})
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div class="row row-wrap mt-2" style="align-items: flex-end">
      <label class="check"><input v-model="mode" type="radio" value="delete" @change="filterOnly = false" /> 删除选中页</label>
      <label class="check"><input v-model="mode" type="radio" value="keep" /> 仅保留选中页</label>
      <span class="small muted">已选 {{ checked.length }} 页{{ !isDelete ? '（顺序=点击顺序，角标即序号）' : '' }}</span>
    </div>

    <div v-if="file" class="row row-wrap mt-2" style="align-items: flex-end">
      <div>
        <span class="field-label">按页码勾选（可选）</span>
        <input v-model="pageSpecInput" type="text" class="input" style="width: 180px" placeholder="如 3-12,15" />
      </div>
      <button class="btn btn-soft btn-sm" @click="applySpec">并入勾选</button>
      <label v-if="!isDelete" class="check" style="margin-left: 10px">
        <input v-model="filterOnly" type="checkbox" /> 仅看已选
      </label>
      <div v-if="!isDelete">
        <span class="field-label">分段批量提取（可选，;分隔各成一档）</span>
        <input v-model="segmentSpec" type="text" class="input" style="width: 220px" placeholder="如 1-10;20-30" />
      </div>
    </div>

    <p v-if="overHalf" class="notice notice-warn mt-2 small">
      将删除 {{ checked.length }} 页、仅保留 {{ Math.max(0, (base?.pageCount ?? 0) - checked.length) }} 页——请确认这不是误选。
    </p>

    <PageThumbs
      v-if="file"
      v-model:checked="checked"
      :file="file"
      :selectable="true"
      :movable="false"
      :rotatable="false"
      :keep-order="!isDelete"
      :filter-checked="filterOnly && !isDelete"
      class="mt-2"
    />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file || (!segmentSpec.trim() && !isDelete && !checked.length) || (isDelete && !checked.length)" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> {{ runLabel }}
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
