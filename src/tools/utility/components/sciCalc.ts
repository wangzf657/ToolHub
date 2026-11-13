/**
 * 科学计算器纯计算引擎（组件拆分，保持单文件精简）：
 * 词法（含隐式乘法、% 后缀/取余双语义、ans 变量）→ 调度场 → 逆波兰求值。
 */

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

export interface SciEvalOpts {
  deg: boolean
  ans: number
}

/* ---------- 词法分析（隐式乘法；% 在操作数之间为取余，跟在数后为百分号 /100） ---------- */
function tokenize(src: string, ans: number): Token[] {
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
      if (word !== 'pi' && word !== 'e' && word !== 'ans' && !FUNCS.includes(word)) throw new Error(`无法识别的符号：${word}`)
      if (needMul()) tokens.push({ t: 'op', v: '*' })
      if (word === 'pi' || word === 'e' || word === 'ans') {
        tokens.push({ t: 'const', v: word === 'pi' ? Math.PI : word === 'e' ? Math.E : ans })
      } else {
        tokens.push({ t: 'fn', v: word })
      }
      i = j
      continue
    }
    if (c === '(') {
      if (needMul()) tokens.push({ t: 'op', v: '*' })
      tokens.push({ t: 'lp' })
    } else if (c === ')') tokens.push({ t: 'rp' })
    else if (c === '%') {
      // 后缀百分号：后面不是新操作数（数字/字母/左括号）时按「/100」展开；否则保留二元取余
      const next = s[i + 1]
      const infix = !!next && /[0-9a-zA-Z(]/.test(next)
      if (infix) tokens.push({ t: 'op', v: '%' })
      else {
        tokens.push({ t: 'op', v: '/' })
        tokens.push({ t: 'num', v: 100 })
      }
    } else if ('+-*/^!'.includes(c)) {
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

/** 求值入口：非法输入抛出中文错误（实时预览层静默捕获） */
export function evalExpr(src: string, opts: SciEvalOpts): number {
  const rpn = toRpn(tokenize(src, opts.ans))
  const st: number[] = []
  const D = (v: number) => (opts.deg ? (v * Math.PI) / 180 : v)
  const R = (v: number) => (opts.deg ? (v * 180) / Math.PI : v)
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

/** 结果格式化 */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '∞ 或未定义'
  if (Math.abs(n) < 1e-12) return '0'
  if (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9) return n.toExponential(8)
  return String(parseFloat(n.toFixed(10)))
}
