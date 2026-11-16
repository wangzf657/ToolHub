import type { ToolDef, CalcFieldDef, CalcResultRow } from '@/types'
import { blackScholes, kelly, cagr, bondYtm, formatMoney, installmentIrr, amortize } from '@/lib/finance'

const F = (k: string, label: string, extra: Partial<CalcFieldDef> = {}): CalcFieldDef => ({
  key: k, label, type: 'number', default: '', ...extra,
})

const money = (n: number) => formatMoney(n)

/** 金融交易工具注册表（20 项） */
const tools: ToolDef[] = [
  {
    slug: 'installment-rate-calculator', title: '信用卡分期年化计算器', category: 'finance',
    desc: '按期手续费率换算真实年化利率（IRR），看清 0.6%×12 期 ≈ 13% 的真相。',
    keywords: ['分期', '信用卡', '年化', '手续费', 'IRR'],
    calcDef: {
      fields: [
        { key: 'principal', label: '分期本金', type: 'number', default: 10000, suffix: '元' },
        { key: 'months', label: '期数', type: 'select', default: '12', choices: [
          { value: '3', label: '3 期' }, { value: '6', label: '6 期' }, { value: '12', label: '12 期' },
          { value: '18', label: '18 期' }, { value: '24', label: '24 期' }, { value: '36', label: '36 期' },
        ] },
        { key: 'feeRate', label: '每期手续费率', type: 'number', default: 0.6, suffix: '%', step: 0.01 },
        { key: 'feeMode', label: '计费方式', type: 'select', default: 'per', choices: [{ value: 'per', label: '每期手续费（常见）' }, { value: 'once', label: '一次性手续费' }] },
        { key: 'settleAt', label: '第 N 期提前结清（可选）', type: 'number', default: '', step: 1, min: 1 },
      ],
      compute: (v) => {
        const principal = Number(v.principal), months = Number(v.months), feeRate = Number(v.feeRate)
        if (!(principal > 0) || !(months > 0) || !(feeRate >= 0)) return [{ label: '请填写分期本金与费率', value: '—' }]
        const m = (x: number) => money(x)
        const perFee = (principal * feeRate) / 100
        /** 一次性手续费口径的真实年化：到手本金 = 本金 − 全期手续费，每期还本金均摊 */
        const irrOnce = (): number | null => {
          const totalFee = perFee * months
          const netIn = principal - totalFee
          const pay = principal / months
          let lo = 0
          let hi = 5
          const pv = (i: number) => pay * (1 - Math.pow(1 + i, -months)) / i
          if (pv(lo) <= netIn) return 0
          if (pv(hi) > netIn) return null
          for (let k = 0; k < 80; k++) {
            const mid = (lo + hi) / 2
            if (pv(mid) > netIn) lo = mid
            else hi = mid
          }
          return ((lo + hi) / 2) * 100 * 12
        }
        const compare = [3, 6, 12, 24].map((mm) => {
          if (mm === months) return { mm, irr: v.feeMode === 'once' ? irrOnce() : installmentIrr(principal, mm, feeRate).realIrr }
          const r2 = installmentIrr(principal, mm, feeRate)
          return { mm, irr: r2.realIrr }
        })
        const compareText = compare.filter((c) => c.irr !== null).map((c) => `${c.mm} 期 ${money(c.irr as number)}%`).join(' · ')
        if (v.feeMode === 'once') {
          const irr = irrOnce()
          const rows: CalcResultRow[] = [
            { label: '手续费总额（一次性）', value: `¥${m(perFee * months)}`, hint: `每期手续费 ¥${m(perFee)} × ${months} 期，首期一次性收取` },
            { label: '每期还款额（本金均摊）', value: `¥${m(principal / months)}` },
            { label: '名义年化费率', value: `${money(feeRate * 12)}%`, hint: '每期费率 × 12' },
            { label: '真实年化利率（IRR）', value: irr === null ? '—' : `${money(irr)}%`, primary: true, tone: irr !== null && irr >= 16 ? 'warn' : undefined, hint: '到手本金扣除全部手续费后逐期偿还折算' },
          ]
          if (compareText) rows.push({ label: '同本金各期数真实年化', value: compareText, hint: '同费率下期数越长真实年化越高' })
          return rows
        }
        const r = installmentIrr(principal, months, feeRate)
        const rows: CalcResultRow[] = [
          { label: '每期还款额', value: `¥${m(r.monthlyPayment)}`, hint: `每期手续费 ¥${m(perFee)}（不随本金递减）` },
          { label: '手续费总额', value: `¥${m(r.totalFee)}` },
          { label: '名义年化费率', value: `${money(r.nominalRate)}%`, hint: '每期费率 × 12' },
          { label: '真实年化利率（IRR）', value: r.realIrr === null ? '—' : `${money(r.realIrr)}%`, primary: true, tone: r.realIrr !== null && r.realIrr >= 16 ? 'warn' : undefined, hint: r.realIrr !== null && r.realIrr >= 16 ? '⚠ 高于多数信用贷年化（≥16%），建议对比银行消费贷后再决定' : '按资金实际占用折算，通常显著高于名义费率' },
        ]
        if (compareText) rows.push({ label: '同本金各期数真实年化', value: compareText, hint: '同费率下 IRR 随期数递减' })
        const settle = Number(v.settleAt)
        if (settle >= 1 && settle < months && r.realIrr !== null) {
          // 剩余手续费照收口径：结清时已付手续费 + 剩余手续费仍计入
          const paidFee = perFee * settle
          const remainFee = perFee * (months - settle)
          rows.push({ label: `第 ${settle} 期提前结清`, value: `已付手续费 ¥${m(paidFee)} + 剩余 ¥${m(remainFee)} 照收`, hint: `剩余本金 ¥${m(principal - (principal / months) * settle)} 需一次结清；多数银行剩余手续费照收或按规则减免，以合同为准——提前结清的实际年化通常不低于全程持有` })
        }
        return rows
      },
      note: '口径：手续费按全额计收、本金按月等额摊还，用 IRR（牛顿迭代+二分）求内部收益率并年化；一次性手续费口径 = 到手本金扣除全期手续费后按本金均摊偿还；提前结清按「剩余手续费照收」估算，各银行政策差异以合同为准。',
      links: [
        { label: '把这笔手续费定投会怎样', to: '/t/sip-calculator', query: (v) => ({ monthly: String((Number(v.principal) * Number(v.feeRate)) / 100 || '') }) },
      ],
    },
  },
  {
    slug: 'auto-loan-calculator', title: '车贷计算器', category: 'finance',
    desc: '车辆消费贷等额本息/等额本金月供对比，利息总额与提前还款参考。',
    keywords: ['车贷', '汽车贷款', '月供', '购车'],
    calcDef: {
      fields: [
        { key: 'loan', label: '贷款金额', type: 'number', default: '', suffix: '元' },
        { key: 'r', label: '年利率', type: 'number', default: 4.5, suffix: '%', step: 0.01 },
        { key: 'months', label: '期限', type: 'select', default: '36', choices: [
          { value: '12', label: '1 年（12 期）' }, { value: '24', label: '2 年（24 期）' }, { value: '36', label: '3 年（36 期）' },
          { value: '48', label: '4 年（48 期）' }, { value: '60', label: '5 年（60 期）' },
        ] },
        { key: 'mode', label: '还款方式', type: 'select', default: 'axbx', choices: [
          { value: 'axbx', label: '等额本息（月供固定）' }, { value: 'axbj', label: '等额本金（月供递减）' },
        ] },
        { key: 'downPct', label: '首付比例', type: 'number', default: 30, suffix: '%', step: 1, hint: '车价参考 = 贷款金额 ÷（1 − 首付比例）' },
        { key: 'extraFee', label: 'GPS/金融服务费等杂费（合计，可选）', type: 'number', default: 0, suffix: '元', step: 100 },
        { key: 'zeroFee', label: '厂商贴息：每期手续费率（可选，对比 0 息方案）', type: 'number', default: 0, suffix: '%', step: 0.01 },
        { key: 'prepayAt', label: '第 N 期提前还（可选）', type: 'number', default: '', step: 1, min: 1 },
        { key: 'prepayAmt', label: '提前还款金额（元，可选）', type: 'number', default: 0, step: 1000 },
      ],
      compute: (v) => {
        const loan = Number(v.loan), r = Number(v.r), months = Math.round(Number(v.months))
        if (!(loan > 0) || !(r >= 0) || !(months > 0)) return [{ label: '请填写贷款金额', value: '—' }]
        const res = amortize(loan, r, months, v.mode === 'axbj' ? 'axbj' : 'axbx')
        const resOther = amortize(loan, r, months, v.mode === 'axbj' ? 'axbx' : 'axbj')
        const m = (x: number) => money(x)
        const first = res.rows[0]?.payment ?? 0
        const last = res.rows[res.rows.length - 1]?.payment ?? 0
        // 直调/预填缺省时兑现字段声明的默认首付比例 30%（表单路径恒有值，此分支仅程序化调用受益）
        const downPct = Math.min(90, Math.max(0, v.downPct === undefined || v.downPct === '' ? 30 : Number(v.downPct) || 0))
        const extraFee = Math.max(0, Number(v.extraFee) || 0)
        const rows: CalcResultRow[] = v.mode === 'axbj'
          ? [
              { label: '首月月供', value: '¥' + m(first), primary: true, hint: '末月递减至 ¥' + m(last) },
              { label: '每月递减', value: '¥' + m(first && last ? (first - last) / Math.max(1, months - 1) : 0) },
              { label: '利息总额', value: '¥' + m(res.totalInterest), hint: `对比等额本息利息 ¥${m(resOther.totalInterest)}（差 ¥${m(Math.abs(resOther.totalInterest - res.totalInterest))}）` },
              { label: '本息合计', value: '¥' + m(res.total) },
            ]
          : [
              { label: '每月月供', value: '¥' + m(res.monthly), primary: true },
              { label: '利息总额', value: '¥' + m(res.totalInterest), hint: `对比等额本金利息 ¥${m(resOther.totalInterest)}（差 ¥${m(Math.abs(resOther.totalInterest - res.totalInterest))}）` },
              { label: '本息合计', value: '¥' + m(res.total) },
            ]
        rows.push({ label: '车价参考', value: '¥' + m(loan / (1 - downPct / 100)), hint: `首付 ${downPct}% 时对应的全款车价` })
        if (extraFee > 0) {
          rows.push({ label: '贷款总成本（含杂费）', value: '¥' + m(res.total + extraFee), hint: `本息合计 ¥${m(res.total)} + 杂费 ¥${m(extraFee)}` })
        }
        const zeroFee = Number(v.zeroFee) || 0
        if (zeroFee > 0) {
          const zf = installmentIrr(loan, months, zeroFee)
          rows.push({ label: '0 息方案对比（每期手续费）', value: zf.realIrr === null ? '—' : `真实年化 ${m(zf.realIrr)}% · 利息（手续费）¥${m(zf.totalFee)}`, hint: `与利率方案利息差 ¥${m(Math.abs(res.totalInterest - zf.totalFee))}；「0 息」话术常以手续费回收成本` })
        }
        const prepayAt = Number(v.prepayAt), prepayAmt = Number(v.prepayAmt) || 0
        if (prepayAt >= 1 && prepayAt < months && prepayAmt > 0) {
          // 引擎原生提前还款口径：期限不变、剩余本金重排月供
          const resPre = amortize(loan, r, months, v.mode === 'axbj' ? 'axbj' : 'axbx', { month: Math.floor(prepayAt), amount: prepayAmt })
          const saved = res.totalInterest - resPre.totalInterest
          rows.push({ label: `第 ${Math.floor(prepayAt)} 期提前还 ${m(prepayAmt)} 元`, value: `新月供 ¥${m(resPre.monthly)} · 省息约 ¥${m(Math.max(0, saved))}`, hint: '期限不变口径：剩余本金重排月供；实际以银行结清试算为准' })
        }
        return rows
      },
      note: '口径：等额本息月供固定、等额本金每月本金相同；提前还款按「期限不变、剩余本金重排月供」估算；0 息对比用分期 IRR 口径；未计入上牌抵押费等未列杂费；利率以合同为准。',
      links: [
        { label: '查看逐期还款明细', to: '/t/amortization-calculator', query: (v) => ({ p: String(v.loan ?? ''), r: String(v.r ?? ''), y: String(Math.round(Number(v.months) / 12) || '') }) },
      ],
    },
  },
  {
    slug: 'renovation-loan-calculator', title: '装修贷计算器', category: 'finance',
    desc: '普通利率贷款与「按期手续费」装修贷双模式，看清真实年化利率。',
    keywords: ['装修贷', '家装贷款', '分期', '手续费'],
    calcDef: {
      fields: [
        { key: 'mode', label: '计息模式', type: 'select', default: 'rate', choices: [
          { value: 'rate', label: '普通利率贷款' }, { value: 'fee', label: '按期手续费（免息话术）' },
        ] },
        { key: 'loan', label: '贷款金额', type: 'number', default: '', suffix: '元' },
        { key: 'r', label: '年利率（普通模式）', type: 'number', default: 3.6, suffix: '%', step: 0.01, hint: '仅普通利率模式使用；手续费模式忽略此值' },
        { key: 'feeRate', label: '每期手续费率（手续费模式）', type: 'number', default: 0.33, suffix: '%', step: 0.01, hint: '仅手续费模式使用；普通利率模式忽略此值' },
        { key: 'months', label: '期限', type: 'select', default: '36', choices: [
          { value: '12', label: '1 年' }, { value: '24', label: '2 年' }, { value: '36', label: '3 年' }, { value: '60', label: '5 年' },
        ] },
        { key: 'monthlyIncome', label: '月收入（可选，额度参考）', type: 'number', default: 0, suffix: '元', step: 1000 },
      ],
      compute: (v) => {
        const loan = Number(v.loan), months = Math.round(Number(v.months))
        const inc = Number(v.monthlyIncome) || 0
        if (!(loan > 0) || !(months > 0)) return [{ label: '请填写贷款金额', value: '—' }]
        const m = (x: number) => money(x)
        // 缺省时兑现字段默认费率 0.33%/期（普通模式对比行的口径基准）
        const feeRate = v.feeRate === undefined || v.feeRate === '' ? 0.33 : Number(v.feeRate) || 0
        if (v.mode === 'fee') {
          const r = installmentIrr(loan, months, feeRate)
          const rows: CalcResultRow[] = [
            { label: '每期还款额', value: '¥' + m(r.monthlyPayment), primary: true, hint: '本金均摊 + 全额计费的手续费' },
            { label: '手续费总额', value: '¥' + m(r.totalFee) },
            { label: '名义年化费率', value: money(r.nominalRate) + '%' },
            { label: '真实年化利率（IRR）', value: r.realIrr === null ? '—' : money(r.realIrr) + '%', hint: '资金逐月占用折算，通常远高于「宣传费率×12」' },
          ]
          rows.push({ label: '额度参考', value: inc > 0 ? `月收入 ${m(inc)} → 常见银行口径可贷约 ${m(inc * 12)}~${m(inc * 18)}` : '—', hint: '按月收入 12~18 倍估算，仅为参考口径、非承诺额度；以银行审批为准' })
          return rows
        }
        const res = amortize(loan, Number(v.r), months, 'axbx')
        const rows: CalcResultRow[] = [
          { label: '每月月供', value: '¥' + m(res.monthly), primary: true },
          { label: '利息总额', value: '¥' + m(res.totalInterest) },
          { label: '本息合计', value: '¥' + m(res.total) },
          { label: `对比：${feeRate}%/期手续费在同期限下的真实年化`, value: (() => { const f = installmentIrr(loan, months, feeRate); return f.realIrr === null ? '—' : money(f.realIrr) + '%' })(), hint: `按当前手续费率 ${feeRate}% 计算对比，判断「手续费模式」是否比利率模式更贵` },
        ]
        rows.push({ label: '额度参考', value: inc > 0 ? `月收入 ${m(inc)} → 常见银行口径可贷约 ${m(inc * 12)}~${m(inc * 18)}` : '—', hint: '按月收入 12~18 倍估算，仅为参考口径、非承诺额度；以银行审批为准' })
        return rows
      },
      note: '口径：手续费模式按全额计费、本金等额摊还，IRR 牛顿迭代年化；按贷款全额期初一次放款口径，分批放款场景真实年化略低于本结果；装修贷资金用途受监管约束，费率以银行合同为准。',
      links: [
        { label: '信用卡分期同款换算', to: '/t/installment-rate-calculator', query: (v) => ({ principal: String(v.loan ?? ''), months: String(v.months ?? ''), feeRate: String(v.feeRate ?? '') }) },
      ],
    },
  },
  {
    slug: 'balloon-loan-calculator', title: '气球贷计算器', category: 'finance',
    desc: '低月供 + 大额尾付的气球贷测算：月供、尾付与利息总额，附压力提示。',
    keywords: ['气球贷', '尾付', '子弹贷', '月供'],
    calcDef: {
      fields: [
        { key: 'loan', label: '贷款金额', type: 'number', default: '', suffix: '元' },
        { key: 'r', label: '年利率', type: 'number', default: 4.0, suffix: '%', step: 0.01 },
        { key: 'months', label: '期限（月）', type: 'number', default: 36 },
        { key: 'balloon', label: '末期尾付比例', type: 'number', default: 30, suffix: '%', hint: '最后一期一次性归还的本金占比' },
        { key: 'refiYears', label: '到期再融资年限（可选，年）', type: 'number', default: 0, step: 1, hint: '填入后按「尾付本金再融资」估算新月供' },
        { key: 'refiRate', label: '再融资年利率（可选，%）', type: 'number', default: 4.0, step: 0.01 },
      ],
      compute: (v) => {
        const loan = Number(v.loan), r = Number(v.r) / 100 / 12, months = Math.round(Number(v.months)), bp = Number(v.balloon) / 100
        if (!(loan > 0) || months < 2 || !(bp >= 0 && bp < 1)) return [{ label: '请填写贷款金额与尾付比例', value: '尾付比例 0~99%' }]
        const fv = loan * bp // 末期尾付
        const p = loan - fv // 前期摊还本金
        // PV = P×(1−(1+i)^−(n−1))/i → 前期月供
        const monthly = r === 0 ? p / (months - 1) : (p * r) / (1 - Math.pow(1 + r, -(months - 1)))
        const total = monthly * (months - 1) + fv + loan * r // 末月还款 = 尾付 + 最后一期利息（近似）
        const totalInterest = total - loan
        const m = (x: number) => money(x)
        const eq = amortize(loan, Number(v.r), months, 'axbx')
        const rows: CalcResultRow[] = [
          { label: '前期月供', value: '¥' + m(monthly), primary: true, hint: '共 ' + (months - 1) + ' 期' },
          { label: '末期尾付', value: '¥' + m(fv + loan * r), hint: '尾付本金 ¥' + m(fv) + ' + 末期利息' },
          { label: '利息总额', value: '¥' + m(totalInterest) },
          { label: '对比等额本息月供', value: '¥' + m(eq.monthly) + '（利息 ¥' + m(eq.totalInterest) + '）' },
        ]
        // 敏感度小表：尾付 10%/20%/30%/40% 四档
        const sens = [10, 20, 30, 40].map((b) => {
          const b2 = b / 100
          const fv2 = loan * b2
          const p2 = loan - fv2
          const mo2 = r === 0 ? p2 / (months - 1) : (p2 * r) / (1 - Math.pow(1 + r, -(months - 1)))
          const ti2 = mo2 * (months - 1) + fv2 + loan * r - loan
          return { b, mo2, ti2 }
        })
        rows.push({ label: '尾付比例敏感度', value: sens.map((s) => `${s.b}%：月供 ${m(s.mo2)} · 利息 ${m(s.ti2)}`).join(' ｜ '), hint: '改利率后随动；月供随尾付比例升高而降低' })
        // 再融资测算：尾付本金按再融资利率与年限重排
        const refiYears = Number(v.refiYears) || 0
        if (refiYears > 0) {
          const rr = (Number(v.refiRate) || 0) / 100 / 12
          const n2 = Math.round(refiYears * 12)
          const refiMonthly = rr === 0 ? fv / n2 : (fv * rr) / (1 - Math.pow(1 + rr, -n2))
          rows.push({ label: `到期再融资新月供（${refiYears} 年 @ ${v.refiRate}%）`, value: '¥' + m(refiMonthly), hint: `对尾付本金 ¥${m(fv)} 重排年金；手算验证：尾付 × 月利率 ÷ (1 − (1+月利率)^−期数)` })
        }
        rows.push({ label: '风险提示', value: `尾付占比 ${money(bp * 100)}%，到期需一次性筹措大额资金，请预留再融资或出售渠道`, tone: 'err', hint: '气球贷的核心风险在于尾付到期一次性偿付压力' })
        return rows
      },
      note: '口径：前期月供按「摊还本金部分的年金」计算，末期利息按尾付单月利息估算，与逐月精确口径在典型场景（≤5 年）误差 <1%；气球贷实际结息方式各机构不同，以合同为准。',
      links: [
        { label: '对比等额本息逐期明细', to: '/t/amortization-calculator', query: (v) => ({ p: String(v.loan ?? ''), r: String(v.r ?? ''), y: String(Math.round(Number(v.months) / 12) || '') }) },
      ],
    },
  },
  {
    slug: 'stock-average-calculator', title: '摊薄成本计算器', category: 'finance',
    desc: '逐笔录入买入价格与数量，计算加权平均成本、总股数与总投入。',
    keywords: ['摊薄', '成本', '加仓'],
    component: () => import('./components/StockAverage.vue'),
  },
  {
    slug: 'crypto-profit-calculator', title: '币圈盈亏计算器', category: 'finance',
    desc: '计算加密交易的净盈亏、ROI 与保本价，自动计入双边手续费，支持杠杆强平价估算。',
    keywords: ['加密', '比特币', '盈亏'],
    calcDef: {
      fields: [
        F('buy', '买入价', { default: 30000, step: 0.01 }),
        F('sell', '卖出价（可选）', { default: 33000, step: 0.01 }),
        { key: 'qtyType', label: '数量类型', type: 'select', default: 'coins', choices: [{ value: 'coins', label: '币数量' }, { value: 'usd', label: '投入美元' }] },
        F('qty', '数量 / 金额', { default: 0.5, step: 0.01 }),
        F('feePct', '单边手续费（%）', { default: 0.1, step: 0.01 }),
        { key: 'lev', label: '杠杆倍数（全仓近似）', type: 'select', default: '1', choices: [
          { value: '1', label: '现货（1×）' }, { value: '2', label: '2×' }, { value: '5', label: '5×' }, { value: '10', label: '10×' },
        ] },
        F('holdDays', '持有天数（可选，年化 ROI 用）', { step: 1 }),
      ],
      compute: (v) => {
        const buy = Number(v.buy)
        const qty = Number(v.qty)
        const fee = (Number(v.feePct) || 0) / 100
        const lev = Math.max(1, Number(v.lev) || 1)
        const sym = v.qtyType === 'usd' ? '$' : ''
        if (!buy || !qty) {
          return [{ label: '请填写买入价与数量', value: '—', hint: '两项填好后即自动计算净盈亏、ROI 与保本价' }]
        }
        const coins = v.qtyType === 'coins' ? qty : qty / buy
        const invested = coins * buy
        const buyFee = invested * fee
        const sell = Number(v.sell)
        const be = buy * (1 + fee * 2)
        if (!sell) {
          const rows: CalcResultRow[] = [
            { label: '持币数量', value: `${coins.toFixed(6)}` },
            { label: '投入（含手续费）', value: `${sym}${money(invested + buyFee)}` },
            { label: '保本卖出价', value: `${sym}${money(be)}`, primary: true, hint: `卖出高于此价才开始盈利（含 ${Number(v.feePct)}% 双边手续费）` },
          ]
          if (lev > 1) {
            rows.push({ label: `估算强平价（${lev}× 全仓）`, value: `${sym}${money(buy * (1 - 1 / lev))}`, hint: '忽略维持保证金的近似口径；价格触及即爆仓' })
            rows.push({ label: '强平风险', value: `高杠杆会放大波动与爆仓风险，${lev}× 时价格回落 ${((100 / lev)).toFixed(0)}% 即触及强平价`, hint: '仅提示，不构成投资建议' })
          }
          return rows
        }
        const gross = coins * sell
        const sellFee = gross * fee
        const net = gross - sellFee - invested - buyFee
        const roi = invested > 0 ? (net / invested) * 100 : 0
        const rows: CalcResultRow[] = [
          { label: '净盈亏', value: `${net >= 0 ? '+' : ''}${sym}${money(net)}`, primary: true },
          { label: '收益率（ROI）', value: `${roi.toFixed(2)}%` },
          { label: '卖出所得（扣费后）', value: `${sym}${money(gross - sellFee)}` },
          { label: '双边手续费合计', value: `${sym}${money(buyFee + sellFee)}` },
          { label: '保本卖出价', value: `${sym}${money(be)}` },
        ]
        if (lev > 1) {
          rows.push({ label: `估算强平价（${lev}× 全仓）`, value: `${sym}${money(buy * (1 - 1 / lev))}`, hint: '忽略维持保证金；全仓近似口径' })
        }
        const d = Number(v.holdDays)
        if (d > 0 && roi > -100) {
          const annualized = (Math.pow(1 + roi / 100, 365 / d) - 1) * 100
          rows.push({ label: '年化 ROI（复利折算）', value: `${annualized.toFixed(1)}%`, hint: `(1+ROI)^(365/${d})−1，按持有 ${d} 天复利折算` })
        }
        return rows
      },
      note: '单边费率按买卖双边各计一次；保本价 = 买入价 × (1 + 2 × 费率)；未含滑点、资金费率与税费。强平价为全仓近似（1 − 1/杠杆倍数），未计维持保证金。',
    },
  },
  {
    slug: 'sip-calculator', title: '定投收益计算器', category: 'finance',
    desc: '估算每月定投的到期价值：本金、预期收益与总回报，支持阶梯定投与通胀折算。',
    keywords: ['定投', 'sip', '基金'],
    calcDef: {
      fields: [
        F('monthly', '每月定投金额', { placeholder: '如 2000' }),
        F('rate', '预期年化收益（%）', { default: 8, step: 0.5 }),
        F('years', '投资年限（年）', { default: 10, step: 1 }),
        F('stepUp', '每年递增（%，可选，阶梯定投）', { default: 0, step: 1 }),
        F('inflation', '年通胀率（%，可选）', { step: 0.5 }),
      ],
      compute: (v) => {
        const m0 = Number(v.monthly)
        if (!m0 || m0 <= 0) {
          return [{ label: '请填写每月定投金额', value: '—', hint: '填好后即自动计算到期总值、本金与收益' }]
        }
        const r = (Number(v.rate) || 0) / 100 / 12
        const n = Math.round((Number(v.years) || 0) * 12)
        const stepUp = (Number(v.stepUp) || 0) / 100
        // 月末（期末）普通年金终值；阶梯定投按年递增月投额
        let fv = 0
        let invested = 0
        for (let k = 0; k < n; k++) {
          const m = k < 12 ? m0 : m0 * Math.pow(1 + stepUp, Math.floor(k / 12))
          const remain = n - 1 - k // 该月投入的计息期数（次月起息）
          fv += r > 0 && remain > 0 ? m * Math.pow(1 + r, remain) : m
          invested += m
        }
        const rows: CalcResultRow[] = [
          { label: '到期总值', value: money(fv), primary: true },
          { label: '累计投入本金', value: money(invested) },
          { label: '预期收益', value: money(fv - invested) },
          { label: '收益占本金比', value: invested ? `${(((fv - invested) / invested) * 100).toFixed(0)}%` : '—' },
        ]
        if (stepUp > 0) rows.push({ label: '阶梯口径', value: `第 2 年起月投额每年递增 ${v.stepUp}%（第 2 年月投 ${money(m0 * (1 + stepUp))}）` })
        const infl = Number(v.inflation)
        if (infl > 0 && Number(v.years) > 0) {
          const real = fv / Math.pow(1 + infl / 100, Number(v.years))
          rows.push({ label: '实际购买力终值', value: money(real), hint: `名义终值 ÷ (1+${v.inflation}%)^${v.years}，按该通胀率折算到今天的购买力` })
        }
        return rows
      },
      note: '按月末（期末）定投、收益按月复利计算（普通年金终值公式，每期投入从次月起计息）；阶梯定投按「每年同一月投额、次年递增」近似；实际购买力终值 = 名义终值 ÷ (1+通胀)^年限。实际市场存在波动。',
    },
  },
  {
    slug: 'cagr-calculator', title: '年化复合增长率', category: 'finance',
    desc: '由期初值、期末值与年数计算 CAGR，支持反推期末值/所需年限与起止日期折算。',
    keywords: ['cagr', '年化', '增长率'],
    calcDef: {
      fields: [
        { key: 'mode', label: '计算方向', type: 'select', default: 'cagr', choices: [
          { value: 'cagr', label: '求 CAGR' }, { value: 'end', label: '求期末值' }, { value: 'years', label: '求所需年限' },
        ] },
        F('begin', '期初价值', { default: 10000, placeholder: '如 10000' }),
        F('end', '期末价值（求 CAGR / 求年限时填）', { default: 25000, placeholder: '如 25000' }),
        F('rate', '目标年化（求期末值 / 求年限时填，%）', { step: 0.1 }),
        F('years', '年数（求 CAGR / 求期末值时填）', { default: 5, step: 0.5 }),
        { key: 'beginDate', label: '起止日期（可选，替代年数）', type: 'date' },
        { key: 'endDate', label: '截止日期（可选）', type: 'date' },
      ],
      compute: (v) => {
        const begin = Number(v.begin)
        if (!begin || begin <= 0) {
          return [{ label: '期初价值需为正数', value: '—', hint: '期初价值与年数需为正数，否则增长率无意义' }]
        }
        // 起止日期折算年数（日历差 / 365.25），填了则覆盖年数字段
        let years = Number(v.years)
        const bd = v.beginDate ? new Date(String(v.beginDate)) : null
        const ed = v.endDate ? new Date(String(v.endDate)) : null
        const dateValid = bd && ed && !Number.isNaN(bd.getTime()) && !Number.isNaN(ed.getTime()) && ed.getTime() > bd.getTime()
        if (dateValid) years = (ed!.getTime() - bd!.getTime()) / 86400000 / 365.25
        if (years <= 0) {
          return [{ label: '年数需为正数', value: '—', hint: '期初价值与年数需为正数（或填写合法的起止日期）' }]
        }
        if (v.mode === 'end') {
          const g = Number(v.rate)
          if (!g) return [{ label: '请填写目标年化（%）', value: '—' }]
          const end = begin * Math.pow(1 + g / 100, years)
          return [
            { label: `期末价值（${g}% 年化 · ${years.toFixed(2)} 年）`, value: money(end), primary: true },
            { label: '总增长倍数', value: `${(end / begin).toFixed(2)}×` },
            { label: '净增金额', value: money(end - begin) },
          ]
        }
        if (v.mode === 'years') {
          const g = Number(v.rate)
          const end = Number(v.end)
          if (!g || !end || end <= begin) return [{ label: '请填写目标年化与大于期初的期末价值', value: '—' }]
          const need = Math.log(end / begin) / Math.log(1 + g / 100)
          return [
            { label: `所需年限（${g}% 年化）`, value: `${need.toFixed(2)} 年`, primary: true },
            { label: '总增长倍数', value: `${(end / begin).toFixed(2)}×` },
          ]
        }
        const end = Number(v.end)
        if (!end || end <= 0) return [{ label: '请填写期末价值', value: '—' }]
        const g = cagr(begin, end, years)
        const mult = end / begin
        const doubleYears = g > 0 ? Math.log(2) / Math.log(1 + g / 100) : NaN
        return [
          { label: '年化复合增长率（CAGR）', value: `${g.toFixed(2)}%`, primary: true },
          { label: '总增长率', value: `${((mult - 1) * 100).toFixed(1)}%` },
          { label: '增长倍数', value: `${mult.toFixed(2)}×` },
          { label: '翻番时间', value: Number.isFinite(doubleYears) ? `按此增速约 ${doubleYears.toFixed(1)} 年翻一番` : '—' },
          { label: '提示', value: '期间若有加仓/分红，CAGR 会失真，请改用 IRR / 净现值计算器', hint: 'IRR 对不规则现金流仍适用（页面底部可跳转）' },
        ]
      },
      note: 'CAGR = (期末/期初)^(1/年数) − 1，假设增长按复利平滑进行；起止日期按日历差 ÷ 365.25 折算年数；求年限用对数求解 ln(倍数)/ln(1+增速)。',
      links: [
        { label: '改用 IRR / 净现值计算器', to: '/t/irr-npv-calculator' },
      ],
    },
  },
  {
    slug: 'dividend-calculator', title: '股息收益计算器', category: 'finance',
    desc: '按年投影股息收入：支持股息再投资（DRIP）、股息增长与股价增长。',
    keywords: ['股息', 'drip', '被动收入'],
    component: () => import('./components/DividendCalculator.vue'),
  },
  {
    slug: 'fire-calculator', title: '财务自由计算器', category: 'finance',
    desc: '计算 FIRE 目标金额与可达年份：由储蓄、收入、支出、收益率与提取率推演，支持通胀折算与提取率敏感度。',
    keywords: ['fire', '财务自由', '退休'],
    calcDef: {
      fields: [
        F('savings', '当前储蓄', { placeholder: '如 200000' }),
        F('income', '年收入', { placeholder: '如 300000' }),
        F('expense', '年支出', { placeholder: '如 120000' }),
        F('ret', '投资年化收益（%）', { default: 6, step: 0.5 }),
        F('withdraw', '安全提取率（%）', { default: 4, step: 0.1 }),
        F('inflation', '通胀率（%，可选）', { step: 0.5 }),
      ],
      compute: (v) => {
        const income = Number(v.income)
        const expense = Number(v.expense)
        if (!income || !expense) {
          return [{ label: '请填写年支出与年收入', value: '—', hint: '两项填好后自动推演 FIRE 目标与达成时间' }]
        }
        const yearsToTarget = (savings: number, r: number, yrSave: number, target: number): number => {
          let cur = savings
          let y = 0
          while (cur < target && y < 80) {
            cur = cur * (1 + r) + yrSave
            y++
          }
          return y
        }
        const target = (expense * 100) / (Number(v.withdraw) || 4)
        const yearlySave = income - expense
        const r = (Number(v.ret) || 0) / 100
        const years = yearsToTarget(Number(v.savings), r, yearlySave, target)
        const rows: CalcResultRow[] = [
          { label: 'FIRE 目标金额', value: money(target), primary: true, hint: `年支出 ÷ ${v.withdraw}% 提取率` },
          { label: '每年可存', value: money(yearlySave) },
          { label: '储蓄率', value: income > 0 ? `${(((income - expense) / income) * 100).toFixed(1)}%` : '—', hint: '（收入 − 支出）÷ 收入' },
        ]
        rows.push(
          years < 80
            ? { label: '预计达成时间', value: `${years} 年后` }
            : { label: '预计达成时间', value: '80 年内无法达成', hint: '试着提高收入、降低支出或预期收益' },
        )
        // 提取率敏感度：3 / 3.5 / 4 / 4.5 四档目标与年限
        for (const w of [3, 3.5, 4, 4.5]) {
          const t = (expense * 100) / w
          const y = yearsToTarget(Number(v.savings), r, yearlySave, t)
          rows.push({ label: `${w}% 提取率档`, value: `目标 ${money(t)} · 约 ${y >= 80 ? '80+' : y} 年`, hint: w === 4 ? '当前所选档位' : undefined })
        }
        const infl = Number(v.inflation)
        if (infl > 0 && infl < r) {
          const yReal = yearsToTarget(Number(v.savings), r - infl / 100, yearlySave, target)
          rows.push({ label: '实际购买力下的达成时间', value: `${yReal >= 80 ? '80+' : yReal} 年后`, hint: `收益按（${v.ret}% − ${v.inflation}% 通胀）近似折算购买力，比名义口径多 ${Math.max(0, yReal - years)} 年` })
        } else if (infl >= r && infl > 0) {
          rows.push({ label: '通胀提示', value: `通胀率（${v.inflation}%）不低于预期收益（${v.ret}%），实际购买力难以增长`, hint: '请提高投资收益假设或降低通胀率' })
        }
        return rows
      },
      note: '按年末一次性存入、收益按年复利简化计算；通胀折算口径 = 收益按（名义收益 − 通胀）近似，直接推算实际购买力达标时间。4% 提取率源自三一学院研究，并非保证。',
    },
  },
  {
    slug: 'irr-npv-calculator', title: 'IRR / 净现值计算器', category: 'finance',
    desc: '不规则现金流求内部收益率 IRR、MIRR 与净现值 NPV，保险年金、项目投资评估。',
    keywords: ['IRR', 'NPV', '内部收益率', '现金流', '净现值'],
    component: () => import('./components/IrrNpvCalculator.vue'),
  },
  {
    slug: 'bond-ytm-calculator', title: '债券到期收益率', category: 'finance',
    desc: '由价格、面值、票息与期限数值求解 YTM、当期收益率与有效年收益率。',
    keywords: ['债券', 'ytm', '收益率'],
    calcDef: {
      fields: [
        F('price', '当前价格', { default: 950, placeholder: '如 950' }),
        F('par', '面值', { default: 1000 }),
        F('coupon', '票面利率（%）', { default: 3.5, step: 0.01 }),
        F('years', '剩余年限（年）', { default: 5, step: 0.5 }),
        { key: 'freq', label: '年付息次数', type: 'select', default: '2', choices: [{ value: '1', label: '每年 1 次' }, { value: '2', label: '每年 2 次（常见）' }, { value: '4', label: '每季度' }] },
        { key: 'mode', label: '计算方向', type: 'select', default: 'ytm', choices: [{ value: 'ytm', label: '按价格求 YTM' }, { value: 'price', label: '按 YTM 反推价格' }] },
        F('targetYtm', '目标 YTM（反推价格时填，%）', { step: 0.01 }),
      ],
      compute: (v) => {
        const par = Number(v.par) || 1000
        const years = Number(v.years)
        const freq = Number(v.freq)
        const coupon = Number(v.coupon)
        if (!coupon || !years) return [{ label: '请填写票面利率与剩余年限', value: '—' }]
        const perC = (par * coupon) / 100 / freq
        const n = Math.round(years * freq)
        /** 按（年化）收益率折现定价 */
        const priceOf = (ytmAnnual: number): number => {
          const i = ytmAnnual / 100 / freq
          let pv = 0
          for (let t = 1; t <= n; t++) pv += perC / Math.pow(1 + i, t)
          pv += par / Math.pow(1 + i, n)
          return pv
        }
        /** 麦考利久期（年，现金流加权口径） */
        const durationOf = (ytmAnnual: number): number => {
          const i = ytmAnnual / 100 / freq
          let pv = 0
          let wsum = 0
          for (let t = 1; t <= n; t++) {
            const cf = perC + (t === n ? par : 0)
            const d = cf / Math.pow(1 + i, t)
            pv += d
            wsum += d * (t / freq)
          }
          return wsum / pv
        }
        if (v.mode === 'price') {
          const ty = Number(v.targetYtm)
          if (!ty) return [{ label: '请填写目标 YTM（%）', value: '—' }]
          const p = priceOf(ty)
          const check = bondYtm(p, par, coupon, years, freq)
          return [
            { label: `按 YTM ${ty}% 反推价格`, value: money(p), primary: true },
            { label: '代回正向求解的 YTM', value: `${check.ytm.toFixed(3)}%`, hint: '与目标值误差应 <0.001%（自检回路）' },
            { label: '较面值', value: `${(((p - par) / par) * 100).toFixed(2)}%`, hint: p < par ? '折价' : p > par ? '溢价' : '平价' },
          ]
        }
        const price = Number(v.price)
        if (!price) return [{ label: '请填写当前价格', value: '—' }]
        const r = bondYtm(price, par, coupon, years, freq)
        const macD = durationOf(r.ytm)
        const modD = macD / (1 + r.ytm / 100 / freq)
        const convexity = (() => {
          const i = r.ytm / 100 / freq
          let c = 0
          let pv = 0
          for (let t = 1; t <= n; t++) {
            const cf = perC + (t === n ? par : 0)
            const d = cf / Math.pow(1 + i, t)
            pv += d
            c += d * ((t / freq) * (t / freq + 1 / freq))
          }
          return c / pv / Math.pow(1 + i, 2)
        })()
        return [
          { label: '到期收益率（YTM）', value: `${r.ytm.toFixed(3)}%`, primary: true },
          { label: '当期收益率', value: `${r.currentYield.toFixed(3)}%` },
          { label: '有效年收益率', value: `${r.effectiveAnnual.toFixed(3)}%` },
          { label: '麦考利久期', value: `${macD.toFixed(2)} 年`, hint: '现金流加权平均回收时间；≈ 价格对利率的一阶敏感度' },
          { label: '修正久期 / 凸性', value: `${modD.toFixed(2)} / ${convexity.toFixed(1)}`, hint: `利率每升 1%，价格约跌 ${modD.toFixed(2)}%（凸性修正 +${((convexity / 2) * 1).toFixed(2)}%·Δy²）` },
          { label: '判断', value: r.ytm > coupon ? '折价买入，YTM 高于票息' : r.ytm < coupon ? '溢价买入，YTM 低于票息' : '平价' },
        ]
      },
      note: 'YTM 通过牛顿迭代数值求解，假设持有到期且利息按相同利率再投资；按全价口径计算，未含应计利息与交易费用；久期/凸性为现金流加权口径，利率升 1% 的近似跌幅 ≈ 修正久期（二阶用凸性修正）。',
    },
  },
  {
    slug: 'portfolio-rebalance-calculator', title: '组合再平衡计算器', category: 'finance',
    desc: '输入各持仓现值与目标配比，得到每类资产应买入或卖出的精确金额。',
    keywords: ['再平衡', '资产配置', '组合'],
    component: () => import('./components/PortfolioRebalance.vue'),
  },
  {
    slug: 'position-size-calculator', title: '仓位规模计算器', category: 'finance',
    desc: '按账户规模与单笔风险百分比计算应买入的股数，让每笔交易风险一致。',
    keywords: ['仓位', '风控', 'position size'],
    calcDef: {
      fields: [
        F('account', '账户总值', { placeholder: '如 100000' }),
        F('riskPct', '单笔风险（%）', { default: 1, step: 0.1, hint: '常用档位 0.5 / 1 / 2（%），职业交易多 ≤1%' }),
        { key: 'dir', label: '方向', type: 'select', default: 'long', choices: [{ value: 'long', label: '做多' }, { value: 'short', label: '做空' }] },
        F('entry', '入场价', { placeholder: '如 25.5', step: 0.01 }),
        F('stop', '止损价', { placeholder: '如 24', step: 0.01 }),
      ],
      samples: [
        { label: '保守 0.5%', values: { account: 100000, riskPct: 0.5, dir: 'long', entry: 25.5, stop: 24 } },
        { label: '稳健 1%（常用）', values: { account: 100000, riskPct: 1, dir: 'long', entry: 25.5, stop: 24 } },
        { label: '进取 2%', values: { account: 100000, riskPct: 2, dir: 'long', entry: 25.5, stop: 24 } },
      ],
      compute: (v) => {
        const account = Number(v.account)
        const entry = Number(v.entry)
        const stop = Number(v.stop)
        if (!account || !entry || !stop) {
          return [{ label: '请填写账户总值、入场价与止损价', value: '—', tone: 'err', hint: '单笔风险默认 1%，可在字段中调整（常用 0.5/1/2%）' }]
        }
        if (v.dir === 'short' && stop <= entry) {
          return [{ label: '做空时止损价应高于入场价', value: '—', tone: 'err', hint: `当前入场 ${entry}、止损 ${stop}：做空的止损在上行方向，请填大于入场价的止损价` }]
        }
        if (v.dir === 'long' && stop >= entry) {
          return [{ label: '做多时止损价应低于入场价', value: '—', tone: 'err', hint: `当前入场 ${entry}、止损 ${stop}，请检查方向或价格` }]
        }
        const risk = (account * (Number(v.riskPct) || 0)) / 100
        const per = Math.abs(entry - stop)
        const shares = per > 0 ? Math.floor(risk / per) : 0
        const posValue = shares * entry
        const pctOf = account ? (posValue / account) * 100 : 0
        const rows: CalcResultRow[] = [
          { label: '单笔最大亏损', value: money(risk) },
          { label: '建议买入股数', value: `${shares} 股`, primary: true },
          { label: '持仓市值', value: money(posValue) },
        ]
        if (pctOf > 100) {
          rows.push({ label: '占账户比例', value: `${pctOf.toFixed(1)}%（超过账户总值）`, tone: 'err', hint: '需杠杆资金才能建仓，注意强平风险——建议放宽止损或降低风险预算' })
        } else {
          rows.push({ label: '占账户比例', value: `${pctOf.toFixed(1)}%` })
        }
        rows.push({ label: '每股风险', value: money(per) })
        return rows
      },
      note: '仓位规模 = 单笔可承受亏损 ÷ 每股风险（做多=入场−止损，做空=止损−入场）。常用单笔风险档位：0.5%、1%、2%，保守起见多 ≤1%。',
      links: [
        { label: '计算这笔交易的盈亏比', to: '/t/risk-reward-calculator', query: (v) => ({ entry: String(v.entry ?? ''), stop: String(v.stop ?? '') }) },
      ],
    },
  },
  {
    slug: 'kelly-criterion-calculator', title: '凯利公式计算器', category: 'finance',
    desc: '由胜率与盈亏比计算最优下注比例：全部、半仓与四分之一凯利。',
    keywords: ['凯利', 'kelly', '资金管理'],
    calcDef: {
      fields: [
        F('winProb', '胜率（%）', { default: 55, step: 0.1 }),
        F('ratio', '平均盈亏比（赢/输）', { default: 1.5, step: 0.05, hint: '赢时每 1 元净收益 ÷ 输时每 1 元净亏损（不含本金）；如胜率 55%、赢 1.5 输 1 → 填 1.5' }),
        F('bankroll', '账户资金（可选，换算下注金额）', { placeholder: '如 100000', step: 1000 }),
      ],
      compute: (v) => {
        const wp = Number(v.winProb)
        const ratio = Number(v.ratio)
        if (!wp || wp <= 0 || wp > 100) {
          return [{ label: '胜率应在 0~100 之间', value: '—', hint: `当前填写的胜率为 ${v.winProb}，请填 0~100 的百分比数值` }]
        }
        if (!ratio || ratio <= 0) {
          return [{ label: '盈亏比应为正数', value: '—', hint: '盈亏比 = 赢单平均收益 ÷ 亏单平均亏损（均为净额，不含本金）' }]
        }
        const r = kelly(wp / 100, ratio)
        const fmt = (x: number) => `${x.toFixed(2)}%`
        const rows: CalcResultRow[] = [
          { label: '全凯利（Full Kelly）', value: fmt(r.full), primary: true },
          { label: '半凯利（Half Kelly）', value: fmt(r.half), hint: '波动减半，更常被实践采用' },
          { label: '四分之一凯利', value: fmt(r.quarter) },
          { label: '判断', value: r.full <= 0 ? '负期望：不应下注' : '正期望' },
        ]
        const bankroll = Number(v.bankroll)
        if (bankroll > 0 && r.full > 0) {
          rows.push({ label: '三档下注金额', value: `全凯利 ${money((bankroll * r.full) / 100)} · 半凯利 ${money((bankroll * r.half) / 100)} · 四分之一 ${money((bankroll * r.quarter) / 100)}`, hint: `按账户资金 ${money(bankroll)} 换算` })
        }
        if (r.full > 0) {
          rows.push({ label: '连败回撤（按全凯利，比例不变）', value: `连败 3 次 → ${(100 * Math.pow(1 - r.full / 100, 3)).toFixed(1)}% · 5 次 → ${(100 * Math.pow(1 - r.full / 100, 5)).toFixed(1)}% · 10 次 → ${(100 * Math.pow(1 - r.full / 100, 10)).toFixed(1)}%`, hint: '复利口径：每次按当前资金的同一比例下注，剩余资金 = (1 − f)^(连败次数)' })
        }
        return rows
      },
      note: '凯利公式 f* = (bp − q) / b，其中 b 为盈亏比、p 为胜率、q = 1 − p。连败回撤为复利口径。',
    },
  },
  {
    slug: 'sharpe-ratio-calculator', title: '夏普 / 索提诺比率', category: 'finance',
    desc: '粘贴各期收益率序列，计算均值、标准差、下行波动与夏普/索提诺比率。',
    keywords: ['夏普', 'sortino', '风险调整'],
    component: () => import('./components/SharpeRatio.vue'),
  },
  {
    slug: 'risk-reward-calculator', title: '盈亏比计算器', category: 'finance',
    desc: '由入场价、止损价与目标价计算盈亏比及保本胜率，评估交易是否值得做。',
    keywords: ['盈亏比', '风险', '胜率'],
    calcDef: {
      fields: [
        F('entry', '入场价', { default: 25.5, step: 0.01 }),
        F('stop', '止损价', { default: 24, step: 0.01 }),
        F('target', '目标价', { default: 30, step: 0.01 }),
        F('winRate', '你的预估胜率（%，可选）', { default: 55, step: 0.1 }),
      ],
      compute: (v) => {
        const entry = Number(v.entry)
        const stop = Number(v.stop)
        const target = Number(v.target)
        if (!entry || !stop || !target || entry === stop || entry === target) {
          return [{ label: '请填写入场、止损与目标价（三者需互不相等）', value: '—', hint: '填好后自动计算盈亏比、保本胜率与期望收益' }]
        }
        const risk = Math.abs(entry - stop)
        const reward = Math.abs(target - entry)
        const rr = risk > 0 ? reward / risk : 0
        if (!rr) {
          return [{ label: '目标价与入场价相同，无回报可言', value: '—', hint: '目标价需与入场价、止损价互不相等' }]
        }
        const breakEven = 100 / (1 + rr)
        const wr = Number(v.winRate)
        const rows = [
          { label: '单股风险', value: money(risk) },
          { label: '单股回报', value: money(reward) },
          { label: '盈亏比（回报:风险）', value: `1 : ${rr.toFixed(2)}`, primary: true, hint: `即 ${rr.toFixed(0)}R 交易（每承担 1 份风险博取 ${rr.toFixed(0)} 份回报）` },
          { label: '保本胜率', value: `${breakEven.toFixed(1)}%`, hint: `胜率高于此值，该策略长期为正期望（保本胜率 = 1 ÷ (1+盈亏比)）` },
        ]
        if (wr) {
          const ev = (wr / 100) * reward - (1 - wr / 100) * risk
          rows.push({ label: '每笔期望收益', value: money(ev), hint: ev > 0 ? '正期望' : '负期望，建议放弃或改进' })
        }
        rows.push({ label: '价格标尺', value: `止损 ${stop} ←${money(risk)}→ 入场 ${entry} ←${money(reward)}→ 目标 ${target}`, hint: `风险段 : 回报段 = ${risk.toFixed(2)} : ${reward.toFixed(2)}（1 : ${rr.toFixed(2)}）` })
        return rows
      },
      note: '未含手续费与滑点；保本胜率 = 1 ÷ (1 + 盈亏比)；期望值 = 胜率 × 单股回报 − (1 − 胜率) × 单股风险。',
      links: [
        { label: '按 1% 风险算这笔仓位', to: '/t/position-size-calculator', query: (v) => ({ entry: String(v.entry ?? ''), stop: String(v.stop ?? ''), dir: Number(v.entry) > Number(v.stop) ? 'long' : 'short' }) },
      ],
    },
  },
  {
    slug: 'forex-pip-calculator', title: '外汇点值计算器', category: 'finance',
    desc: '计算任意货币对在标准手/迷你手/微型手下的每点价值。',
    keywords: ['外汇', 'pip', '点值'],
    calcDef: {
      fields: [
        { key: 'pair', label: '货币对', type: 'select', default: 'EURUSD', choices: [
          { value: 'EURUSD', label: 'EUR/USD' }, { value: 'GBPUSD', label: 'GBP/USD' },
          { value: 'AUDUSD', label: 'AUD/USD' }, { value: 'USDJPY', label: 'USD/JPY' },
          { value: 'USDCHF', label: 'USD/CHF' }, { value: 'USDCAD', label: 'USD/CAD' },
          { value: 'EURJPY', label: 'EUR/JPY' }, { value: 'GBPJPY', label: 'GBP/JPY' },
          { value: 'EURGBP', label: 'EUR/GBP' }, { value: 'NZDUSD', label: 'NZD/USD' },
          { value: 'USDCNH', label: 'USD/CNH' },
        ] },
        F('pipSize', '点差大小（JPY 对自动按 0.01 计）', { default: 0.0001, step: 0.00001 }),
        F('rate', '汇率（美元在前的对填该货币对现价；美元报价对固定按 1）', { default: 1, step: 0.0001 }),
        F('lots', '手数', { default: 1, step: 0.01 }),
        { key: 'acctCcy', label: '账户币种', type: 'select', default: 'USD', choices: [{ value: 'USD', label: 'USD（美元）' }, { value: 'CNY', label: 'CNY（人民币）' }] },
        F('usdcnh', 'USDCNH 汇率（账户为 CNY 时必填）', { default: 7.2, step: 0.0001 }),
      ],
      compute: (v) => {
        const pair = String(v.pair || '')
        const lots = Number(v.lots) || 0
        const isCross = !/USD/.test(pair) // EUR/JPY、GBP/JPY、EUR/GBP 等交叉盘
        // 货币对真实参与计算：JPY 对按百分位报价计点（1 点 = 0.01），不再叠加 ×100 补偿（避免双重补偿）
        const pipSize = pair.includes('JPY') ? 0.01 : Number(v.pipSize)
        // 报价货币兑美元汇率：
        // - 美元报价对（EUR/USD 等）：恒为 1；
        // - 美元在前的对（USD/JPY 等）：按所填货币对现价取倒数；
        // - 交叉盘（EUR/JPY 等）：以点差所属货币（对价货币）兑美元换算，需另行填写该货币兑美元汇率
        if (isCross) {
          const ask = `交叉盘 ${pair}：点值以 ${pair.slice(3)} 兑美元汇率折算。请在「汇率」栏填 ${pair.slice(3)} 兑美元汇率（如 EUR/JPY 需另查 JPY 兑美元 ≈ 1/USDJPY 现价），或先用两个直盘汇率自行换算`
          return [
            { label: '每点价值（标准手 10 万单位）', value: '$—', hint: ask },
            { label: '当前手数每点价值', value: '$—', primary: true, hint: ask },
            { label: '10 点波动盈亏', value: '$—', hint: ask },
            { label: '100 点波动盈亏', value: '$—', hint: ask },
          ]
        }
        let rate: number
        let rateHint = ''
        if (/^USD/.test(pair)) {
          const r = Number(v.rate)
          if (r > 0 && r !== 1) {
            rate = 1 / r
            rateHint = `已按 ${pair} 现价 ${r} 换算：1 ${pair.slice(3)} ≈ ${rate.toFixed(5)} USD`
          } else {
            const ask = `请先填写 ${pair} 现价（如 150），即可得到准确的美元点值`
            return [
              { label: '每点价值（标准手 10 万单位）', value: '$—', hint: ask },
              { label: '当前手数每点价值', value: '$—', primary: true, hint: ask },
              { label: '10 点波动盈亏', value: '$—', hint: ask },
              { label: '100 点波动盈亏', value: '$—', hint: ask },
            ]
          }
        } else {
          rate = 1
        }
        const pvUsd = pipSize * 100000 * lots * rate
        const perLotUsd = lots > 0 ? pvUsd / lots : pvUsd
        const sym = v.acctCcy === 'CNY' ? '¥' : '$'
        const cnh = Number(v.usdcnh) || 7.2
        const pv = v.acctCcy === 'CNY' ? pvUsd * cnh : pvUsd
        const perLot = v.acctCcy === 'CNY' ? perLotUsd * cnh : perLotUsd
        const convHint = v.acctCcy === 'CNY' ? `已按 USDCNH ${cnh} 折算为人民币（1 点 ≈ $${money(perLotUsd)}）` : rateHint
        return [
          { label: `每点价值（标准手 10 万单位）`, value: `${sym}${money(perLot)}` },
          { label: '当前手数每点价值', value: `${sym}${money(pv)}`, primary: true, hint: convHint },
          { label: '10 点波动盈亏', value: `${sym}${money(pv * 10)}` },
          { label: '100 点波动盈亏', value: `${sym}${money(pv * 100)}` },
          { label: '仓位联动', value: `按本页每点价值 ${sym}${money(perLot)} 反推手数`, hint: '点击下方链接打开仓位规模计算器：其「每股风险」= 入场价 − 止损价，外汇场景可按止损点数 × 每点价值估算每股风险后再反推手数' },
        ]
      },
      note: '点值 = 点差 × 合约单位（10 万）× 手数 × 报价货币兑美元汇率。JPY 对 1 点 = 0.01（自动应用）；USD/JPY 等美元在前的货币对填该货币对现价自动取倒数；交叉盘（EUR/JPY 等）以对价货币兑美元汇率折算；账户币种选 CNY 时按 USDCNH 汇率换算，为近似参考。',
      links: [
        { label: '用仓位规模计算器反推手数', to: '/t/position-size-calculator' },
      ],
    },
  },
  {
    slug: 'black-scholes-calculator', title: '期权定价计算器', category: 'finance',
    desc: '用 Black-Scholes 模型为欧式期权定价，并给出 Delta、Gamma 等希腊字母。',
    keywords: ['期权', 'black-scholes', '希腊字母'],
    calcDef: {
      fields: [
        F('spot', '标的现价', { placeholder: '如 100' }),
        F('strike', '行权价', { placeholder: '如 105' }),
        { key: 'timeUnit', label: '期限单位', type: 'select', default: 'year', choices: [{ value: 'year', label: '年' }, { value: 'day', label: '天' }] },
        F('years', '剩余期限', { default: 0.5, placeholder: '如 0.5' }),
        F('rate', '无风险利率（%）', { default: 3, step: 0.01 }),
        F('vol', '年化波动率（%）', { default: 25, step: 0.1 }),
        F('div', '股息率（%，可选）', { step: 0.01 }),
        { key: 'mode', label: '计算方向', type: 'select', default: 'price', choices: [{ value: 'price', label: '定价' }, { value: 'iv', label: '反推波动率（IV）' }] },
        F('market', '期权市价（反推 IV 时填）', { step: 0.01 }),
      ],
      compute: (v) => {
        // 必填项守卫：避免空值打开即显示 NaN
        if (!v.spot || !v.strike || !v.years || !v.rate) {
          return [{ label: '请填写标的现价、行权价与期限', value: '—' }]
        }
        const S = Number(v.spot)
        const K = Number(v.strike)
        const T = v.timeUnit === 'day' ? Number(v.years) / 365 : Number(v.years)
        const rate = (Number(v.rate) || 0) / 100
        if (T <= 0) return [{ label: '剩余期限需大于 0', value: '—' }]
        // 标准正态分布 CDF（erf 近似，供 Put 希腊字母与 IV 求解使用）
        const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))
        const erf = (x: number) => {
          const t = 1 / (1 + 0.3275911 * Math.abs(x))
          const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
          return x >= 0 ? y : 1 - y
        }
        if (v.mode === 'iv') {
          const target = Number(v.market)
          if (!target || target <= 0) return [{ label: '请填写期权市价（反推波动率）', value: '—', hint: '填入市场报价后自动二分求解隐含波动率' }]
          const callPrice = (vol: number) => blackScholes(S, K, T, rate, vol, (Number(v.div) || 0) / 100).call
          let lo = 0.0001
          let hi = 5
          let mid = 0
          for (let i = 0; i < 80; i++) {
            mid = (lo + hi) / 2
            if (callPrice(mid) > target) hi = mid
            else lo = mid
          }
          const iv = mid
          if (callPrice(0.0001) > target || callPrice(5) < target) {
            return [{ label: '市价超出理论边界，无法反推 IV', value: '—', hint: '市价低于内在价值或高于极端波动率上界，请检查参数' }]
          }
          return [
            { label: '隐含波动率（IV）', value: `${(iv * 100).toFixed(2)}%`, primary: true, hint: '二分求解：使 BS 理论 Call 价等于市价的年化波动率' },
            { label: '该 IV 下理论价', value: money(callPrice(iv)) },
            { label: '对照', value: `市价 ${money(target)} · 求解区间 [0.01%, 500%]` },
          ]
        }
        if (!v.vol) return [{ label: '请填写年化波动率（%）', value: '—' }]
        const r = blackScholes(S, K, T, rate, (Number(v.vol) || 0) / 100, (Number(v.div) || 0) / 100)
        // Put 侧希腊字母（与 lib 口径一致，由 Call 推导）：
        const discK = K * Math.exp(-rate * T)
        const thetaPut = r.thetaCall + rate * discK * normCdf(-r.d2) // Θput = Θcall + rK·e^(−rT)·N(−d2)
        const rhoPut = r.rhoCall - discK * T // ρput = ρcall − K·T·e^(−rT)
        return [
          { label: '看涨期权（Call）价值', value: money(r.call), primary: true },
          { label: '看跌期权（Put）价值', value: money(r.put) },
          { label: 'Delta（Call / Put）', value: `${r.deltaCall.toFixed(4)} / ${r.deltaPut.toFixed(4)}`, hint: '标的每变动 1 元，期权价变化量' },
          { label: 'Gamma', value: r.gamma.toFixed(4), hint: 'Delta 对标的价格的敏感度（凸性）；平值附近最大' },
          { label: 'Theta（每日，Call / Put）', value: `${r.thetaCall.toFixed(4)} / ${thetaPut.toFixed(4)}`, hint: '时间每过 1 天期权理论价值的变化；虚值 Put 的 Theta 可为正（贴现效应）' },
          { label: 'Vega（每 1% 波动）', value: r.vega.toFixed(4), hint: `波动率每 +1%，期权价约变化 ${r.vega.toFixed(4)}` },
          { label: 'Rho（Call / Put）', value: `${r.rhoCall.toFixed(4)} / ${rhoPut.toFixed(4)}`, hint: '无风险利率每 +1% 的期权价变化' },
          { label: 'd1 / d2', value: `${r.d1.toFixed(3)} / ${r.d2.toFixed(3)}` },
          { label: '策略联动', value: `现价 ${S} · 行权价 ${K} 构建组合`, hint: '点击下方链接跳转后，把标的现价与腿行权价按此填写' },
        ]
      },
      note: 'Black-Scholes 模型假设对数正态价格、无摩擦市场与常数波动率，仅为理论参考价；天数模式按 365 天/年折算；Put 希腊字母由 Call 与平价关系推导；IV 由看涨市价二分反推。',
      links: [
        { label: '以当前参数构建到期损益', to: '/t/options-payoff-calculator', query: (v) => ({ spot: String(v.spot ?? ''), strike: String(v.strike ?? '') }) },
      ],
    },
  },
  {
    slug: 'options-payoff-calculator', title: '期权到期损益图', category: 'finance',
    desc: '组合多头/空头看涨看跌与正股，绘制到期损益曲线、最大盈亏与盈亏平衡点。',
    keywords: ['期权', '损益', '策略'],
    component: () => import('./components/OptionsPayoff.vue'),
    steps: ['添加期权腿（买卖方向）', '查看到期损益曲线', '读出最大盈亏与盈亏平衡点'],
  },
]

export default tools