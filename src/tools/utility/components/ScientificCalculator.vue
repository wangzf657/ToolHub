<script setup lang="ts">
import { ref } from 'vue'
import { Delete } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'const'; v: number }
  | { t: 'lp' }
  | { t: 'rp' }

const FUNCS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'abs']
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u-': 4, '^': 3 }
const RIGHT = new Set(['u-', '^'])

/* ---------- 词法分析（含隐式乘法：2π、3(1+2)、)( 等） ---------- */
function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'PI').replace(/√/g, 'sqrt')
  let i = 0
  const needMul = () => {
    const p = tokens[tokens.length - 1]
    return !!p && (p.t === 'num' || p.t === 'const' || p.t === 'rp')
  }
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const str = s.slice(i, j)
      if ((str.match(/\./g) ?? []).length > 1) throw new Error('数字格式错误')
      if (needMul()) tokens.push({ t: 'op', v: '*' })
      tokens.push({ t: 'num', v: parseFloat(str) })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const word = s.slice(i, j).toLowerCase()
      if (word !== 'pi' && word !== 'e' && !FUNCS.includes(word)) throw new Error(`无法识别的符号：${word}`)
      if (needMul()) tokens.push({ t: 'op', v: '*' })
      tokens.push(word === 'pi' || word === 'e' ? { t: 'const', v: word === 'pi' ? Math.PI : Math.E } : { t: 'fn', v: word })
      i = j
      continue
    }
    if (c === '(') {
      if (needMul()) tokens.push({ t: 'op', v: '*' })
      tokens.push({ t: 'lp' })
    } else if (c === ')') tokens.push({ t: 'rp' })
    else if ('+-*/%^!'.includes(c)) {
      if (c === '!') tokens.push({ t: 'op', v: '!' })
      else {
        const p = tokens[tokens.length - 1]
        const unary = c === '-' && (!p || p.t === 'op' || p.t === 'fn' || p.t === 'lp')
        tokens.push({ t: 'op', v: unary ? 'u-' : c })
      }
    } else throw new Error(`无法识别的字符：${c}`)
    i++
  }
  return tokens
}

/* ---------- 调度场算法 → 逆波兰 ---------- */
function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = []
  const stack: Token[] = []
  for (const tk of tokens) {
    if (tk.t === 'num' || tk.t === 'const') out.push(tk)
    else if (tk.t === 'fn') stack.push(tk)
    else if (tk.t === 'op') {
      if (tk.v === '!') { out.push(tk); continue }
      while (stack.length) {
        const top = stack[stack.length - 1]
        const pop = top.t === 'fn' || (top.t === 'op' && top.v !== '!' && (PREC[top.v] > PREC[tk.v] || (PREC[top.v] === PREC[tk.v] && !RIGHT.has(tk.v))))
        if (!pop) break
        out.push(stack.pop()!)
      }
      stack.push(tk)
    } else if (tk.t === 'lp') stack.push(tk)
    else {
      let matched = false
      while (stack.length) {
        const top = stack.pop()!
        if (top.t === 'lp') { matched = true; break }
        out.push(top)
      }
      if (!matched) throw new Error('括号不匹配')
      if (stack.length && stack[stack.length - 1].t === 'fn') out.push(stack.pop()!)
    }
  }
  while (stack.length) {
    const top = stack.pop()!
    if (top.t === 'lp') throw new Error('括号不匹配')
    out.push(top)
  }
  return out
}

const fact = (n: number): number => {
  if (n < 0 || !Number.isInteger(n)) throw new Error('阶乘仅支持非负整数')
  if (n > 170) throw new Error('阶乘结果超出范围（最大 170!）')
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

const BIN: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => { if (b === 0) throw new Error('除数不能为 0'); return a / b },
  '%': (a, b) => a % b,
  '^': (a, b) => a ** b,
}

function evalRpn(rpn: Token[]): number {
  const st: number[] = []
  const D = (v: number) => (degMode.value ? (v * Math.PI) / 180 : v)
  const R = (v: number) => (degMode.value ? (v * 180) / Math.PI : v)
  const UN: Record<string, (x: number) => number> = {
    sin: (x) => Math.sin(D(x)),
    cos: (x) => Math.cos(D(x)),
    tan: (x) => Math.tan(D(x)),
    asin: (x) => { if (x < -1 || x > 1) throw new Error('asin 定义域为 [-1,1]'); return R(Math.asin(x)) },
    acos: (x) => { if (x < -1 || x > 1) throw new Error('acos 定义域为 [-1,1]'); return R(Math.acos(x)) },
    atan: (x) => R(Math.atan(x)),
    log: (x) => { if (x <= 0) throw new Error('log 定义域为正数'); return Math.log10(x) },
    ln: (x) => { if (x <= 0) throw new Error('ln 定义域为正数'); return Math.log(x) },
    sqrt: (x) => { if (x < 0) throw new Error('sqrt 定义域为非负数'); return Math.sqrt(x) },
    abs: (x) => Math.abs(x),
  }
  for (const tk of rpn) {
    if (tk.t === 'num' || tk.t === 'const') { st.push(tk.v); continue }
    if (tk.t === 'fn') {
      const x = st.pop()
      if (x === undefined) throw new Error('表达式不完整')
      st.push(UN[tk.v](x))
      continue
    }
    const v = 'v' in tk ? (tk.v as string) : ''
    if (v === 'u-') {
      const x = st.pop()
      if (x === undefined) throw new Error('表达式不完整')
      st.push(-x)
      continue
    }
    if (v === '!') {
      const x = st.pop()
      if (x === undefined) throw new Error('表达式不完整')
      st.push(fact(x))
      continue
    }
    const b = st.pop()
    const a = st.pop()
    if (a === undefined || b === undefined) throw new Error('表达式不完整')
    st.push(BIN[v](a, b))
  }
  if (st.length !== 1) throw new Error('表达式不完整')
  return st[0]
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '∞ 或未定义'
  if (Math.abs(n) < 1e-12) return '0'
  if (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9) return n.toExponential(8)
  return String(parseFloat(n.toFixed(10)))
}

const expr = ref('')
const result = ref('')
const degMode = ref(true)
const history = ref<{ expr: string; val: string }[]>([])

const evaluate = () => {
  const src = expr.value.trim()
  if (!src) return
  try {
    const out = fmt(evalRpn(toRpn(tokenize(src))))
    result.value = `${src} = ${out}`
    history.value = [{ expr: src, val: out }, ...history.value].slice(0, 12)
  } catch (e) {
    result.value = ''
    toast.err((e as Error).message || '表达式错误')
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
  if (k.act === 'clear') { expr.value = ''; result.value = ''; return }
  if (k.act === 'back') { expr.value = expr.value.slice(0, -1); return }
  if (k.act === 'deg') { degMode.value = !degMode.value; return }
  expr.value += k.insert ?? k.label
}
</script>

<template>
  <div>
    <div class="disp">
      <input v-model="expr" class="input mono disp-input" placeholder="输入表达式，如 sin(30)+2^10 或 5!" @keydown.enter="evaluate" />
      <div v-if="result" class="disp-result mono">{{ result }}</div>
      <div class="row" style="gap: 10px">
        <span class="badge">角度模式：{{ degMode ? 'DEG（度）' : 'RAD（弧度）' }}</span>
        <span class="muted small">支持 π e ! ^ ( ) 与 sin/cos/tan/asin/acos/atan/log/ln/√，回车求值</span>
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

    <div v-if="history.length" class="mt-2">
      <div class="io-head">
        <span class="io-title">历史记录</span>
        <button class="mini-clear" @click="history = []"><Delete :size="13" /> 清空</button>
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
.disp { padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); display: grid; gap: 8px; }
.disp-input { font-size: 18px; }
.disp-result { font-size: 20px; color: var(--accent-text); font-weight: 700; }
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
.hist-list { display: grid; gap: 5px; max-width: 520px; }
.hist-row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: color-mix(in srgb, var(--panel-solid) 45%, transparent); cursor: pointer; text-align: left; color: var(--text); }
.hist-row:hover { border-color: var(--accent); }
.hist-val { color: var(--accent-text); }
</style>
