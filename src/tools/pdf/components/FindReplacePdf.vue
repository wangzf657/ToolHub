<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { locateHits, overlayHits, type TextHit } from './pdfHits'
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
const busy = ref(false)
const hits = ref<TextHit[]>([])

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

const buildRegex = (): RegExp | null => {
  const src = find.value
  if (!src) return null
  try {
    return new RegExp(useRegex.value ? src : src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
  } catch {
    return null
  }
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
  try {
    hits.value = await locateHits(file, re)
    if (!hits.value.length) toast.warn('未找到匹配内容（扫描图片型 PDF 没有文本层）')
    else toast.ok(`共命中 ${hits.value.length} 处`)
  } catch (e) {
    toast.err((e as Error).message || '扫描失败')
  } finally {
    busy.value = false
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
    if (!list.length) list = await locateHits(file, re)
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
        <label class="check mt-1"><input v-model="useRegex" type="checkbox" /> 使用正则表达式</label>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" :disabled="busy || !base?.files.length || !find" @click="scan">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 扫描命中
      </button>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || !find" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 执行替换并下载
      </button>
      <span v-if="hits.length" class="small muted">命中 {{ hits.length }} 处</span>
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
