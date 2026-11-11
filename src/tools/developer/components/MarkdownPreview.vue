<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { FileText, Download, Code2 } from 'lucide-vue-next'
import { saveBlob, copyText } from '@/lib/download'
import { mdToHtml, renderMermaidIn } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 百宝工具箱\n\n**本地优先**的在线工具箱，无需注册，数据不出设备。\n\n- 支持 `Markdown` 语法\n- [链接示例](https://example.com)\n\n> 所有渲染在浏览器完成。\n\n## 数学公式（KaTeX）\n\n质能方程 $E = mc^2$，求和公式：\n\n$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$\n\n## 流程图（Mermaid）\n\n```mermaid\ngraph LR\n  A[Markdown] --> B{数学?}\n  B -->|是| C[KaTeX]\n  B -->|否| D[直接渲染]\n```')
const html = ref('')
const busy = ref(false)
const renderErr = ref('')
const withMath = ref(true)
const withMermaid = ref(true)

const previewRef = ref<HTMLDivElement | null>(null)

const render = async () => {
  if (!input.value.trim()) {
    html.value = ''
    return
  }
  busy.value = true
  renderErr.value = ''
  try {
    html.value = await mdToHtml(input.value, { math: withMath.value, mermaid: withMermaid.value })
    await nextTick()
    if (previewRef.value) await renderMermaidIn(previewRef.value)
  } catch (e) {
    renderErr.value = `渲染失败：${(e as Error).message}`
  } finally {
    busy.value = false
  }
}
// 输入即渲染（300ms 防抖）：预览与编辑保持联动，不必手点「渲染预览」
let debTimer = 0
watch([input, withMath, withMermaid], () => {
  window.clearTimeout(debTimer)
  debTimer = window.setTimeout(() => void render(), 300)
})

const copyHtml = async () => {
  if (!html.value) return toast.warn('请先渲染内容')
  const okFlag = await copyText(html.value)
  okFlag ? toast.ok('HTML 已复制（公式/图表为静态结果）') : toast.err('复制失败')
}

const downloadHtml = async () => {
  if (!html.value) return toast.warn('请先渲染内容')
  const katexCss = withMath.value ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">\n' : ''
  const doc = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Markdown 导出</title>\n${katexCss}<style>body{max-width:760px;margin:40px auto;padding:0 20px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.7;color:#24292f}code{background:#f0f1f4;padding:2px 5px;border-radius:4px}pre{background:#f6f8fa;padding:14px;border-radius:8px;overflow:auto}blockquote{border-left:4px solid #d0d7de;margin:0;padding-left:14px;color:#57606a}table{border-collapse:collapse}th,td{border:1px solid #d0d7de;padding:6px 12px}.mermaid-src svg{max-width:100%}</style>\n</head>\n<body>\n${html.value}\n</body>\n</html>`
  saveBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), 'markdown.html')
  toast.ok('已下载独立 HTML 文件')
}

const loadSample = () => {
  input.value += '\n\n## 二级标题\n\n| 功能 | 状态 |\n| --- | --- |\n| 本地渲染 | ✅ |\n'
  render()
}
</script>

<template>
  <div class="md-preview">
    <div class="row row-wrap mb-2" style="gap: 10px; align-items: center">
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="render"><FileText :size="15" /> 渲染预览</button>
      <button class="btn btn-ghost btn-sm" @click="copyHtml"><Code2 :size="15" /> 复制 HTML</button>
      <button class="btn btn-ghost btn-sm" @click="downloadHtml"><Download :size="15" /> 下载 HTML</button>
      <button class="btn btn-soft btn-sm" @click="loadSample">追加表格示例</button>
      <label class="check"><input v-model="withMath" type="checkbox" @change="render" /> 数学公式</label>
      <label class="check"><input v-model="withMermaid" type="checkbox" @change="render" /> Mermaid 图表</label>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">Markdown 输入（$行内公式$、$$独立公式$$、```mermaid 代码块）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 380px"></textarea>
      </div>
      <div>
        <span class="field-label">渲染预览（已净化）</span>
        <div ref="previewRef" class="preview-box prose" v-html="html"></div>
      </div>
    </div>

    <div v-if="renderErr" class="notice notice-err mt-2">{{ renderErr }}</div>
    <p class="notice notice-info mt-2 small">marked 渲染 + DOMPurify 消毒；KaTeX 公式与 Mermaid 图表在本地渲染成静态结果后随 HTML 一起复制/导出。</p>
  </div>
</template>

<style scoped>
.preview-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 80%, transparent);
  padding: 18px 20px;
  min-height: 380px;
  max-height: 520px;
  overflow: auto;
  font-size: 14.5px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.preview-box :deep(img) {
  max-width: 100%;
}
.preview-box :deep(.mermaid-src) {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}
.preview-box :deep(.mermaid-src svg) {
  max-width: 100%;
}
.preview-box :deep(.katex-display) {
  overflow-x: auto;
}
</style>
