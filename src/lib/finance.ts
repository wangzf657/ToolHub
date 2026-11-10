/** 金融与交易计算纯函数（全部原创实现） */

const SQRT2PI = Math.sqrt(2 * Math.PI)

function normCdf(x: number): number {
  // Abramowitz-Stegun 近似
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly =
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const cdf = 1 - (Math.exp(-0.5 * x * x) / SQRT2PI) * poly
  return x >= 0 ? cdf : 1 - cdf
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT2PI
}

export interface BsResult {
  call: number
  put: number
  deltaCall: number
  deltaPut: number
  gamma: number
  thetaCall: number
  vega: number
  rhoCall: number
  d1: number
  d2: number
}

/** Black-Scholes-Merton 定价与希腊字母 */
export function blackScholes(
  spot: number,
  strike: number,
  years: number,
  rate: number, // 年化，小数
  vol: number, // 年化，小数
  dividendYield = 0,
): BsResult {
  const sqrtT = Math.sqrt(years)
  const d1 =
    (Math.log(spot / strike) + (rate - dividendYield + 0.5 * vol * vol) * years) / (vol * sqrtT)
  const d2 = d1 - vol * sqrtT
  const discR = Math.exp(-rate * years)
  const discQ = Math.exp(-dividendYield * years)
  const call = spot * discQ * normCdf(d1) - strike * discR * normCdf(d2)
  const put = strike * discR * normCdf(-d2) - spot * discQ * normCdf(-d1)
  const deltaCall = discQ * normCdf(d1)
  const deltaPut = discQ * (normCdf(d1) - 1)
  const gamma = (discQ * normPdf(d1)) / (spot * vol * sqrtT)
  const thetaCall =
    (-spot * discQ * normPdf(d1) * vol) / (2 * sqrtT) -
    rate * strike * discR * normCdf(d2) +
    dividendYield * spot * discQ * normCdf(d1)
  const vega = (spot * discQ * normPdf(d1) * sqrtT) / 100
  const rhoCall = (strike * years * discR * normCdf(d2)) / 100
  return { call, put, deltaCall, deltaPut, gamma, thetaCall: thetaCall / 365, vega, rhoCall, d1, d2 }
}

/** 隐含波动率（牛顿迭代） */
export function impliedVol(
  price: number,
  spot: number,
  strike: number,
  years: number,
  rate: number,
  isCall = true,
): number | null {
  let vol = 0.5
  for (let i = 0; i < 60; i++) {
    const r = blackScholes(spot, strike, years, rate, vol)
    const p = isCall ? r.call : r.put
    const diff = p - price
    if (Math.abs(diff) < 1e-6) return vol
    const vega = r.vega * 100
    if (Math.abs(vega) < 1e-10) return null
    vol -= diff / vega
    if (vol <= 0) vol = 0.0001
    if (vol > 10) return null
  }
  return Math.abs(blackScholes(spot, strike, years, rate, vol)[isCall ? 'call' : 'put'] - price) < 0.01 ? vol : null
}

/** 等额本息月供 */
export function loanPayment(principal: number, annualRate: number, years: number): { monthly: number; totalInterest: number; total: number } {
  const n = Math.round(years * 12)
  const r = annualRate / 100 / 12
  const monthly = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return { monthly, totalInterest: monthly * n - principal, total: monthly * n }
}

export function compoundInterest(
  principal: number,
  annualRate: number,
  years: number,
  perYear: number,
  monthlyAdd = 0,
): { final: number; interest: number; schedule: { year: number; value: number }[] } {
  const schedule: { year: number; value: number }[] = []
  let value = principal
  const r = annualRate / 100 / perYear
  const monthsPerPeriod = 12 / perYear
  let monthAddRemaining = monthlyAdd
  for (let y = 1; y <= Math.ceil(years); y++) {
    for (let p = 0; p < perYear && (y - 1) * perYear + p < years * perYear; p++) {
      value = value * (1 + r) + monthAddRemaining * monthsPerPeriod
    }
    schedule.push({ year: y, value })
  }
  const contributed = principal + monthlyAdd * 12 * years
  return { final: value, interest: value - contributed, schedule }
}

export function cagr(begin: number, end: number, years: number): number {
  if (begin <= 0 || years <= 0) return 0
  return (Math.pow(end / begin, 1 / years) - 1) * 100
}

/** 凯利公式 */
export function kelly(winProb: number, winLossRatio: number): { full: number; half: number; quarter: number } {
  const b = winLossRatio
  const p = winProb
  const q = 1 - p
  const full = (p * b - q) / b
  return {
    full: full * 100,
    half: full * 50,
    quarter: full * 25,
  }
}

/** 债券到期收益率（牛顿迭代） */
export function bondYtm(
  price: number,
  par: number,
  couponRate: number,
  years: number,
  freq = 2,
): { ytm: number; currentYield: number; effectiveAnnual: number } {
  const n = Math.round(years * freq)
  const c = (par * couponRate) / 100 / freq
  let y = couponRate / 100
  const pv = (y: number) => {
    let v = 0
    for (let i = 1; i <= n; i++) v += c / Math.pow(1 + y / freq, i)
    v += par / Math.pow(1 + y / freq, n)
    return v
  }
  for (let i = 0; i < 80; i++) {
    const p = pv(y)
    const diff = p - price
    if (Math.abs(diff) < 1e-8) break
    const h = 1e-6
    const dp = (pv(y + h) - pv(y - h)) / (2 * h)
    if (Math.abs(dp) < 1e-10) break
    y -= diff / dp
    if (y < 0) y = 1e-6
  }
  const currentYield = (par * couponRate) / 100 / price * 100
  const effectiveAnnual = (Math.pow(1 + y / freq, freq) - 1) * 100
  return { ytm: y * 100, currentYield, effectiveAnnual }
}

/** 夏普/索提诺比率 */
export function sharpeSortino(returns: number[], riskFree = 0): { mean: number; std: number; downside: number; sharpe: number; sortino: number } {
  const n = returns.length
  if (n === 0) return { mean: 0, std: 0, downside: 0, sharpe: 0, sortino: 0 }
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)
  const std = Math.sqrt(variance)
  const downsideVar = returns.reduce((a, b) => a + Math.min(0, b - riskFree) ** 2, 0) / Math.max(1, n - 1)
  const downside = Math.sqrt(downsideVar)
  const perPeriodSharpe = std > 0 ? (mean - riskFree) / std : 0
  const perPeriodSortino = downside > 0 ? (mean - riskFree) / downside : 0
  const annual = Math.sqrt(252) // 假设日度收益；调用方可自行换算
  return {
    mean,
    std,
    downside,
    sharpe: perPeriodSharpe,
    sortino: perPeriodSortino,
  }
}

export function formatMoney(n: number, digits = 2): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 现金流内部收益率 IRR（牛顿迭代 + 二分兜底），flows[0] 通常是期初投入（负数） */
export function irr(flows: number[]): number | null {
  if (flows.length < 2) return null
  const hasPos = flows.some((v) => v > 0)
  const hasNeg = flows.some((v) => v < 0)
  if (!hasPos || !hasNeg) return null
  const f = (rate: number) => flows.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i), 0)
  // 先试牛顿迭代
  let r = 0.1
  for (let i = 0; i < 100; i++) {
    const val = f(r)
    if (Math.abs(val) < 1e-7) return r
    const h = 1e-7
    const d = (f(r + h) - f(r - h)) / (2 * h)
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) break
    r -= val / d
    if (r <= -0.9999) r = -0.9999
  }
  // 二分兜底：在 (-0.9999, 10) 中找符号变化区间
  let lo = -0.9999
  let hi = 10
  const flo = f(lo)
  const fhi = f(hi)
  if (flo === 0) return lo
  if (fhi === 0) return hi
  if (flo * fhi > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (Math.abs(fm) < 1e-7) return mid
    if (flo * fm < 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** 净现值 NPV（rate 为每期折现率小数，flows 期末发生） */
export function npv(rate: number, flows: number[]): number {
  return flows.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i), 0)
}

/** 修正内部收益率 MIRR（financeRate/reinvestRate 为每期小数） */
export function mirr(flows: number[], financeRate: number, reinvestRate: number): number | null {
  const n = flows.length
  if (n < 2) return null
  let negPv = 0
  let posFv = 0
  flows.forEach((v, i) => {
    if (v < 0) negPv += v / Math.pow(1 + financeRate, i)
    else posFv += v * Math.pow(1 + reinvestRate, n - 1 - i)
  })
  if (negPv === 0 || posFv === 0) return null
  return Math.pow(posFv / -negPv, 1 / (n - 1)) - 1
}

/** 信用卡分期真实年化：每期手续费、本金等额摊还（总手续费/总本金口径） */
export function installmentIrr(
  principal: number,
  months: number,
  monthlyFeePercent: number,
): { monthlyPayment: number; totalFee: number; nominalRate: number; realIrr: number | null } {
  const fee = (principal * monthlyFeePercent) / 100
  const monthlyPayment = principal / months + fee
  const flows = [-principal]
  for (let i = 0; i < months; i++) flows.push(monthlyPayment)
  const monthlyIrr = irr(flows)
  const realIrr = monthlyIrr === null ? null : (Math.pow(1 + monthlyIrr, 12) - 1) * 100
  return {
    monthlyPayment,
    totalFee: fee * months,
    nominalRate: monthlyFeePercent * 12,
    realIrr,
  }
}

export interface AmortRow {
  month: number
  payment: number // 当月还款额
  interest: number
  principal: number
  balance: number // 还款后剩余本金
}

export interface AmortResult {
  monthly: number // 等额本息月供；等额本金为首月月供
  rows: AmortRow[]
  totalInterest: number
  total: number
  months: number
}

/** 房贷逐月计划表。mode: 'axbx' 等额本息 | 'axbj' 等额本金；prepay 在第 month 期额外还 amount */
export function amortize(
  principal: number,
  annualRatePercent: number,
  months: number,
  mode: 'axbx' | 'axbj',
  prepay?: { month: number; amount: number },
): AmortResult {
  const r = annualRatePercent / 100 / 12
  const rows: AmortRow[] = []
  let balance = principal
  let monthly = 0
  let monthlyPrincipal = 0
  if (mode === 'axbx') {
    monthly =
      r === 0
        ? principal / months
        : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  } else {
    monthlyPrincipal = principal / months
  }
  let totalInterest = 0
  let total = 0
  let remaining = months
  for (let m = 1; m <= months && balance > 0.005; m++) {
    const interest = balance * r
    let principalPart = mode === 'axbx' ? monthly - interest : monthlyPrincipal
    if (principalPart > balance) principalPart = balance
    let pay = principalPart + interest
    let extra = 0
    if (prepay && prepay.month === m && prepay.amount > 0) {
      extra = Math.min(prepay.amount, balance - principalPart)
      balance -= extra
      remaining = m // 剩余期数从下月起重算
      const rest = months - m
      if (balance > 0 && rest > 0) {
        if (mode === 'axbx') {
          monthly =
            r === 0
              ? balance / rest
              : (balance * r * Math.pow(1 + r, rest)) / (Math.pow(1 + r, rest) - 1)
        } else {
          monthlyPrincipal = balance / rest
        }
      }
    }
    balance -= principalPart
    totalInterest += interest
    total += pay
    rows.push({ month: m, payment: pay, interest, principal: principalPart, balance: Math.max(0, balance) })
  }
  return {
    monthly,
    rows,
    totalInterest,
    total,
    months: rows.length,
  }
}
