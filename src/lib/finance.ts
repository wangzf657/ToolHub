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
