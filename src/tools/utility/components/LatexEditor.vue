<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Copy, Download, Loader2 } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { copyText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const tex = ref(String.raw`E = mc^2 \quad \sum_{i=1}^{n} i = \frac{n(n+1)}{2}`)
const displayMode = ref(true)
const busy = ref(false)

const TEMPLATES = [
  { label: '分式', tex: String.raw`\frac{a}{b}` },
  { label: '根式', tex: String.raw`\sqrt[n]{x}` },
  { label: '求和', tex: String.raw`\sum_{i=1}^{n} a_i` },
  { label: '积分', tex: String.raw`\int_0^1 f(x)\,dx` },
  { label: '极限', tex: String.raw`\lim_{x \to \infty} \frac{1}{x} = 0` },
  { label: '矩阵', tex: String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}` },
  { label: '方程组', tex: String.raw`\begin{cases} x + y = 3 \\ x - y = 1 \end{cases}` },
  { label: '上下标', tex: String.raw`x^{2n+1}_{i,j}` },
  { label: '希腊字母', tex: String.raw`\alpha\ \beta\ \gamma\ \theta\ \pi\ \Omega` },
  { label: '勾股定理', tex: String.raw`a^2 + b^2 = c^2` },
  { label: '二次求根', tex: String.raw`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}` },
  { label: '欧拉公式', tex: String.raw`e^{i\pi} + 1 = 0` },
]

const outRef = ref<HTMLDivElement | null>(null)
const err = ref('')

const render = async () => {
  await nextTick()
  if (!outRef.value) return
  try {
    const katex = await import('katex')
    await import('katex/dist/katex.min.css')
    katex.render(tex.value, outRef.value, { displayMode: displayMode.value, throwOnError: true })
    err.value = ''
  } catch (e) {
    err.value = `公式语法有误：${(e as Error).message.slice(0, 120)}`
  }
}

watch([tex, displayMode], render, { immediate: true })

const doCopy = async () => {
  const ok = await copyText(tex.value)
  ok ? toast.ok('已复制 TeX 源码') : toast.err('复制失败')
}

const exportPng = async () => {
  if (!outRef.value || err.value) return toast.warn('请先修正公式语法')
  busy.value = true
  try {
    const url = await toPng(outRef.value, { pixelRatio: 3, backgroundColor: undefined })
    const blob = await (await fetch(url)).blob()
    saveBlob(blob, '公式.png')
    toast.ok('已导出高清 PNG')
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
      <div class="chips mb-2">
        <button v-for="t in TEMPLATES" :key="t.label" class="chip-btn" @click="tex = tex + '  ' + t.tex">+ {{ t.label }}</button>
      </div>
      <textarea v-model="tex" class="input area mono" rows="4" spellcheck="false" placeholder="输入 LaTeX 公式，如 \frac{a}{b}"></textarea>
      <div class="row gap mt-2">
        <label class="check"><input v-model="displayMode" type="checkbox" /> 独立公式（居中大图）</label>
        <span class="spacer"></span>
        <button class="btn btn-sm" @click="doCopy"><Copy :size="14" /> 复制 TeX</button>
        <button class="btn btn-primary btn-sm" :disabled="busy || !!err" @click="exportPng"><Loader2 v-if="busy" :size="14" class="spin" /><Download v-else :size="14" /> 导出 PNG</button>
      </div>
    </div>

    <div class="preview mt-2">
      <div ref="outRef" class="formula"></div>
      <p v-if="err" class="hint err">{{ err }}</p>
    </div>
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip-btn { padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.area { width: 100%; resize: vertical; }
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.preview { padding: 34px 20px; border: 1px solid var(--border); border-radius: 12px; display: grid; place-items: center; min-height: 140px; background: var(--panel-solid, transparent); }
.formula { font-size: 22px; }
.hint { font-size: 12px; color: var(--muted); }
.hint.err { color: var(--err); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
