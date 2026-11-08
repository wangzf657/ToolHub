/**
 * 中国个税与五险一金引擎（纯函数，零依赖）
 * 口径说明：综合所得年度税率表与全年一次性奖金月度税率表依据现行个人所得税法（起征 5000/月，年度 6 万）；
 * 五险一金为各城市常用比例/基数上下限估算口径，每年 7 月前后可能调整，以当地人社局公布为准。
 */

/** 综合所得年度税率表（不含速算扣除数） */
export const ANNUAL_BRACKETS = [
  { limit: 36000, rate: 0.03, quick: 0 },
  { limit: 144000, rate: 0.1, quick: 2520 },
  { limit: 300000, rate: 0.2, quick: 16920 },
  { limit: 420000, rate: 0.25, quick: 31440 },
  { limit: 660000, rate: 0.3, quick: 52920 },
  { limit: 960000, rate: 0.35, quick: 85920 },
  { limit: Infinity, rate: 0.45, quick: 181920 },
]

/** 全年一次性奖金按月换算税率表 */
export const BONUS_BRACKETS = [
  { limit: 36000, rate: 0.03, quick: 0 },
  { limit: 144000, rate: 0.1, quick: 210 },
  { limit: 300000, rate: 0.2, quick: 1410 },
  { limit: 420000, rate: 0.25, quick: 2660 },
  { limit: 660000, rate: 0.3, quick: 4410 },
  { limit: 960000, rate: 0.35, quick: 7160 },
  { limit: Infinity, rate: 0.45, quick: 15160 },
]

function bracketFor(taxable: number, brackets: typeof ANNUAL_BRACKETS) {
  return brackets.find((b) => taxable <= b.limit) ?? brackets[brackets.length - 1]
}

export interface AnnualTaxResult {
  /** 年度应纳税所得额 */
  taxable: number
  /** 年度应纳税额 */
  tax: number
  /** 月均应纳税额 */
  monthlyTax: number
  /** 适用税率 */
  rate: number
  /** 月均税后收入（工资部分，不含年终奖） */
  monthlyNet: number
}

/**
 * 综合所得年度个税：月薪 −5000/月 − 个人五险一金 − 专项附加扣除，累进计算
 */
export function annualIncomeTax(opts: {
  monthlySalary: number
  annualBonus: number
  insuranceMonthly: number
  specialDeductionMonthly: number
}): AnnualTaxResult {
  const { monthlySalary, insuranceMonthly, specialDeductionMonthly } = opts
  // 年终奖单独计税：奖金 ÷ 12 查月度税率表，奖金 × 税率 − 速算扣除数
  const bonusTaxable = Math.max(0, opts.annualBonus)
  const bb = bracketFor(bonusTaxable, BONUS_BRACKETS)
  const bonusTax = bonusTaxable > 0 ? bonusTaxable * bb.rate - bb.quick : 0

  const taxable = Math.max(0, (monthlySalary - 5000 - insuranceMonthly - specialDeductionMonthly) * 12)
  const ab = bracketFor(taxable, ANNUAL_BRACKETS)
  const tax = taxable * ab.rate - ab.quick
  // 到手口径：专项附加扣除只是报税抵扣项（降低应纳税所得额从而少缴税），不是实际支出，
  // 不从工资中减去；它对到手的影响已体现在更低的 tax 中。
  const salaryNetAnnual = monthlySalary * 12 - insuranceMonthly * 12 - tax
  return {
    taxable,
    tax,
    monthlyTax: tax / 12,
    rate: ab.rate,
    monthlyNet: salaryNetAnnual / 12,
  }
}

/** 年终奖单独计税（含临界点陷阱检测） */
export function annualBonusTax(bonus: number): {
  tax: number
  net: number
  rate: number
  /** 奖金落在临界点陷阱区（多发一元到手反而变少）时的提示 */
  trapHint: string
} {
  const b = bracketFor(bonus, BONUS_BRACKETS)
  const tax = bonus * b.rate - b.quick
  const net = bonus - tax
  // 陷阱检测：若奖金恰高于本级下限 threshold，比较“按下限整数发”的到手额
  let trapHint = ''
  const idx = BONUS_BRACKETS.indexOf(b)
  if (idx > 0 && bonus > BONUS_BRACKETS[idx - 1].limit) {
    const threshold = BONUS_BRACKETS[idx - 1].limit
    const netAtThreshold = threshold - (threshold * BONUS_BRACKETS[idx - 1].rate - BONUS_BRACKETS[idx - 1].quick)
    if (net < netAtThreshold) {
      trapHint = `⚠ 临界点陷阱：发放 ${(threshold / 10000).toFixed(1)} 万整（到手 ${Math.round(netAtThreshold).toLocaleString()} 元）比当前发放反而多拿约 ${Math.round(netAtThreshold - net).toLocaleString()} 元`
    }
  }
  return { tax, net, rate: b.rate, trapHint }
}

/** 年终奖六个临界点（超过即跳档） */
export const BONUS_CRITICAL_POINTS = [36000, 144000, 300000, 420000, 660000, 960000]

/* ------------------------------------------------------------------ */
/* 五险一金                                                             */
/* ------------------------------------------------------------------ */

export interface CityInsurance {
  /** 城市 */
  name: string
  /** 缴费基数下限（元/月） */
  floor: number
  /** 缴费基数上限（元/月） */
  ceil: number
  /** 各项比例：[个人, 单位] */
  pension: [number, number]
  medical: [number, number]
  unemployment: [number, number]
  injury: [number, number]
  birth: [number, number]
  /** 公积金默认比例（个人=单位，可在 5%~12% 调整） */
  fund: number
  /** 口径年份备注 */
  year: string
}

/** 主要城市五险一金常量表（估算口径，公积金比例可调） */
export const CITY_INSURANCE: CityInsurance[] = [
  { name: '北京', floor: 6821, ceil: 35283, pension: [8, 16], medical: [2, 9.8], unemployment: [0.5, 0.5], injury: [0, 0.4], birth: [0, 0.8], fund: 12, year: '2024-07 起年度口径' },
  { name: '上海', floor: 7384, ceil: 36921, pension: [8, 16], medical: [2, 9], unemployment: [0.5, 0.5], injury: [0, 0.4], birth: [0, 1], fund: 7, year: '2024-07 起年度口径' },
  { name: '广州', floor: 4588, ceil: 28299, pension: [8, 15], medical: [2, 6.85], unemployment: [0.2, 0.48], injury: [0, 0.3], birth: [0, 0.85], fund: 5, year: '2024 社保年度口径' },
  { name: '深圳', floor: 2360, ceil: 34860, pension: [8, 15], medical: [2, 5], unemployment: [0.3, 0.7], injury: [0, 0.3], birth: [0, 0.45], fund: 5, year: '2024 口径（医疗按二档简化）' },
  { name: '杭州', floor: 4812, ceil: 24930, pension: [8, 16], medical: [2, 9.9], unemployment: [0.5, 0.5], injury: [0, 0.3], birth: [0, 0.6], fund: 12, year: '2024-07 起年度口径' },
  { name: '成都', floor: 4511, ceil: 22555, pension: [8, 16], medical: [2, 6.9], unemployment: [0.4, 0.6], injury: [0, 0.2], birth: [0, 0.8], fund: 6, year: '2024-07 起年度口径' },
  { name: '重庆', floor: 4390, ceil: 21949, pension: [8, 16], medical: [2, 8.5], unemployment: [0.4, 0.5], injury: [0, 0.3], birth: [0, 0.7], fund: 5, year: '2024-07 起年度口径' },
  { name: '南京', floor: 4879, ceil: 24396, pension: [8, 16], medical: [2, 8.8], unemployment: [0.5, 0.5], injury: [0, 0.3], birth: [0, 0.8], fund: 8, year: '2024-07 起年度口径' },
  { name: '武汉', floor: 4796, ceil: 23979, pension: [8, 16], medical: [2, 8], unemployment: [0.3, 0.7], injury: [0, 0.3], birth: [0, 0.7], fund: 8, year: '2024-07 起年度口径' },
  { name: '西安', floor: 4369, ceil: 21846, pension: [8, 16], medical: [2, 8], unemployment: [0.3, 0.7], injury: [0, 0.3], birth: [0, 0.5], fund: 8, year: '2024-07 起年度口径' },
  { name: '苏州', floor: 4879, ceil: 24396, pension: [8, 16], medical: [2, 7], unemployment: [0.5, 0.5], injury: [0, 0.4], birth: [0, 0.8], fund: 8, year: '2024-07 起年度口径' },
  { name: '天津', floor: 5013, ceil: 25065, pension: [8, 16], medical: [2, 10], unemployment: [0.3, 0.5], injury: [0, 0.4], birth: [0, 0.8], fund: 11, year: '2024-07 起年度口径' },
]

export interface InsuranceResult {
  /** 个人缴纳明细：[养老, 医疗, 失业, 公积金] */
  personal: { pension: number; medical: number; unemployment: number; fund: number }
  /** 单位缴纳明细：[养老, 医疗, 失业, 工伤, 生育, 公积金] */
  company: { pension: number; medical: number; unemployment: number; injury: number; birth: number; fund: number }
  /** 实际计费基数（夹在上下限之间） */
  base: number
  personalTotal: number
  companyTotal: number
  city: CityInsurance
}

const clampBase = (salary: number, c: CityInsurance) => Math.min(Math.max(salary, c.floor), c.ceil)

/** 五险一金计算：按城市常量表 + 公积金比例（个人=单位） */
export function computeInsurance(salary: number, city: CityInsurance, fundRate: number): InsuranceResult {
  const base = clampBase(salary, city)
  const pct = (r: number) => (base * r) / 100
  const fr = Math.min(12, Math.max(5, fundRate))
  const personal = {
    pension: pct(city.pension[0]),
    medical: pct(city.medical[0]),
    unemployment: pct(city.unemployment[0]),
    fund: pct(fr),
  }
  const company = {
    pension: pct(city.pension[1]),
    medical: pct(city.medical[1]),
    unemployment: pct(city.unemployment[1]),
    injury: pct(city.injury[1]),
    birth: pct(city.birth[1]),
    fund: pct(fr),
  }
  return {
    personal,
    company,
    base,
    personalTotal: personal.pension + personal.medical + personal.unemployment + personal.fund,
    companyTotal: company.pension + company.medical + company.unemployment + company.injury + company.birth + company.fund,
    city,
  }
}

const money = (n: number): string => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
