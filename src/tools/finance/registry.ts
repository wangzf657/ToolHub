import type { ToolDef, CalcFieldDef, CalcResultRow } from '@/types'
import { blackScholes, kelly, cagr, bondYtm, formatMoney } from '@/lib/finance'

const F = (k: string, label: string, extra: Partial<CalcFieldDef> = {}): CalcFieldDef => ({
  key: k, label, type: 'number', default: '', ...extra,
})

const money = (n: number) => formatMoney(n)

/** 金融交易工具注册表（15 项，全部内联 calcDef） */
const tools: ToolDef[] = [
  {
    slug: 'black-scholes-calculator', title: '期权定价计算器', category: 'finance',
    desc: '用 Black-Scholes 模型为欧式期权定价，并给出 Delta、Gamma 等希腊字母。',
    keywords: ['期权', 'black-scholes', '希腊字母'],
    calcDef: {
      fields: [
        F('spot', '标的现价', { placeholder: '如 100' }),
        F('strike', '行权价', { placeholder: '如 105' }),
        F('years', '剩余期限（年）', { placeholder: '如 0.5' }),
        F('rate', '无风险利率（%）', { placeholder: '如 3', step: 0.01 }),
        F('vol', '年化波动率（%）', { placeholder: '如 25', step: 0.1 }),
        F('div', '股息率（%，可选）', { step: 0.01 }),
      ],
      compute: (v) => {
        // 必填项守卫：避免空值打开即显示 NaN
        if (!v.spot || !v.strike || !v.years || !v.rate || !v.vol) {
          return [{ label: '请填写标的现价、行权价、期限、无风险利率与波动率', value: '—' }]
        }
        const r = blackScholes(Number(v.spot), Number(v.strike), Number(v.years), (Number(v.rate) || 0) / 100, (Number(v.vol) || 0) / 100, (Number(v.div) || 0) / 100)
        return [
          { label: '看涨期权（Call）价值', value: money(r.call), primary: true },
          { label: '看跌期权（Put）价值', value: money(r.put) },
          { label: 'Delta（Call / Put）', value: `${r.deltaCall.toFixed(4)} / ${r.deltaPut.toFixed(4)}` },
          { label: 'Gamma', value: r.gamma.toFixed(4) },
          { label: 'Theta（每日，Call）', value: r.thetaCall.toFixed(4) },
          { label: 'Vega（每 1% 波动）', value: r.vega.toFixed(4) },
          { label: 'Rho（Call）', value: r.rhoCall.toFixed(4) },
          { label: 'd1 / d2', value: `${r.d1.toFixed(3)} / ${r.d2.toFixed(3)}` },
        ]
      },
      note: 'Black-Scholes 模型假设对数正态价格、无摩擦市场与常数波动率，仅为理论参考价。',
    },
  },
  {
    slug: 'options-payoff-calculator', title: '期权到期损益图', category: 'finance',
    desc: '组合多头/空头看涨看跌与正股，绘制到期损益曲线、最大盈亏与盈亏平衡点。',
    keywords: ['期权', '损益', '策略'],
    component: () => import('./components/OptionsPayoff.vue'),
    steps: ['添加期权腿（买卖方向）', '查看到期损益曲线', '读出最大盈亏与盈亏平衡点'],
  },
  {
    slug: 'position-size-calculator', title: '仓位规模计算器', category: 'finance',
    desc: '按账户规模与单笔风险百分比计算应买入的股数，让每笔交易风险一致。',
    keywords: ['仓位', '风控', 'position size'],
    calcDef: {
      fields: [
        F('account', '账户总值', { placeholder: '如 100000' }),
        F('riskPct', '单笔风险（%）', { placeholder: '如 1', step: 0.1 }),
        F('entry', '入场价', { placeholder: '如 25.5', step: 0.01 }),
        F('stop', '止损价', { placeholder: '如 24', step: 0.01 }),
      ],
      compute: (v) => {
        const risk = (Number(v.account) * (Number(v.riskPct) || 0)) / 100
        const per = Math.abs(Number(v.entry) - Number(v.stop))
        const shares = per > 0 ? Math.floor(risk / per) : 0
        return [
          { label: '单笔最大亏损', value: money(risk) },
          { label: '建议买入股数', value: `${shares} 股`, primary: true },
          { label: '持仓市值', value: money(shares * Number(v.entry)) },
          { label: '占账户比例', value: v.account ? `${(((shares * Number(v.entry)) / Number(v.account)) * 100).toFixed(1)}%` : '—' },
          { label: '每股风险', value: money(per) },
        ]
      },
      note: '仓位规模 = 单笔可承受亏损 ÷ 每股风险（入场价 − 止损价）。',
    },
  },
  {
    slug: 'risk-reward-calculator', title: '盈亏比计算器', category: 'finance',
    desc: '由入场价、止损价与目标价计算盈亏比及保本胜率，评估交易是否值得做。',
    keywords: ['盈亏比', '风险', '胜率'],
    calcDef: {
      fields: [
        F('entry', '入场价', { step: 0.01 }),
        F('stop', '止损价', { step: 0.01 }),
        F('target', '目标价', { step: 0.01 }),
        F('winRate', '你的预估胜率（%，可选）', { step: 0.1 }),
      ],
      compute: (v) => {
        const entry = Number(v.entry)
        const risk = Math.abs(entry - Number(v.stop))
        const reward = Math.abs(Number(v.target) - entry)
        const rr = risk > 0 ? reward / risk : 0
        const breakEven = 100 / (1 + rr)
        const wr = Number(v.winRate)
        const rows = [
          { label: '单股风险', value: money(risk) },
          { label: '单股回报', value: money(reward) },
          { label: '盈亏比（回报:风险）', value: `1 : ${rr.toFixed(2)}`, primary: true },
          { label: '保本胜率', value: `${breakEven.toFixed(1)}%`, hint: '胜率高于此值，该策略长期为正期望' },
        ]
        if (wr) {
          const ev = (wr / 100) * reward - (1 - wr / 100) * risk
          rows.push({ label: '每笔期望收益', value: money(ev), hint: ev > 0 ? '正期望' : '负期望，建议放弃或改进' })
        }
        return rows
      },
    },
  },
  {
    slug: 'kelly-criterion-calculator', title: '凯利公式计算器', category: 'finance',
    desc: '由胜率与盈亏比计算最优下注比例：全部、半仓与四分之一凯利。',
    keywords: ['凯利', 'kelly', '资金管理'],
    calcDef: {
      fields: [
        F('winProb', '胜率（%）', { placeholder: '如 55', step: 0.1 }),
        F('ratio', '平均盈亏比（赢/输）', { placeholder: '如 1.5', step: 0.05 }),
      ],
      compute: (v) => {
        const r = kelly((Number(v.winProb) || 0) / 100, Number(v.ratio) || 1)
        const fmt = (x: number) => `${x.toFixed(2)}%`
        return [
          { label: '全凯利（Full Kelly）', value: fmt(r.full), primary: true },
          { label: '半凯利（Half Kelly）', value: fmt(r.half), hint: '波动减半，更常被实践采用' },
          { label: '四分之一凯利', value: fmt(r.quarter) },
          { label: '判断', value: r.full <= 0 ? '负期望：不应下注' : '正期望' },
        ]
      },
      note: '凯利公式 f* = (bp − q) / b，其中 b 为盈亏比、p 为胜率、q = 1 − p。',
    },
  },
  {
    slug: 'sharpe-ratio-calculator', title: '夏普 / 索提诺比率', category: 'finance',
    desc: '粘贴各期收益率序列，计算均值、标准差、下行波动与夏普/索提诺比率。',
    keywords: ['夏普', 'sortino', '风险调整'],
    component: () => import('./components/SharpeRatio.vue'),
  },
  {
    slug: 'cagr-calculator', title: '年化复合增长率', category: 'finance',
    desc: '由期初值、期末值与年数计算 CAGR，另给出总增长与增长倍数。',
    keywords: ['cagr', '年化', '增长率'],
    calcDef: {
      fields: [
        F('begin', '期初价值', { placeholder: '如 10000' }),
        F('end', '期末价值', { placeholder: '如 25000' }),
        F('years', '年数', { placeholder: '如 5', step: 0.5 }),
      ],
      compute: (v) => {
        const g = cagr(Number(v.begin), Number(v.end), Number(v.years))
        const mult = Number(v.begin) > 0 ? Number(v.end) / Number(v.begin) : 0
        return [
          { label: '年化复合增长率（CAGR）', value: `${g.toFixed(2)}%`, primary: true },
          { label: '总增长率', value: mult ? `${((mult - 1) * 100).toFixed(1)}%` : '—' },
          { label: '增长倍数', value: `${mult.toFixed(2)}×` },
        ]
      },
      note: 'CAGR = (期末/期初)^(1/年数) − 1，假设增长按复利平滑进行。',
    },
  },
  {
    slug: 'stock-average-calculator', title: '摊薄成本计算器', category: 'finance',
    desc: '逐笔录入买入价格与数量，计算加权平均成本、总股数与总投入。',
    keywords: ['摊薄', '成本', '加仓'],
    component: () => import('./components/StockAverage.vue'),
  },
  {
    slug: 'dividend-calculator', title: '股息收益计算器', category: 'finance',
    desc: '按年投影股息收入：支持股息再投资（DRIP）、股息增长与股价增长。',
    keywords: ['股息', 'drip', '被动收入'],
    component: () => import('./components/DividendCalculator.vue'),
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
        ] },
        F('pipSize', '点差大小', { default: 0.0001, step: 0.00001 }),
        F('rate', '报价货币兑美元汇率（直盘填 1）', { default: 1, step: 0.0001 }),
        F('lots', '手数', { default: 1, step: 0.01 }),
      ],
      compute: (v) => {
        const pipValue = Number(v.pipSize) * 100000 * Number(v.lots) * Number(v.rate)
        const jpy = String(v.pair).includes('JPY')
        const pv = jpy ? pipValue * 100 : pipValue
        return [
          { label: '每点价值（标准手 10 万单位）', value: `$${money(pv / Number(v.lots || 1))}` },
          { label: '当前手数每点价值', value: `$${money(pv)}`, primary: true },
          { label: '10 点波动盈亏', value: `$${money(pv * 10)}` },
          { label: '100 点波动盈亏', value: `$${money(pv * 100)}` },
        ]
      },
      note: '点值 = 点差 × 合约单位 × 手数 × 报价货币汇率。JPY 对点差为 0.01。',
    },
  },
  {
    slug: 'crypto-profit-calculator', title: '币圈盈亏计算器', category: 'finance',
    desc: '计算加密交易的净盈亏、ROI 与保本价，自动计入双边手续费。',
    keywords: ['加密', '比特币', '盈亏'],
    calcDef: {
      fields: [
        F('buy', '买入价', { step: 0.01 }),
        F('sell', '卖出价（可选）', { step: 0.01 }),
        { key: 'qtyType', label: '数量类型', type: 'select', default: 'coins', choices: [{ value: 'coins', label: '币数量' }, { value: 'usd', label: '投入美元' }] },
        F('qty', '数量 / 金额', { step: 0.01 }),
        F('feePct', '单边手续费（%）', { default: 0.1, step: 0.01 }),
      ],
      compute: (v) => {
        const buy = Number(v.buy)
        const fee = (Number(v.feePct) || 0) / 100
        const coins = v.qtyType === 'coins' ? Number(v.qty) : Number(v.qty) / buy
        const invested = coins * buy
        const buyFee = invested * fee
        const sell = Number(v.sell)
        if (!sell) {
          const be = buy * (1 + fee * 2)
          return [
            { label: '持币数量', value: `${coins.toFixed(6)}` },
            { label: '投入（含手续费）', value: money(invested + buyFee) },
            { label: '保本卖出价', value: money(be), primary: true, hint: `卖出高于此价才开始盈利（含 ${Number(v.feePct)}% 双边手续费）` },
          ]
        }
        const gross = coins * sell
        const sellFee = gross * fee
        const net = gross - sellFee - invested - buyFee
        const roi = invested > 0 ? (net / invested) * 100 : 0
        return [
          { label: '净盈亏', value: `${net >= 0 ? '+' : ''}${money(net)}`, primary: true },
          { label: '收益率（ROI）', value: `${roi.toFixed(2)}%` },
          { label: '卖出所得（扣费后）', value: money(gross - sellFee) },
          { label: '双边手续费合计', value: money(buyFee + sellFee) },
          { label: '保本卖出价', value: money(buy * (1 + fee * 2)) },
        ]
      },
    },
  },
  {
    slug: 'bond-ytm-calculator', title: '债券到期收益率', category: 'finance',
    desc: '由价格、面值、票息与期限数值求解 YTM、当期收益率与有效年收益率。',
    keywords: ['债券', 'ytm', '收益率'],
    calcDef: {
      fields: [
        F('price', '当前价格', { placeholder: '如 950' }),
        F('par', '面值', { default: 1000 }),
        F('coupon', '票面利率（%）', { step: 0.01 }),
        F('years', '剩余年限（年）', { step: 0.5 }),
        { key: 'freq', label: '年付息次数', type: 'select', default: '2', choices: [{ value: '1', label: '每年 1 次' }, { value: '2', label: '每年 2 次（常见）' }, { value: '4', label: '每季度' }] },
      ],
      compute: (v) => {
        if (!v.price || !v.coupon || !v.years) return [{ label: '请填写当前价格、票面利率与剩余年限', value: '—' }]
        const r = bondYtm(Number(v.price), Number(v.par), Number(v.coupon), Number(v.years), Number(v.freq))
        return [
          { label: '到期收益率（YTM）', value: `${r.ytm.toFixed(3)}%`, primary: true },
          { label: '当期收益率', value: `${r.currentYield.toFixed(3)}%` },
          { label: '有效年收益率', value: `${r.effectiveAnnual.toFixed(3)}%` },
          { label: '判断', value: r.ytm > Number(v.coupon) ? '折价买入，YTM 高于票息' : r.ytm < Number(v.coupon) ? '溢价买入，YTM 低于票息' : '平价' },
        ]
      },
      note: 'YTM 通过牛顿迭代数值求解，假设持有到期且利息按相同利率再投资。',
    },
  },
  {
    slug: 'portfolio-rebalance-calculator', title: '组合再平衡计算器', category: 'finance',
    desc: '输入各持仓现值与目标配比，得到每类资产应买入或卖出的精确金额。',
    keywords: ['再平衡', '资产配置', '组合'],
    component: () => import('./components/PortfolioRebalance.vue'),
  },
  {
    slug: 'sip-calculator', title: '定投收益计算器', category: 'finance',
    desc: '估算每月定投的到期价值：本金、预期收益与总回报一目了然。',
    keywords: ['定投', 'sip', '基金'],
    calcDef: {
      fields: [
        F('monthly', '每月定投金额', { placeholder: '如 2000' }),
        F('rate', '预期年化收益（%）', { default: 8, step: 0.5 }),
        F('years', '投资年限（年）', { default: 10, step: 1 }),
      ],
      compute: (v) => {
        const m = Number(v.monthly)
        const r = (Number(v.rate) || 0) / 100 / 12
        const n = Math.round((Number(v.years) || 0) * 12)
        const fv = r === 0 ? m * n : m * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
        const invested = m * n
        return [
          { label: '到期总值', value: money(fv), primary: true },
          { label: '累计投入本金', value: money(invested) },
          { label: '预期收益', value: money(fv - invested) },
          { label: '收益占本金比', value: invested ? `${(((fv - invested) / invested) * 100).toFixed(0)}%` : '—' },
        ]
      },
      note: '按月末定投、收益按月复利计算（标准 SIP 公式）。实际市场存在波动。',
    },
  },
  {
    slug: 'fire-calculator', title: '财务自由计算器', category: 'finance',
    desc: '计算 FIRE 目标金额与可达年份：由储蓄、收入、支出、收益率与提取率推演。',
    keywords: ['fire', '财务自由', '退休'],
    calcDef: {
      fields: [
        F('savings', '当前储蓄', { placeholder: '如 200000' }),
        F('income', '年收入', { placeholder: '如 300000' }),
        F('expense', '年支出', { placeholder: '如 120000' }),
        F('ret', '投资年化收益（%）', { default: 6, step: 0.5 }),
        F('withdraw', '安全提取率（%）', { default: 4, step: 0.1 }),
      ],
      compute: (v) => {
        const target = (Number(v.expense) * 100) / (Number(v.withdraw) || 4)
        const yearlySave = Number(v.income) - Number(v.expense)
        const r = (Number(v.ret) || 0) / 100
        let cur = Number(v.savings)
        let years = 0
        const points: { year: number; value: number }[] = []
        while (cur < target && years < 80) {
          cur = cur * (1 + r) + yearlySave
          years++
          if (years % 5 === 0) points.push({ year: years, value: cur })
        }
        const rows: CalcResultRow[] = [
          { label: 'FIRE 目标金额', value: money(target), primary: true, hint: `年支出 ÷ ${v.withdraw}% 提取率` },
          { label: '每年可存', value: money(yearlySave) },
        ]
        rows.push(
          years < 80
            ? { label: '预计达成时间', value: `${years} 年后` }
            : { label: '预计达成时间', value: '80 年内无法达成', hint: '试着提高收入、降低支出或预期收益' },
        )
        for (const p of points.slice(0, 3)) rows.push({ label: `${p.year} 年后资产`, value: money(p.value) })
        return rows
      },
      note: '按年末一次性存入、收益按年复利简化计算。4% 提取率源自三一学院研究，并非保证。',
    },
  },
]

export default tools
