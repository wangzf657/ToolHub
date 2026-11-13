<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { pdfInfo } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

/**
 * PDF 工具通用基座：文件载入 + 页数查询 + 错误提示 + 加载态。
 * 通过默认插槽把 files / pageCount 暴露给具体工具。
 * - 重复文件拦截：同名同大小的文件再次加入时提示并忽略（对全部工具生效）。
 * - richList 模式：隐藏 FileDrop 内置列表，改用带「页数 · 体积」的增强列表与汇总行。
 */
const props = withDefaults(
  defineProps<{
    /** 是否允许多文件 */
    multiple?: boolean
    label?: string
    hint?: string
    /** 增强文件列表：每行显示页数与体积，底部汇总行 */
    richList?: boolean
  }>(),
  { multiple: false, label: '拖入 PDF 文件，或点击选择', hint: '在你的设备上处理 —— 从不上传', richList: false },
)

const emit = defineEmits<{ files: [files: File[]] }>()

const dropRef = ref<InstanceType<typeof FileDrop> | null>(null)
const files = ref<File[]>([])
const loading = ref(false)
const pageCount = ref(0)
/** richList：每个文件的页数（按索引对齐），-1 表示尚未解析 */
const pagesPer = ref<number[]>([])
const toast = useToast()

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

/* ---------- 重复文件拦截（同名同大小视为同一文件） ---------- */
const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size

/* ---------- 同步内部文件列表（richList 的移动/移除要写回 FileDrop） ---------- */
const syncList = (arr: File[]) => {
  files.value = arr
  if (dropRef.value) dropRef.value.files = [...arr]
  emit('files', arr)
}

const moveAt = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= files.value.length) return
  const arr = [...files.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  syncList(arr)
}

const removeAt = (i: number) => {
  const arr = [...files.value]
  arr.splice(i, 1)
  syncList(arr)
}

const onFiles = async (list: File[]) => {
  // 重复拦截：与已加入的文件、以及本批内部重复都忽略
  const keep: File[] = []
  let dup = 0
  for (const f of list) {
    if (files.value.some((o) => sameFile(o, f)) || keep.some((o) => sameFile(o, f))) {
      dup++
      continue
    }
    keep.push(f)
  }
  if (dup > 0) toast.warn(`已忽略 ${dup} 个重复文件（该文件已在列表中）`)
  const target = dup > 0 ? keep : list
  files.value = target
  if (dup > 0 && dropRef.value) dropRef.value.files = [...target]
  emit('files', target)
  pageCount.value = 0
  if (target.length === 1) {
    loading.value = true
    try {
      pageCount.value = (await pdfInfo(target[0])).pages
    } catch (e) {
      toast.err((e as Error).message || '无法读取该 PDF，请确认文件有效且未损坏')
    } finally {
      loading.value = false
    }
  }
}

/* ---------- richList：逐文件页数（懒解析，失败按 0 处理） ---------- */
watch(
  () => files.value.map((f) => `${f.name}:${f.size}`).join('|'),
  async () => {
    if (!props.richList) return
    pagesPer.value = files.value.map(() => -1)
    const list = files.value
    for (let i = 0; i < list.length; i++) {
      try {
        const info = await pdfInfo(list[i])
        // 列表可能已变化，只有仍对得上才写入
        if (list[i] === files.value[i]) pagesPer.value[i] = info.pages
      } catch {
        if (list[i] === files.value[i]) pagesPer.value[i] = 0
      }
    }
  },
  { immediate: true },
)

const totalPages = () => pagesPer.value.reduce((a, b) => a + Math.max(0, b), 0)

/** 清空（同时清掉内部 FileDrop 的列表） */
const clear = () => {
  files.value = []
  pageCount.value = 0
  pagesPer.value = []
  dropRef.value?.clear()
  emit('files', [])
}

/** 读取文件的 Uint8Array（供引擎使用） */
const readBytes = async (f: File | Blob) => new Uint8Array(await f.arrayBuffer())

defineExpose({ files, clear, readBytes, pageCount, loading })
</script>

<template>
  <div :class="{ 'rich-mode': props.richList }">
    <FileDrop
      ref="dropRef"
      accept="application/pdf,.pdf"
      :multiple="props.multiple"
      :label="props.label"
      :hint="props.hint"
      @files="onFiles"
    />
    <div v-if="loading" class="row mt-1 small muted">
      <Loader2 :size="14" class="spin" /> 正在读取文档信息…
    </div>
    <p v-else-if="!props.richList && files.length === 1 && pageCount" class="mt-1 small muted">
      已载入 <b>{{ pageCount }}</b> 页 · {{ fmtSize(files[0].size) }}
    </p>

    <!-- 增强列表：每行页数+体积，底部汇总行（顺序即处理顺序，可 ↑↓ 调整） -->
    <div v-if="props.richList && files.length" class="rich-list mt-2">
      <div v-for="(f, i) in files" :key="`${f.name}-${i}`" class="rich-row">
        <span class="file-idx">{{ i + 1 }}</span>
        <span class="file-name" :title="f.name">{{ f.name }}</span>
        <span class="small muted">
          <template v-if="pagesPer[i] < 0">读取中…</template>
          <template v-else>{{ pagesPer[i] }} 页 · {{ fmtSize(f.size) }}</template>
        </span>
        <span class="row gap4">
          <button v-if="props.multiple && files.length > 1" class="mini-btn" title="上移" aria-label="上移" @click="moveAt(i, -1)">↑</button>
          <button v-if="props.multiple && files.length > 1" class="mini-btn" title="下移" aria-label="下移" @click="moveAt(i, 1)">↓</button>
          <button class="mini-btn danger" title="移除" aria-label="移除" @click="removeAt(i)">✕</button>
        </span>
      </div>
      <p v-if="files.length >= 2" class="small muted summary-row">
        共 {{ files.length }} 个文件 · {{ totalPages() }} 页 · {{ fmtSize(files.reduce((a, f) => a + f.size, 0)) }}
      </p>
    </div>
    <slot :files="files" :page-count="pageCount" />
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* richList 模式下隐藏 FileDrop 内置列表，用增强列表替代 */
.rich-mode :deep(.file-list) {
  display: none;
}
.rich-list {
  display: grid;
  gap: 6px;
}
.rich-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13px;
}
.file-idx {
  flex: none;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gap4 {
  gap: 4px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 12px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
.summary-row {
  padding: 4px 10px;
}
</style>
