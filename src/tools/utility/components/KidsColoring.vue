<script setup lang="ts">
import { ref } from 'vue'
import { Printer, Download, Trash } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 儿童涂色画板：自绘原创 SVG 线稿，点击区域填色，可打印 */
const toast = useToast()

const PALETTE = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#78350f', '#111827', '#ffffff']
const color = ref('#ef4444')
const current = ref(0)
const busy = ref(false)

/** 原创线稿模板（path id 唯一，点击填色） */
const TEMPLATES: { name: string; svg: string }[] = [
  {
    name: '小房子',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<path id="a1" d="M60 160 L150 80 L240 160 Z"/><rect id="a2" x="70" y="160" width="160" height="100"/><rect id="a3" x="130" y="200" width="40" height="60"/><rect id="a4" x="190" y="180" width="26" height="26"/><rect id="a5" x="88" y="180" width="26" height="26"/><path id="a6" d="M110 260 v-40 h20 v40"/><circle id="a7" cx="150" cy="150" r="10"/></g></svg>`,
  },
  {
    name: '小鱼',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<ellipse id="b1" cx="140" cy="150" rx="80" ry="46"/><path id="b2" d="M220 150 L268 118 L258 150 L268 182 Z"/><circle id="b3" cx="100" cy="140" r="10"/><path id="b4" d="M120 108 Q140 84 160 108"/><path id="b5" d="M120 192 Q140 216 160 192"/><path id="b6" d="M150 120 Q166 150 150 180"/></g></svg>`,
  },
  {
    name: '大太阳',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<circle id="c1" cx="150" cy="150" r="60"/><g id="c2"><line x1="150" y1="40" x2="150" y2="76"/><line x1="150" y1="224" x2="150" y2="260"/><line x1="40" y1="150" x2="76" y2="150"/><line x1="224" y1="150" x2="260" y2="150"/><line x1="74" y1="74" x2="100" y2="100"/><line x1="200" y1="200" x2="226" y2="226"/><line x1="226" y1="74" x2="200" y2="100"/><line x1="100" y1="200" x2="74" y2="226"/></g><path id="c3" d="M126 156 Q138 170 150 156 Q162 170 174 156"/><circle id="c4" cx="130" cy="136" r="5"/><circle id="c5" cx="170" cy="136" r="5"/></g></svg>`,
  },
  {
    name: '蝴蝶',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<ellipse id="d1" cx="115" cy="120" rx="48" ry="60"/><ellipse id="d2" cx="185" cy="120" rx="48" ry="60"/><ellipse id="d3" cx="125" cy="210" rx="32" ry="40"/><ellipse id="d4" cx="175" cy="210" rx="32" ry="40"/><rect id="d5" x="142" y="110" width="16" height="150" rx="8"/><circle id="d6" cx="150" cy="98" r="16"/><path id="d7" d="M140 84 Q120 60 112 52" fill="none"/><path id="d8" d="M160 84 Q180 60 188 52" fill="none"/></g></svg>`,
  },
  {
    name: '小树',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<circle id="e1" cx="150" cy="110" r="56"/><rect id="e2" x="136" y="160" width="28" height="90"/><path id="e3" d="M96 250 H204"/><circle id="e4" cx="122" cy="92" r="16"/><circle id="e5" cx="168" cy="120" r="14"/></g></svg>`,
  },
  {
    name: '星星月亮',
    svg: `<svg viewBox="0 0 300 300"><g stroke="#111827" stroke-width="3" fill="#fff">
<path id="f1" d="M120 60 L138 118 L198 118 L150 154 L168 212 L120 176 L72 212 L90 154 L42 118 L102 118 Z"/><path id="f2" d="M216 150 A62 62 0 1 0 258 210 A50 50 0 1 1 216 150"/><circle id="f3" cx="60" cy="250" r="4"/><circle id="f4" cx="242" cy="70" r="4"/><circle id="f5" cx="266" cy="112" r="3"/></g></svg>`,
  },
]

const fill = (e: Event) => {
  const el = e.target as SVGElement
  if (el.tagName.toLowerCase() === 'g') return
  el.style.fill = color.value
}

const reset = () => {
  current.value = (current.value + 1) % TEMPLATES.length
  void current
  // 强制重渲染：换 key 由模板处处理
  current.value = (current.value + TEMPLATES.length - 1) % TEMPLATES.length
  locationHash.value++
}

const locationHash = ref(0)

const print = () => window.print()

const exportPng = async () => {
  busy.value = true
  try {
    const el = document.querySelector('.coloring-stage svg') as HTMLElement | null
    if (!el) return
    const url = await toPng(el, { pixelRatio: 3, backgroundColor: '#ffffff' })
    saveBlob(await (await fetch(url)).blob(), '涂色作品.png')
    toast.ok('已导出作品')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="chips">
        <button v-for="(t, i) in TEMPLATES" :key="t.name" class="chip-btn" :class="{ on: current === i }" @click="current = i; locationHash++">{{ t.name }}</button>
      </div>
      <div class="row wrap gap mt-2">
        <span class="field-label">颜色</span>
        <button v-for="c in PALETTE" :key="c" class="swatch" :class="{ on: color === c }" :style="{ background: c }" @click="color = c"></button>
        <span class="spacer"></span>
        <button class="mini-btn" title="重新开始（清空颜色）" @click="reset"><Trash :size="15" /></button>
        <button class="btn btn-sm" @click="print"><Printer :size="14" /> 打印</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="exportPng"><Download :size="14" /> 导出 PNG</button>
      </div>
      <p class="hint mt-1">用鼠标或手指点线稿里的区域涂色；打印按钮配合浏览器「另存为 PDF」可以做成涂色卡。</p>
    </div>

    <div class="stage mt-2" :key="locationHash">
      <div class="coloring-stage" v-html="TEMPLATES[current]!.svg" @click="fill"></div>
    </div>
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip-btn { padding: 4px 14px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 13px; color: var(--text); }
.chip-btn.on { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.gap { gap: 8px; align-items: center; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; }
.swatch.on { outline: 3px solid var(--accent); }
.spacer { flex: 1; }
.mini-btn { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 7px; width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; }
.stage { display: grid; place-items: center; }
.coloring-stage { width: 420px; max-width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 16px; background: #fff; cursor: pointer; }
.coloring-stage svg { width: 100%; height: auto; }
.coloring-stage svg * { transition: fill .15s; }
.hint { font-size: 12px; color: var(--muted); }
@media print { body * { visibility: hidden; } .coloring-stage, .coloring-stage * { visibility: visible; } .coloring-stage { position: fixed; inset: 0; margin: auto; border: none; } }
</style>
