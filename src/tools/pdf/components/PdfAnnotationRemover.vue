<script setup lang="ts">
import { ref } from 'vue'
import { Download, Eraser, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 注释清除：遍历每页 /Annots 数组删除注释对象，可选保留链接类注释（Subtype /Link）。
 * 全部保留链接时整键删除 Annots 数组；有保留项时逐个从数组移除。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const keepLinks = ref(true)
const busy = ref(false)
const progress = ref(0)
const removedCount = ref(0)
const keptLinks = ref(0)
const pageCount = ref(0)
const outBlob = ref<Blob | null>(null)

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
  outBlob.value = null
  try {
    const { PDFDocument, PDFName, PDFDict } = await loadPdfLib()
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    const pages = doc.getPages()
    pageCount.value = pages.length
    let removed = 0
    let kept = 0
    for (let i = 0; i < pages.length; i++) {
      const annots = pages[i].node.Annots()
      if (annots) {
        const total = annots.size()
        // 先统计本页链接类注释数量
        let pageLinks = 0
        if (keepLinks.value) {
          for (let k = 0; k < total; k++) {
            const d = annots.lookupMaybe(k, PDFDict)
            const sub = d?.lookupMaybe(PDFName.of('Subtype'), PDFName)
            if (sub?.asString() === '/Link') pageLinks++
          }
        }
        if (keepLinks.value && pageLinks > 0) {
          // 本页有链接要保留：倒序逐个移除非链接注释
          for (let k = total - 1; k >= 0; k--) {
            const d = annots.lookupMaybe(k, PDFDict)
            const sub = d?.lookupMaybe(PDFName.of('Subtype'), PDFName)
            if (sub?.asString() === '/Link') continue
            annots.remove(k)
            removed++
          }
          kept += pageLinks
        } else {
          // 本页无链接需保留（或未勾选保留）：整键删除
          if (pages[i].node.delete(PDFName.of('Annots'))) removed += total
        }
      }
      progress.value = (i + 1) / pages.length
    }
    removedCount.value = removed
    keptLinks.value = kept
    if (!removed && !(kept > 0)) toast.warn('该 PDF 没有可清除的注释')
    doc.setProducer('ToolHub')
    doc.setCreator('ToolHub')
    outBlob.value = new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    if (removed) toast.ok(`已清除 ${removed} 个注释${kept ? `，保留 ${kept} 个链接` : ''}`)
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
    <PdfToolBase ref="base" @files="() => ((removedCount = 0), (outBlob = null))" />

    <label class="row mt-2" style="gap: 8px; cursor: pointer">
      <input v-model="keepLinks" type="checkbox" />
      <span class="small">保留链接类注释（Subtype /Link，点击可跳转的那种）</span>
    </label>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Eraser v-else :size="16" /> 清除注释并下载
      </button>
      <button v-if="outBlob" class="btn btn-soft" @click="download"><Download :size="15" /> 重新下载</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="removedCount || keptLinks" class="stats mt-2">
      <div class="stat"><span class="k">扫描页数</span><span class="v">{{ pageCount }}</span></div>
      <div class="stat"><span class="k">已删除注释</span><span class="v accent">{{ removedCount }}</span></div>
      <div v-if="keptLinks" class="stat"><span class="k">保留链接</span><span class="v">{{ keptLinks }}</span></div>
    </div>

    <p class="notice notice-warn mt-2 small">
      会一并移除批注、高亮、下划线、印章等全部注释类型；勾选「保留链接」后目录跳转与网页外链不受影响。
      操作生成新副本，原文件不受影响。
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
</style>
