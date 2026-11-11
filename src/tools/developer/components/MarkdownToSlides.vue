<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import { Presentation, Download } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { mdToHtml } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const input = ref('# Markdown 转幻灯片\n\n用 `---` 分隔每一页\n\n---\n\n## 第二页 · 要点\n\n- 支持 **加粗**、`代码`\n- 支持表格与图片\n- 方向键翻页\n\n---\n\n## 第三页 · 表格\n\n| 功能 | 支持 |\n| --- | --- |\n| 分页 | ✅ |\n| 主题 | 3 套 |')
const theme = ref<'dark' | 'light' | 'warm'>('dark')

const THEMES = {
  dark: { bg: '#0f172a', fg: '#e2e8f0', accent: '#818cf8', sub: '#94a3b8' },
  light: { bg: '#fafaf9', fg: '#1c1917', accent: '#4f46e5', sub: '#78716c' },
  warm: { bg: '#2d1b16', fg: '#fde68a', accent: '#fb923c', sub: '#d6b28a' },
} as const

/** 按 --- 切页（不切代码块里的 ---） */
const splitSlides = (md: string): string[] => {
  const out: string[] = []
  let buf: string[] = []
  let inCode = false
  for (const line of md.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) inCode = !inCode
    if (!inCode && /^---+\s*$/.test(line.trim())) {
      out.push(buf.join('\n'))
      buf = []
      continue
    }
    buf.push(line)
  }
  out.push(buf.join('\n'))
  return out.map((s) => s.trim()).filter(Boolean)
}

const slides = computed(() => splitSlides(input.value))
const previews = ref<string[]>([])

const render = async () => {
  const parts: string[] = []
  for (const s of slides.value) {
    parts.push(await mdToHtml(s))
  }
  // 逐页 HTML 直通数组：marked 输出含换行，join('\n') 后按行号取页会错位串页
  previews.value = parts
}
void render()
// 输入变化预览联动（500ms 防抖，逐页渲染较重）
let debTimer = 0
watch(input, () => {
  window.clearTimeout(debTimer)
  debTimer = window.setTimeout(() => void render(), 500)
})

const exportHtml = async () => {
  await render()
  const t = THEMES[theme.value]
  const css = `body{margin:0;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;background:${t.bg};color:${t.fg}}
.deck{position:relative}
.slide{display:none;position:absolute;inset:0;flex-direction:column;justify-content:center;padding:6vh 10vw;box-sizing:border-box}
.slide.active{display:flex}
.slide h1,.slide h2{color:${t.accent};line-height:1.3}
.slide h1{font-size:2.6em}.slide h2{font-size:2em}
.slide p,.slide li{font-size:1.35em;line-height:1.7}
.slide code{background:rgba(127,127,127,.18);padding:2px 7px;border-radius:5px}
.slide pre{background:rgba(0,0,0,.28);padding:14px;border-radius:10px;overflow:auto;font-size:1em}
.slide table{border-collapse:collapse}.slide th,.slide td{border:1px solid rgba(127,127,127,.4);padding:8px 16px}
.slide blockquote{border-left:4px solid ${t.accent};margin:0;padding-left:16px;color:${t.sub}}
.slide img{max-width:80%}
.page{position:fixed;bottom:18px;right:26px;color:${t.sub};font-size:14px}
.hint{position:fixed;bottom:18px;left:26px;color:${t.sub};font-size:13px}`
  const script = `const slides=[...document.querySelectorAll('.slide')];let cur=0;
function show(i){cur=Math.max(0,Math.min(slides.length-1,i));slides.forEach((s,j)=>s.classList.toggle('active',j===cur));document.getElementById('pg').textContent=(cur+1)+' / '+slides.length}
document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();show(cur+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(cur-1)}if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1)});
document.addEventListener('click',()=>show(cur+1));show(0);`
  const doc = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>幻灯片</title><style>${css}</style></head>
<body><div class="deck">
${slides.value.map((s, i) => `<section class="slide${i === 0 ? ' active' : ''}">${previews.value[i] ?? ''}</section>`).join('\n')}
</div>
<div class="page" id="pg">1 / ${slides.value.length}</div>
<div class="hint">← → 方向键 / 空格 / 点击翻页</div>
<script>${script}<\/script></body></html>`
  saveBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), 'slides.html')
  toast.ok('已导出独立 HTML 幻灯片（方向键翻页）')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">主题</span>
        <select v-model="theme" class="input">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
          <option value="warm">暖色</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="exportHtml"><Presentation :size="15" /> 导出 HTML 幻灯片</button>
        <span class="hint">用 `---` 单独一行分页，共 {{ slides.length }} 页</span>
      </div>
      <textarea v-model="input" class="input area mono mt-2" rows="10" spellcheck="false"></textarea>
      <p class="hint mt-1">导出的是零依赖单文件 HTML：双击打开即可全屏演示，方向键/空格/点击翻页，适合快速分享讲稿。</p>
    </div>

    <div v-if="previews.length" class="mt-2">
      <h4 class="h4">页面预览（逐页）</h4>
      <div v-for="(s, i) in previews" :key="i" class="slide-card" v-html="s"></div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.area { width: 100%; resize: vertical; }
.hint { font-size: 12px; color: var(--muted); }
.h4 { margin-bottom: 8px; font-size: 14px; }
.slide-card { border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.slide-card :deep(h1), .slide-card :deep(h2) { color: var(--accent-text); }
.slide-card :deep(img) { max-width: 100%; }
</style>
