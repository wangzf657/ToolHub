<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Paperclip, Trash2, FilePlus2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 附件管理：基于 @cantoo/pdf-lib 的 attach/getAttachments/detach 高层 API。
 * - 列出文档内嵌附件（EmbeddedFiles），可逐个下载或打包 ZIP
 * - 可添加本地文件为新附件，或移除已有附件后另存副本
 */
interface AttItem {
  name: string
  data: Uint8Array
  mimeType?: string
}

const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const loading = ref(false)
const busy = ref(false)
const atts = ref<AttItem[]>([])
const adds = ref<File[]>([])
const checked = ref<Set<number>>(new Set())
const scanned = ref(false)

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const scan = async () => {
  const file = base.value?.files[0]
  if (!file) return
  loading.value = true
  scanned.value = false
  atts.value = []
  try {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    const list = doc.getAttachments()
    atts.value = list.map((a) => ({ name: a.name || '未命名', data: a.data, mimeType: a.mimeType }))
    scanned.value = true
    if (atts.value.length) toast.ok(`发现 ${atts.value.length} 个内嵌附件`)
  } catch (e) {
    toast.err((e as Error).message || '读取附件失败')
  } finally {
    loading.value = false
  }
}

const onAddFiles = (files: File[]) => {
  adds.value = files
}

const toggle = (i: number) => {
  const next = new Set(checked.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  checked.value = next
}

const saveOne = (a: AttItem) => {
  saveBlob(new Blob([a.data as BlobPart]), a.name)
}

const saveAll = () => {
  if (!atts.value.length) return
  saveMany(atts.value.map((a) => ({ name: a.name, blob: new Blob([a.data as BlobPart]) })), 'PDF附件.zip')
}

/** 重存副本：先移除勾选附件，再写入待添加文件（统一 ToolHub 元数据） */
const saveCopy = async () => {
  const file = base.value?.files[0]
  if (!file) return
  if (!checked.value.size && !adds.value.length) {
    toast.warn('请先勾选要移除的附件，或选择要添加的文件')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    let removed = 0
    for (const i of [...checked.value].sort((a, b) => b - a)) {
      const name = atts.value[i]?.name
      if (!name) continue
      try {
        doc.detach(name)
        removed++
      } catch {
        /* 单个附件移除失败不影响整体 */
      }
    }
    for (const f of adds.value) {
      await doc.attach(new Uint8Array(await f.arrayBuffer()), f.name, {
        mimeType: f.type || 'application/octet-stream',
      })
    }
    doc.setProducer('ToolHub')
    doc.setCreator('ToolHub')
    const blob = new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, '附件更新后.pdf')
    const parts: string[] = []
    if (removed) parts.push(`移除 ${removed} 个附件`)
    if (adds.value.length) parts.push(`添加 ${adds.value.length} 个附件`)
    toast.ok(`已保存副本：${parts.join('，') || '无变更'}`)
    checked.value = new Set()
    adds.value = []
    base.value?.clear()
    atts.value = []
    scanned.value = false
  } catch (e) {
    toast.err((e as Error).message || '保存失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" label="拖入要管理附件的 PDF 文件" @files="scan" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spinner" /> 正在扫描附件…</div>

    <div v-if="scanned" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="muted small"><Paperclip :size="14" style="vertical-align: -2px" /> {{ atts.length }} 个内嵌附件</span>
        <span class="grow"></span>
        <button v-if="atts.length" class="btn btn-sm" :disabled="busy" @click="saveAll"><Download :size="14" /> 全部下载（ZIP）</button>
      </div>

      <div v-if="atts.length" class="list mt-1">
        <label v-for="(a, i) in atts" :key="a.name" class="entry">
          <input type="checkbox" :checked="checked.has(i)" @change="toggle(i)" />
          <span class="name" :title="a.name">{{ a.name }}</span>
          <span class="mime">{{ a.mimeType || '未知类型' }}</span>
          <span class="size">{{ fmtSize(a.data.length) }}</span>
          <button class="mini-btn" title="下载" @click.prevent="saveOne(a)"><Download :size="14" /></button>
        </label>
      </div>
      <p v-else class="muted small mt-1">该 PDF 没有内嵌附件，可在下方添加新附件后另存。</p>

      <div class="mt-2">
        <FileDrop multiple label="选择要添加为附件的本地文件" hint="可选多个；与「移除」可同时执行，生成新副本" @files="onAddFiles" />
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="saveCopy">
          <Loader2 v-if="busy" :size="16" class="spinner" /> <FilePlus2 v-else :size="16" /> 保存副本
        </button>
        <button v-if="checked.size" class="btn btn-soft" :disabled="busy" @click="saveCopy">
          <Trash2 :size="15" /> 移除所选（{{ checked.size }}）并保存
        </button>
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
.grow {
  flex: 1;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 320px;
  overflow: auto;
}
.entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  cursor: pointer;
}
.entry:last-child {
  border-bottom: none;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mime {
  flex: none;
  font-size: 11px;
  color: var(--text-3);
}
.size {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
}
.mini-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
}
</style>
