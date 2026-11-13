<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Eraser, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 注释清除：注释清单预览（按类型统计）→ 类型筛选（保留链接/图章）→ 执行并自动下载 → Widget/空结果守卫。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const keepLinks = ref(true)
const keepStamps = ref(false)
const busy = ref(false)
const progress = ref(0)
const removedCount = ref(0)
const keptLinks = ref(0)
const keptStamps = ref(0)
const widgetCount = ref(0)
const pageCount = ref(0)
const outBlob = ref<Blob | null>(null)
/** 执行前注释清单：第 N 页 → { 类型: 数量 } */
const inventory = ref<{ page: number; items: Record<string, number>; total: number }[]>([])
const totalAnnots = computed(() => inventory.value.reduce((a, b) => a + b.total, 0))

const SUB_LABEL: Record<string, string> = {
  '/Link': '链接',
  '/Highlight': '高亮',
  '/Text': '便签',
  '/Underline': '下划线',
  '/Squiggly': '波浪线',
  '/StrikeOut': '删除线',
  '/Stamp': '图章',
  '/FreeText': '文字框',
  '/Square': '矩形',
  '/Ink': '墨迹',
  '/FileAttachment': '文件附注',
  '/Widget': '表单字段',
}

const labelOf = (sub: string) => SUB_LABEL[sub] ?? sub.replace('/', '')

/** 载入即扫描注释清单（只读，不改动） */
const scanInventory = async () => {
  const file = base.value?.files[0]
  inventory.value = []
  widgetCount.value = 0
  if (!file) return
  try {
    const { PDFDocument, PDFName, PDFDict } = await loadPdfLib()
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    const pages = doc.getPages()
    pageCount.value = pages.length
    for (let i = 0; i < pages.length; i++) {
      const annots = pages[i].node.Annots()
      if (!annots) continue
      const items: Record<string, number> = {}
      const total = annots.size()
      for (let k = 0; k < total; k++) {
        const d = annots.lookupMaybe(k, PDFDict)
        const sub = d?.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString() || '/未知'
        items[labelOf(sub)] = (items[labelOf(sub)] ?? 0) + 1
        if (sub === '/Widget') widgetCount.value++
      }
      if (total) inventory.value.push({ page: i + 1, items, total })
    }
    if (widgetCount.value) {
      toast.toast('检测到表单字段（Widget）：清除注释会移除其可交互外观，建议改用「PDF 扁平化」；仍可继续', 'warn', 5000)
    }
  } catch {
    /* 清单扫描失败不阻塞主流程 */
  }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  removedCount.value = 0
  keptLinks.value = 0
  keptStamps.value = 0
  outBlob.value = null
  try {
    const { PDFDocument, PDFName, PDFDict } = await loadPdfLib()
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    const pages = doc.getPages()
    pageCount.value = pages.length
    let removed = 0
    let keptL = 0
    let keptS = 0
    for (let i = 0; i < pages.length; i++) {
      const annots = pages[i].node.Annots()
      if (annots) {
        const total = annots.size()
        const subOf = (k: number) => annots.lookupMaybe(k, PDFDict)?.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString() || ''
        let pageKeep = 0
        for (let k = 0; k < total; k++) {
          const sub = subOf(k)
          if (keepLinks.value && sub === '/Link') pageKeep++
          else if (keepStamps.value && (sub === '/Stamp' || sub === '/RubberStamp')) pageKeep++
        }
        if (pageKeep > 0) {
          for (let k = total - 1; k >= 0; k--) {
            const sub = subOf(k)
            if (keepLinks.value && sub === '/Link') {
              keptL++
              continue
            }
            if (keepStamps.value && (sub === '/Stamp' || sub === '/RubberStamp')) {
              keptS++
              continue
            }
            annots.remove(k)
            removed++
          }
        } else {
          if (pages[i].node.delete(PDFName.of('Annots'))) removed += total
        }
      }
      progress.value = (i + 1) / pages.length
    }
    removedCount.value = removed
    keptLinks.value = keptL
    keptStamps.value = keptS
    // 空结果短路：无注释可清则不生成下载
    if (!removed && !keptL && !keptS) {
      toast.warn('该 PDF 没有可清除的注释')
      return
    }
    doc.setProducer('ToolHub')
    doc.setCreator('ToolHub')
    outBlob.value = new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(outBlob.value, '已清除注释.pdf')
    toast.ok(`已清除 ${removed} 个注释${keptL ? `，保留 ${keptL} 个链接` : ''}${keptS ? `，保留 ${keptS} 个图章` : ''}（已自动下载）`)
  } catch (e) {
    toast.err((e as Error).message || '清除失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (outBlob.value) saveBlob(outBlob.value, '已清除注释.pdf')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="scanInventory" />

    <div v-if="inventory.length" class="inv mt-2">
      <p class="field-label mb-1">注释清单（执行前统计）</p>
      <div v-for="g in inventory" :key="g.page" class="row-item small">
        <b>第 {{ g.page }} 页：</b>
        <span v-for="(c, k) in g.items" :key="k" class="inv-item">{{ k }} ×{{ c }}</span>
        <span class="muted">共 {{ g.total }} 处</span>
      </div>
    </div>
    <p v-else-if="pageCount && base?.files.length" class="muted small mt-1">扫描完成：未发现任何注释。</p>

    <div class="row row-wrap mt-2">
      <label class="row" style="gap: 8px; cursor: pointer">
        <input v-model="keepLinks" type="checkbox" />
        <span class="small">保留链接类注释（Subtype /Link）</span>
      </label>
      <label class="row" style="gap: 8px; cursor: pointer">
        <input v-model="keepStamps" type="checkbox" />
        <span class="small">保留图章/印章（Stamp）</span>
      </label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Eraser v-else :size="16" /> 清除注释并下载
      </button>
      <button v-if="outBlob" class="btn btn-soft" @click="download"><Download :size="15" /> 重新下载</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="removedCount || keptLinks || keptStamps" class="stats mt-2">
      <div class="stat"><span class="k">扫描页数</span><span class="v">{{ pageCount }}</span></div>
      <div class="stat"><span class="k">已删除注释</span><span class="v accent">{{ removedCount }}</span></div>
      <div v-if="keptLinks" class="stat"><span class="k">保留链接</span><span class="v">{{ keptLinks }}</span></div>
      <div v-if="keptStamps" class="stat"><span class="k">保留图章</span><span class="v">{{ keptStamps }}</span></div>
    </div>

    <p class="notice notice-warn mt-2 small">
      会一并移除批注、高亮、下划线、印章等注释（可按上方开关筛选保留）；含表单字段的 PDF 建议改用「PDF 扁平化」。操作生成新副本，原文件不受影响。
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
.inv {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  display: grid;
  gap: 4px;
}
.inv-item {
  display: inline-block;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11.5px;
  margin-right: 6px;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 17px;
  font-weight: 700;
}
.v.accent {
  color: var(--accent-text);
}
.row-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
