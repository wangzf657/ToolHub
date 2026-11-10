<script setup lang="ts">
import { ref, watch } from 'vue'
import { Camera, Download } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const code = ref(`function greet(name) {\n  // 一行代码，一张卡片\n  return \`你好，\${name}！\`;\n}\nconsole.log(greet('ToolHub'));`)
const lang = ref('auto')
const theme = ref<'midnight' | 'paper' | 'moss' | 'ember'>('midnight')
const showHeader = ref(true)
const filename = ref('index.js')
const padding = ref(48)
const bg = ref('gradient-1')
const busy = ref(false)

const THEMES = {
  midnight: { bg: '#0f172a', fg: '#e2e8f0', kw: '#c084fc', str: '#4ade80', num: '#fbbf24', com: '#64748b', fn: '#60a5fa', win: '#1e293b' },
  paper: { bg: '#fafaf9', fg: '#1c1917', kw: '#9333ea', str: '#15803d', num: '#b45309', com: '#a8a29e', fn: '#2563eb', win: '#f5f5f4' },
  moss: { bg: '#0b1f16', fg: '#d1fae5', kw: '#5eead4', str: '#bef264', num: '#fcd34d', com: '#4b6357', fn: '#38bdf8', win: '#123326' },
  ember: { bg: '#1f1210', fg: '#fde68a', kw: '#fb7185', str: '#a3e635', num: '#fdba74', com: '#78544c', fn: '#f97316', win: '#2d1b16' },
} as const

const BGS = [
  { k: 'gradient-1', css: 'linear-gradient(135deg,#6366f1,#ec4899)' },
  { k: 'gradient-2', css: 'linear-gradient(135deg,#0ea5e9,#22d3ee)' },
  { k: 'gradient-3', css: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { k: 'gradient-4', css: 'linear-gradient(135deg,#10b981,#0ea5e9)' },
  { k: 'solid-dark', css: '#1e1b4b' },
]

/** highlight.js core + 按需注册语言（比 common 全量更轻），auto 模式用这些语言做自动检测 */
const LANGS = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'sql', 'bash', 'yaml', 'json', 'css', 'xml', 'markdown']

interface HljsLike {
  registerLanguage: (name: string, fn: unknown) => void
  highlight: (code: string, opts: { language: string }) => { value: string }
  highlightAuto: (code: string, subset?: string[]) => { value: string; language?: string }
}

let hljsReady: HljsLike | null = null

const getHljs = async (): Promise<HljsLike> => {
  if (hljsReady) return hljsReady
  const core = (await import('highlight.js/lib/core')) as unknown as HljsLike
  for (const l of LANGS) {
    if (l === 'c') continue // c 已随 cpp 注册
    const mod = (await import(`highlight.js/lib/languages/${l}.js`)) as unknown as { default: unknown }
    core.registerLanguage(l, mod.default)
  }
  hljsReady = core
  return core
}

const highlight = async (codeText: string, langName: string) => {
  const hljs = await getHljs()
  if (langName === 'auto') {
    const r = hljs.highlightAuto(codeText, LANGS.filter((x) => x !== 'c'))
    return { html: r.value, detected: r.language ?? '' }
  }
  try {
    return { html: hljs.highlight(codeText, { language: langName }).value, detected: langName }
  } catch {
    return { html: hljs.highlightAuto(codeText, LANGS.filter((x) => x !== 'c')).value, detected: '' }
  }
}

const highlighted = ref('')
const detectedLang = ref('')

const refresh = async () => {
  const r = await highlight(code.value, lang.value)
  highlighted.value = r.html
  detectedLang.value = r.detected
}

watch([code, lang], refresh, { immediate: true })

const LANG_SELECT = ['auto', ...LANGS]

const stageRef = ref<HTMLDivElement | null>(null)

const exportPng = async () => {
  if (!stageRef.value) return
  busy.value = true
  try {
    const url = await toPng(stageRef.value, { pixelRatio: 2, cacheBust: true })
    const bin = await (await fetch(url)).blob()
    saveBlob(bin, `代码截图-${Date.now()}.png`)
    toast.ok('已导出 PNG')
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
      <div class="row wrap gap">
        <span class="field-label">语言</span>
        <select v-model="lang" class="input slim">
          <option v-for="l in LANG_SELECT" :key="l" :value="l">{{ l === 'auto' ? '自动检测' : l }}</option>
        </select>
        <span class="chip" v-if="detectedLang && lang === 'auto'">识别为 {{ detectedLang }}</span>
        <span class="field-label">主题</span>
        <select v-model="theme" class="input slim">
          <option value="midnight">午夜蓝</option>
          <option value="paper">纸白</option>
          <option value="moss">苔绿</option>
          <option value="ember">炭火</option>
        </select>
        <label class="check"><input v-model="showHeader" type="checkbox" /> 显示窗口条</label>
        <span class="field-label">内边距</span>
        <input v-model.number="padding" type="number" class="input n-input" min="16" max="120" />
      </div>
      <div class="row wrap gap mt-2">
        <span class="field-label">背景</span>
        <button v-for="b in BGS" :key="b.k" class="swatch" :style="{ background: b.css }" :class="{ active: bg === b.k }" @click="bg = b.k"></button>
        <span class="spacer"></span>
        <input v-model="filename" class="input slim" placeholder="文件名（窗口条展示）" />
      </div>
      <textarea v-model="code" class="input area mt-2 mono" rows="8" placeholder="粘贴要美化的代码…" spellcheck="false"></textarea>
    </div>

    <div class="mt-2 center">
      <div ref="stageRef" class="stage" :style="{ background: BGS.find((b) => b.k === bg)?.css, padding: `${padding}px` }">
        <div class="win" :style="{ background: THEMES[theme].bg, color: THEMES[theme].fg }">
          <div v-if="showHeader" class="win-bar" :style="{ background: THEMES[theme].win }">
            <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            <span class="fname">{{ filename }}</span>
          </div>
          <pre class="code mono" v-html="highlighted"></pre>
        </div>
      </div>
      <button class="btn btn-primary mt-2" :disabled="busy" @click="exportPng"><Camera v-if="!busy" :size="16" /><Download v-else :size="16" class="spin" /> 导出 PNG（2x 高清）</button>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 150px; }
.n-input { width: 70px; }
.chip { font-size: 12px; color: var(--muted); }
.spacer { flex: 1; }
.area { width: 100%; resize: vertical; tab-size: 2; }
.center { display: flex; flex-direction: column; align-items: center; }
.stage { border-radius: 16px; padding: 48px; max-width: 860px; width: 100%; }
.win { border-radius: 10px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
.win-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; }
.dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.dot.r { background: #ff5f57; }
.dot.y { background: #febc2e; }
.dot.g { background: #28c840; }
.fname { margin-left: 8px; font-size: 12px; opacity: .7; }
.code { margin: 0; padding: 18px 22px; font-size: 13.5px; line-height: 1.7; overflow-x: auto; tab-size: 2; }
.swatch { width: 30px; height: 22px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: var(--accent); }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
