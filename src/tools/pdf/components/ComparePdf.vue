<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadPdfJs } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

interface PageDiff {
  page: number
  segments: { type: 'same' | 'add' | 'del'; text: string }[]
  changed: boolean
}

/** PDF 文本对比：逐页 diff（中文自动字符级），差异过滤/导航、进度、页数对齐警告 */
const toast = useToast()
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)
const busy = ref(false)
const progressLabel = ref('')
const pages = ref<PageDiff[]>([])
const stats = ref({ added: 0, removed: 0, changedPages: 0 })
const showOnlyDiff = ref(true)
const pageWarn = ref('')
const scanWarn = ref(false)
const diffRefs = new Map<number, HTMLElement>()

/** 逐页提取（带进度；引擎 pdfPageTexts 无进度参数，lib 只读，组件级口径一致） */
const extractTexts = async (file: File, onP: (done: number, total: number) => void): Promise<string[]> => {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const texts: string[] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      let last = 0
      let text = ''
      for (const item of tc.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
        if (item.str === undefined) continue
        const y = item.transform?.[5] ?? 0
        if (last !== 0 && Math.abs(y - last) > 2) text += '\n'
        text += item.str
        if (item.hasEOL) text += '\n'
        last = y
      }
      texts.push(text.trim())
      onP(i, doc.numPages)
    }
  } finally {
    doc.destroy()
  }
  return texts
}

const charVolume = (texts: string[]) => texts.join('').replace(/\s/g, '').length
const NEAR_EMPTY = 10

const onA = (l: File[]) => ((fileA.value = l[0] ?? null), (pages.value = []))
const onB = (l: File[]) => ((fileB.value = l[0] ?? null), (pages.value = []))

/** 差异导航：滚动定位到差异页卡片 */
const gotoDiff = (page: number) => {
  const el = diffRefs.get(page)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const changedPagesList = computed(() => pages.value.filter((p) => p.changed).map((p) => ({ page: p.page, added: p.segments.filter((s) => s.type === 'add').length, removed: p.segments.filter((s) => s.type === 'del').length })))

const run = async () => {
  if (!fileA.value || !fileB.value) {
    toast.warn('请分别选择「原版」和「新版」两个 PDF')
    return
  }
  busy.value = true
  pages.value = []
  pageWarn.value = ''
  scanWarn.value = false
  try {
    const textsA = await extractTexts(fileA.value, (d, t) => (progressLabel.value = `正在提取原版第 ${d} / ${t} 页`))
    const textsB = await extractTexts(fileB.value, (d, t) => (progressLabel.value = `正在提取新版第 ${d} / ${t} 页`))
    progressLabel.value = ''
    // 页数对齐警告
    if (textsA.length !== textsB.length) {
      pageWarn.value = `页数不一致（原版 ${textsA.length} 页，新版 ${textsB.length} 页），第 ${Math.min(textsA.length, textsB.length) + 1} 页起按新增/删除处理`
    }
    // 文本层护栏：任一侧近空 → 警告（扫描件无文本层）
    const volA = charVolume(textsA)
    const volB = charVolume(textsB)
    if (volA < NEAR_EMPTY || volB < NEAR_EMPTY) {
      scanWarn.value = true
      toast.warn('该文件可能为扫描件（无文本层），文本对比结果不可靠')
    }
    // 中文占比 >30% 时改用字符级 diff（避免整段误标）
    const total = Math.max(textsA.length, textsB.length)
    const cjkRatio =
      (textsA.join('') + textsB.join('')).match(/[\u2e80-\u9fff]/g)?.length ?? 0
    const cjkMajority = volA + volB > 0 && cjkRatio / Math.max(1, volA + volB) > 0.3
    const { diffWordsWithSpace, diffChars } = await import('diff')
    const diffFn = cjkMajority ? diffChars : diffWordsWithSpace
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
        segs.push({ type: 'add', text: b ?? '' })
        added += (b ?? '').length
        changed = true
      } else if (b === undefined) {
        segs.push({ type: 'del', text: a })
        removed += a.length
        changed = true
      } else {
        for (const p of diffFn(a, b)) {
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
    if (!changedPages && !scanWarn.value) toast.ok('两个文件的文本完全一致')
    else if (changedPages) toast.ok(`对比完成：${changedPages} 页有差异`)
  } catch (e) {
    toast.err((e as Error).message || '对比失败：请确认两个 PDF 都有文本层')
  } finally {
    busy.value = false
    progressLabel.value = ''
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

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始对比
      </button>
      <label class="check"><input v-model="showOnlyDiff" type="checkbox" /> 仅显示有差异的页</label>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else-if="pages.length" class="small muted">
        {{ stats.changedPages }} 页有差异 · 新增 {{ stats.added }} 字 / 删除 {{ stats.removed }} 字
      </span>
    </div>

    <p v-if="pageWarn" class="notice notice-warn mt-2 small">{{ pageWarn }}</p>
    <div v-if="scanWarn" class="notice notice-warn mt-2 small">
      该文件可能为扫描件（无文本层），文本对比结果不可靠——扫描件请用视觉比对工具核对。
    </div>

    <div v-if="pages.length && changedPagesList.length" class="diff-nav mt-2">
      <span class="small muted">差异页导航：</span>
      <button v-for="c in changedPagesList" :key="c.page" class="chip" @click="gotoDiff(c.page)">
        第 {{ c.page }} 页（+{{ c.added }} / −{{ c.removed }}）
      </button>
    </div>

    <div v-if="pages.length" class="diff-list mt-2">
      <div
        v-for="p in pages"
        :key="p.page"
        v-show="!showOnlyDiff || p.changed"
        :ref="(el) => { if (el) diffRefs.set(p.page, el as HTMLElement) }"
        class="diff-page"
      >
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
.diff-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.chip {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--accent);
  color: var(--text);
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
