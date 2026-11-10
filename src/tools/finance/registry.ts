import type { ToolDef, CalcFieldDef, CalcResultRow } from '@/types'
import { blackScholes, kelly, cagr, bondYtm, formatMoney, installmentIrr, amortize } from '@/lib/finance'

const F = (k: string, label: string, extra: Partial<CalcFieldDef> = {}): CalcFieldDef => ({
  key: k, label, type: 'number', default: '', ...extra,
})

const money = (n: number) => formatMoney(n)

/** 金融交易工具注册表（20 项） */
const tools: ToolDef[] = [
  {
    slug: 'stock-average-calculator', title: '摊薄成本计算器', category: 'finance',
    desc: '逐笔录入买入价格与数量，计算加权平均成本、总股数与总投入。',
    keywords: ['摊薄', '成本', '加仓'],
    component: () => import('./components/StockAverage.vue'),
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
    slug: 'dividend-calculator', title: '股息收益计算器', category: 'finance',
    desc: '按年投影股息收入：支持股息再投资（DRIP）、股息增长与股价增长。',
    keywords: ['股息', 'drip', '被动收入'],
    component: () => import('./components/DividendCalculator.vue'),
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
    slug: 'sharpe-ratio-calculator', title: '夏普 / 索提诺比率', category: 'finance',
    desc: '粘贴各期收益率序列，计算均值、标准差、下行波动与夏普/索提诺比率。',
    keywords: ['夏普', 'sortino', '风险调整'],
    component: () => import('./components/SharpeRatio.vue'),
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
      ],
      compute: (v) => {
        const principal = Number(v.principal), months = Number(v.months), feeRate = Number(v.feeRate)
        if (!(principal > 0) || !(months > 0) || !(feeRate >= 0)) return [{ label: '请填写分期本金与费率', value: '—' }]
        const r = installmentIrr(principal, months, feeRate)
        const m = (x: number) => money(x)
        return [
          { label: '每期还款额', value: `¥${m(r.monthlyPayment)}`, hint: `每期手续费 ¥${m((principal * feeRate) / 100)}（不随本金递减）` },
          { label: '手续费总额', value: `¥${m(r.totalFee)}` },
          { label: '名义年化费率', value: `${money(r.nominalRate)}%`, hint: '每期费率 × 12' },
          { label: '真实年化利率（IRR）', value: r.realIrr === null ? '—' : `${money(r.realIrr)}%`, primary: true, hint: '按资金实际占用折算，通常显著高于名义费率' },
        ]
      },
      note: '口径：手续费按全额计收、本金按月等额摊还，用 IRR（牛顿迭代+二分）求内部收益率并年化；各银行规则略有差异，以账单为准。',
    },
  },
  {
    slug: 'irr-npv-calculator', title: 'IRR / 净现值计算器', category: 'finance',
    desc: '不规则现金流求内部收益率 IRR、MIRR 与净现值 NPV，保险年金、项目投资评估。',
    keywords: ['IRR', 'NPV', '内部收益率', '现金流', '净现值'],
    component: () => import('./components/IrrNpvCalculator.vue'),
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
      ],
      compute: (v) => {
        const loan = Number(v.loan), r = Number(v.r), months = Math.round(Number(v.months))
        if (!(loan > 0) || !(r >= 0) || !(months > 0)) return [{ label: '请填写贷款金额', value: '—' }]
        const res = amortize(loan, r, months, v.mode === 'axbj' ? 'axbj' : 'axbx')
        const m = (x: number) => money(x)
        const first = res.rows[0]?.payment ?? 0
        const last = res.rows[res.rows.length - 1]?.payment ?? 0
        const rows: CalcResultRow[] = v.mode === 'axbj'
          ? [
              { label: '首月月供', value: '¥' + m(first), primary: true, hint: '末月递减至 ¥' + m(last) },
              { label: '每月递减', value: '¥' + m(first && last ? (first - last) / Math.max(1, months - 1) : 0) },
              { label: '利息总额', value: '¥' + m(res.totalInterest) },
              { label: '本息合计', value: '¥' + m(res.total) },
            ]
          : [
              { label: '每月月供', value: '¥' + m(res.monthly), primary: true },
              { label: '利息总额', value: '¥' + m(res.totalInterest) },
              { label: '本息合计', value: '¥' + m(res.total) },
            ]
        rows.push({ label: '车价参考（含三成首付）', value: '¥' + m(loan / 0.7), hint: '贷款 70% 时对应的全款车价' })
        return rows
      },
      note: '口径：等额本息月供固定、等额本金每月本金相同；未计入 GPS 费/金融服务费/上牌抵押费等购车杂费；利率以合同为准。',
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
        { key: 'r', label: '年利率（普通模式）', type: 'number', default: 3.6, suffix: '%', step: 0.01 },
        { key: 'feeRate', label: '每期手续费率（手续费模式）', type: 'number', default: 0.33, suffix: '%', step: 0.01 },
        { key: 'months', label: '期限', type: 'select', default: '36', choices: [
          { value: '12', label: '1 年' }, { value: '24', label: '2 年' }, { value: '36', label: '3 年' }, { value: '60', label: '5 年' },
        ] },
      ],
      compute: (v) => {
        const loan = Number(v.loan), months = Math.round(Number(v.months))
        if (!(loan > 0) || !(months > 0)) return [{ label: '请填写贷款金额', value: '—' }]
        const m = (x: number) => money(x)
        if (v.mode === 'fee') {
          const r = installmentIrr(loan, months, Number(v.feeRate))
          return [
            { label: '每期还款额', value: '¥' + m(r.monthlyPayment), primary: true, hint: '本金均摊 + 全额计费的手续费' },
            { label: '手续费总额', value: '¥' + m(r.totalFee) },
            { label: '名义年化费率', value: money(r.nominalRate) + '%' },
            { label: '真实年化利率（IRR）', value: r.realIrr === null ? '—' : money(r.realIrr) + '%', hint: '资金逐月占用折算，通常远高于「宣传费率×12」' },
          ]
        }
        const res = amortize(loan, Number(v.r), months, 'axbx')
        return [
          { label: '每月月供', value: '¥' + m(res.monthly), primary: true },
          { label: '利息总额', value: '¥' + m(res.totalInterest) },
          { label: '本息合计', value: '¥' + m(res.total) },
          { label: '对比：0.33%/期手续费在同期限下的真实年化', value: (() => { const f = installmentIrr(loan, months, 0.33); return f.realIrr === null ? '—' : money(f.realIrr) + '%' })(), hint: '判断「手续费模式」是否比利率模式更贵' },
        ]
      },
      note: '口径：手续费模式按全额计费、本金等额摊还，IRR 牛顿迭代年化；装修贷资金用途受监管约束，费率以银行合同为准。',
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
        const eq = amortize(loan, Number(v.r) * 100, months, 'axbx')
        return [
          { label: '前期月供', value: '¥' + m(monthly), primary: true, hint: '共 ' + (months - 1) + ' 期' },
          { label: '末期尾付', value: '¥' + m(fv + loan * r), hint: '尾付本金 ¥' + m(fv) + ' + 末期利息' },
          { label: '利息总额', value: '¥' + m(totalInterest) },
          { label: '对比等额本息月供', value: '¥' + m(eq.monthly) + '（利息 ¥' + m(eq.totalInterest) + '）' },
          { label: '风险提示', value: '尾付占比 ' + money(bp * 100) + '%，到期需一次性筹措大额资金，请预留再融资或出售渠道', primary: false },
        ]
      },
      note: '口径：前期月供按「摊还本金部分的年金」计算，末期利息按剩余尾付单月利息估算；气球贷实际结息方式各机构不同，以合同为准。',
    },
  },
]

export default tools