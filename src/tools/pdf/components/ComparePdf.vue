<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

interface PageDiff {
  page: number
  segments: { type: 'same' | 'add' | 'del'; text: string }[]
  changed: boolean
}

/** PDF 文本对比：逐页 diff，新增绿 / 删除红 */
const toast = useToast()
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)
const busy = ref(false)
const pages = ref<PageDiff[]>([])
const stats = ref({ added: 0, removed: 0, changedPages: 0 })

const onA = (l: File[]) => (fileA.value = l[0] ?? null)
const onB = (l: File[]) => (fileB.value = l[0] ?? null)

const run = async () => {
  if (!fileA.value || !fileB.value) {
    toast.warn('请分别选择「原版」和「新版」两个 PDF')
    return
  }
  busy.value = true
  pages.value = []
  try {
    const [textsA, textsB] = await Promise.all([pdfPageTexts(fileA.value), pdfPageTexts(fileB.value)])
    const { diffWordsWithSpace } = await import('diff')
    const total = Math.max(textsA.length, textsB.length)
    let added = 0
    let removed = 0
    let changedPages = 0
    const out: PageDiff[] = []
    for (let i = 0; i < total; i++) {
      const a = textsA[i]
      const b = textsB[i]
      const segs: PageDiff['segments'] = []
      let changed = false
      if (a === undefined) {
        segs.push({ type: 'add', text: b })
        added += b.length
        changed = true
      } else if (b === undefined) {
        segs.push({ type: 'del', text: a })
        removed += a.length
        changed = true
      } else {
        const parts = diffWordsWithSpace(a, b)
        for (const p of parts) {
          const v = p.value ?? ''
          if (p.added) {
            segs.push({ type: 'add', text: v })
            added += v.length
            changed = true
          } else if (p.removed) {
            segs.push({ type: 'del', text: v })
            removed += v.length
            changed = true
          } else {
            segs.push({ type: 'same', text: v })
          }
        }
      }
      if (changed) changedPages++
      out.push({ page: i + 1, segments: segs, changed })
    }
    pages.value = out
    stats.value = { added, removed, changedPages }
    if (!changedPages) toast.ok('两个文件的文本完全一致')
  } catch (e) {
    toast.err((e as Error).message || '对比失败：请确认两个 PDF 都有文本层')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <p class="field-label mb-2">原版 PDF</p>
        <FileDrop accept="application/pdf,.pdf" :multiple="false" label="拖入原版 PDF" hint="旧版本" @files="onA" />
      </div>
      <div>
        <p class="field-label mb-2">新版 PDF</p>
        <FileDrop accept="application/pdf,.pdf" :multiple="false" label="拖入新版 PDF" hint="新版本" @files="onB" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始对比
      </button>
      <span v-if="pages.length" class="small muted">
        {{ stats.changedPages }} 页有差异 · 新增 {{ stats.added }} 字 / 删除 {{ stats.removed }} 字
      </span>
    </div>

    <div v-if="pages.length" class="diff-list mt-2">
      <div v-for="p in pages" :key="p.page" class="diff-page">
        <p class="small muted mb-2">
          第 {{ p.page }} 页
          <span v-if="!p.changed" class="badge">无差异</span>
        </p>
        <div class="diff-body mono">
          <template v-for="(s, i) in p.segments" :key="i">
            <ins v-if="s.type === 'add'">{{ s.text }}</ins>
            <del v-else-if="s.type === 'del'">{{ s.text }}</del>
            <template v-else>{{ s.text }}</template>
          </template>
        </div>
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
.diff-list {
  display: grid;
  gap: 12px;
}
.diff-page {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}
.diff-body {
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12.5px;
  line-height: 1.7;
}
ins {
  background: rgba(52, 211, 153, 0.18);
  color: #0b8a5f;
  text-decoration: none;
  border-radius: 3px;
  padding: 0 1px;
}
del {
  background: rgba(239, 68, 68, 0.15);
  color: #c53030;
  border-radius: 3px;
  padding: 0 1px;
}
</style>
