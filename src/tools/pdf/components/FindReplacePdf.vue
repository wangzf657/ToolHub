<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { locateHits, overlayHits, type TextHit } from './pdfHits'
import { parsePageSpec, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 查找替换（降级说明见页面提示）：
 * 用 pdf.js 文本项坐标估算每个命中位置 → 白条覆盖原词 + 写入替换词（loadPdfLib 直写）。
 * 坐标为文本项内字符占比估算，复杂排版可能偏移；中文替换词自动贴图。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const find = ref('')
const replace = ref('')
const useRegex = ref(false)
const ignoreCase = ref(false)
const rangeSpec = ref('')
const busy = ref(false)
const scanLabel = ref('')
const hits = ref<TextHit[]>([])
const overflowWarn = ref('')

/** 按页聚合命中 */
const byPage = () => {
  const m = new Map<number, TextHit[]>()
  for (const h of hits.value) {
    const list = m.get(h.page) ?? []
    list.push(h)
    m.set(h.page, list)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([page, list]) => ({ page: page + 1, list }))
}

/** 估算显示宽度（CJK 记 1、西文记 0.55），用于替换词溢出预判 */
const dispWidth = (s: string) => [...s].reduce((a, ch) => a + (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.55), 0)

const buildRegex = (): RegExp | null => {
  const src = find.value
  if (!src) return null
  try {
    const body = useRegex.value ? src : src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(body, ignoreCase.value ? 'gi' : 'g')
  } catch {
    return null
  }
}

/** 溢出预判：替换词显示宽度 > 命中文本 1.2 倍时列出涉及页码 */
const checkOverflow = (list: TextHit[]) => {
  if (!replace.value.trim()) return ''
  const wide = list.filter((h) => dispWidth(replace.value) > dispWidth(h.text) * 1.2)
  if (!wide.length) return ''
  const pages = [...new Set(wide.map((h) => h.page + 1))].join('、')
  return `${wide.length} 处替换词超宽（超过原词 1.2 倍），可能压盖相邻内容——涉及第 ${pages} 页`
}

const applyRange = (list: TextHit[]): TextHit[] => {
  if (!rangeSpec.value.trim()) return list
  const total = base.value?.pageCount ?? 0
  const keep = new Set(parsePageSpec(rangeSpec.value, total || 1))
  return list.filter((h) => keep.has(h.page))
}

const scan = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const re = buildRegex()
  if (!re) {
    toast.err('查找内容无效：正则表达式语法错误')
    return
  }
  busy.value = true
  hits.value = []
  overflowWarn.value = ''
  try {
    const raw = await locateHits(file, re, (p, t) => (scanLabel.value = `正在扫描第 ${Math.round(p * t)} / ${t} 页`))
    hits.value = applyRange(raw)
    if (!raw.length) toast.warn('未找到匹配内容（扫描图片型 PDF 没有文本层）')
    else if (!hits.value.length) toast.warn('命中均在页范围之外，已全部过滤')
    else {
      toast.ok(`共命中 ${raw.length} 处${rangeSpec.value.trim() ? `，范围内 ${hits.value.length} 处` : ''}`)
      overflowWarn.value = checkOverflow(hits.value)
    }
  } catch (e) {
    toast.err((e as Error).message || '扫描失败')
  } finally {
    busy.value = false
    scanLabel.value = ''
  }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const re = buildRegex()
  if (!re) {
    toast.err('查找内容无效：正则表达式语法错误')
    return
  }
  busy.value = true
  try {
    let list = hits.value
    if (!list.length) {
      const raw = await locateHits(file, re, (p, t) => (scanLabel.value = `正在扫描第 ${Math.round(p * t)} / ${t} 页`))
      list = applyRange(raw)
    }
    if (!list.length) {
      toast.warn('未找到匹配内容，未生成文件')
      return
    }
    const blob = await overlayHits(file, list, {
      color: [1, 1, 1],
      replacement: replace.value,
      replaceColor: [0.12, 0.12, 0.14],
    })
    saveBlob(blob, '替换后.pdf')
    toast.ok(`已在 ${list.length} 处完成覆盖替换`)
  } catch (e) {
    toast.err((e as Error).message || '替换失败')
  } finally {
    busy.value = false
    scanLabel.value = ''
  }
}

/* ---------- 替换预演：渲染首个命中页，叠加白条+替换词示意 ---------- */
const previewUrl = ref('')
const previewHits = ref<TextHit[]>([])
const doPreview = async () => {
  const file = base.value?.files[0]
  if (!file || !hits.value.length) return
  try {
    const firstPage = hits.value[0]!.page
    const canvas = await renderPageToCanvas(file, firstPage, 1.2)
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    previewHits.value = hits.value.filter((h) => h.page === firstPage).slice(0, 8)
  } catch {
    toast.err('预演渲染失败')
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (hits = [])" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">查找内容</span>
        <input v-model="find" class="input" :placeholder="useRegex ? '正则，如 价格\\d+' : '要查找的词'" />
      </div>
      <div>
        <span class="field-label">替换为（留空 = 只涂抹）</span>
        <input v-model="replace" class="input" placeholder="新词" />
      </div>
      <div>
        <span class="field-label">匹配方式</span>
        <label class="check"><input v-model="useRegex" type="checkbox" /> 使用正则表达式</label>
        <label class="check"><input v-model="ignoreCase" type="checkbox" /> 忽略大小写</label>
      </div>
      <div>
        <span class="field-label">应用页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 2-3" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" :disabled="busy || !base?.files.length || !find" @click="scan">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 扫描命中
      </button>
      <button v-if="hits.length" class="btn btn-soft" :disabled="busy" @click="doPreview">替换预演（首个命中页）</button>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || !find" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 执行替换并下载
      </button>
      <span v-if="scanLabel" class="small muted">{{ scanLabel }}</span>
      <span v-else-if="hits.length" class="small muted">命中 {{ hits.length }} 处</span>
    </div>

    <p v-if="overflowWarn" class="notice notice-warn mt-2 small">{{ overflowWarn }}</p>

    <div v-if="previewUrl" class="mt-2 preview-card">
      <img :src="previewUrl" alt="替换预演" class="preview-img" />
      <div
        v-for="(h, i) in previewHits"
        :key="i"
        class="pv-box"
        :style="{ left: h.x * 100 + '%', top: h.y * 100 + '%', width: h.w * 100 + '%', height: h.h * 100 + '%' }"
      >
        <span class="pv-word">{{ replace || '（涂抹）' }}</span>
      </div>
      <p class="small muted mt-1">首个命中页预演：白条覆盖原词并写入替换词，落位/是否压线以此为准</p>
    </div>

    <div v-if="hits.length" class="report mt-2">
      <p class="field-label mb-2">命中报告（按页）</p>
      <div v-for="g in byPage()" :key="g.page" class="row-item">
        <b>第 {{ g.page }} 页</b>
        <span class="small muted">{{ g.list.length }} 处 ·</span>
        <code v-for="(h, i) in g.list.slice(0, 6)" :key="i" class="chip">{{ h.text }}</code>
        <span v-if="g.list.length > 6" class="small muted">等</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      实现说明（诚实标注）：PDF 的文字与位置并非逐字存储，本工具按文本项内「字符占比」估算每个命中的坐标，用白条覆盖原词并写入替换词。规则排版（合同、表格）效果好；艺术字、跨行词、重叠排版可能覆盖不全。替换词支持中文（自动贴图嵌入）。需要「真正改写字符流」的替换属于 PDF 重排级操作，浏览器端暂不支持。
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
.report {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
}
.preview-card {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
}
.preview-img {
  max-width: 100%;
  max-height: 60vh;
  display: block;
  border-radius: 6px;
  background: #fff;
}
.pv-box {
  position: absolute;
  background: rgba(255, 255, 255, 0.92);
  border: 1px dashed var(--accent);
  display: flex;
  align-items: center;
  overflow: hidden;
}
.pv-word {
  font-size: 10px;
  color: #1f2430;
  padding-left: 2px;
  white-space: nowrap;
}
.row-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}
.chip {
  font-size: 11.5px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
}
</style>
