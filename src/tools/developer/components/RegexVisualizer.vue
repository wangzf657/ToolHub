<script setup lang="ts">
/** 正则可视化：交互面板；布局与解析全部在 lib/regexDiagram（regjsparser AST → SVG 铁路图）。
 *  增强口径：实时渲染（300ms 防抖，失败保留上次成功图）、节点中文解释（hover/点击）、
 *  导出 SVG 主题色内联保真、尺寸展示、与 regex-tester 互链（query 传正则与 flags）。 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Workflow, Download, FlaskConical } from 'lucide-vue-next'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { injectTitles, inlineSvgTheme } from './regexExplain'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const input = ref('^https?://[\\w.-]+(?:\\?[\\w=&%-]*)?$')
const flags = ref('')
const svg = ref('')
const size = ref({ w: 0, h: 0 })
const error = ref('')
const busy = ref(false)

let timer: number | null = null
watch([input, flags], () => {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => void run(true), 300)
})

const run = async (silent = false) => {
  const src = input.value.trim()
  if (!src) {
    if (!silent) toast.warn('请输入正则表达式')
    return
  }
  busy.value = true
  try {
    // 布局引擎重依赖 regjsparser，懒加载进异步 chunk
    const { regexDiagramSvg } = await import('@/lib/regexDiagram')
    const r = await regexDiagramSvg(src, flags.value.trim())
    // 交互版注入 <title> 中文解释（仅页面内保留，下载版不含）
    svg.value = injectTitles(r.svg)
    size.value = { w: r.width, h: r.height }
    error.value = ''
    if (!silent) toast.ok('已生成结构图')
  } catch (e) {
    // 失败时保留上次成功图 + 错误条，便于连续输入修正
    error.value = `正则解析失败：${(e as Error).message || '未知错误'}`
    if (!silent) toast.err('正则语法有误，请检查')
  } finally {
    busy.value = false
  }
}

/** 下载保真：var(--x) 替换为当前主题实际色值，并剥掉 <title>（下载版不含 tooltip） */
const downloadSvg = () => {
  if (!svg.value) return toast.warn('请先生成结构图')
  const clean = svg.value.replace(/<title>[\s\S]*?<\/title>/g, '')
  saveText(inlineSvgTheme(clean), '正则结构.svg', 'image/svg+xml;charset=utf-8')
  toast.ok('已导出 SVG（主题色已内联，可独立打开）')
}

/** 点击节点：读取所在 <g> 的 <title>，toast 呈现中文解释（与 hover 等效，触屏可用） */
const onStageClick = (e: MouseEvent) => {
  const g = (e.target as SVGElement | HTMLElement | null)?.closest?.('g.dia-node')
  const t = g?.querySelector('title')?.textContent
  if (t) toast.ok(t)
}

/* ---------- 与 regex-tester 互链：出站传 query，入站读 query ---------- */
const goTester = () => {
  const q: Record<string, string> = { re: input.value }
  if (flags.value.trim()) q.fl = flags.value.trim()
  void router.push({ path: '/t/regex-tester', query: q })
}

// 入站：从 regex-tester「去可视化」带过来的表达式
{
  const re = route.query.re
  if (typeof re === 'string' && re) input.value = re
  const fl = route.query.fl
  if (typeof fl === 'string') flags.value = fl
}
void run(true)
onBeforeUnmount(() => {
  if (timer !== null) window.clearTimeout(timer)
})
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 8px">
      <input v-model="input" class="input mono grow" style="min-width: 260px" spellcheck="false" placeholder="输入正则，如 ^\\d{4}-\\d{2}$" />
      <input v-model="flags" class="input mono" style="width: 66px" spellcheck="false" placeholder="flags" title="正则标志，如 g i m u" />
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run()"><Workflow :size="14" /> 可视化</button>
      <button class="btn btn-ghost btn-sm" @click="goTester"><FlaskConical :size="14" /> 去测试匹配</button>
      <button v-if="svg" class="btn btn-ghost btn-sm" @click="downloadSvg"><Download :size="14" /> 下载 SVG</button>
    </div>

    <div v-if="error" class="notice notice-err">{{ error }}（下方保留最近一次成功生成的结构图）</div>
    <div v-else-if="svg" class="svg-stage" v-html="svg" @click="onStageClick"></div>
    <div v-else class="muted small">点击「可视化」生成铁路结构图：序列从左到右、分支纵向展开、量词以虚线框 + 角标标注、捕获组标「第 N 组」、虚线盒为元字符/断言。</div>

    <p v-if="svg" class="muted small mt-1">
      宽 {{ size.w }} × 高 {{ size.h }} px · 悬停或点击任意盒可看中文解释（量词/字符类/分组/锚点）
    </p>

    <p class="notice notice-info mt-2 small">解析使用 regjsparser（支持命名分组、后顾断言、\p{…} 与 u/v 标志）；flags 栏填 g i m u 等标志；下载的 SVG 已内联当前主题色，可直接贴进文档（不含悬停解释）。要看实际匹配效果请去 <RouterLink to="/t/regex-tester">正则测试</RouterLink>。</p>
  </div>
</template>

<style scoped>
.svg-stage {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  overflow: auto;
}
.svg-stage :deep(g.dia-node) {
  cursor: help;
}
.grow {
  flex: 1;
}
</style>
