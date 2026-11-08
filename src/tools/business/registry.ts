import type { ToolDef, CalcFieldDef } from '@/types'

const F = (k: string, label: string, extra: Partial<CalcFieldDef> = {}): CalcFieldDef => ({
  key: k, label, type: 'number', default: '', ...extra,
})
const money = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const pct = (n: number) => `${n.toFixed(2)}%`

/** 商业 SaaS 工具注册表（15 项） */
const tools: ToolDef[] = [
  { slug: 'resume-builder', title: '简历生成器', category: 'business', desc: '填写经历即可生成排版整洁的简历页面，浏览器直接打印/另存 PDF，无水印。', keywords: ['简历', 'cv', 'resume'], component: () => import('./components/ResumeBuilder.vue'), steps: ['填写基本信息与经历', '选择模板样式', '打印或另存为 PDF'] },
  {
    slug: 'take-home-pay-calculator', title: '税后工资计算器', category: 'business',
    desc: '由税前年薪与有效税率估算每月/每年到手工资与扣除明细。',
    keywords: ['税后', '工资', '到手'],
    calcDef: {
      fields: [
        F('gross', '税前年薪', { placeholder: '如 300000' }),
        F('taxRate', '有效税率（%）', { default: 15, step: 0.5 }),
        F('other', '其他月度扣除（社保公积金等）', { placeholder: '如 2000' }),
        F('months', '发放月数', { default: 12 }),
      ],
      compute: (v) => {
        const gross = Number(v.gross)
        const tax = gross * ((Number(v.taxRate) || 0) / 100)
        const otherYear = (Number(v.other) || 0) * Number(v.months)
        const net = gross - tax - otherYear
        const months = Number(v.months) || 12
        return [
          { label: '每年到手', value: `¥${money(net)}`, primary: true },
          { label: '每月到手', value: `¥${money(net / months)}` },
          { label: '年度个税', value: `¥${money(tax)}` },
          { label: '其他扣除合计', value: `¥${money(otherYear)}` },
          { label: '实际到手率', value: gross ? pct((net / gross) * 100) : '—' },
        ]
      },
      note: '使用「有效税率」简化计算，未模拟累进税率表；其他扣除按每月固定金额 × 月数。',
    },
  },
  {
    slug: 'roi-calculator', title: 'ROI / ROAS 计算器', category: 'business',
    desc: '计算投资回报率与广告支出回报率，支持按持有期年化。',
    keywords: ['roi', 'roas', '回报'],
    calcDef: {
      fields: [
        F('cost', '总投入成本', { placeholder: '如 10000' }),
        F('revenue', '带来的总收入', { placeholder: '如 18000' }),
        F('months', '持有月数（年化用，可选）', { placeholder: '如 6' }),
      ],
      compute: (v) => {
        const cost = Number(v.cost)
        const profit = Number(v.revenue) - cost
        const roi = cost > 0 ? (profit / cost) * 100 : 0
        const roas = cost > 0 ? Number(v.revenue) / cost : 0
        const months = Number(v.months)
        const rows = [
          { label: '净利润', value: `${profit >= 0 ? '+' : ''}¥${money(profit)}` },
          { label: 'ROI（投资回报率）', value: pct(roi), primary: true },
          { label: 'ROAS（广告支出回报）', value: `${roas.toFixed(2)}×` },
        ]
        if (months > 0) {
          const annualized = (Math.pow(Math.max(0.0001, Number(v.revenue) / Math.max(1, cost)), 12 / months) - 1) * 100
          rows.push({ label: '年化 ROI', value: pct(annualized) })
        }
        return rows
      },
      note: 'ROI =（收入 − 成本）/ 成本；ROAS = 收入 / 广告支出。',
    },
  },
  {
    slug: 'freelance-rate-calculator', title: '自由职业报价计算', category: 'business',
    desc: '由目标年收入、开销、可计费小时与利润目标反推时薪与日报价。',
    keywords: ['自由职业', '时薪', '报价'],
    calcDef: {
      fields: [
        F('income', '目标年净收入', { placeholder: '如 300000' }),
        F('expenses', '年业务开销', { placeholder: '如 30000' }),
        F('hours', '每周可计费小时', { default: 25, step: 1 }),
        F('weeks', '每年工作周数', { default: 46, step: 1 }),
        F('profit', '目标利润率（%）', { default: 15, step: 1 }),
      ],
      compute: (v) => {
        const billable = Number(v.hours) * Number(v.weeks)
        const base = (Number(v.income) + Number(v.expenses)) / Math.max(1, billable)
        const rate = base * (1 + (Number(v.profit) || 0) / 100)
        return [
          { label: '建议时薪', value: `¥${money(rate)}`, primary: true },
          { label: '建议日薪（8 小时）', value: `¥${money(rate * 8)}` },
          { label: '年可计费小时', value: `${billable} 小时` },
          { label: '保本时薪（无利润）', value: `¥${money(base)}` },
        ]
      },
      note: '时薪 =（目标收入 + 开销）÷ 可计费小时 ×（1 + 目标利润率）。',
    },
  },
  {
    slug: 'break-even-calculator', title: '盈亏平衡点计算', category: 'business',
    desc: '由固定成本、单价与单位变动成本计算保本销量与保本收入。',
    keywords: ['盈亏平衡', '保本', 'break even'],
    calcDef: {
      fields: [
        F('fixed', '固定成本（月）', { placeholder: '如 50000' }),
        F('price', '单件售价', { step: 0.01 }),
        F('variable', '单件变动成本', { step: 0.01 }),
      ],
      compute: (v) => {
        const cm = Number(v.price) - Number(v.variable)
        if (cm <= 0) {
          return [{ label: '单位贡献毛利', value: money(cm), primary: true, hint: '售价不高于变动成本，无法盈利，请先调整定价或成本' }]
        }
        const units = Number(v.fixed) / cm
        return [
          { label: '单位贡献毛利', value: `¥${money(cm)}` },
          { label: '保本销量', value: `${Math.ceil(units)} 件`, primary: true },
          { label: '保本收入', value: `¥${money(Math.ceil(units) * Number(v.price))}` },
          { label: '贡献毛利率', value: pct((cm / Number(v.price)) * 100) },
        ]
      },
      note: '保本销量 = 固定成本 ÷（单价 − 单位变动成本）。',
    },
  },
  {
    slug: 'profit-margin-calculator', title: '利润率计算器', category: 'business',
    desc: '由成本与售价计算利润、毛利率与加价率，或按目标毛利率反推售价。',
    keywords: ['利润率', '毛利', '加价'],
    calcDef: {
      fields: [
        F('cost', '单位成本', { step: 0.01 }),
        F('price', '售价（与目标毛利率二选一）', { step: 0.01 }),
        F('targetMargin', '目标毛利率（%，反推售价）', { step: 0.1 }),
      ],
      compute: (v) => {
        const cost = Number(v.cost)
        if (Number(v.price)) {
          const price = Number(v.price)
          const profit = price - cost
          return [
            { label: '单件利润', value: `¥${money(profit)}` },
            { label: '毛利率', value: cost > 0 ? pct((profit / price) * 100) : '—', primary: true },
            { label: '加价率（Markup）', value: cost > 0 ? pct((profit / cost) * 100) : '—' },
            { label: '成本占比', value: price > 0 ? pct((cost / price) * 100) : '—' },
          ]
        }
        if (Number(v.targetMargin)) {
          const price = cost / (1 - Number(v.targetMargin) / 100)
          return [
            { label: '建议售价', value: `¥${money(price)}`, primary: true },
            { label: '单件利润', value: `¥${money(price - cost)}` },
            { label: '验证毛利率', value: pct(Number(v.targetMargin)) },
          ]
        }
        return [{ label: '提示', value: '请填写售价或目标毛利率' }]
      },
      note: '毛利率 =（售价 − 成本）/ 售价；加价率 =（售价 − 成本）/ 成本。',
    },
  },
  {
    slug: 'ltv-calculator', title: '客户终身价值 LTV', category: 'business',
    desc: '由 ARPU、毛利率与月流失率计算客户终身价值与回收周期。',
    keywords: ['ltv', '终身价值', 'arpu'],
    calcDef: {
      fields: [
        F('arpu', '每用户月均收入 ARPU', { placeholder: '如 100' }),
        F('margin', '毛利率（%）', { default: 80, step: 1 }),
        F('churn', '月流失率（%）', { placeholder: '如 3', step: 0.1 }),
      ],
      compute: (v) => {
        const churn = (Number(v.churn) || 0) / 100
        const margin = (Number(v.margin) || 0) / 100
        const life = churn > 0 ? 1 / churn : 999
        const ltv = Number(v.arpu) * margin * life
        return [
          { label: '客户终身价值（LTV）', value: `¥${money(ltv)}`, primary: true },
          { label: '平均客户生命周期', value: life > 900 ? '极长（流失率过低）' : `${life.toFixed(1)} 个月` },
          { label: '月毛利贡献', value: `¥${money(Number(v.arpu) * margin)}` },
        ]
      },
      note: 'LTV = ARPU × 毛利率 ÷ 月流失率。与 CAC 搭配使用，健康线为 LTV ≥ 3 × CAC。',
    },
  },
  {
    slug: 'cash-flow-calculator', title: '现金流预测', category: 'business',
    desc: '逐月编辑收入与支出，查看累计现金曲线、期末余额与最低现金点。',
    keywords: ['现金流', '预测', '现金'],
    component: () => import('./components/CashFlowProjection.vue'),
  },
  {
    slug: 'cac-calculator', title: '获客成本与回收期', category: 'business',
    desc: '计算 CAC、LTV:CAC 比值与回本所需月数，判断投放效率。',
    keywords: ['cac', '获客', '投放'],
    calcDef: {
      fields: [
        F('spend', '市场销售总投入', { placeholder: '如 50000' }),
        F('newCustomers', '新增客户数', { placeholder: '如 50' }),
        F('arpu', '每客户月收入', { placeholder: '如 200' }),
        F('margin', '毛利率（%）', { default: 80, step: 1 }),
      ],
      compute: (v) => {
        const cac = Number(v.newCustomers) > 0 ? Number(v.spend) / Number(v.newCustomers) : 0
        const monthlyProfit = Number(v.arpu) * ((Number(v.margin) || 0) / 100)
        const payback = monthlyProfit > 0 ? cac / monthlyProfit : Infinity
        const ltv = (Number(v.arpu) * ((Number(v.margin) || 0) / 100)) / Math.max(0.001, Number(v.churnPct ?? 3) / 100)
        void ltv
        return [
          { label: '获客成本（CAC）', value: `¥${money(cac)}`, primary: true },
          { label: '每月毛利回收', value: `¥${money(monthlyProfit)}` },
          { label: 'CAC 回本周期', value: Number.isFinite(payback) ? `${payback.toFixed(1)} 个月` : '—' },
          { label: '简单 LTV:CAC（按 36 个月）', value: cac ? `1 : ${(monthlyProfit * 36 / cac).toFixed(1)}` : '—' },
        ]
      },
      note: 'CAC = 市场+销售总投入 ÷ 新增客户数。健康线为回本期 < 12 个月。',
    },
  },
  {
    slug: 'churn-rate-calculator', title: '流失率计算器', category: 'business',
    desc: '由期初、流失与新增数计算客户流失率、留存率与收入流失率。',
    keywords: ['流失', '留存', 'churn'],
    calcDef: {
      fields: [
        F('start', '期初客户数', { placeholder: '如 1000' }),
        F('lost', '期内流失客户数', { placeholder: '如 40' }),
        F('new', '期内新增客户数（可选）', { placeholder: '如 60' }),
        F('mrrLost', '流失 MRR（可选）', { placeholder: '如 4000' }),
        F('mrrStart', '期初 MRR（可选）', { placeholder: '如 100000' }),
      ],
      compute: (v) => {
        const start = Number(v.start)
        const lost = Number(v.lost)
        const churn = start > 0 ? (lost / start) * 100 : 0
        const rows = [
          { label: '客户流失率', value: pct(churn), primary: true },
          { label: '客户留存率', value: pct(100 - churn) },
          { label: '期末客户数', value: `${Math.max(0, start - lost + Number(v.new || 0))}` },
        ]
        if (Number(v.mrrLost) && Number(v.mrrStart)) {
          rows.push({ label: '收入流失率', value: pct((Number(v.mrrLost) / Number(v.mrrStart)) * 100) })
        }
        return rows
      },
      note: '流失率 = 期内流失客户 ÷ 期初客户。月流失率 < 2% 通常被视为健康。',
    },
  },
  {
    slug: 'mrr-calculator', title: 'MRR / ARR 计算器', category: 'business',
    desc: '按订阅档位汇总月度经常性收入与年度经常性收入，或追踪 MRR 变动。',
    keywords: ['mrr', 'arr', '订阅'],
    component: () => import('./components/MrrCalculator.vue'),
  },
  {
    slug: 'cohort-retention-calculator', title: '同期群留存分析', category: 'business',
    desc: '粘贴各期留存数据，生成彩色热力表与平均留存曲线。',
    keywords: ['留存', '同期群', 'cohort'],
    component: () => import('./components/CohortRetention.vue'),
  },
  {
    slug: 'burn-rate-calculator', title: '烧钱率与现金跑道', category: 'business',
    desc: '由现金余额、收入与支出计算月烧钱率、现金跑道与现金耗尽月份。',
    keywords: ['烧钱', '跑道', 'runway'],
    calcDef: {
      fields: [
        F('cash', '当前现金余额', { placeholder: '如 2000000' }),
        F('revenue', '月收入', { placeholder: '如 150000' }),
        F('expense', '月支出', { placeholder: '如 260000' }),
        F('growth', '月收入增长率（%，可选）', { step: 0.5 }),
      ],
      compute: (v) => {
        const burn = Number(v.expense) - Number(v.revenue)
        const runway = burn > 0 ? Number(v.cash) / burn : Infinity
        const d = new Date()
        d.setMonth(d.getMonth() + Math.floor(Number.isFinite(runway) ? runway : 999))
        const rows = [
          { label: '月净烧钱率', value: `¥${money(burn)}`, primary: burn > 0 },
          { label: '现金跑道', value: Number.isFinite(runway) ? (runway > 999 ? '盈利，无限跑道' : `${runway.toFixed(1)} 个月`) : '盈利，无限跑道' },
        ]
        if (Number.isFinite(runway) && runway < 999) {
          rows.push({ label: '预计现金耗尽', value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
        }
        rows.push({ label: '状态判断', value: !Number.isFinite(runway) || runway > 18 ? '健康（>18 个月）' : runway > 12 ? '需要关注（12-18 个月）' : '危险（<12 个月），尽快融资或削减成本' })
        return rows
      },
      note: '净烧钱率 = 月支出 − 月收入；跑道 = 现金 ÷ 净烧钱率。',
    },
  },
  {
    slug: 'rule-of-40-calculator', title: 'Rule of 40 计算器', category: 'business',
    desc: '收入增长率 + 利润率是否达到 40%？一键评估 SaaS 成长健康度。',
    keywords: ['rule of 40', 'saas', '增长'],
    calcDef: {
      fields: [
        F('growth', '收入增长率（%）', { placeholder: '如 35', step: 0.1 }),
        F('margin', '利润率（%，亏损为负）', { placeholder: '如 10', step: 0.1 }),
      ],
      compute: (v) => {
        const score = Number(v.growth) + Number(v.margin)
        return [
          { label: 'Rule of 40 得分', value: score.toFixed(1), primary: true },
          { label: '是否达标（≥40）', value: score >= 40 ? '✓ 达标' : '✗ 未达标' },
          { label: '差距', value: score >= 40 ? `超出 ${pct(score - 40)}` : `还差 ${pct(40 - score)}` },
          { label: '解读', value: score >= 40 ? '增长与盈利的平衡优秀' : '在增长或盈利上仍有提升空间' },
        ]
      },
      note: 'Rule of 40 = 收入增长率% + 利润率%（可用 EBITDA 率或自由现金流率），≥40% 视为优秀。',
    },
  },
  {
    slug: 'saas-pricing-calculator', title: '定价与毛利计算', category: 'business',
    desc: '双向定价：按目标毛利定价，或由价格与折扣反推毛利与利润。',
    keywords: ['定价', '毛利', '折扣'],
    calcDef: {
      fields: [
        F('cost', '单单位成本', { step: 0.01 }),
        { key: 'mode', label: '计算方向', type: 'select', default: 'price', choices: [
          { value: 'price', label: '按目标毛利 → 定价' },
          { value: 'margin', label: '按价格 → 毛利' },
        ] },
        F('target', '目标毛利率（%）或售价（按方向填）', { step: 0.1 }),
        F('discount', '折扣（%，仅毛利方向）', { step: 1 }),
      ],
      compute: (v) => {
        const cost = Number(v.cost)
        const t = Number(v.target)
        if (v.mode === 'price') {
          const price = cost / (1 - t / 100)
          const discounted = price * (1 - (Number(v.discount) || 0) / 100)
          const rows = [
            { label: '建议定价', value: `¥${money(price)}`, primary: true },
            { label: '单毛利', value: `¥${money(price - cost)}` },
          ]
          if (Number(v.discount)) {
            rows.push({ label: `打 ${Number(v.discount)} 折后价格`, value: `¥${money(discounted)}` })
            rows.push({ label: '折后毛利率', value: discounted > 0 ? pct(((discounted - cost) / discounted) * 100) : '—' })
          }
          return rows
        }
        const profit = t - cost
        return [
          { label: '单毛利', value: `¥${money(profit)}`, primary: true },
          { label: '毛利率', value: t ? pct((profit / t) * 100) : '—' },
          { label: '加价率', value: cost ? pct((profit / cost) * 100) : '—' },
          { label: '盈亏平衡折扣', value: t ? pct((1 - cost / t) * 100) : '—', hint: '折扣低于此值仍可保本' },
        ]
      },
    },
  },
]

export default tools
