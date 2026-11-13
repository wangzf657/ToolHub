<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ClipboardCopy, ListTree, FileDown } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const html = ref(`<h1>Vue 3 组合式 API 指南</h1>
<h2>什么是组合式 API</h2>
<h3>与选项式 API 的对比</h3>
<h4>代码组织</h4>
<h2>核心函数</h2>
<h4>ref 与 reactive</h4>
<p>正文段落…</p>
<h2>最佳实践</h2>
<h3></h3>`)

interface Heading {
  level: number
  text: string
}

const headings = ref<Heading[]>([])
const parsed = ref(false)

const parse = (silent = false) => {
  const src = html.value.trim()
  if (!src) {
    if (!silent) toast.warn('请先粘贴 HTML 内容')
    headings.value = []
    parsed.value = false
    return
  }
  try {
    const doc = new DOMParser().parseFromString(src, 'text/html')
    const nodes = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
    headings.value = Array.from(nodes).map((n) => ({
      level: Number(n.tagName.slice(1)),
      text: (n.textContent ?? '').trim(),
    }))
    parsed.value = true
    if (!headings.value.length && !silent) toast.warn('未找到任何 H1–H6 标题')
  } catch {
    if (!silent) toast.err('HTML 解析失败')
  }
}

// rx2 自动解析：输入 200ms 防抖后静默解析（保留手动按钮）
let timer: ReturnType<typeof setTimeout> | undefined
watch(html, () => {
  clearTimeout(timer)
  timer = setTimeout(() => parse(true), 200)
})

const counts = computed(() => {
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const h of headings.value) c[h.level]++
  return c
})

/** 有效长度（沿用搜索结果口径：中文/全角 = 2 英文） */
const effLen = (s: string) => {
  const cn = (s.match(/[\u4e00-\u9fff\u3000-\u303f\uff01-\uff60]/g) ?? []).length
  return cn * 2 + ([...s].length - cn)
}

interface Issue {
  level: 'err' | 'warn'
  text: string
  /** 对应大纲行索引（点击 notice 滚动定位） */
  row?: number
}

const issues = computed<Issue[]>(() => {
  const out: Issue[] = []
  const hs = headings.value
  if (!hs.length) return out
  const h1 = hs.filter((h) => h.level === 1)
  if (h1.length === 0) out.push({ level: 'err', text: '缺少 H1：页面应有且只有一个一级标题' })
  if (h1.length > 1) out.push({ level: 'warn', text: `发现 ${h1.length} 个 H1：建议只保留一个主标题` })
  let prev = 0
  for (let i = 0; i < hs.length; i++) {
    if (!hs[i].text.trim()) out.push({ level: 'err', text: `第 ${i + 1} 个标题为空（H${hs[i].level}）`, row: i })
    if (prev && hs[i].level > prev + 1) {
      out.push({ level: 'warn', text: `第 ${i + 1} 个标题从 H${prev} 跳级到 H${hs[i].level}，层级不连续`, row: i })
    }
    prev = hs[i].level
  }
  // rx3 重复标题检测：同一标题文本出现 ≥2 次
  const seen = new Map<string, number>()
  for (let i = 0; i < hs.length; i++) {
    const t = hs[i].text.trim()
    if (!t) continue
    const first = seen.get(t)
    if (first !== undefined) {
      out.push({ level: 'warn', text: `重复标题「${t.slice(0, 24)}${t.length > 24 ? '…' : ''}」：第 ${first + 1} 与第 ${i + 1} 行重复`, row: i })
    } else {
      seen.set(t, i)
    }
  }
  // rx3 H1 超长检测：有效长度 > 60（与搜索结果口径一致）
  for (let i = 0; i < hs.length; i++) {
    if (hs[i].level === 1 && effLen(hs[i].text) > 60) {
      out.push({ level: 'warn', text: `第 ${i + 1} 行 H1 有效长度 ${effLen(hs[i].text)}/60 超长，搜索引擎会截断展示`, row: i })
    }
  }
  return out
})

// 大纲行标色：问题行索引集合
const warnRows = computed(() => new Set(issues.value.filter((it) => it.level === 'warn' && it.row !== undefined).map((it) => it.row as number)))
const errRows = computed(() => new Set(issues.value.filter((it) => it.level === 'err' && it.row !== undefined).map((it) => it.row as number)))

const outlineEl = ref<HTMLElement | null>(null)
// rx1 点击 notice 滚动定位到对应大纲行
const locate = (row?: number) => {
  if (row === undefined || !outlineEl.value) return
  const el = outlineEl.value.querySelector<HTMLElement>(`[data-row="${row}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 1400)
}

const outlineText = computed(() =>
  headings.value.map((h) => `${'  '.repeat(h.level - 1)}H${h.level} ${h.text || '（空标题）'}`).join('\n'),
)

const copyOutline = async () => {
  if (!headings.value.length) {
    toast.warn('还没有可复制的大纲')
    return
  }
  const okFlag = await copyText(outlineText.value)
  if (okFlag) toast.ok('大纲已复制')
  else toast.err('复制失败')
}

// rx5 导出 Markdown 目录：按层级输出 # ~ ######
const tocText = computed(() => headings.value.map((h) => `${'#'.repeat(h.level)} ${h.text || '（空标题）'}`).join('\n'))
const exportToc = () => {
  if (!headings.value.length) {
    toast.warn('还没有可导出的目录')
    return
  }
  saveText(tocText.value, 'toc.md', 'text/markdown;charset=utf-8')
  toast.ok('Markdown 目录已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      粘贴完整或片段 HTML，本地解析出 H1–H6 层级结构，不会访问任何网络。
      浏览器安全限制（CORS）无法直接抓取在线页面，因此需要先复制网页源码再粘贴到这里（Ctrl+U 查看源码）。
      输入后约 0.2 秒自动解析。
    </div>

    <textarea v-model="html" class="textarea mono mt-2" style="min-height: 160px" placeholder="粘贴包含 h1–h6 的 HTML…"></textarea>
    <div class="row mt-1">
      <button class="btn btn-primary" @click="parse()"><ListTree :size="16" /> 立即解析标题结构</button>
    </div>

    <template v-if="parsed && headings.length">
      <div class="row row-wrap mt-2">
        <span v-for="lv in [1, 2, 3, 4, 5, 6]" :key="lv" class="chip" :class="{ active: counts[lv] > 0 }">
          H{{ lv }}<b class="cnt">{{ counts[lv] }}</b>
        </span>
      </div>

      <div ref="outlineEl" class="outline mt-2">
        <div
          v-for="(h, i) in headings"
          :key="i"
          :data-row="i"
          class="lv"
          :class="[`lv${h.level}`, { 'row-warn': warnRows.has(i), 'row-err': errRows.has(i) }]"
          :style="{ paddingLeft: `${(h.level - 1) * 18 + 10}px` }"
        >
          <span class="tag">H{{ h.level }}</span>
          <span :class="{ empty: !h.text }">{{ h.text || '（空标题）' }}</span>
        </div>
      </div>

      <div v-if="issues.length" class="issues mt-2">
        <button
          v-for="(it, i) in issues"
          :key="i"
          class="notice issue-row mt-1"
          :class="it.level === 'err' ? 'notice-err' : 'notice-warn'"
          :disabled="it.row === undefined"
          :title="it.row !== undefined ? '点击定位到大纲对应行' : ''"
          @click="locate(it.row)"
        >
          {{ it.text }}
        </button>
      </div>
      <div v-else class="notice notice-ok mt-2">标题层级结构良好，未发现问题。</div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="copyOutline"><ClipboardCopy :size="16" /> 复制大纲文本</button>
        <button class="btn btn-ghost" @click="exportToc"><FileDown :size="16" /> 导出 Markdown 目录</button>
      </div>
    </template>

    <div v-else-if="parsed" class="notice notice-warn mt-2">未提取到任何标题，请检查 HTML 是否包含 h1–h6 标签。</div>
  </div>
</template>

<style scoped>
.outline {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 6px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 4px;
}
.lv { display: flex; align-items: center; gap: 8px; border-radius: 6px; min-height: 26px; border: 1px solid transparent; }
.row-warn { border-color: #d97706; background: color-mix(in srgb, #d97706 8%, transparent); }
.row-err { border-color: var(--err); background: color-mix(in srgb, var(--err) 8%, transparent); }
.flash { outline: 2px solid var(--accent); outline-offset: 2px; }
.tag {
  flex: none;
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
}
.lv1 { font-size: 16.5px; font-weight: 700; }
.lv2 { font-size: 15.5px; font-weight: 600; }
.lv3 { font-size: 14.5px; font-weight: 600; }
.lv4 { font-size: 13.5px; }
.lv5 { font-size: 13px; color: var(--text-2); }
.lv6 { font-size: 12.5px; color: var(--text-3); }
.empty { color: var(--err); font-style: italic; }
.cnt {
  margin-left: 6px;
  font-size: 11px;
  background: rgba(127, 127, 127, 0.15);
  border-radius: 999px;
  padding: 0 6px;
}
.issue-row {
  display: block;
  width: 100%;
  text-align: left;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
}
.issue-row:disabled { cursor: default; }
</style>
