<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Copy, Delete } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/download'
import { evalExpr, fmtNum } from './sciCalc'

const toast = useToast()

const expr = ref('')
const result = ref('')
const preview = ref('')
const copied = ref(false)
const degMode = ref(true)
const ansValue = ref(0)
const history = ref<{ expr: string; val: string }[]>([])

const tryEval = (src: string): number | null => {
  try {
    return evalExpr(src, { deg: degMode.value, ans: ansValue.value })
  } catch {
    return null
  }
}

/* ---------- 实时预览：150ms 防抖，非法中间态静默（不弹 toast、不写历史） ---------- */
let pvTimer: number | null = null
watch(expr, (v) => {
  if (pvTimer !== null) window.clearTimeout(pvTimer)
  pvTimer = window.setTimeout(() => {
    pvTimer = null
    const src = v.trim()
    if (!src) { preview.value = ''; return }
    const n = tryEval(src)
    preview.value = n !== null && src !== result.value.split(' = ')[0] ? `≈ ${fmtNum(n)}` : ''
  }, 150)
})

const evaluate = () => {
  const src = expr.value.trim()
  if (!src) return
  try {
    const n = evalExpr(src, { deg: degMode.value, ans: ansValue.value })
    const out = fmtNum(n)
    result.value = `${src} = ${out}`
    preview.value = ''
    ansValue.value = n
    history.value = [{ expr: src, val: out }, ...history.value].slice(0, 12)
    histIdx.value = -1
    draft.value = ''
  } catch (e) {
    result.value = ''
    toast.err((e as Error).message || '表达式错误')
  }
}

/* ---------- 结果一键复制 ---------- */
const copyResult = async () => {
  const m = result.value.match(/ = (.+)$/)
  if (!m) return
  const okFlag = await copyText(m[1])
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } else toast.err('复制失败，请手动选择复制')
}

/* ---------- 历史回溯：输入框 ↑/↓ 在历史间移动 ---------- */
const histIdx = ref(-1)
const draft = ref('')
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!history.value.length) return
    if (histIdx.value === -1) draft.value = expr.value
    histIdx.value = Math.min(histIdx.value + 1, history.value.length - 1)
    expr.value = history.value[histIdx.value]!.expr
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (histIdx.value === -1) return
    histIdx.value--
    expr.value = histIdx.value === -1 ? draft.value : history.value[histIdx.value]!.expr
  }
}

/* ---------- 按键面板 ---------- */
interface Key { label: string; insert?: string; act?: 'eq' | 'clear' | 'back' | 'deg'; cls?: string }
const keyRows: Key[][] = [
  [{ label: 'sin' }, { label: 'cos' }, { label: 'tan' }, { label: 'C', act: 'clear' }, { label: '⌫', act: 'back' }],
  [{ label: 'asin' }, { label: 'acos' }, { label: 'atan' }, { label: '(' }, { label: ')' }],
  [{ label: 'log' }, { label: 'ln' }, { label: '√', insert: 'sqrt(' }, { label: '^' }, { label: '!' }],
  [{ label: 'π', insert: 'π' }, { label: 'e', insert: 'e' }, { label: '%' }, { label: '×', insert: '×' }, { label: '÷', insert: '÷' }],
  [{ label: '7' }, { label: '8' }, { label: '9' }, { label: '−', insert: '-' }, { label: '+' }],
  [{ label: '4' }, { label: '5' }, { label: '6' }, { label: 'DEG/RAD', act: 'deg', cls: 'wide' }, { label: '＝', act: 'eq', cls: 'accent' }],
  [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '.' }, { label: '0' }],
]

const press = (k: Key) => {
  if (k.act === 'eq') return evaluate()
  if (k.act === 'clear') { expr.value = ''; result.value = ''; preview.value = ''; return }
  if (k.act === 'back') { expr.value = expr.value.slice(0, -1); return }
  if (k.act === 'deg') { degMode.value = !degMode.value; return }
  expr.value += k.insert ?? k.label
}
</script>

<template>
  <div class="sci-grid">
    <div class="sci-main">
      <div class="disp">
        <input v-model="expr" class="input mono disp-input" placeholder="输入表达式，如 sin(30)+2^10 或 5!" @keydown.enter="evaluate" @keydown="onKey" />
        <div v-if="preview" class="disp-preview mono">{{ preview }}</div>
        <div v-if="result" class="disp-result-row">
          <span class="disp-result mono">{{ result }}</span>
          <button class="copy-btn" title="复制结果" aria-label="复制结果" @click="copyResult">
            <Check v-if="copied" :size="15" color="#34d399" />
            <Copy v-else :size="15" />
          </button>
        </div>
        <div class="row" style="gap: 10px">
          <span class="badge">角度模式：{{ degMode ? 'DEG（度）' : 'RAD（弧度）' }}</span>
          <span class="muted small">支持 π e ans ! ^ ( ) 与 sin/cos/tan/asin/acos/atan/log/ln/√；50% 按 0.5，7%3 为取余</span>
        </div>
      </div>

      <div class="pad mt-2">
        <div v-for="(row, ri) in keyRows" :key="ri" class="pad-row">
          <button
            v-for="k in row"
            :key="k.label"
            class="key"
            :class="[k.cls, { fn: /^[a-z]/.test(k.label) }]"
            @click="press(k)"
          >{{ k.label }}</button>
        </div>
      </div>
    </div>

    <div class="sci-side" v-if="history.length">
      <div class="io-head">
        <span class="io-title">历史记录（↑/↓ 回溯）</span>
        <button class="mini-clear" @click="history = []; histIdx = -1"><Delete :size="13" /> 清空</button>
      </div>
      <div class="hist-list">
        <button v-for="(h, i) in history" :key="i" class="hist-row" :title="`插入 ${h.expr}`" :aria-label="`插入 ${h.expr}`" @click="expr = h.expr">
          <span class="mono">{{ h.expr }}</span>
          <span class="mono hist-val">= {{ h.val }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sci-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 860px) {
  .sci-grid { grid-template-columns: 520px 1fr; align-items: stretch; }
}
.sci-side { display: flex; flex-direction: column; min-width: 0; }
.disp { padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); display: grid; gap: 8px; }
.disp-input { font-size: 18px; }
.disp-preview { font-size: 16px; color: var(--text-3); }
.disp-result-row { display: flex; align-items: center; gap: 10px; }
.disp-result { font-size: 20px; color: var(--accent-text); font-weight: 700; }
.copy-btn { border: 1px solid var(--border); background: none; border-radius: 8px; width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer; color: var(--text-3); }
.copy-btn:hover { border-color: var(--accent); color: var(--text); }
.pad { display: grid; gap: 8px; max-width: 520px; }
.pad-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.key { height: 44px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--panel-solid) 65%, transparent); color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.12s ease; }
.key:hover { border-color: var(--accent); background: var(--accent-soft); }
.key.fn { font-size: 13px; color: var(--accent-text); }
.key.wide { grid-column: span 2; font-size: 12.5px; }
.key.accent { background: var(--accent); border-color: var(--accent); color: #fff; }
.io-head { display: flex; align-items: center; justify-content: space-between; }
.io-title { font-size: 13px; font-weight: 600; color: var(--text-2); }
.mini-clear { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; color: var(--text-3); font-size: 12.5px; cursor: pointer; }
.mini-clear:hover { color: var(--err); }
.hist-list { display: grid; gap: 5px; align-content: start; }
.hist-row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: color-mix(in srgb, var(--panel-solid) 45%, transparent); cursor: pointer; text-align: left; color: var(--text); }
.hist-row:hover { border-color: var(--accent); }
.hist-val { color: var(--accent-text); }
</style>
