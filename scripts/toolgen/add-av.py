# -*- coding: utf-8 -*-
"""audio 4 件 + finance 3 件注册追加。"""
import io

# ---------- audio ----------
p = 'src/tools/audio/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD = r'''  { slug: 'mp3-tag-editor', title: 'MP3 标签编辑器', category: 'audio', desc: '读取并修改 MP3 的标题/艺术家/专辑/封面标签，写回新文件副本。', keywords: ['标签', 'id3', '封面', 'mp3'], component: () => import('./components/Mp3TagEditor.vue') },
  { slug: 'audio-equalizer', title: '音频均衡器 EQ', category: 'audio', desc: '10 段均衡实时试听（低音/人声/高音预设），同链离线渲染导出 MP3/WAV。', keywords: ['均衡器', 'eq', '调音', '低音'], component: () => import('./components/AudioEqualizer.vue') },
  { slug: 'audio-visualizer', title: '音频可视化播放器', category: 'audio', desc: '频谱柱状/波形/圆环粒子三主题实时可视化，可截图导出封面图。', keywords: ['可视化', '频谱', '波形', '播放器'], component: () => import('./components/AudioVisualizer.vue') },
  { slug: 'decibel-meter', title: '在线分贝仪', category: 'audio', desc: '麦克风实时估算环境噪音声级，曲线与峰值记录，验房/午休测噪。', keywords: ['分贝', '噪音', '声级', '测噪'], component: () => import('./components/DecibelMeter.vue') },
]

export default tools'''
idx = s.rindex(']\n\nexport default tools')
s = s[:idx] + ADD[ADD.index('  {'):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('audio ok:', s.count("slug: '"))

# ---------- finance ----------
p = 'src/tools/finance/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD2 = r'''  {
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

export default tools'''
idx = s.rindex(']\n\nexport default tools')
s = s[:idx] + ADD2[ADD2.index('  {'):]
s = s.replace(
    "import { blackScholes, kelly, cagr, bondYtm, formatMoney, installmentIrr } from '@/lib/finance'",
    "import { blackScholes, kelly, cagr, bondYtm, formatMoney, installmentIrr, amortize } from '@/lib/finance'")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('finance ok:', s.count("slug: '"))
