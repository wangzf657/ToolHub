import type { ToolDef, CalcFieldDef, CalcResultRow } from '@/types'

const F = (k: string, label: string, extra: Partial<CalcFieldDef> = {}): CalcFieldDef => ({
  key: k, label, type: 'number', default: '', ...extra,
})
const money = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const pct = (n: number) => `${n.toFixed(2)}%`
const pct1 = (n: number) => `${n.toFixed(1)}%`

/** 商业 SaaS 工具注册表（15 项） */
const tools: ToolDef[] = [
  { slug: 'resume-builder', title: '简历生成器', category: 'business', desc: '填写经历即可生成排版整洁的简历页面，浏览器直接打印/另存 PDF，无水印。', keywords: ['简历', 'cv', 'resume'], component: () => import('./components/ResumeBuilder.vue'), steps: ['填写基本信息与经历', '选择模板样式', '打印或另存为 PDF'] },
  { slug: 'email-signature-generator', title: '邮件签名生成器', category: 'business', desc: '生成 Outlook/Gmail/Foxmail 兼容的 HTML 邮件签名，一键复制富文本。', keywords: ['邮件签名', '签名档', 'outlook'], component: () => import('./components/EmailSignatureGenerator.vue') },
  {
    slug: 'freelance-rate-calculator', title: '自由职业报价计算', category: 'business',
    desc: '由目标到手收入、税负、开销、可计费小时与利润目标反推时薪与日报价。',
    keywords: ['自由职业', '时薪', '报价'],
    calcDef: {
      fields: [
        F('income', '目标年净收入（到手口径）', { placeholder: '如 300000' }),
        F('tax', '综合税负率（%，含个税与社保，建议 15~25；留空 = 不折算）', { step: 1 }),
        F('expenses', '年业务开销', { default: 30000 }),
        F('hours', '每周可计费小时', { default: 25, step: 1 }),
        F('weeks', '每年工作周数', { default: 46, step: 1 }),
        F('profit', '目标利润率（%）', { default: 15, step: 1 }),
      ],
      compute: (v) => {
        const billable = Number(v.hours) * Number(v.weeks)
        const tax = Math.min(60, Math.max(0, Number(v.tax) || 0)) / 100
        const grossIncome = Number(v.income) / (1 - tax)
        const base = (grossIncome + Number(v.expenses)) / Math.max(1, billable)
        const rate = base * (1 + (Number(v.profit) || 0) / 100)
        const weekHours = Number(v.hours)
        return [
          { label: '建议时薪', value: `¥${money(rate)}`, primary: true },
          { label: '建议日薪（8 小时）', value: `¥${money(rate * 8)}` },
          { label: '周报价', value: `¥${money(rate * weekHours)}` },
          { label: '月报价', value: `¥${money((rate * billable) / 12)}` },
          { label: '保守价（保本×1.1）', value: `¥${money(base * 1.1)}` },
          { label: '溢价价（标准×1.3）', value: `¥${money(rate * 1.3)}` },
          { label: '保本时薪（无利润）', value: `¥${money(base)}` },
          { label: '年可计费小时', value: `${billable} 小时` },
        ]
      },
      note: '时薪 =(目标收入 ÷(1−综合税负率)+ 年开销)÷ 可计费小时 ×(1 + 目标利润率)；税负率留空则按 0%（不折算）。weeks 默认 46 已预留约 6 周休假/病假；日薪按 8 可计费小时估算；目标收入建议按到手口径并配合税负率（建议 15~25%）折算成税前成本。',
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
      samples: [
        { label: '保守', values: { cost: 50000, revenue: 60000, months: 12 } },
        { label: '常规', values: { cost: 50000, revenue: 90000, months: 12 } },
        { label: '乐观', values: { cost: 50000, revenue: 150000, months: 12 } },
      ],
      compute: (v) => {
        const cost = Number(v.cost)
        const profit = Number(v.revenue) - cost
        const roi = cost > 0 ? (profit / cost) * 100 : 0
        const roas = cost > 0 ? Number(v.revenue) / cost : 0
        const margin = Number(v.revenue) > 0 ? (profit / Number(v.revenue)) * 100 : 0
        const rows = [
          { label: '净利润', value: `${profit >= 0 ? '+' : ''}¥${money(profit)}` },
          { label: 'ROI（投资回报率）', value: pct(roi), primary: true },
          { label: 'ROAS（广告支出回报）', value: `${roas.toFixed(2)}×`, hint: '仅当成本为广告支出时此口径适用' },
          { label: '利润率（净利÷收入）', value: pct(margin) },
        ]
        const months = Number(v.months)
        if (months > 0) {
          const annualized = (Math.pow(Math.max(0.0001, Number(v.revenue) / Math.max(1, cost)), 12 / months) - 1) * 100
          rows.push({ label: '年化 ROI', value: pct(annualized), hint: '年化 =(1+总ROI)^(12/月数)−1（复利口径）' })
        }
        return rows
      },
      note: '净利润 = 收入 − 成本（成本需含全部相关支出）；ROAS = 收入 / 广告支出（仅在成本为广告支出时适用）；年化 =(1+总ROI)^(12/月数)−1。',
      links: [
        { label: '算获客回收 → CAC', to: '/t/cac-calculator', query: (v) => ({ spend: String(v.cost ?? '') }) },
      ],
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
        const tm = Number(v.targetMargin)
        if (Number(v.price)) {
          const price = Number(v.price)
          const profit = price - cost
          const marginPct = cost > 0 ? (profit / price) * 100 : 0
          return [
            { label: '单件利润', value: `¥${money(profit)}` },
            { label: '毛利率', value: cost > 0 ? pct(marginPct) : '—', primary: true },
            { label: '加价率（Markup）', value: cost > 0 ? pct((profit / cost) * 100) : '—' },
            { label: '该毛利率对应的加价率', value: marginPct < 100 ? pct((marginPct / (100 - marginPct)) * 100) : '—', hint: '换算口径：加价率 = 毛利率 ÷(1 − 毛利率)' },
            { label: '成本占比', value: price > 0 ? pct((cost / price) * 100) : '—' },
            ...(tm > 0 ? [{ label: '提示', value: '已按售价优先计算', hint: '「目标毛利率」已忽略；清空售价后走反推分支' }] : []),
          ]
        }
        if (tm) {
          if (tm >= 100) {
            return [{ label: '目标毛利率无效', value: '需低于 100%', primary: true, hint: '等于 100% 意味着零成本，数学上无解' }]
          }
          const price = cost / (1 - tm / 100)
          return [
            { label: '建议售价', value: `¥${money(price)}`, primary: true },
            { label: '单件利润', value: `¥${money(price - cost)}` },
            { label: '成本占比', value: price > 0 ? pct((cost / price) * 100) : '—' },
          ]
        }
        return [{ label: '提示', value: '请填写售价或目标毛利率' }]
      },
      note: '毛利率 =(售价 − 成本)/ 售价；加价率 =(售价 − 成本)/ 成本；反推售价 = 成本 ÷(1 − 目标毛利率)。',
    },
  },
  {
    slug: 'break-even-calculator', title: '盈亏平衡点计算', category: 'business',
    desc: '由固定成本、单价与单位变动成本计算保本销量与保本收入，支持目标利润与安全边际。',
    keywords: ['盈亏平衡', '保本', 'break even'],
    calcDef: {
      fields: [
        F('fixed', '固定成本（月）', { placeholder: '如 50000' }),
        F('price', '单件售价', { step: 0.01 }),
        F('variable', '单件变动成本', { step: 0.01 }),
        F('targetProfit', '目标月利润（可选）', { placeholder: '如 20000' }),
        F('expectedUnits', '预计月销量（可选，算安全边际）', { placeholder: '如 500' }),
      ],
      compute: (v) => {
        const cm = Number(v.price) - Number(v.variable)
        if (cm <= 0) {
          return [{ label: '单位贡献毛利', value: money(cm), primary: true, hint: '售价不高于变动成本，无法盈利，请先调整定价或成本' }]
        }
        const units = Number(v.fixed) / cm
        const beUnits = Math.ceil(units)
        const rows: CalcResultRow[] = [
          { label: '单位贡献毛利', value: `¥${money(cm)}` },
          { label: '保本销量', value: `${beUnits} 件`, primary: true, hint: '保本销量按向上取整，保本收入按取整后件数计算' },
          { label: '保本收入', value: `¥${money(beUnits * Number(v.price))}` },
          { label: '贡献毛利率', value: pct((cm / Number(v.price)) * 100) },
        ]
        const target = Number(v.targetProfit)
        if (target > 0) {
          const tu = Math.ceil((Number(v.fixed) + target) / cm)
          rows.push({ label: `达成目标利润需销量（月）`, value: `${tu} 件（销售额 ¥${money(tu * Number(v.price))}）` })
        }
        const expected = Number(v.expectedUnits)
        if (expected > 0 && beUnits > 0) {
          const safety = expected > beUnits ? ((expected - beUnits) / expected) * 100 : -((beUnits - expected) / expected) * 100
          rows.push({ label: '安全边际率', value: pct(safety), hint: safety < 0 ? '预计销量低于保本点，当前定价/成本结构下会亏损' : '（预计销量 − 保本销量）÷ 预计销量' })
        }
        return rows
      },
      note: '保本销量 = 固定成本 ÷（单价 − 单位变动成本），按向上取整；保本收入 = 取整后件数 × 单价。达成目标利润需销量 =(固定成本 + 目标利润)÷ 单位贡献毛利。',
      links: [
        { label: '定价与毛利 → 定价计算器', to: '/t/saas-pricing-calculator', query: (v) => ({ cost: String(v.variable ?? '') }) },
        { label: '成本利润率速算 → 利润率计算器', to: '/t/profit-margin-calculator', query: (v) => ({ cost: String(v.variable ?? '') }) },
      ],
    },
  },
  {
    slug: 'cash-flow-calculator', title: '现金流预测', category: 'business',
    desc: '逐月编辑收入与支出，查看累计现金曲线、期末余额与最低现金点。',
    keywords: ['现金流', '预测', '现金'],
    component: () => import('./components/CashFlowProjection.vue'),
  },
  {
    slug: 'burn-rate-calculator', title: '烧钱率与现金跑道', category: 'business',
    desc: '由现金余额、收入（可带增长率）与支出计算月烧钱率、现金跑道与现金耗尽月份。',
    keywords: ['烧钱', '跑道', 'runway'],
    calcDef: {
      fields: [
        F('cash', '当前现金余额', { placeholder: '如 2000000' }),
        F('revenue', '月收入', { placeholder: '如 150000' }),
        F('expense', '月支出', { placeholder: '如 260000' }),
        F('growth', '月收入增长率（%，可选，按月复利外推）', { step: 0.5 }),
      ],
      compute: (v) => {
        const cash = Number(v.cash)
        const revenue = Number(v.revenue)
        const expense = Number(v.expense)
        const growth = Math.min(99, Math.max(0, Number(v.growth) || 0)) / 100
        const burn = expense - revenue
        const rows: CalcResultRow[] = []
        let runway: number
        let mode = ''
        if (growth > 0 && burn > 0) {
          // 按月复利外推：收入逐月增长，支出恒定
          let cum = 0
          let m = 0
          const r0 = revenue
          while (cum < cash && m < 600) {
            m++
            cum += expense - r0 * Math.pow(1 + growth, m)
          }
          runway = cum >= cash ? m : Infinity
          mode = '（按增长外推）'
        } else {
          runway = burn > 0 ? cash / burn : Infinity
        }
        rows.push({ label: '月净烧钱率', value: `¥${money(burn)}`, primary: burn > 0 })
        rows.push({
          label: '现金跑道',
          value: Number.isFinite(runway) ? (runway > 600 ? '盈利，无限跑道' : `${runway.toFixed(1)} 个月${mode}`) : `盈利，无限跑道`,
        })
        if (Number.isFinite(runway) && runway <= 600) {
          const d = new Date()
          d.setMonth(d.getMonth() + Math.floor(runway))
          rows.push({ label: '预计现金耗尽', value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
        }
        const state = !Number.isFinite(runway) || runway > 18
          ? '✓ 健康（>18 个月）'
          : runway > 12
            ? '⚠ 需要关注（12-18 个月）'
            : '✗ 危险（<12 个月），尽快融资或削减成本'
        rows.push({ label: '状态判断', value: state, tone: !Number.isFinite(runway) || runway > 18 ? 'ok' : runway > 12 ? 'warn' : 'err', hint: '跑道假设支出恒定；保守评估可用月总支出（gross burn）替代净烧钱率' })
        return rows
      },
      note: '净烧钱率 = 月支出 − 月收入；跑道 = 现金 ÷ 净烧钱率。收入增长率 >0 时按月复利外推（收入逐月增长、支出恒定）；保守评估可用月总支出（gross burn）替代净烧钱率。',
      links: [
        { label: '逐月精算跑道 → 现金流预测', to: '/t/cash-flow-calculator', query: (v) => ({ cash: String(v.cash ?? ''), revenue: String(v.revenue ?? ''), expense: String(v.expense ?? '') }) },
      ],
    },
  },
  {
    slug: 'saas-pricing-calculator', title: '定价与毛利计算', category: 'business',
    desc: '双向定价：按目标毛利定价，或由价格与折扣减让反推毛利与利润。',
    keywords: ['定价', '毛利', '折扣'],
    calcDef: {
      fields: [
        F('cost', '单单位成本', { step: 0.01 }),
        { key: 'mode', label: '计算方向', type: 'select', default: 'price', choices: [
          { value: 'price', label: '按目标毛利 → 定价' },
          { value: 'margin', label: '按价格 → 毛利' },
        ] },
        F('target', '目标毛利率（%）或售价（按方向填）', { step: 0.1 }),
        F('discount', '折扣减让（%，如 20 表示让利 20%）', { step: 1 }),
      ],
      compute: (v) => {
        const cost = Number(v.cost)
        const t = Number(v.target)
        const d = Number(v.discount) || 0
        if (v.mode === 'price') {
          const price = cost / (1 - t / 100)
          const discounted = price * (1 - d / 100)
          const rows: CalcResultRow[] = [
            { label: '建议定价', value: `¥${money(price)}`, primary: true },
            { label: '单毛利', value: `¥${money(price - cost)}` },
          ]
          if (d > 0) {
            rows.push({ label: `让利 ${d}% 后价格`, value: `¥${money(discounted)}` })
            rows.push({ label: '让利后毛利率', value: discounted > 0 ? pct(((discounted - cost) / discounted) * 100) : '—' })
            if (d > 0 && d <= 10) {
              rows.push({ label: '折扣心智提示', value: `「打 ${d} 折」= 让利 ${(100 - d * 10)}%`, hint: '若您想表达打 8 折（让利 20%），请在折扣减让中填 20' })
            }
          }
          return rows
        }
        const profit = t - cost
        return [
          { label: '单毛利', value: `¥${money(profit)}`, primary: true },
          { label: '毛利率', value: t ? pct((profit / t) * 100) : '—' },
          { label: '加价率', value: cost ? pct((profit / cost) * 100) : '—' },
          { label: '盈亏平衡折扣', value: t ? pct((1 - cost / t) * 100) : '—', hint: '让利百分比低于此值仍可保本' },
        ]
      },
      note: '定价 = 成本 ÷（1 − 目标毛利率）；毛利率分母为售价；折扣按减让百分比计算（填 20 表示让利 20%，即打 8 折）。',
      links: [
        { label: '成本利润率速算 → 利润率计算器', to: '/t/profit-margin-calculator', query: (v) => ({ cost: String(v.cost ?? '') }) },
      ],
    },
  },
  {
    slug: 'rule-of-40-calculator', title: 'Rule of 40 计算器', category: 'business',
    desc: '收入增长率 + 利润率是否达到 40%？一键评估 SaaS 成长健康度。',
    keywords: ['rule of 40', 'saas', '增长'],
    calcDef: {
      fields: [
        F('growth', '收入增长率（%，YoY 口径）', { placeholder: '如 35', step: 0.1 }),
        F('margin', '利润率（%，亏损为负）', { placeholder: '如 10', step: 0.1 }),
        { key: 'basis', label: '利润率口径', type: 'select', default: 'ebitda', choices: [
          { value: 'ebitda', label: 'EBITDA 率' },
          { value: 'fcf', label: '自由现金流率（FCF）' },
          { value: 'op', label: '经营利润率' },
        ] },
      ],
      compute: (v) => {
        const score = Number(v.growth) + Number(v.margin)
        const basisLabel = v.basis === 'fcf' ? '自由现金流率' : v.basis === 'op' ? '经营利润率' : 'EBITDA 率'
        const quadrant =
          Number(v.growth) >= 40 && Number(v.margin) >= 0
            ? '增长驱动型（增长 ≥40 且未亏损）'
            : Number(v.margin) >= 40 && Number(v.growth) >= 0
              ? '盈利驱动型（利润 ≥40 且仍在增长）'
              : Number(v.growth) < 20 && Number(v.margin) < 20
                ? '双低（增长与利润均低于 20，优先补增长）'
                : '均衡型（40 线附近，增长与利润互补）'
        const rows: CalcResultRow[] = [
          { label: 'Rule of 40 得分', value: score.toFixed(1), primary: true },
          { label: '是否达标（≥40）', value: score >= 40 ? '✓ 达标' : '⚠ 未达标', tone: score >= 40 ? 'ok' : score >= 30 ? 'warn' : 'err' },
          { label: '差距', value: score >= 40 ? `超出 ${pct(score - 40)}` : `还差 ${pct(40 - score)}` },
          { label: '象限解读', value: quadrant },
          { label: '参照（示例值，请以最新报告为准）', value: '上市 SaaS 中位约 35；前 1/4 > 60', hint: '来源：Bessemer / Battery 年度云基准报告' },
        ]
        return rows
      },
      note: 'Rule of 40 = 收入增长率%（YoY）+ 利润率%（当前口径见上方下拉），≥40% 视为优秀。参照值为公开基准报告的示例量级，请以最新报告为准。',
    },
  },
  {
    slug: 'ltv-calculator', title: '客户终身价值 LTV', category: 'business',
    desc: '由 ARPU、毛利率与流失率计算客户终身价值与回收周期，支持 LTV:CAC 判定。',
    keywords: ['ltv', '终身价值', 'arpu'],
    calcDef: {
      fields: [
        F('arpu', '每用户月均收入 ARPU', { placeholder: '如 100' }),
        F('margin', '毛利率（%）', { default: 80, step: 1 }),
        F('churn', '流失率（%）', { placeholder: '如 3', step: 0.1 }),
        { key: 'period', label: '流失率周期', type: 'select', default: 'month', choices: [
          { value: 'month', label: '月流失率' },
          { value: 'year', label: '年流失率（自动 ÷12 换算月）' },
        ] },
        F('cac', '客户获取成本 CAC（可选，算比值）', { placeholder: '如 500' }),
      ],
      compute: (v) => {
        const margin = Math.min(100, Math.max(0, Number(v.margin) || 0)) / 100
        const arpu = Number(v.arpu)
        const period = String(v.period || 'month')
        let churnPct = Number(v.churn) || 0
        let monthlyChurn = period === 'year' ? churnPct / 12 : churnPct
        const rows: CalcResultRow[] = []
        if (monthlyChurn <= 0 || monthlyChurn >= 50) {
          return [
            { label: '流失率校验', value: '应在 0~50% 之间', primary: true, tone: 'err', hint: '月流失率过低请直接评估合同价值（长期合约不宜用流失率口径）' },
          ]
        }
        if (period === 'year') {
          rows.push({ label: '年流失率换算月率', value: pct1(monthlyChurn), hint: '简单口径：月流失率 ≈ 年流失率 ÷ 12' })
        }
        const churn = monthlyChurn / 100
        const life = 1 / churn
        const ltv = arpu * margin * life
        rows.push({ label: '客户终身价值（LTV）', value: `¥${money(ltv)}`, primary: true })
        rows.push({ label: '平均客户生命周期', value: `${life.toFixed(1)} 个月` })
        rows.push({ label: '月毛利贡献', value: `¥${money(arpu * margin)}` })
        const cac = Number(v.cac)
        if (cac > 0) {
          const ratio = ltv / cac
          const verdict = ratio >= 3 ? '健康（≥3）' : ratio >= 1 ? '关注（1~3）' : '危险（<1）'
          rows.push({ label: 'LTV : CAC', value: `1 : ${ratio.toFixed(1)}（${verdict}）`, tone: ratio >= 3 ? 'ok' : ratio >= 1 ? 'warn' : 'err', hint: '健康线为 LTV ≥ 3 × CAC；CAC 2000、LTV 2666 这类低于健康线的组合请关注回收' })
        }
        return rows
      },
      note: 'LTV = ARPU × 毛利率 ÷ 月流失率（年流失率自动 ÷12）。简单口径假设月流失率恒定、不含扩容收入与折现，适合订阅制快估。健康线为 LTV ≥ 3 × CAC。',
      links: [
        { label: '精确算流失率 → churn-rate-calculator', to: '/t/churn-rate-calculator' },
        { label: '算回收 → CAC', to: '/t/cac-calculator', query: (v) => ({ arpu: String(v.arpu ?? ''), margin: String(v.margin ?? '') }) },
      ],
    },
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
        F('churnPct', '月流失率%（可选，真实 LTV:CAC 口径）', { placeholder: '如 3', step: 0.1 }),
      ],
      compute: (v) => {
        const cac = Number(v.newCustomers) > 0 ? Number(v.spend) / Number(v.newCustomers) : 0
        const monthlyProfit = Number(v.arpu) * (Math.min(100, Math.max(0, Number(v.margin) || 0)) / 100)
        const payback = monthlyProfit > 0 ? cac / monthlyProfit : Infinity
        const rows: CalcResultRow[] = [
          { label: '获客成本（CAC）', value: `¥${money(cac)}`, primary: true },
          { label: '每月毛利回收', value: `¥${money(monthlyProfit)}` },
          { label: 'CAC 回本周期', value: Number.isFinite(payback) ? `${payback.toFixed(1)} 个月` : '—' },
        ]
        const churn = Number(v.churnPct) || 0
        if (churn > 0 && churn < 50) {
          const ltv = monthlyProfit / (churn / 100)
          rows.push({ label: 'LTV:CAC（流失率口径）', value: cac ? `1 : ${(ltv / cac).toFixed(1)}` : '—', hint: '按 ARPU×毛利率÷月流失率计算（真实口径）' })
          const ratio = cac ? ltv / cac : 0
          const v1 = verdictOf(payback, ratio)
          rows.push({ label: '投放健康度', value: v1.text, tone: v1.tone })
        } else {
          const approxRatio = cac ? (monthlyProfit * 36) / cac : 0
          rows.push({ label: '简单 LTV:CAC（按 36 个月近似）', value: cac ? `1 : ${approxRatio.toFixed(1)}` : '—', hint: '近似口径：高流失业务请填写月流失率改用真实口径' })
          const v2 = verdictOf(payback, approxRatio)
          rows.push({ label: '投放健康度', value: v2.text, tone: v2.tone })
        }
        return rows
      },
      note: 'CAC = 市场+销售总投入 ÷ 新增客户数。健康判定：回本 < 12 个月 且 LTV:CAC ≥ 3 为「健康」；仅一项达标为「关注」；均不达标为「危险」。未填月流失率时按 36 个月生命周期近似，高流失业务请改用流失率口径。',
      links: [
        { label: '精确算 LTV → LTV 计算器', to: '/t/ltv-calculator', query: (v) => ({ arpu: String(v.arpu ?? ''), margin: String(v.margin ?? '') }) },
      ],
    },
  },
  {
    slug: 'churn-rate-calculator', title: '流失率计算器', category: 'business',
    desc: '由期初、流失与新增数计算客户流失率、留存率与收入流失率，支持周期切换与年化。',
    keywords: ['流失', '留存', 'churn'],
    calcDef: {
      fields: [
        F('start', '期初客户数', { placeholder: '如 1000' }),
        F('lost', '期内流失客户数', { placeholder: '如 40' }),
        F('new', '期内新增客户数（可选）', { placeholder: '如 60' }),
        F('mrrLost', '流失 MRR（可选）', { placeholder: '如 4000' }),
        F('mrrStart', '期初 MRR（可选）', { placeholder: '如 100000' }),
        { key: 'period', label: '统计周期', type: 'select', default: 'month', choices: [
          { value: 'month', label: '月' },
          { value: 'quarter', label: '季' },
          { value: 'year', label: '年' },
        ] },
      ],
      compute: (v) => {
        const start = Number(v.start)
        const lost = Number(v.lost)
        const period = String(v.period || 'month')
        const label = period === 'month' ? '月' : period === 'quarter' ? '季' : '年'
        const stepsPerYear = period === 'month' ? 12 : period === 'quarter' ? 4 : 1
        if (start > 0 && (lost < 0 || lost > start)) {
          return [{ label: '流失数校验', value: '应在 0 与期初客户数之间', primary: true, tone: 'err', hint: `流失 ${lost} 超出期初 ${start}，请检查输入` }]
        }
        const churn = start > 0 ? (lost / start) * 100 : 0
        const monthlyChurn = (1 - Math.pow(1 - churn / 100, 1 / (period === 'year' ? 12 : period === 'quarter' ? 3 : 1))) * 100
        const annualChurn = (1 - Math.pow(1 - churn / 100, stepsPerYear)) * 100
        const rows: CalcResultRow[] = [
          { label: `客户流失率（${label}口径）`, value: pct(churn), primary: true },
          { label: '客户留存率', value: pct(100 - churn) },
          { label: '折算年流失率', value: pct1(annualChurn), hint: period === 'month' ? '公式：1 −(1 − 月流失)^12' : period === 'quarter' ? '公式：1 −(1 − 季流失)^4' : '年口径即年流失率' },
        ]
        const m = monthlyChurn
        const verdict = m < 2 ? '健康（月口径 < 2%）' : m <= 5 ? '关注（月口径 2~5%）' : '危险（月口径 > 5%）'
        rows.push({ label: '健康判定（按月口径）', value: verdict, tone: m < 2 ? 'ok' : m <= 5 ? 'warn' : 'err' })
        rows.push({ label: '期末客户数', value: `${Math.max(0, start - lost + Number(v.new || 0))}` })
        if (Number(v.mrrLost) && Number(v.mrrStart)) {
          rows.push({ label: '收入流失率', value: pct((Number(v.mrrLost) / Number(v.mrrStart)) * 100) })
        }
        return rows
      },
      note: '流失率 = 期内流失客户 ÷ 期初客户。月口径流失率 < 2% 通常被视为健康；年流失率按复利折算（1 −(1 − 期流失)^期数/年）。',
      links: [
        { label: '用此流失率算 LTV →', to: '/t/ltv-calculator', query: (v) => {
          const period = String(v.period || 'month')
          const start = Number(v.start)
          const lost = Number(v.lost)
          const churn = start > 0 ? (lost / start) * 100 : 0
          const monthly = period === 'month' ? churn : period === 'quarter' ? (1 - Math.pow(1 - churn / 100, 1 / 3)) * 100 : (1 - Math.pow(1 - churn / 100, 1 / 12)) * 100
          return { churn: monthly.toFixed(1) }
        } },
      ],
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
]

/** CAC 投放健康度判定（文案 + 语义着色） */
function verdictOf(payback: number, ratio: number): { text: string; tone: 'ok' | 'warn' | 'err' } {
  const okPayback = Number.isFinite(payback) && payback < 12
  const okRatio = ratio >= 3
  if (okPayback && okRatio) return { text: '✓ 健康（回本 <12 个月且比值 ≥3）', tone: 'ok' }
  if (okPayback || okRatio) return { text: '⚠ 关注（仅一项达标）', tone: 'warn' }
  return { text: '✗ 危险：收紧投放或提价', tone: 'err' }
}

export default tools
