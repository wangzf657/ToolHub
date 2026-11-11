import type { ToolDef, CalcResultRow } from '@/types'
import {
  toCase, sortLines, removeDuplicateLines, reverseText, removeLineBreaks, repeatText,
  morseEncode, morseDecode, textToBinary, binaryToText, caesar, toRoman, fromRoman,
  numberToChinese, numberToEnglish, wordFrequency, isPalindrome, isAnagram, findReplace, randomString,
  uuidv4, slugify, piiScrub, textStats,
} from '@/lib/textEngine'
import { loanPayment, compoundInterest } from '@/lib/finance'
import { calcAge, convertTimezone, dateDiff, COMMON_TIMEZONES, tzOffsetAt } from '@/lib/dateEngine'
import { annualIncomeTax, annualBonusTax, computeInsurance, CITY_INSURANCE } from '@/lib/chinaPayroll'
import { pinyinOf, variantConvert, type VariantMode } from '@/lib/chineseText'
import { extractFromText, EXTRACT_TYPES, cleanText, fullToHalf, halfToFull, type ExtractType } from '@/lib/textExt'
import { idCardValid, cnDate, phoneCarrier } from '@/lib/validators'
import { retirementFor, RETIRE_KINDS, shiftOn, SHIFT_MODELS, bloodInherit, formatCitation } from '@/lib/utilLife'
import { SIZE_CHARTS, recommendSize } from '@/lib/utilData'
import { dateAddMonths } from '@/lib/chinaCalendar'
import { parseAddresses } from '@/lib/textExt'

const fmtN = (n: number): string => {
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? n.toLocaleString('zh-CN') : n.toFixed(2).replace(/\.?0+$/, '')
}
/** 按本地时区格式化 yyyy-mm-dd（toISOString 会按 UTC 偏移导致差一天） */
const fmtDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const moneyCn = (n: number): string =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const fmtDuration = (mins: number): string => {
  const m = Math.round(mins)
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`
}
const TZ_CHOICES = COMMON_TIMEZONES.map((t) => ({ value: t.value, label: t.label }))

/** 实用工具注册表（132 项）—— 文本/编码类走内联 textDef，其余为自定义组件 */
const tools: ToolDef[] = [
  { slug: 'qr-code-generator', title: '二维码生成器', category: 'utility', desc: '为链接、文本、电话生成高清二维码，可选中心 Logo，支持 PNG 与 SVG 下载。', keywords: ['qr', '二维码', 'qrcode'], component: () => import('./components/QrGenerator.vue'), steps: ['输入链接或文本内容', '调整尺寸与纠错级别', '下载 PNG 或 SVG'] },
  { slug: 'unit-converter', title: '单位换算', category: 'utility', desc: '长度、重量、温度、面积、体积、速度、数据容量等常用单位即时互转。', keywords: ['单位', '换算', 'converter'], component: () => import('./components/UnitConverter.vue') },
  { slug: 'word-counter', title: '字数统计', category: 'utility', desc: '实时统计字数、字符数（含/不含空格）、行数、段落数与阅读时长。', keywords: ['字数', '统计', 'count'], component: () => import('./components/WordCounter.vue') },
  {
    slug: 'loan-calculator', title: '贷款计算器', category: 'utility',
    desc: '等额本息月供、总利息与总还款一步算清，支持任意金额利率期限。',
    keywords: ['贷款', '月供', '等额本息'],
    calcDef: {
      fields: [
        { key: 'p', label: '贷款金额', type: 'number', default: '' },
        { key: 'r', label: '年利率（%）', type: 'number', default: '' },
        { key: 'y', label: '期限（年）', type: 'number', default: '' },
      ],
      compute: (v) => {
        if (!v.p || !v.r || !v.y) return [{ label: '请填写贷款金额、年利率与期限', value: '—' }]
        const r = loanPayment(Number(v.p), Number(v.r), Number(v.y))
        return [
          { label: '每月还款（等额本息）', value: `¥${moneyCn(r.monthly)}`, primary: true },
          { label: '还款总期数', value: `${Math.round(Number(v.y) * 12)} 期` },
          { label: '利息总额', value: `¥${moneyCn(r.totalInterest)}` },
          { label: '本息合计', value: `¥${moneyCn(r.total)}` },
          { label: '利息占本金', value: Number(v.p) ? `${((r.totalInterest / Number(v.p)) * 100).toFixed(1)}%` : '—' },
        ]
      },
      note: '月供公式：P × r × (1+r)^n ÷ ((1+r)^n − 1)，r 为月利率、n 为总月数。',
    },
  },
  {
    slug: 'mortgage-calculator', title: '房贷计算器', category: 'utility',
    desc: '由房价、首付、利率与年限计算月供、利息总额与还款明细。',
    keywords: ['房贷', '月供', '买房'],
    calcDef: {
      fields: [
        { key: 'price', label: '房价', type: 'number', default: '' },
        { key: 'down', label: '首付比例（%）', type: 'number', default: 30 },
        { key: 'r', label: '年利率（%）', type: 'number', default: 4.2 },
        { key: 'y', label: '年限（年）', type: 'number', default: 30 },
      ],
      compute: (v) => {
        const price = Number(v.price)
        const down = price * ((Number(v.down) || 0) / 100)
        const loan = price - down
        const r = loanPayment(loan, Number(v.r), Number(v.y))
        return [
          { label: '每月月供', value: `¥${moneyCn(r.monthly)}`, primary: true },
          { label: '贷款本金', value: `¥${moneyCn(loan)}` },
          { label: '首付金额', value: `¥${moneyCn(down)}` },
          { label: '利息总额', value: `¥${moneyCn(r.totalInterest)}` },
          { label: '购房总支出', value: `¥${moneyCn(down + r.total)}` },
        ]
      },
      note: '按等额本息计算，未考虑公积金组合贷、提前还款与利率重定价。',
    },
  },
  { slug: 'password-generator', title: '强密码生成器', category: 'utility', desc: '用密码学随机源生成高强度密码，自定义长度与字符集，永不外发。', keywords: ['密码', 'password', '随机'], component: () => import('./components/PasswordGenerator.vue'), steps: ['设置长度与字符类型', '点击生成', '复制使用'] },
  { slug: 'uuid-generator', title: 'UUID 生成器', category: 'utility', desc: '生成密码学随机的 UUIDv4（GUID），支持单个或批量，适合数据库主键。', keywords: ['uuid', 'guid', 'id'], component: () => import('./components/UuidGenerator.vue') },
  {
    slug: 'age-calculator', title: '年龄计算器', category: 'utility',
    desc: '由出生日期精确计算周岁（年月日）、总天数与距离下一个生日的天数。',
    keywords: ['年龄', '生日', '周岁'],
    calcDef: {
      fields: [
        { key: 'birth', label: '出生日期', type: 'date', default: '' },
      ],
      compute: (v) => {
        if (!v.birth) return [{ label: '请选择出生日期', value: '—' }]
        const a = calcAge(String(v.birth))
        return [
          { label: '精确年龄', value: `${a.years} 岁 ${a.months} 个月 ${a.days} 天`, primary: true },
          { label: '总天数', value: `${a.totalDays.toLocaleString()} 天` },
          { label: '总周数', value: `${a.totalWeeks.toLocaleString()} 周` },
          { label: '总小时', value: `${a.totalHours.toLocaleString()} 小时` },
          { label: '下一个生日', value: `${a.nextBirthday.date}（还有 ${a.nextBirthday.days} 天）` },
        ]
      },
    },
  },
  /* ---- 计算器（内联 calcDef） ---- */
  {
    slug: 'percentage-calculator', title: '百分比计算器', category: 'utility',
    desc: '三种百分比问题一次算完：求占比、求数值、求增减幅，边输入边出结果。',
    keywords: ['百分比', 'percent', '增减'],
    calcDef: {
      fields: [
        { key: 'x', label: '数值 X', type: 'number', default: '' },
        { key: 'y', label: '数值 Y', type: 'number', default: '' },
      ],
      compute: (v) => {
        const x = Number(v.x)
        const y = Number(v.y)
        const rows: CalcResultRow[] = []
        rows.push({ label: `X 的 Y%（${x} 的 30% 类问题）`, value: fmtN(x * (y / 100)) })
        rows.push({ label: `X 是 Y 的百分之几`, value: y ? `${fmtN((x / y) * 100)}%` : '—' })
        if (x && y) {
          rows.push({ label: 'X 相对 Y 的增减幅', value: `${fmtN(((x - y) / y) * 100)}%`, primary: true, hint: x >= y ? '增长' : '下降' })
        }
        return rows
      },
      note: '三个问题分别对应：求一个数的百分之几、求占比、求变化率。',
    },
  },
  {
    slug: 'bmi-calculator', title: 'BMI 计算器', category: 'utility',
    desc: '输入身高体重即时计算身体质量指数与 WHO 分类，附健康范围提示。',
    keywords: ['bmi', '体重', '健康'],
    calcDef: {
      fields: [
        { key: 'h', label: '身高（cm）', type: 'number', default: '' },
        { key: 'w', label: '体重（kg）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const h = Number(v.h) / 100
        const w = Number(v.w)
        if (!h || !w) return [{ label: '请填写身高与体重', value: '—' }]
        const bmi = w / (h * h)
        const cat = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖'
        const ideal = (18.5 * h * h).toFixed(1) + ' ~ ' + (24 * h * h).toFixed(1)
        return [
          { label: 'BMI 指数', value: bmi.toFixed(1), primary: true },
          { label: '分类（中国标准）', value: cat },
          { label: '该身高的健康体重范围', value: `${ideal} kg` },
        ]
      },
      note: 'BMI = 体重(kg) ÷ 身高²(m²)。中国成人标准：18.5–23.9 为正常。仅供参考，不构成医疗建议。',
    },
  },
  { slug: 'currency-converter', title: '货币换算', category: 'utility', desc: '150+ 货币之间的换算，内置常用汇率快照，支持手动更新汇率。', keywords: ['汇率', '货币', 'currency'], component: () => import('./components/CurrencyConverter.vue') },
  { slug: 'scientific-calculator', title: '科学计算器', category: 'utility', desc: '支持三角函数、对数、幂、阶乘、括号的表达式计算器，键盘友好。', keywords: ['计算器', '科学', 'calculator'], component: () => import('./components/ScientificCalculator.vue') },
  {
    slug: 'date-difference-calculator', title: '日期间隔计算', category: 'utility',
    desc: '两个日期之间的天数、周数、月数、年数与工作日统计。',
    keywords: ['日期', '间隔', '天数'],
    calcDef: {
      fields: [
        { key: 'a', label: '开始日期', type: 'date', default: '' },
        { key: 'b', label: '结束日期', type: 'date', default: '' },
      ],
      compute: (v) => {
        if (!v.a || !v.b) return [{ label: '请选择两个日期', value: '—' }]
        try {
          const d = dateDiff(String(v.a), String(v.b))
          return [
            { label: '总天数', value: `${d.days.toLocaleString()} 天`, primary: true },
            { label: '周数', value: `${d.weeks} 周 ${d.days % 7} 天` },
            { label: '月数', value: `${d.months} 个月` },
            { label: '年数', value: `${d.years} 年` },
            { label: '工作日（周一至周五）', value: `${d.businessDays} 天` },
            { label: '总小时', value: `${(d.days * 24).toLocaleString()} 小时` },
          ]
        } catch (e) {
          return [{ label: '错误', value: (e as Error).message }]
        }
      },
    },
  },
  { slug: 'wifi-qr-code', title: 'WiFi 二维码生成', category: 'utility', desc: '生成扫码即可加入 WiFi 的二维码，客人无需手动输入密码。', keywords: ['wifi', '无线', '二维码'], component: () => import('./components/WifiQr.vue'), steps: ['填写 WiFi 名称与密码', '选择加密方式', '下载二维码供客人扫码'] },
  { slug: 'qr-code-scanner', title: '二维码识别', category: 'utility', desc: '上传含二维码的截图或图片，本地立即解码出链接、文本或 WiFi 信息。', keywords: ['扫码', '识别', 'decode'], component: () => import('./components/QrScanner.vue'), steps: ['上传或拖入二维码图片', '查看解码内容', '一键复制或打开链接'] },
  /* ---- P0 新增：生活计算与中文处理 ---- */
  {
    slug: 'income-tax-calculator', title: '个税计算器', category: 'utility',
    desc: '按现行累进税率计算年度个税、年终奖单独计税与全年到手，提示年终奖临界点陷阱。',
    keywords: ['个税', '个人所得税', '年终奖', '税率'],
    calcDef: {
      fields: [
        { key: 'salary', label: '月薪（税前）', type: 'number', default: '', suffix: '元' },
        { key: 'bonus', label: '年终奖', type: 'number', default: 0, suffix: '元' },
        { key: 'insurance', label: '个人五险一金（月）', type: 'number', default: 0, suffix: '元', hint: '可用「五险一金计算器」算出' },
        { key: 'special', label: '专项附加扣除（月）', type: 'number', default: 0, suffix: '元', hint: '子女教育/房贷/赡养老人等合计' },
      ],
      compute: (v) => {
        const salary = Number(v.salary)
        if (!salary || salary <= 0) return [{ label: '请填写税前月薪', value: '—' }]
        const insurance = Number(v.insurance) || 0
        const special = Number(v.special) || 0
        const r = annualIncomeTax({
          monthlySalary: salary,
          annualBonus: Number(v.bonus) || 0,
          insuranceMonthly: insurance,
          specialDeductionMonthly: special,
        })
        const bonus = Number(v.bonus) || 0
        const bt = annualBonusTax(bonus)
        const rows: CalcResultRow[] = [
          { label: '年度应纳税所得额（工资）', value: `¥${moneyCn(r.taxable)}`, hint: '（月薪 − 5000 − 个人五险一金 − 专项附加）× 12' },
          { label: '工资部分年度个税', value: `¥${moneyCn(r.tax)}`, hint: `适用税率 ${(r.rate * 100).toFixed(0)}%（七级累进）` },
        ]
        if (special > 0) {
          // 展示抵税额（精确差额）：澄清专项附加是「少缴税」而非「从工资里扣钱」
          const without = annualIncomeTax({ monthlySalary: salary, annualBonus: 0, insuranceMonthly: insurance, specialDeductionMonthly: 0 })
          rows.push({ label: '其中专项附加抵税', value: `¥${moneyCn(without.tax - r.tax)}`, hint: '专项附加是报税抵扣项（让你少缴税），不从工资中扣除' })
        }
        if (bonus > 0) {
          rows.push({ label: '年终奖个税（单独计税）', value: `¥${moneyCn(bt.tax)}`, hint: bt.trapHint || `税率 ${(bt.rate * 100).toFixed(0)}%，奖金 ÷ 12 查月度税率表` })
        }
        rows.push(
          { label: '全年税后到手合计', value: `¥${moneyCn(r.monthlyNet * 12 + (bonus > 0 ? bt.net : 0))}`, primary: true },
          { label: '月均到手（工资部分）', value: `¥${moneyCn(r.monthlyNet)}` },
        )
        return rows
      },
      note: '口径：现行个人所得税法综合所得年度税率表（起征 5000/月），年终奖按全年一次性奖金单独计税政策；政策可能调整，以官方公布为准。',
    },
  },
  {
    slug: 'social-insurance-calculator', title: '五险一金计算器', category: 'utility',
    desc: '选城市输月薪，算出养老/医疗/失业/工伤/生育与公积金的个人、单位分摊明细。',
    keywords: ['五险一金', '社保', '公积金', '社保计算'],
    calcDef: {
      fields: [
        { key: 'city', label: '城市', type: 'select', default: '北京', choices: CITY_INSURANCE.map((c) => ({ value: c.name, label: c.name })) },
        { key: 'salary', label: '月薪', type: 'number', default: '', suffix: '元' },
        { key: 'fundRate', label: '公积金比例', type: 'select', default: '', choices: [
          { value: '', label: '按城市默认' },
          { value: '5', label: '5%' }, { value: '8', label: '8%' }, { value: '10', label: '10%' }, { value: '12', label: '12%' },
        ] },
      ],
      compute: (v) => {
        const salary = Number(v.salary)
        if (!salary || salary <= 0) return [{ label: '请填写月薪', value: '—' }]
        const city = CITY_INSURANCE.find((c) => c.name === v.city) ?? CITY_INSURANCE[0]
        const fundRate = v.fundRate === '' ? city.fund : Number(v.fundRate)
        const r = computeInsurance(salary, city, fundRate)
        const m = (n: number) => `¥${moneyCn(n)}`
        return [
          { label: '缴费基数', value: `¥${moneyCn(r.base)}`, hint: `下限 ${city.floor} / 上限 ${city.ceil} · ${city.year}` },
          { label: '个人缴纳合计', value: m(r.personalTotal), primary: true, hint: `养老 ${m(r.personal.pension)} · 医疗 ${m(r.personal.medical)} · 失业 ${m(r.personal.unemployment)} · 公积金 ${m(r.personal.fund)}` },
          { label: '单位缴纳合计', value: m(r.companyTotal), hint: `养老 ${m(r.company.pension)} · 医疗 ${m(r.company.medical)} · 失业 ${m(r.company.unemployment)} · 工伤 ${m(r.company.injury)} · 生育 ${m(r.company.birth)} · 公积金 ${m(r.company.fund)}` },
          { label: '单位用工总成本', value: m(salary + r.companyTotal), hint: '月薪 + 单位部分；个人部分可作个税税前扣除' },
        ]
      },
      note: '口径：主要城市社保年度常用比例与基数上下限估算（公积金比例可调，个人=单位）。内置数据截至 2024-07（2024 社保年度），此后年度基数上下限可能已调整，高薪/低薪按上下限封顶缴费的用户请以当地人社局与公积金中心最新公布为准。',
    },
  },
  {
    slug: 'pinyin-converter', title: '文字转拼音', category: 'utility',
    desc: '中文转带声调拼音，多音字按词组智能判断（重庆/重量），支持无声调与数字声调。',
    keywords: ['拼音', '多音字', '声调', 'pinyin'],
    textDef: {
      options: [
        { key: 'tone', label: '声调样式', type: 'select', default: 'symbol', choices: [
          { value: 'symbol', label: '符号声调（hàn yǔ）' },
          { value: 'num', label: '数字声调（han4 yu3）' },
          { value: 'none', label: '无声调（han yu）' },
        ] },
        { key: 'spaced', label: '字间以空格分隔', type: 'toggle', default: true },
      ],
      placeholder: '输入中文文字，如：重庆的重量…',
      transform: (t, o) => pinyinOf(t, { tone: o.tone as never, spaced: !!o.spaced }),
    },
  },
  {
    slug: 'chinese-variant-converter', title: '简繁中文转换', category: 'utility',
    desc: 'OpenCC 词表简繁转换，支持台湾/香港正体与词汇级转换（内存→記憶體）。',
    keywords: ['简繁', '繁体', '台湾正体', 'opencc'],
    textDef: {
      options: [
        { key: 'mode', label: '转换方向', type: 'select', default: 's2t', choices: [
          { value: 's2t', label: '简 → 繁（通用）' },
          { value: 't2s', label: '繁 → 简' },
          { value: 's2tw', label: '简 → 台湾正体' },
          { value: 's2twp', label: '简 → 台湾正体 + 词汇' },
          { value: 's2hk', label: '简 → 香港繁体' },
          { value: 't2tw', label: '繁 → 台湾正体' },
          { value: 't2hk', label: '繁 → 香港繁体' },
        ] },
      ],
      placeholder: '输入中文，首次转换需加载词表…',
      transform: (t, o) => variantConvert(t, o.mode as VariantMode),
    },
  },
  { slug: 'lunar-calendar', title: '农历万年历', category: 'utility', desc: '公农历对照月历，节气、节日、干支、宜忌与公农历互转一览。', keywords: ['农历', '万年历', '黄历', '节气'], component: () => import('./components/LunarCalendar.vue'), steps: ['浏览月历点选日期', '查看农历/干支/宜忌', '下方公农历互转'] },
  {
    slug: 'id-card-validator', title: '身份证号校验器', category: 'utility',
    desc: '按 GB 11643 校验位规则本地校验 18 位身份证号，解析省份/生日/性别，不联网查询。',
    keywords: ['身份证', '校验', '地区码'],
    calcDef: {
      fields: [
        { key: 'id', label: '18 位身份证号', type: 'text', default: '', placeholder: '如 11010519491231002X' },
      ],
      compute: (v) => {
        const id = String(v.id).trim().toUpperCase()
        if (!id) return [{ label: '请输入身份证号', value: '—' }]
        if (!/^\d{17}[\dX]$/.test(id)) return [{ label: '格式无效', value: '✗', hint: '需 18 位：前 17 位数字 + 校验码（数字或 X）' }]
        // GB 11643-1999 加权因子与校验码表
        const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
        const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
        const sum = id.slice(0, 17).split('').reduce((s, d, i) => s + Number(d) * weights[i], 0)
        const expect = codes[sum % 11]
        const valid = expect === id[17]
        const PROV: Record<string, string> = {
          '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古', '21': '辽宁', '22': '吉林', '23': '黑龙江',
          '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东', '41': '河南',
          '42': '湖北', '43': '湖南', '44': '广东', '45': '广西', '46': '海南', '50': '重庆', '51': '四川', '52': '贵州',
          '53': '云南', '54': '西藏', '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆', '71': '台湾', '81': '香港', '82': '澳门',
        }
        const prov = PROV[id.slice(0, 2)] ?? '未知地区码'
        const birth = `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`
        const bd = new Date(birth)
        const birthOk = !Number.isNaN(bd.getTime()) && bd.getFullYear() === Number(id.slice(6, 10))
        const gender = Number(id[16]) % 2 === 1 ? '男' : '女'
        const rows: CalcResultRow[] = [
          { label: '校验结果', value: valid ? '✓ 校验通过' : '✗ 校验位不符', primary: true, hint: valid ? `校验码应为 ${expect}` : `按 GB 11643 计算，末位校验码应为 ${expect}` },
        ]
        if (birthOk && prov !== '未知地区码') {
          rows.push(
            { label: '省份/地区', value: prov, hint: `地区码 ${id.slice(0, 2)}` },
            { label: '出生日期', value: birth },
            { label: '性别', value: gender, hint: '由第 17 位奇偶判定' },
          )
        } else {
          rows.push({ label: '详情', value: prov === '未知地区码' ? `地区码 ${id.slice(0, 2)} 不存在` : '出生日期段无效', hint: '号码结构不完整' })
        }
        return rows
      },
      note: '仅按 GB 11643-1999 编码规则做本地校验（校验位/地区码/生日结构），结果不代表号码真实存在或仍有效；本工具不做任何联网查询。',
    },
  },
  /* ---- P1 新增 ---- */
  { slug: 'qr-code-styled', title: '艺术二维码', category: 'utility', desc: '圆点/优雅点型 + 渐变配色 + 中心 Logo 的风格化二维码，PNG/SVG 下载。', keywords: ['二维码', '艺术', '美化', 'logo'], component: () => import('./components/QrCodeStyled.vue'), steps: ['输入内容选点型配色', '可选上传中心 Logo', '下载 PNG/SVG'] },
  { slug: 'qr-code-batch', title: '二维码批量生成', category: 'utility', desc: 'CSV 或多行文本一次生成上百个二维码 PNG，打包 ZIP 下载。', keywords: ['二维码', '批量', 'csv'], component: () => import('./components/QrCodeBatch.vue'), steps: ['粘贴多行或 CSV', '选尺寸批量生成', '打包下载 ZIP'] },
  { slug: 'copybook-generator', title: '字帖生成器', category: 'utility', desc: '输入汉字生成田字格/米字格硬笔字帖 PDF，浅红描红可打印。', keywords: ['字帖', '田字格', '练字', '描红'], component: () => import('./components/CopybookGenerator.vue'), steps: ['输入练习汉字', '选格子类型', '下载 A4 PDF 打印'] },
  { slug: 'barcode-generator', title: '条形码生成器', category: 'utility', desc: '生成 CODE128、EAN-13、UPC、CODE39 等格式的条形码，可下载 PNG。', keywords: ['barcode', 'ean', 'upc'], component: () => import('./components/BarcodeGenerator.vue'), steps: ['输入条码内容', '选择码制', '下载 PNG 图片'] },
  { slug: 'password-strength-checker', title: '密码强度检测', category: 'utility', desc: '检测密码长度、字符多样性、信息熵与被暴力破解所需时间，纯本地检测。', keywords: ['强度', 'entropy', '安全'], component: () => import('./components/PasswordStrength.vue') },
  { slug: 'random-string-generator', title: '随机字符串生成', category: 'utility', desc: '批量生成指定长度与字符集的随机字符串，适合作 API 密钥、测试数据。', keywords: ['随机', 'token', '密钥'], component: () => import('./components/RandomString.vue') },
  { slug: 'random-number', title: '随机数生成器', category: 'utility', desc: '在自定义范围内生成一个或多个随机数，可选允许重复，用于抽奖与抽样。', keywords: ['随机数', '抽奖', '抽样'], component: () => import('./components/RandomNumber.vue') },
  { slug: 'dice-roller', title: '掷骰子', category: 'utility', desc: '支持 2d6+3、4d6dl1、2d20kh1 等桌游记法，密码学公平随机。', keywords: ['骰子', 'dice', '桌游'], component: () => import('./components/DiceRoller.vue') },
  { slug: 'lorem-ipsum-generator', title: '占位文本生成', category: 'utility', desc: '生成 Lorem Ipsum 或中文占位段落，自定义段落数与句长，用于设计稿填充。', keywords: ['lorem', '占位', '假文'], component: () => import('./components/LoremIpsum.vue') },
  { slug: 'invoice-generator', title: '发票生成器', category: 'utility', desc: '在浏览器里填写抬头、明细与税率，直接生成可打印的发票页面。', keywords: ['发票', 'invoice', '账单'], component: () => import('./components/InvoiceGenerator.vue') },
  { slug: 'file-encryptor', title: '文件加密', category: 'utility', desc: '用 AES-256-GCM + 密码加密任意文件，也可解密回来，密钥从不出设备。', keywords: ['加密', 'aes', 'encrypt'], component: () => import('./components/FileEncryptor.vue'), needModel: false },
  { slug: 'screen-recorder', title: '屏幕录制', category: 'utility', desc: '录制屏幕或窗口（可含麦克风），本地编码为 WebM，无水印无时长限制。', keywords: ['录屏', '屏幕', 'recorder'], component: () => import('./components/ScreenRecorder.vue') },
  { slug: 'countdown-timer', title: '秒表与倒计时', category: 'utility', desc: '精准秒表与倒计时二合一，结束时可响铃提醒，支持暂停与计次。', keywords: ['秒表', '倒计时', 'timer'], component: () => import('./components/CountdownTimer.vue') },
  { slug: 'event-countdown', title: '节日倒计时', category: 'utility', desc: '为任意事件设置倒计时，实时显示剩余天时分秒，适合汇报与活动。', keywords: ['倒计时', '节日', 'countdown'], component: () => import('./components/EventCountdown.vue') },
  { slug: 'pomodoro-timer', title: '番茄钟', category: 'utility', desc: '经典 25/5 番茄工作法计时器，可自定义时长，阶段结束自动提醒。', keywords: ['番茄钟', '专注', 'pomodoro'], component: () => import('./components/PomodoroTimer.vue') },
  { slug: 'ephemeral-notepad', title: '闪念便签', category: 'utility', desc: '只存在于内存中的便签：不落盘、刷新即焚，可设置自动清空倒计时。', keywords: ['便签', '临时', '隐私'], component: () => import('./components/EphemeralNotepad.vue') },
  { slug: 'browser-fingerprint', title: '浏览器指纹查看', category: 'utility', desc: '查看网站能拿到的本机信息：Canvas 哈希、WebGL、屏幕、时区与字体等。', keywords: ['指纹', '隐私', 'fingerprint'], component: () => import('./components/BrowserFingerprint.vue') },
  { slug: 'fancy-text-generator', title: '花体字生成', category: 'utility', desc: '把文字变成粗体、斜体、花体、圆圈字等 Unicode 风格，直接粘贴到昵称。', keywords: ['花体', '艺术字', 'unicode'], component: () => import('./components/FancyText.vue') },
  { slug: 'ascii-banner', title: 'ASCII 艺术大字', category: 'utility', desc: '把短句变成等宽字符画大字，可自定义填充字符，复制到 README。', keywords: ['ascii', '字符画', 'banner'], component: () => import('./components/AsciiBanner.vue') },
  { slug: 'word-frequency-counter', title: '词频统计', category: 'utility', desc: '统计每个词出现的次数与排名，可忽略大小写并过滤停用词。', keywords: ['词频', '频率', 'frequency'], component: () => import('./components/WordFrequency.vue') },
  { slug: 'palindrome-checker', title: '回文与变位词检查', category: 'utility', desc: '判断短语是否为回文、两个词是否互为变位词，自动忽略大小写与标点。', keywords: ['回文', '变位', 'anagram'], component: () => import('./components/PalindromeChecker.vue') },
  { slug: 'pii-scrubber', title: '隐私信息脱敏', category: 'utility', desc: '贴入文本自动识别并遮盖邮箱、手机号、身份证、IP 等敏感信息。', keywords: ['脱敏', '隐私', 'pii'], component: () => import('./components/PiiScrubber.vue') },
  /* ---- 纯文本转换（内联 textDef） ---- */
  {
    slug: 'case-converter', title: '大小写转换', category: 'utility',
    desc: '大写、小写、标题格式、驼峰、下划线、中划线等 11 种大小写风格互转。',
    keywords: ['大小写', 'camel', 'case'],
    textDef: {
      options: [
        {
          key: 'mode', label: '目标格式', type: 'select', default: 'upper',
          choices: [
            { value: 'upper', label: '全部大写' }, { value: 'lower', label: '全部小写' },
            { value: 'title', label: '单词首字母大写' }, { value: 'sentence', label: '句首大写' },
            { value: 'camel', label: '小驼峰 camelCase' }, { value: 'pascal', label: '大驼峰 PascalCase' },
            { value: 'snake', label: '下划线 snake_case' }, { value: 'kebab', label: '中划线 kebab-case' },
            { value: 'constant', label: '常量 CONSTANT_CASE' }, { value: 'alternating', label: '交替大小写' },
            { value: 'inverse', label: '大小写互换' },
          ],
        },
      ],
      transform: (t, o) => toCase(t, String(o.mode)),
    },
  },
  {
    slug: 'find-and-replace', title: '查找替换', category: 'utility',
    desc: '在文本块中查找替换，支持大小写敏感、正则表达式与捕获组引用。',
    keywords: ['查找', '替换', 'replace'],
    textDef: {
      options: [
        { key: 'find', label: '查找内容', type: 'text', default: '', placeholder: '要查找的文本' },
        { key: 'replace', label: '替换为', type: 'text', default: '', placeholder: '替换为（支持 $1）' },
        { key: 'caseSensitive', label: '区分大小写', type: 'toggle', default: false },
        { key: 'regex', label: '正则模式', type: 'toggle', default: false },
      ],
      transform: (t, o) => {
        const r = findReplace(t, String(o.find ?? ''), String(o.replace ?? ''), { caseSensitive: !!o.caseSensitive, regex: !!o.regex })
        return r.result
      },
      placeholder: '在此粘贴要处理的文本…',
    },
  },
  {
    slug: 'remove-duplicate-lines', title: '列表去重', category: 'utility',
    desc: '删除重复行并保留首次出现，可忽略大小写、自动去除首尾空白。',
    keywords: ['去重', '重复', 'unique'],
    textDef: {
      options: [
        { key: 'ignoreCase', label: '忽略大小写', type: 'toggle', default: false },
        { key: 'trim', label: '去除首尾空白', type: 'toggle', default: false },
        { key: 'keepLast', label: '保留最后一次出现', type: 'toggle', default: false },
      ],
      transform: (t, o) => removeDuplicateLines(t, { ignoreCase: !!o.ignoreCase, trim: !!o.trim, keepLast: !!o.keepLast }).result,
    },
  },
  {
    slug: 'sort-lines', title: '行排序', category: 'utility',
    desc: '按字母、数字、长度排序，或随机打乱、倒序，支持去重与忽略大小写。',
    keywords: ['排序', 'sort', 'shuffle'],
    textDef: {
      options: [
        {
          key: 'mode', label: '排序方式', type: 'select', default: 'alpha',
          choices: [
            { value: 'alpha', label: '字母 A→Z' }, { value: 'alphaDesc', label: '字母 Z→A' },
            { value: 'numeric', label: '数字升序' }, { value: 'numericDesc', label: '数字降序' },
            { value: 'length', label: '长度短→长' }, { value: 'lengthDesc', label: '长度长→短' },
            { value: 'shuffle', label: '随机打乱' }, { value: 'reverse', label: '原序倒置' },
          ],
        },
        { key: 'unique', label: '同时去重', type: 'toggle', default: false },
        { key: 'ignoreCase', label: '忽略大小写', type: 'toggle', default: false },
        { key: 'trim', label: '去除首尾空白', type: 'toggle', default: false },
      ],
      transform: (t, o) => sortLines(t, { mode: o.mode as never, unique: !!o.unique, ignoreCase: !!o.ignoreCase, trim: !!o.trim }),
    },
  },
  {
    slug: 'reverse-text', title: '文本反转', category: 'utility',
    desc: '三种反转：按字符倒序、按单词倒序、按行倒序。',
    keywords: ['反转', '倒序', 'reverse'],
    textDef: {
      options: [
        {
          key: 'mode', label: '反转方式', type: 'select', default: 'chars',
          choices: [
            { value: 'chars', label: '按字符倒序' },
            { value: 'words', label: '按单词倒序' },
            { value: 'lines', label: '按行倒序' },
          ],
        },
      ],
      transform: (t, o) => reverseText(t, o.mode as never),
    },
  },
  {
    slug: 'remove-line-breaks', title: '去除换行符', category: 'utility',
    desc: '把换行打散为连续文本：全部移除、保留段落、或合并为单行。',
    keywords: ['换行', '合并', 'breaks'],
    textDef: {
      options: [
        {
          key: 'mode', label: '处理方式', type: 'select', default: 'keepParagraph',
          choices: [
            { value: 'all', label: '全部移除（含段落）' },
            { value: 'keepParagraph', label: '保留段落空行' },
            { value: 'join', label: '合并为单行' },
          ],
        },
      ],
      transform: (t, o) => removeLineBreaks(t, o.mode as never),
    },
  },
  {
    slug: 'text-repeater', title: '文本重复生成', category: 'utility',
    desc: '把一段文本重复指定次数，支持换行、空格、逗号或自定义分隔符。',
    keywords: ['重复', '刷屏', 'repeat'],
    textDef: {
      options: [
        { key: 'times', label: '重复次数', type: 'number', default: 3 },
        { key: 'sep', label: '分隔符', type: 'select', default: 'newline', choices: [
          { value: 'newline', label: '换行' }, { value: 'space', label: '空格' }, { value: 'comma', label: '逗号' }, { value: 'none', label: '无' },
        ] },
      ],
      transform: (t, o) => {
        const sepMap: Record<string, string> = { newline: '\n', space: ' ', comma: ',', none: '' }
        return repeatText(t, Number(o.times) || 1, sepMap[String(o.sep)] ?? '\n')
      },
    },
  },
  {
    slug: 'morse-code-translator', title: '摩斯电码翻译', category: 'utility',
    desc: '文本与摩斯电码双向翻译：字母数字标点按国际标准，中文按 Unicode 码点数字转码、可无损还原。',
    keywords: ['摩斯', '电码', 'morse'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '文本 → 摩斯' }, { value: 'decode', label: '摩斯 → 文本' },
      ] }],
      transform: (t, o) => (o.dir === 'decode' ? morseDecode(t) : morseEncode(t)),
      placeholder: '输入文本或摩斯电码（用 / 分隔单词）…',
    },
  },
  {
    slug: 'binary-text-converter', title: '二进制文本转换', category: 'utility',
    desc: '文本转 8 位二进制、二进制转文本，完整支持 UTF-8 中文。',
    keywords: ['二进制', 'binary', '0和1'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '文本 → 二进制' }, { value: 'decode', label: '二进制 → 文本' },
      ] }],
      transform: (t, o) => (o.dir === 'decode' ? binaryToText(t) : textToBinary(t)),
    },
  },
  {
    slug: 'caesar-cipher', title: '凯撒密码 / ROT13', category: 'utility',
    desc: '凯撒位移加密与解密，任意位移量，默认 ROT13，保留大小写与标点。',
    keywords: ['凯撒', 'rot13', '加密'],
    textDef: {
      options: [
        { key: 'shift', label: '位移量（ROT13 = 13）', type: 'number', default: 13 },
        { key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
          { value: 'encode', label: '加密（正向位移）' }, { value: 'decode', label: '解密（反向位移）' },
        ] },
      ],
      transform: (t, o) => caesar(t, o.dir === 'decode' ? -(Number(o.shift) || 13) : Number(o.shift) || 13),
    },
  },
  {
    slug: 'roman-numeral-converter', title: '罗马数字转换', category: 'utility',
    desc: '数字 1–3999 与罗马数字双向转换，边输入边出结果。',
    keywords: ['罗马数字', 'roman'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '数字 → 罗马数字' }, { value: 'decode', label: '罗马数字 → 数字' },
      ] }],
      transform: (t, o) => {
        if (o.dir === 'decode') {
          const n = fromRoman(t.trim())
          return Number.isNaN(n) ? '（无效的罗马数字）' : String(n)
        }
        const n = parseInt(t.trim(), 10)
        if (Number.isNaN(n)) return ''
        try { return toRoman(n) } catch (e) { return (e as Error).message }
      },
      singleLine: true,
    },
  },
  {
    slug: 'number-to-words', title: '数字大小写转换', category: 'utility',
    desc: '数字一键转人民币大写（壹仟贰佰…元整）、普通汉字或英文单词，报销单据与合同通用。',
    keywords: ['大写', '数字', '人民币', '金额大写', '壹仟', '英文'],
    textDef: {
      options: [{ key: 'mode', label: '输出格式', type: 'select', default: 'rmb', choices: [
        { value: 'rmb', label: '人民币大写（元角分整）' },
        { value: 'finance', label: '财务数字大写（壹贰叁）' },
        { value: 'cn', label: '普通汉字（一二三）' },
        { value: 'en', label: '英文（One Thousand…）' },
      ] }],
      transform: (t, o) => {
        const raw = t.trim().replace(/[¥￥,，\s]/g, '')
        if (o.mode === 'en') {
          if (!/^-?\d+(\.\d+)?$/.test(raw)) return '（请输入有效数字）'
          const neg = raw.startsWith('-')
          const body = neg ? raw.slice(1) : raw
          const [ip = '0', dp] = body.split('.')
          const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
          const words = cap(numberToEnglish(Number(ip))) + (dp ? ' point ' + [...dp].map((d) => numberToEnglish(Number(d))).join(' ') : '')
          return (neg ? 'Negative ' : '') + words
        }
        if (o.mode === 'cn') return numberToChinese(raw, false)
        return numberToChinese(raw, true)
      },
      singleLine: true,
      placeholder: '输入数字，如 1234.56 或 -12',
    },
  },
  {
    slug: 'timezone-converter', title: '时区换算', category: 'utility',
    desc: '在 14 个常用时区间换算日期时间，使用浏览器 Intl 数据，无需联网。',
    keywords: ['时区', '时间', 'timezone'],
    calcDef: {
      fields: [
        { key: 'date', label: '日期', type: 'date', default: '' },
        { key: 'time', label: '时间', type: 'text', default: '12:00', placeholder: 'HH:MM' },
        {
          key: 'from', label: '源时区', type: 'select', default: 'Asia/Shanghai',
          choices: TZ_CHOICES,
        },
        {
          key: 'to', label: '目标时区', type: 'select', default: 'America/New_York',
          choices: TZ_CHOICES,
        },
      ],
      compute: (v) => {
        if (!v.date) return [{ label: '请选择日期', value: '—' }]
        try {
          const r = convertTimezone(String(v.date), String(v.time), String(v.from), String(v.to))
          // 用 Intl 按所选日期实时计算两时区实际偏移（含夏令时），不依赖写死偏移表
          const at = new Date(`${v.date}T${String(v.time) || '00:00'}:00`)
          const fmtTz = (tz: string) => {
            const o = tzOffsetAt(tz, at)
            return `${o.offset}${o.dst ? '（夏令时生效）' : ''}`
          }
          return [
            { label: '源时区时间', value: r.from, hint: `所选日期实际偏移 ${fmtTz(String(v.from))}` },
            { label: '目标时区时间', value: r.to, primary: true, hint: `所选日期实际偏移 ${fmtTz(String(v.to))}` },
          ]
        } catch (e) {
          return [{ label: '错误', value: (e as Error).message }]
        }
      },
      note: '偏移按所选日期由浏览器 Intl 数据实时计算，夏令时期间自动生效；结果行偏移即该日实际偏移。',
    },
  },
  {
    slug: 'tip-calculator', title: '小费计算器', category: 'utility',
    desc: '输入账单、小费比例与人数，即时得出小费、总额与每人应付。',
    keywords: ['小费', '分摊', 'tip'],
    calcDef: {
      fields: [
        { key: 'bill', label: '账单金额', type: 'number', default: '' },
        { key: 'pct', label: '小费比例（%）', type: 'number', default: 15 },
        { key: 'people', label: '人数', type: 'number', default: 1 },
      ],
      compute: (v) => {
        const bill = Number(v.bill)
        const tip = bill * ((Number(v.pct) || 0) / 100)
        const total = bill + tip
        const people = Math.max(1, Number(v.people) || 1)
        return [
          { label: '小费', value: `¥${moneyCn(tip)}` },
          { label: '含小费总额', value: `¥${moneyCn(total)}`, primary: true },
          { label: `每人应付（${people} 人）`, value: `¥${moneyCn(total / people)}` },
          { label: '每人小费', value: `¥${moneyCn(tip / people)}` },
        ]
      },
    },
  },
  {
    slug: 'compound-interest-calculator', title: '复利计算器', category: 'utility',
    desc: '本金、利率、年限与复利频率四要素，展示每年增长曲线数据。',
    keywords: ['复利', '利息', '存款'],
    calcDef: {
      fields: [
        { key: 'p', label: '本金', type: 'number', default: '' },
        { key: 'r', label: '年利率（%）', type: 'number', default: '' },
        { key: 'y', label: '年限（年）', type: 'number', default: '' },
        { key: 'n', label: '每年复利次数', type: 'select', default: '1', choices: [
          { value: '1', label: '每年 1 次' }, { value: '2', label: '每半年' },
          { value: '4', label: '每季度' }, { value: '12', label: '每月' }, { value: '365', label: '每天' },
        ] },
        { key: 'add', label: '每月追加（可选）', type: 'number', default: 0 },
      ],
      compute: (v) => {
        const r = compoundInterest(Number(v.p), Number(v.r), Number(v.y), Number(v.n), Number(v.add) || 0)
        const contributed = Number(v.p) + (Number(v.add) || 0) * 12 * Number(v.y)
        return [
          { label: '期末余额', value: `¥${moneyCn(r.final)}`, primary: true },
          { label: '累计投入', value: `¥${moneyCn(contributed)}` },
          { label: '利息收益', value: `¥${moneyCn(r.interest)}` },
          { label: '收益倍数', value: contributed ? `${(r.final / contributed).toFixed(2)}×` : '—' },
          { label: '近三年余额', value: r.schedule.slice(-3).map((s) => `第${s.year}年 ¥${moneyCn(s.value)}`).join('，') },
        ]
      },
      note: '复利公式：A = P(1 + r/n)^(nt)，追加投资按月复利近似合并计算。',
    },
  },
  {
    slug: 'discount-calculator', title: '折扣计算器', category: 'utility',
    desc: '正反两算：由折扣率算到手价，或由原价/现价反推真实折扣。',
    keywords: ['折扣', '打折', '优惠'],
    calcDef: {
      fields: [
        { key: 'price', label: '原价', type: 'number', default: '' },
        { key: 'off', label: '折扣（%，如 20 表示 8 折）', type: 'number', default: '' },
        { key: 'sale', label: '现价（反推折扣时填）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const price = Number(v.price)
        const rows: CalcResultRow[] = []
        if (Number(v.off)) {
          const sale = price * (1 - Number(v.off) / 100)
          rows.push({ label: `打 ${fmtN(100 - Number(v.off))} 折后价格`, value: `¥${moneyCn(sale)}`, primary: true })
          rows.push({ label: '节省', value: `¥${moneyCn(price - sale)}` })
        }
        if (Number(v.sale) && price) {
          const off = (1 - Number(v.sale) / price) * 100
          rows.push({ label: '真实折扣', value: `${fmtN(100 - off)} 折（省 ${fmtN(off)}%）` })
        }
        return rows.length ? rows : [{ label: '提示', value: '请填写原价与折扣或现价' }]
      },
    },
  },
  {
    slug: 'sales-tax-calculator', title: '税费计算器', category: 'utility',
    desc: '净价加税、含税反推净价两个方向，附税额明细。',
    keywords: ['税', '增值税', 'tax'],
    calcDef: {
      fields: [
        { key: 'amount', label: '金额', type: 'number', default: '' },
        { key: 'rate', label: '税率（%）', type: 'number', default: 13 },
        { key: 'mode', label: '方向', type: 'select', default: 'add', choices: [
          { value: 'add', label: '净价 → 含税价' }, { value: 'extract', label: '含税价 → 净价' },
        ] },
      ],
      compute: (v) => {
        const amt = Number(v.amount)
        const rate = (Number(v.rate) || 0) / 100
        if (!amt) return [{ label: '请填写金额', value: '—' }]
        if (v.mode === 'add') {
          return [
            { label: '含税总价', value: `¥${moneyCn(amt * (1 + rate))}`, primary: true },
            { label: '税额', value: `¥${moneyCn(amt * rate)}` },
            { label: '净价', value: `¥${moneyCn(amt)}` },
          ]
        }
        const net = amt / (1 + rate)
        return [
          { label: '净价', value: `¥${moneyCn(net)}`, primary: true },
          { label: '税额', value: `¥${moneyCn(amt - net)}` },
          { label: '含税价', value: `¥${moneyCn(amt)}` },
        ]
      },
    },
  },
  {
    slug: 'reading-time-calculator', title: '阅读时长估算', category: 'utility',
    desc: '由字数或原文估算阅读时间，支持自定义每分钟阅读速度。',
    keywords: ['阅读', '时长', '演讲'],
    calcDef: {
      fields: [
        { key: 'words', label: '字数（中文按字、英文按词）', type: 'number', default: '' },
        { key: 'wpm', label: '阅读速度（字/分钟）', type: 'number', default: 300 },
      ],
      compute: (v) => {
        const w = Number(v.words)
        const wpm = Math.max(1, Number(v.wpm) || 300)
        if (!w) return [{ label: '请填写字数', value: '—', hint: '可先用「字数统计」工具统计原文' }]
        const mins = w / wpm
        return [
          { label: '预计阅读时长', value: fmtDuration(mins), primary: true },
          { label: '按秒计', value: `${Math.round(mins * 60).toLocaleString()} 秒` },
          { label: '朗读时长参考（约 240 字/分）', value: fmtDuration(w / 240) },
        ]
      },
      note: '成人默读平均约 200–300 字/分钟；演讲/朗读约 130–240 字/分钟。',
    },
  },
  {
    slug: 'simple-interest-calculator', title: '单利计算器', category: 'utility',
    desc: 'P×r×t 单利公式计算利息与到期本息和。',
    keywords: ['单利', '利息'],
    calcDef: {
      fields: [
        { key: 'p', label: '本金', type: 'number', default: '' },
        { key: 'r', label: '年利率（%）', type: 'number', default: '' },
        { key: 't', label: '期限（年）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const p = Number(v.p)
        const interest = p * ((Number(v.r) || 0) / 100) * (Number(v.t) || 0)
        return [
          { label: '利息', value: `¥${moneyCn(interest)}`, primary: true },
          { label: '到期本息和', value: `¥${moneyCn(p + interest)}` },
          { label: '年利息', value: `¥${moneyCn(p * ((Number(v.r) || 0) / 100))}` },
        ]
      },
      note: '单利公式：利息 = 本金 × 利率 × 时间（不复利滚动）。',
    },
  },
  {
    slug: 'salary-calculator', title: '薪资换算器', category: 'utility',
    desc: '在时薪、日薪、周薪、月薪与年薪之间任意换算。',
    keywords: ['薪资', '时薪', '年薪'],
    calcDef: {
      fields: [
        { key: 'amount', label: '金额', type: 'number', default: '' },
        { key: 'period', label: '该金额对应周期', type: 'select', default: 'month', choices: [
          { value: 'hour', label: '每小时' }, { value: 'day', label: '每天' },
          { value: 'week', label: '每周' }, { value: 'month', label: '每月' }, { value: 'year', label: '每年' },
        ] },
        { key: 'hours', label: '每天工作小时', type: 'number', default: 8 },
        { key: 'days', label: '每周工作天数', type: 'number', default: 5 },
      ],
      compute: (v) => {
        const amt = Number(v.amount)
        const hours = Math.max(1, Number(v.hours) || 8)
        const days = Math.max(1, Number(v.days) || 5)
        const hoursPer: Record<string, number> = {
          hour: 1, day: hours, week: hours * days, month: (hours * days * 52) / 12, year: hours * days * 52,
        }
        const hourly = amt / (hoursPer[String(v.period)] || 1)
        return [
          { label: '时薪', value: `¥${moneyCn(hourly)}` },
          { label: '日薪', value: `¥${moneyCn(hourly * hours)}` },
          { label: '周薪', value: `¥${moneyCn(hourly * hours * days)}` },
          { label: '月薪（年薪 ÷ 12）', value: `¥${moneyCn((hourly * hours * days * 52) / 12)}`, primary: true },
          { label: '年薪', value: `¥${moneyCn(hourly * hours * days * 52)}` },
        ]
      },
      note: '按你设置的工作小时与每周天数换算；年按 52 周，月为年薪 ÷ 12（月薪与年薪恰好相差 12 倍）。',
    },
  },
  {
    slug: 'fuel-cost-calculator', title: '油费计算器', category: 'utility',
    desc: '由里程、油耗与油价计算行程油费，支持多人分摊。',
    keywords: ['油费', '油耗', '自驾'],
    calcDef: {
      fields: [
        { key: 'km', label: '行程距离（km）', type: 'number', default: '' },
        { key: 'l100', label: '油耗（L/100km）', type: 'number', default: 8 },
        { key: 'price', label: '油价（元/升）', type: 'number', default: 8 },
        { key: 'people', label: '分摊人数', type: 'number', default: 1 },
      ],
      compute: (v) => {
        const liters = (Number(v.km) / 100) * (Number(v.l100) || 0)
        const cost = liters * (Number(v.price) || 0)
        const people = Math.max(1, Number(v.people) || 1)
        return [
          { label: '所需油量', value: `${liters.toFixed(2)} 升` },
          { label: '油费合计', value: `¥${moneyCn(cost)}`, primary: true },
          { label: `每人分摊（${people} 人）`, value: `¥${moneyCn(cost / people)}` },
          { label: '每公里成本', value: `¥${(cost / Math.max(1, Number(v.km) || 1)).toFixed(3)}` },
        ]
      },
    },
  },
  {
    slug: 'aspect-ratio-calculator', title: '宽高比计算器', category: 'utility',
    desc: '锁定宽高比换算另一边，并给出最简比（如 16:9）。',
    keywords: ['宽高比', '比例', '尺寸'],
    calcDef: {
      fields: [
        { key: 'ow', label: '原宽', type: 'number', default: '' },
        { key: 'oh', label: '原高', type: 'number', default: '' },
        { key: 'nw', label: '新宽（与新高二选一）', type: 'number', default: '' },
        { key: 'nh', label: '新高', type: 'number', default: '' },
      ],
      compute: (v) => {
        const ow = Number(v.ow)
        const oh = Number(v.oh)
        if (!ow || !oh) return [{ label: '请填写原始宽高', value: '—' }]
        const g = gcd(Math.round(ow), Math.round(oh))
        const rows: CalcResultRow[] = [
          { label: '最简比', value: `${ow / g}:${oh / g}`, primary: true },
        ]
        if (Number(v.nw)) rows.push({ label: '按新宽的对应高', value: fmtN((Number(v.nw) * oh) / ow) })
        if (Number(v.nh)) rows.push({ label: '按新高的对应宽', value: fmtN((Number(v.nh) * ow) / oh) })
        return rows
      },
    },
  },
  {
    slug: 'ratio-calculator', title: '比例计算器', category: 'utility',
    desc: '解 A:B = C:D 的未知项，或化简任意比例。',
    keywords: ['比例', 'ratio', '化简'],
    calcDef: {
      fields: [
        { key: 'a', label: 'A', type: 'number', default: '' },
        { key: 'b', label: 'B', type: 'number', default: '' },
        { key: 'c', label: 'C（求 D 时填）', type: 'number', default: '' },
        { key: 'd', label: 'D（求 C 时填）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const a = Number(v.a)
        const b = Number(v.b)
        const c = v.c === '' ? null : Number(v.c)
        const d = v.d === '' ? null : Number(v.d)
        const rows: CalcResultRow[] = []
        if (a && b) {
          const g = gcd(Math.round(a), Math.round(b))
          rows.push({ label: 'A:B 化简', value: `${a / g}:${b / g}`, primary: true })
        }
        if (a && b && c !== null && d === null) rows.push({ label: `D（A:B = ${a}:${b} = ${c}:D）`, value: fmtN((b * c) / a) })
        if (a && b && d !== null && c === null) rows.push({ label: `C（A:B = ${a}:${b} = C:${d}）`, value: fmtN((a * d) / b) })
        return rows.length ? rows : [{ label: '提示', value: '填写 A、B 以及 C 或 D 之一' }]
      },
    },
  },
  {
    slug: 'body-fat-calculator', title: '体脂率计算器', category: 'utility',
    desc: '美国海军围度法估算体脂率，需要身高体重与腰围颈围（女性加臀围）。',
    keywords: ['体脂', '围度', '健身'],
    calcDef: {
      fields: [
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
        { key: 'h', label: '身高（cm）', type: 'number', default: '' },
        { key: 'neck', label: '颈围（cm）', type: 'number', default: '' },
        { key: 'waist', label: '腰围（cm）', type: 'number', default: '' },
        { key: 'hip', label: '臀围（cm，女性必填）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const h = Number(v.h)
        const neck = Number(v.neck)
        const waist = Number(v.waist)
        if (!h || !neck || !waist) return [{ label: '请填写身高、颈围与腰围', value: '—' }]
        let bf: number
        if (v.sex === 'female') {
          const hip = Number(v.hip)
          if (!hip) return [{ label: '女性需填写臀围', value: '—' }]
          bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(h)) - 450
        } else {
          bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450
        }
        const cat = bf < 10 ? '必需脂肪' : bf < 14 ? '运动员' : bf < 18 ? '健康' : bf < 25 ? '可接受' : '肥胖'
        return [
          { label: '体脂率（估算）', value: `${bf.toFixed(1)}%`, primary: true },
          { label: '分类（男性标准）', value: cat },
        ]
      },
      note: '美国海军围度法为估算值，误差 ±3%。女性分类标准相应上移，仅供参考。',
    },
  },
  {
    slug: 'ideal-weight-calculator', title: '理想体重计算器', category: 'utility',
    desc: 'Devine、Robinson、Miller、Hamwi 四种经典公式对比估算理想体重。',
    keywords: ['理想体重', '体重', '健康'],
    calcDef: {
      fields: [
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
        { key: 'h', label: '身高（cm）', type: 'number', default: '' },
      ],
      compute: (v) => {
        const hCm = Number(v.h)
        if (!hCm) return [{ label: '请填写身高', value: '—' }]
        const inchesOver5ft = Math.max(0, hCm / 2.54 - 60)
        const male = v.sex === 'male'
        const devine = (male ? 50 : 45.5) + 2.3 * inchesOver5ft
        const robinson = (male ? 52 : 49) + (male ? 1.9 : 1.7) * inchesOver5ft
        const miller = (male ? 56.2 : 53.1) + (male ? 1.41 : 1.36) * inchesOver5ft
        const hamwi = (male ? 48 : 45.5) + (male ? 2.7 : 2.2) * inchesOver5ft
        const avg = (devine + robinson + miller + hamwi) / 4
        return [
          { label: '四种公式平均', value: `${avg.toFixed(1)} kg`, primary: true },
          { label: 'Devine（临床常用）', value: `${devine.toFixed(1)} kg` },
          { label: 'Robinson', value: `${robinson.toFixed(1)} kg` },
          { label: 'Miller', value: `${miller.toFixed(1)} kg` },
          { label: 'Hamwi', value: `${hamwi.toFixed(1)} kg` },
        ]
      },
      note: '公式基于身高估算，不含肌肉量与骨架差异；BMI 18.5–24 区间通常更有参考意义。',
    },
  },
  {
    slug: 'due-date-calculator', title: '预产期计算器', category: 'utility',
    desc: '按末次月经（Naegele 法则）估算预产期、当前孕周与三个孕期阶段。',
    keywords: ['预产期', '孕周', '怀孕'],
    calcDef: {
      fields: [
        { key: 'lmp', label: '末次月经第一天', type: 'date', default: '' },
      ],
      compute: (v) => {
        if (!v.lmp) return [{ label: '请选择末次月经日期', value: '—' }]
        const lmp = new Date(String(v.lmp) + 'T00:00:00')
        const due = new Date(lmp)
        due.setDate(due.getDate() + 280)
        const now = new Date()
        const daysPreg = Math.floor((now.getTime() - lmp.getTime()) / 86400000)
        const weeks = Math.floor(daysPreg / 7)
        const t2 = new Date(lmp); t2.setDate(t2.getDate() + 91)
        const t3 = new Date(lmp); t3.setDate(t3.getDate() + 189)
        return [
          { label: '预产期', value: fmtDate(due), primary: true, hint: '孕 40 周（Naegele 法则：LMP + 280 天）' },
          { label: '当前孕周', value: daysPreg >= 0 && daysPreg <= 294 ? `${weeks} 周 ${daysPreg % 7} 天` : '不在常规孕期范围内' },
          { label: '孕中期开始', value: fmtDate(t2) },
          { label: '孕晚期开始', value: fmtDate(t3) },
        ]
      },
      note: '仅供估算，实际预产期以超声测量与医生判断为准。',
    },
  },
  {
    slug: 'gpa-calculator', title: 'GPA 计算器', category: 'utility',
    desc: '按课程成绩与学分计算 4.0 制加权平均绩点。',
    keywords: ['gpa', '绩点', '成绩'],
    component: () => import('./components/GpaCalculator.vue'),
  },
  {
    slug: 'grade-calculator', title: '成绩计算器', category: 'utility',
    desc: '按各项权重计算课程总评，或反推期末考试需要的分数。',
    keywords: ['成绩', '权重', '期末'],
    component: () => import('./components/GradeCalculator.vue'),
  },
  {
    slug: 'hours-calculator', title: '工时计算器', category: 'utility',
    desc: '多段上下班时间累计工时，自动扣除午休，适合工时表与考勤。',
    keywords: ['工时', '考勤', '工时表'],
    component: () => import('./components/HoursCalculator.vue'),
  },
  {
    slug: 'sleep-cycle-calculator', title: '睡眠周期计算器', category: 'utility',
    desc: '按 90 分钟睡眠周期推算最佳就寝或起床时刻，含 15 分钟入睡缓冲。',
    keywords: ['睡眠', '起床', '就寝', 'sleep'],
    calcDef: {
      fields: [
        { key: 'mode', label: '计算方式', type: 'select', default: 'byWake', choices: [
          { value: 'byWake', label: '已知起床时间，推算就寝' },
          { value: 'byNow', label: '现在就睡，推算起床' },
        ] },
        { key: 'wake', label: '起床时间', type: 'text', default: '', placeholder: 'HH:mm，如 07:30', hint: '选「现在就睡」时无需填写' },
      ],
      compute: (v) => {
        const rows: CalcResultRow[] = []
        const hm = (mins: number) => {
          const m = ((mins % 1440) + 1440) % 1440
          return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
        }
        const parse = (t: string): number | null => {
          const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
          if (!m) return null
          const hh = Number(m[1]), mm = Number(m[2])
          if (hh > 23 || mm > 59) return null
          return hh * 60 + mm
        }
        if (v.mode === 'byWake') {
          const w = parse(String(v.wake ?? ''))
          if (w === null) return [{ label: '请输入起床时间', value: '格式 HH:mm，如 07:30' }]
          for (const c of [6, 5, 4]) {
            const bed = w - (c * 90 + 15)
            rows.push({ label: `${c} 个周期（约 ${(c * 1.5).toFixed(1)} 小时）`, value: `就寝 ${hm(bed)}`, primary: c === 5 })
          }
        } else {
          const bed = new Date().getHours() * 60 + new Date().getMinutes()
          for (const c of [3, 4, 5, 6]) {
            const up = bed + 15 + c * 90
            rows.push({ label: `${c} 个周期（约 ${(c * 1.5).toFixed(1)} 小时）`, value: `起床 ${hm(up)}`, primary: c === 5 })
          }
          rows.push({ label: '当前入睡时刻', value: hm(bed) })
        }
        return rows
      },
      note: '口径：单周期按 90 分钟、入睡缓冲 15 分钟估算（个体差异约 ±30 分钟）；5 个周期（7.5 小时）适合多数成年人。',
    },
  },
  {
    slug: 'text-extractor', title: '文本提取器', category: 'utility',
    desc: '从大段文本中批量提取邮箱、手机号、URL、IP、身份证号等并去重导出。',
    keywords: ['提取', '手机号', '邮箱', '正则提取', '批量'],
    textDef: {
      options: [
        { key: 'type', label: '提取类型', type: 'select', default: 'all', choices: [
          { value: 'all', label: '全部类型' },
          { value: 'email', label: '仅邮箱' },
          { value: 'phone', label: '仅手机号' },
          { value: 'url', label: '仅网址 URL' },
          { value: 'ip', label: '仅 IP 地址' },
          { value: 'idcard', label: '仅身份证号' },
          { value: 'date', label: '仅日期' },
          { value: 'money', label: '仅金额' },
        ] },
        { key: 'dedupe', label: '去重', type: 'toggle', default: true },
        { key: 'sort', label: '按内容排序', type: 'toggle', default: false },
        { key: 'validId', label: '身份证过校验位', type: 'toggle', default: true },
      ],
      placeholder: '粘贴含邮箱、手机号、链接等内容的大段文本，自动批量提取…',
      transform: (t, o) => {
        const type = String(o.type)
        const keys: ExtractType[] = type === 'all' ? (Object.keys(EXTRACT_TYPES) as ExtractType[]) : [type as ExtractType]
        const groups = extractFromText(t, keys, o.dedupe !== false, o.sort === true)
        const lines: string[] = []
        let total = 0
        for (const g of groups) {
          let items = g.items
          if ((type === 'idcard' || (type === 'all' && g.label === '身份证号')) && o.validId !== false) {
            items = items.filter((x) => idCardValid(x))
          }
          if (!items.length) continue
          total += items.length
          lines.push(`【${g.label}】共 ${items.length} 条`)
          lines.push(...items)
          lines.push('')
        }
        return total ? lines.join('\n').trimEnd() : '（未提取到目标内容）'
      },
    },
  },
  {
    slug: 'business-day-calculator', title: '工作日计算器', category: 'utility',
    desc: '区间工作日天数、日期加减 N 个工作日，含法定节假日与调休补班。',
    keywords: ['工作日', '调休', '节假日', '上班天数'],
    component: () => import('./components/BusinessDayCalculator.vue'),
  },
  {
    slug: 'kinship-calculator', title: '亲戚关系计算器', category: 'utility',
    desc: '「爸爸的哥哥叫什么」一键推出称谓，也可反向查关系链，走亲访友不再叫错。',
    keywords: ['亲戚', '称谓', '亲属', '过年'],
    component: () => import('./components/KinshipCalculator.vue'),
  },
  {
    slug: 'period-calculator', title: '经期/安全期计算器', category: 'utility',
    desc: '按末次月经与周期推算经期、排卵日与安全期日历，数据仅存本机不上传。',
    keywords: ['经期', '安全期', '排卵', '生理期'],
    component: () => import('./components/PeriodCalculator.vue'),
  },
  {
    slug: 'amortization-calculator', title: '房贷还款计划表', category: 'utility',
    desc: '等额本息/等额本金逐月明细，支持提前还款重算，可导出 Excel。',
    keywords: ['还款计划', '等额本金', '逐月', '提前还款'],
    component: () => import('./components/AmortizationCalculator.vue'),
  },
  {
    slug: 'lucky-wheel', title: '幸运大转盘', category: 'utility',
    desc: '名单生成抽奖转盘，缓动旋转动画与音效，课堂点名、年会抽奖、今天吃什么。',
    keywords: ['转盘', '抽奖', '随机点名', '大转盘'],
    component: () => import('./components/LuckyWheel.vue'),
  },
  {
    slug: 'random-group-splitter', title: '随机分组器', category: 'utility',
    desc: '名单随机分组成团队，支持排除与锁定成员，教师分组、团建破冰。',
    keywords: ['分组', '随机', '点名', '团队'],
    component: () => import('./components/RandomGroupSplitter.vue'),
  },
  {
    slug: 'banned-words-checker', title: '文案违禁词检测', category: 'utility',
    desc: '检测文案中的广告法极限词、医疗宣称与平台风险词，高亮并给替换建议。',
    keywords: ['违禁词', '极限词', '广告法', '文案检测'],
    component: () => import('./components/BannedWordsChecker.vue'),
  },
  {
    slug: 'statistics-calculator', title: '统计计算器', category: 'utility',
    desc: '一组数算均值/中位数/众数/方差/标准差/分位数，质检与运营数据一步到位。',
    keywords: ['标准差', '中位数', '方差', '统计'],
    calcDef: {
      fields: [
        { key: 'data', label: '数据（逗号/空格/换行分隔）', type: 'text', default: '', placeholder: '如 88, 92, 79, 85, 90' },
      ],
      compute: (v) => {
        // 先剔除空 token 再转数字：Number('') === 0 会混入幻影统计
        const nums = String(v.data ?? '').split(/[,，\s;、]+/).filter((s) => s.trim() !== '').map(Number).filter((x) => Number.isFinite(x))
        if (nums.length < 1) return [{ label: '请输入数据', value: '至少 1 个数字' }]
        const n = nums.length
        const sum = nums.reduce((a, b) => a + b, 0)
        const mean = sum / n
        const sorted = [...nums].sort((a, b) => a - b)
        const median = n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
        const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)
        const std = Math.sqrt(variance)
        const freq = new Map<number, number>()
        nums.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1))
        const maxFreq = Math.max(...freq.values())
        const modes = maxFreq > 1 ? [...freq.entries()].filter(([, c]) => c === maxFreq).map(([x]) => x) : []
        const q1 = sorted[Math.floor((n - 1) * 0.25)]!
        const q3 = sorted[Math.floor((n - 1) * 0.75)]!
        const fmt = (x: number) => (Number.isInteger(x) ? fmtN(x) : x.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''))
        const rows: CalcResultRow[] = [
          { label: '样本量 / 总和', value: n + ' 个 / ' + fmt(sum) },
          { label: '均值', value: fmt(mean), primary: true },
          { label: '中位数', value: fmt(median) },
          { label: '众数', value: modes.length ? modes.map(fmt).join('、') : '无（无重复值）' },
          { label: '样本方差 / 标准差', value: fmt(variance) + ' / ' + fmt(std) },
          { label: '极差（最大-最小）', value: fmt(sorted[n - 1]!) + ' − ' + fmt(sorted[0]!) + ' = ' + fmt(sorted[n - 1]! - sorted[0]!) },
          { label: 'Q1 / Q3（IQR）', value: fmt(q1) + ' / ' + fmt(q3) + '（' + fmt(q3 - q1) + '）' },
        ]
        if (n >= 2 && mean !== 0) rows.push({ label: '变异系数 CV', value: fmt((std / Math.abs(mean)) * 100) + '%' })
        return rows
      },
      note: '口径：方差与标准差取样本口径（除以 n−1）；分位数用序号取整插值，仅供快速参考。',
    },
  },
  {
    slug: 'phone-carrier-lookup', title: '手机号运营商查询', category: 'utility',
    desc: '判断手机号属于移动/联通/电信/广电或虚拟运营商，支持批量粘贴。',
    keywords: ['运营商', '号段', '手机号', '移动联通电信'],
    calcDef: {
      fields: [
        { key: 'phones', label: '手机号（可批量，换行或逗号分隔）', type: 'text', default: '', placeholder: '13800138000, 18600000000…' },
      ],
      compute: (v) => {
        const list = [...new Set(String(v.phones ?? '').split(/[,，\s;；、]+/).filter(Boolean))].slice(0, 200)
        if (!list.length) return [{ label: '请输入手机号', value: '可批量粘贴' }]
        return list.map((p2) => {
          const r = phoneCarrier(p2)
          return { label: p2, value: r.valid ? String(r.carrier) : '无效（' + r.reason + '）', primary: list.length === 1 }
        })
      },
      note: '口径：内置公开号段前缀表（仅判断运营商与虚商，不提供归属地，不联网查询）；新号段可能未收录。',
    },
  },
  {
    slug: 'pace-calculator', title: '跑步配速计算器', category: 'utility',
    desc: '距离/完赛时间/配速三求一，附 5K 到全马折算表，马拉松备赛常用。',
    keywords: ['配速', '马拉松', '跑步', 'pace'],
    calcDef: {
      fields: [
        { key: 'mode', label: '已知条件', type: 'select', default: 'pace', choices: [
          { value: 'pace', label: '由配速求时间' },
          { value: 'time', label: '由时间求配速' },
        ] },
        { key: 'dist', label: '距离', type: 'select', default: '42.195', choices: [
          { value: '5', label: '5 公里' }, { value: '10', label: '10 公里' }, { value: '21.0975', label: '半马 21.0975 公里' },
          { value: '42.195', label: '全马 42.195 公里' }, { value: 'custom', label: '自定义' },
        ] },
        { key: 'distC', label: '自定义距离（公里）', type: 'number', default: '' },
        { key: 'pace', label: '配速（分:秒/公里）', type: 'text', default: '', placeholder: '5:30 表示 5 分 30 秒' },
        { key: 'time', label: '完赛时间（时:分:秒）', type: 'text', default: '', placeholder: '3:59:59' },
      ],
      compute: (v) => {
        const dist = v.dist === 'custom' ? Number(v.distC) : Number(v.dist)
        if (!(dist > 0)) return [{ label: '请填写距离', value: '—' }]
        const parseHMS = (t: string): number | null => {
          const m = /^(\d+):(\d{1,2}):(\d{1,2})$|^(\d{1,2}):(\d{1,2})$/.exec(t.trim())
          if (!m) return null
          if (m[4] !== undefined) return Number(m[4]) * 60 + Number(m[5])
          return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
        }
        const parseMS = (t: string): number | null => {
          const m = /^(\d{1,2}):(\d{1,2})$/.exec(t.trim())
          if (!m) return null
          return Number(m[1]) * 60 + Number(m[2])
        }
        const hms = (s: number) => {
          const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
          return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') : m + ':' + String(sec).padStart(2, '0')
        }
        if (v.mode === 'pace') {
          const p2 = parseMS(String(v.pace ?? ''))
          if (p2 === null || p2 <= 0) return [{ label: '请填写配速', value: '格式 分:秒，如 5:30' }]
          const rows: CalcResultRow[] = [
            { label: dist + ' 公里完赛时间', value: hms(p2 * dist), primary: true },
            { label: '每 5 公里用时', value: hms(p2 * 5) },
          ]
          for (const d of [5, 10, 21.0975, 42.195]) {
            rows.push({ label: d === 21.0975 ? '半马' : d === 42.195 ? '全马' : d + 'K', value: hms(p2 * d) })
          }
          return rows
        }
        const t = parseHMS(String(v.time ?? ''))
        if (t === null || t <= 0) return [{ label: '请填写完赛时间', value: '格式 时:分:秒，如 3:59:59' }]
        const pace = t / dist
        const pm = Math.floor(pace / 60), ps = Math.round(pace % 60)
        return [
          { label: '平均配速', value: pm + ':' + String(ps).padStart(2, '0') + ' /公里', primary: true },
          { label: '折算 5K', value: hms(pace * 5) },
          { label: '折算半马', value: hms(pace * 21.0975) },
          { label: '折算全马', value: hms(pace * 42.195) },
        ]
      },
      note: '口径：配速 = 时间 ÷ 距离，匀速假设，未考虑爬升/补给与赛道拥挤；折算表按匀速估算。',
    },
  },
  {
    slug: 'one-rep-max-calculator', title: '健身极限重量 1RM', category: 'utility',
    desc: '按 Epley/Brzycki 公式推算单次极限重量，附百分比训练负荷表。',
    keywords: ['1RM', '极限重量', '深蹲', '卧推'],
    calcDef: {
      fields: [
        { key: 'w', label: '训练重量', type: 'number', default: '', suffix: 'kg' },
        { key: 'r', label: '完成次数', type: 'number', default: 5, suffix: '次' },
      ],
      compute: (v) => {
        const w = Number(v.w), r = Math.floor(Number(v.r))
        if (!(w > 0) || !(r > 0)) return [{ label: '请填写重量与次数', value: '—' }]
        if (r > 12) return [{ label: '次数过多', value: '1RM 估算建议使用 ≤12 次力竭组，误差更小' }]
        const epley = w * (1 + r / 30)
        const brzycki = w * (36 / (37 - Math.min(r, 36)))
        const oneRm = (epley + brzycki) / 2
        const fmt = (x: number) => (Math.round(x * 2) / 2).toFixed(1)
        const loads = [95, 90, 85, 80, 75, 70, 65, 60].map((p2) => p2 + '% → ' + fmt((oneRm * p2) / 100) + 'kg × ' + (p2 >= 85 ? 2 : p2 >= 75 ? 5 : 8) + ' 次')
        return [
          { label: '估算 1RM', value: fmt(oneRm) + ' kg', primary: true, hint: 'Epley ' + fmt(epley) + ' / Brzycki ' + fmt(brzycki) },
          { label: '3RM / 5RM / 10RM', value: fmt((oneRm * 93) / 100) + ' / ' + fmt((oneRm * 87) / 100) + ' / ' + fmt((oneRm * 75) / 100) + ' kg' },
          { label: '力量/爆发负荷', value: loads.slice(0, 4).join(' ｜ ') },
          { label: '肌肥大负荷', value: loads.slice(4).join(' ｜ ') },
        ]
      },
      note: '口径：取 Epley 与 Brzycki 两公式均值，适合 12 次以内力竭组；新手建议保守取下限，大重量训练请有人保护。',
    },
  },
  {
    slug: 'tdee-calculator', title: '基础代谢 TDEE 计算器', category: 'utility',
    desc: 'Mifflin-St Jeor 公式算 BMR，按活动系数推每日总消耗与三大营养素分配。',
    keywords: ['基础代谢', 'BMR', 'TDEE', '减脂'],
    calcDef: {
      fields: [
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
        { key: 'age', label: '年龄', type: 'number', default: 30, suffix: '岁' },
        { key: 'h', label: '身高', type: 'number', default: '', suffix: 'cm' },
        { key: 'w', label: '体重', type: 'number', default: '', suffix: 'kg' },
        { key: 'act', label: '活动水平', type: 'select', default: '1.375', choices: [
          { value: '1.2', label: '久坐（几乎不运动）' }, { value: '1.375', label: '轻度（每周 1-3 次）' },
          { value: '1.55', label: '中度（每周 3-5 次）' }, { value: '1.725', label: '高度（每周 6-7 次）' },
          { value: '1.9', label: '极高（体力劳动/双训）' },
        ] },
      ],
      compute: (v) => {
        const age = Number(v.age), h = Number(v.h), w = Number(v.w), act = Number(v.act)
        if (!(age > 0 && h > 0 && w > 0)) return [{ label: '请填写完整的身高体重年龄', value: '—' }]
        const bmr = 10 * w + 6.25 * h - 5 * age + (v.sex === 'male' ? 5 : -161)
        const tdee = bmr * act
        const fmt = (x: number) => Math.round(x).toLocaleString('zh-CN')
        return [
          { label: '基础代谢 BMR', value: fmt(bmr) + ' 千卡', hint: 'Mifflin-St Jeor 公式' },
          { label: '每日总消耗 TDEE', value: fmt(tdee) + ' 千卡', hint: 'BMR × 活动系数', primary: true },
          { label: '温和减脂（−300 千卡）', value: '约 ' + fmt(tdee - 300) + ' 千卡/天' },
          { label: '均衡维持', value: '约 ' + fmt(tdee) + ' 千卡/天' },
          { label: '增肌盈余（+300 千卡）', value: '约 ' + fmt(tdee + 300) + ' 千卡/天' },
          { label: '宏量分配建议（维持）', value: '蛋白 ' + fmt((tdee * 0.3) / 4) + 'g ｜ 脂肪 ' + fmt((tdee * 0.25) / 9) + 'g ｜ 碳水 ' + fmt((tdee * 0.45) / 4) + 'g' },
        ]
      },
      note: '口径：Mifflin-St Jeor 公式（1990），公认较准的估算式；个体差异可达 ±10%，以体成分变化为准。',
    },
  },
  {
    slug: 'shoe-size-converter', title: '鞋码尺码换算', category: 'utility',
    desc: '中/欧/美/英/日男女鞋码互转与脚长毫米反查，海淘下单必备。',
    keywords: ['鞋码', '尺码', '海淘', '换算'],
    calcDef: {
      fields: [
        { key: 'sex', label: '适用', type: 'select', default: 'male', choices: [{ value: 'male', label: '男鞋' }, { value: 'female', label: '女鞋' }] },
        { key: 'sys', label: '已知尺码制', type: 'select', default: 'eu', choices: [
          { value: 'cn', label: '中国码（脚长 mm）' }, { value: 'eu', label: '欧码 EU' }, { value: 'us', label: '美码 US' }, { value: 'uk', label: '英码 UK' },
        ] },
        { key: 'size', label: '尺码数值', type: 'text', default: '', placeholder: '如 42 或 260' },
      ],
      compute: (v) => {
        const s = String(v.size ?? '').trim()
        const n = Number(s)
        if (!s || !Number.isFinite(n)) return [{ label: '请输入尺码', value: '—' }]
        const male = v.sex === 'male'
        // 统一以「欧码 ↔ 脚长」为主轴（脚长 cm×1.5+2 = EU），美/英按性别用市场通行偏移换算
        const eu = v.sys === 'cn' ? (n / 10) * 1.5 + 2
          : v.sys === 'eu' ? n
          : v.sys === 'us' ? n + (male ? 33.5 : 31)
          : n + (male ? 34.5 : 33)
        if (!Number.isFinite(eu)) return [{ label: '请确认尺码制', value: '—' }]
        const foot = Math.round(((eu - 2) / 1.5) * 10 / 5) * 5
        const us = male ? eu - 33.5 : eu - 31
        const uk = male ? eu - 34.5 : eu - 33
        const jp = foot / 10
        const f1 = (x: number) => x.toFixed(1)
        return [
          { label: '脚长参考', value: '约 ' + foot + ' mm', primary: true },
          { label: '中国码（脚长制）', value: foot + ' mm' },
          { label: '欧码 EU', value: f1(eu) },
          { label: '美码 US', value: f1(us) },
          { label: '英码 UK', value: f1(uk) },
          { label: '日码 JP（cm）', value: f1(jp) },
        ]
      },
      note: '口径：EU = 脚长(cm)×1.5 + 2 的近似线性模型，美码按市场通行表偏移（男 US≈EU−33.5、女 US≈EU−31）；各品牌存在 ±半码差异，下单前以该品牌官方尺码表为准。',
    },
  },
  {
    slug: 'fraction-calculator', title: '分数计算器', category: 'utility',
    desc: '分数四则运算、约分与带分数互转，BigInt 精确计算不丢精度。',
    keywords: ['分数', '约分', '通分', 'fraction'],
    calcDef: {
      fields: [
        { key: 'a', label: '分数 A', type: 'text', default: '', placeholder: '如 1/2、3 或带分数 1 1/2' },
        { key: 'op', label: '运算', type: 'select', default: '+', choices: [
          { value: '+', label: '加（+）' }, { value: '-', label: '减（−）' }, { value: '*', label: '乘（×）' }, { value: '/', label: '除（÷）' },
        ] },
        { key: 'b', label: '分数 B', type: 'text', default: '', placeholder: '如 3/4' },
      ],
      compute: (v) => {
        const parse = (t: string): [bigint, bigint] | null => {
          const s = t.trim().replace(/＋/g, '+')
          let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s)
          if (m) return [BigInt(m[1]) * BigInt(m[3]) + BigInt(m[2]), BigInt(m[3])]
          m = /^(-?\d+)\/(\d+)$/.exec(s)
          if (m) return [BigInt(m[1]), BigInt(m[2])]
          if (/^-?\d+$/.test(s)) return [BigInt(s), 1n]
          return null
        }
        const gcd = (x: bigint, y: bigint): bigint => (y === 0n ? (x < 0n ? -x : x) : gcd(y, x % y))
        const A = parse(String(v.a ?? '')), B = parse(String(v.b ?? ''))
        if (!A || !B) return [{ label: '请按格式输入分数', value: '支持 3/4、5、带分数 1 1/2' }]
        const an = A[0], ad = A[1], bn = B[0], bd = B[1]
        let rn: bigint, rd: bigint
        const op = String(v.op)
        if (op === '+') { rn = an * bd + bn * ad; rd = ad * bd }
        else if (op === '-') { rn = an * bd - bn * ad; rd = ad * bd }
        else if (op === '*') { rn = an * bn; rd = ad * bd }
        else {
          if (bn === 0n) return [{ label: '除数不能为零', value: '—' }]
          rn = an * bd; rd = ad * bn
        }
        if (rd === 0n) return [{ label: '分母不能为零', value: '—' }]
        if (rd < 0n) { rn = -rn; rd = -rd }
        const g = gcd(rn, rd)
        rn /= g
        rd /= g
        const dec = Number(rn) / Number(rd)
        // 带分数按绝对值拆整数部分，符号统一前置（−1/2 不再丢符号、−7/6 → -1 又 1/6）
        const negOut = rn < 0n
        const arn = negOut ? -rn : rn
        const whole = arn / rd
        const rem = arn % rd
        const sign = negOut ? '-' : ''
        const mixed = rd === 1n
          ? rn.toString()
          : rem === 0n
            ? '—'
            : whole === 0n
              ? sign + arn + '/' + rd + '（真分数，无整数部分）'
              : sign + whole + ' 又 ' + rem + '/' + rd
        return [
          { label: '最简分数', value: rd === 1n ? rn.toString() : rn + '/' + rd, primary: true },
          { label: '带分数', value: mixed },
          { label: '小数', value: Number.isFinite(dec) ? dec.toString().slice(0, 16) : '—' },
          { label: '过程', value: '(' + an + '/' + ad + ') ' + (op === '*' ? '×' : op === '/' ? '÷' : op) + ' (' + bn + '/' + bd + ')' },
        ]
      },
      note: '口径：BigInt 整数分数运算，结果自动约分；循环小数显示前 16 位。',
    },
  },
  {
    slug: 'text-cleaner', title: '文本清洗器', category: 'utility',
    desc: '一键去空格/空行/标点/Emoji/HTML 标签，中英文数字按需清除。',
    keywords: ['文本清洗', '去空格', '去标点', '格式化'],
    textDef: {
      options: [
        { key: 'spaces', label: '压缩多余空格', type: 'toggle', default: true },
        { key: 'emptyLines', label: '去除空行', type: 'toggle', default: false },
        { key: 'punctuation', label: '去除标点', type: 'toggle', default: false },
        { key: 'emoji', label: '去除 Emoji', type: 'toggle', default: false },
        { key: 'htmlTags', label: '去除 HTML 标签', type: 'toggle', default: false },
        { key: 'digits', label: '去除数字', type: 'toggle', default: false },
        { key: 'chinese', label: '去除中文', type: 'toggle', default: false },
        { key: 'english', label: '去除英文', type: 'toggle', default: false },
        { key: 'toHalf', label: '全角转半角', type: 'toggle', default: false },
      ],
      placeholder: '粘贴要清洗的文本…',
      transform: (t, o) => cleanText(t, o as never),
    },
  },
  {
    slug: 'fullwidth-converter', title: '全角半角转换', category: 'utility',
    desc: '全角↔半角互转（数字/字母/标点/空格），处理财务与系统录入格式。',
    keywords: ['全角', '半角', '转换', '全半角'],
    textDef: {
      options: [
        { key: 'dir', label: '方向', type: 'select', default: 'toHalf', choices: [
          { value: 'toHalf', label: '全角 → 半角' }, { value: 'toFull', label: '半角 → 全角' },
        ] },
      ],
      placeholder: '粘贴含全角或半角字符的文本…',
      transform: (t, o) => (o.dir === 'toFull' ? halfToFull(t) : fullToHalf(t)),
    },
  },
  {
    slug: 'typing-test', title: '打字速度测试', category: 'utility',
    desc: '30/60 秒限时测速，中文按字计速、英文按 WPM，实时正确率与速度曲线。',
    keywords: ['打字', '测速', 'wpm', '键盘'],
    component: () => import('./components/TypingTest.vue'),
    steps: ['选择中文或英文模式', '点开始跟随文字输入', '结束时看成绩曲线'],
  },
  {
    slug: 'text-set-operations', title: '文本集合运算', category: 'utility',
    desc: '两列文本求交集/并集/差集，支持忽略大小写与去空白，名单比对利器。',
    keywords: ['交集', '并集', '差集', '名单比对'],
    component: () => import('./components/TextSetOps.vue'),
  },
  {
    slug: 'vcard-generator', title: '电子名片 vCard', category: 'utility',
    desc: '生成标准 vCard 名片，扫码存通讯录或下载 .vcf，微信邮箱通用。',
    keywords: ['名片', 'vcard', '联系人', '二维码名片'],
    component: () => import('./components/VCardGenerator.vue'),
  },
  {
    slug: 'archive-extractor', title: '在线解压', category: 'utility',
    desc: '本地解压 zip/7z/rar/tar.gz，支持密码加密包，文件列表预览后按需下载。',
    keywords: ['解压', '压缩包', 'rar', '7z'],
    needModel: true,
    component: () => import('./components/ArchiveExtractor.vue'),
  },
  {
    slug: 'special-symbols', title: '特殊符号大全', category: 'utility',
    desc: '箭头/数学/序号/花边等符号库，点击复制，常用符号最近使用置顶。',
    keywords: ['特殊符号', '箭头', '序号', '复制'],
    component: () => import('./components/SpecialSymbols.vue'),
  },
  {
    slug: 'screen-dead-pixel-test', title: '屏幕坏点测试', category: 'utility',
    desc: '全屏纯色循环检测坏点亮点，含闪烁修复模式，新机验机二手验屏。',
    keywords: ['坏点', '屏幕检测', '验机'],
    component: () => import('./components/ScreenDeadPixelTest.vue'),
  },
  {
    slug: 'keyboard-test', title: '键盘按键测试', category: 'utility',
    desc: '可视化 87 键布局，按下高亮计数，检测卡键与连击 CPM，机械键盘验轴。',
    keywords: ['键盘测试', '卡键', '连击', '键盘检测'],
    component: () => import('./components/KeyboardTest.vue'),
  },
  {
    slug: 'idiom-dictionary', title: '成语词典', category: 'utility',
    desc: '三万条成语随查随用：拼音、释义、出处、例句，支持成语接龙与随机抽读。',
    keywords: ['成语', '词典', '接龙', '释义'],
    needModel: true,
    component: () => import('./components/IdiomDictionary.vue'),
  },
  {
    slug: 'xiehouyu-lookup', title: '歇后语查询', category: 'utility',
    desc: '一万四千条歇后语检索与随机抽签，写作聊天趣味加分。',
    keywords: ['歇后语', '俗语', '谜语'],
    needModel: true,
    component: () => import('./components/XiehouyuLookup.vue'),
  },
  {
    slug: 'hanzi-stroke-order', title: '汉字笔顺演示', category: 'utility',
    desc: '逐字播放标准笔顺动画，支持描红练习，家长辅导语文神器。',
    keywords: ['笔顺', '汉字', '描红', '笔画'],
    needModel: true,
    component: () => import('./components/HanziStrokeOrder.vue'),
    steps: ['输入一个汉字', '点播放看笔顺动画', '切描红模式用鼠标描写'],
  },
  {
    slug: 'poem-search', title: '古诗词检索', category: 'utility',
    desc: '唐诗三百首 + 宋词三百首精选语料，按题目、作者、名句即时检索。',
    keywords: ['古诗词', '唐诗', '宋词', '诗句'],
    needModel: true,
    component: () => import('./components/PoemSearch.vue'),
  },
  {
    slug: 'phonetic-lookup', title: '英语音标查询', category: 'utility',
    desc: '两万高频词英美音标与中文释义速查，背单词发音参考。',
    keywords: ['音标', '发音', '词典', '英语'],
    needModel: true,
    component: () => import('./components/PhoneticLookup.vue'),
  },
  {
    slug: 'periodic-table', title: '元素周期表', category: 'utility',
    desc: '交互式 118 元素周期表：类别着色、性质速查、按符号或中文名搜索。',
    keywords: ['元素周期表', '化学', '元素'],
    needModel: true,
    component: () => import('./components/PeriodicTable.vue'),
  },
  {
    slug: 'dynasty-timeline', title: '历史朝代表', category: 'utility',
    desc: '从夏商周到明清的朝代时间轴与速查表，含都城与建立者。',
    keywords: ['朝代', '历史', '时间轴'],
    component: () => import('./components/DynastyTimeline.vue'),
  },
  {
    slug: 'university-lookup', title: '全国高校查询', category: 'utility',
    desc: '公办本科名单按省份、类别与 985/211/双一流标签筛选。',
    keywords: ['高校', '大学', '985', '高考'],
    needModel: true,
    component: () => import('./components/UniversityLookup.vue'),
  },
  {
    slug: 'latex-editor', title: 'LaTeX 公式编辑器', category: 'utility',
    desc: 'KaTeX 实时渲染数学公式，常用模板一键插入，导出高清 PNG。',
    keywords: ['latex', '公式', '数学', 'katex'],
    component: () => import('./components/LatexEditor.vue'),
  },
  {
    slug: 'sudoku-solver', title: '数独生成与求解', category: 'utility',
    desc: '三档难度出题（唯一解）、冲突标红、逐格提示，也可手输题目求解。',
    keywords: ['数独', 'sudoku', '解谜'],
    component: () => import('./components/SudokuSolver.vue'),
  },
  {
    slug: 'whiteboard', title: '在线白板', category: 'utility',
    desc: '画笔/直线/矩形/椭圆/文字随手涂画，撤销重做，导出 PNG。',
    keywords: ['白板', '涂鸦', '画板', '草图'],
    component: () => import('./components/Whiteboard.vue'),
  },
  {
    slug: 'er-diagram-editor', title: '数据库 ER 图设计器', category: 'utility',
    desc: '拖拽建表、连线标外键，导出 MySQL 建表 SQL 与设计图 PNG。',
    keywords: ['er图', '数据库', '建表', 'sql'],
    component: () => import('./components/ErDiagramEditor.vue'),
  },
  {
    slug: 'kids-coloring', title: '儿童涂色画板', category: 'utility',
    desc: '六款原创线稿点选填色，可打印成涂色卡，亲子手工首选。',
    keywords: ['涂色', '儿童', '画画', '亲子'],
    component: () => import('./components/KidsColoring.vue'),
  },
  {
    slug: 'garbage-classifier', title: '垃圾分类查询', category: 'utility',
    desc: '四千条常见物品干湿/可回收/有害分类速查（上海四分类口径）。',
    keywords: ['垃圾分类', '干垃圾', '湿垃圾'],
    needModel: true,
    component: () => import('./components/GarbageClassifier.vue'),
  },
  {
    slug: 'food-calorie-lookup', title: '食物热量速查', category: 'utility',
    desc: '常见食物热量与三大营养素查询，可逐项加入「一餐」累计。',
    keywords: ['食物热量', '卡路里', '营养'],
    needModel: true,
    component: () => import('./components/FoodCalorieLookup.vue'),
  },
  {
    slug: 'invoice-assistant', title: '发票抬头助手', category: 'utility',
    desc: '抬头信息生成二维码与文本，前台扫码开票，多抬头本机保存。',
    keywords: ['发票', '抬头', '开票', '税号'],
    component: () => import('./components/InvoiceAssistant.vue'),
  },
  {
    slug: 'mbti-personality-test', title: 'MBTI 人格测试', category: 'utility',
    desc: '28 题快速版 MBTI 自测，四维度百分比与类型解读，娱乐向。',
    keywords: ['mbti', '人格', '性格测试'],
    component: () => import('./components/MbtiTest.vue'),
    steps: ['凭直觉答完 28 题', '查看四维度倾向', '复制结果分享'],
  },
  {
    slug: 'digital-muyu', title: '电子木鱼', category: 'utility',
    desc: '敲木鱼积功德，敲击音效与连击动效，解压摸鱼神器（可挂机）。',
    keywords: ['木鱼', '功德', '解压'],
    component: () => import('./components/DigitalMuyu.vue'),
  },
  {
    slug: 'handheld-marquee', title: '手持弹幕 LED', category: 'utility',
    desc: '全屏滚动大字：接机、演唱会应援、直播间标语，支持镜像翻转。',
    keywords: ['弹幕', 'led', '接机', '应援'],
    component: () => import('./components/HandheldMarquee.vue'),
  },
  {
    slug: 'teleprompter', title: '提词器', category: 'utility',
    desc: '口播录制全屏匀速滚动台词，可调速、镜像与焦点线，滚完自停。',
    keywords: ['提词器', '口播', '台词', '直播'],
    component: () => import('./components/Teleprompter.vue'),
  },
  {
    slug: 'online-piano', title: '虚拟钢琴', category: 'utility',
    desc: '一个半八度虚拟键盘，鼠标点击或键盘映射弹奏，音色本地合成。',
    keywords: ['钢琴', '键盘', '乐器', '弹奏'],
    component: () => import('./components/OnlinePiano.vue'),
  },
  {
    slug: 'qr-code-repair', title: '二维码修复', category: 'utility',
    desc: '识别模糊、带 Logo 的旧二维码，重新生成高纠错的干净新码。',
    keywords: ['二维码修复', '模糊', '去logo'],
    component: () => import('./components/QrCodeRepair.vue'),
  },
  {
    slug: 'seal-generator', title: '印章示意图生成', category: 'utility',
    desc: '圆形/椭圆章风格示意图（弧形文字+五角星），文档示意与 PPT 配图。',
    keywords: ['印章', '示意图', '图章'],
    component: () => import('./components/SealGenerator.vue'),
  },
  {
    slug: 'name-generator', title: '随机起名器', category: 'utility',
    desc: '按风格与性别偏好批量生成中文名（附拼音），起名灵感参考。',
    keywords: ['起名', '取名', '名字生成'],
    component: () => import('./components/NameGenerator.vue'),
  },
  {
    slug: 'avatar-generator', title: '随机头像生成器', category: 'utility',
    desc: '八种 DiceBear 风格按 seed 生成稳定头像，批量导出 PNG。',
    keywords: ['头像', '生成器', 'dicebear', '卡通'],
    component: () => import('./components/AvatarGenerator.vue'),
  },
  {
    slug: 'text-to-handwriting', title: '手写体文字图', category: 'utility',
    desc: '文字渲染成楷体「手写作业」图（横线/方格纸+抖动），导出 PNG/PDF。',
    keywords: ['手写体', '作业', '楷体', '生成'],
    component: () => import('./components/TextToHandwriting.vue'),
  },
  {
    slug: 'text-behind-image', title: '文字藏于主体后', category: 'utility',
    desc: '海报级效果：大字被人像/主体遮挡，色键抠图本地完成无需模型。',
    keywords: ['文字遮挡', '海报', '抠图'],
    component: () => import('./components/TextBehindImage.vue'),
  },
  {
    slug: 'calendar-printer', title: '可打印日历', category: 'utility',
    desc: '带农历与法定节假日的月历/年历，打印或导出 PNG，可做桌面日历。',
    keywords: ['日历', '打印', '年历', '农历'],
    component: () => import('./components/CalendarPrinter.vue'),
  },
  {
    slug: 'citation-generator', title: '参考文献引用生成', category: 'utility',
    desc: '按 GB/T 7714-2015 与 APA 7 生成图书/期刊/网页等文献引用。',
    keywords: ['参考文献', '引用', 'gb7714', 'apa', '论文'],
    calcDef: {
      fields: [
        { key: 'type', label: '文献类型', type: 'select', default: 'journal', choices: [
          { value: 'book', label: '图书 [M]' }, { value: 'journal', label: '期刊论文 [J]' },
          { value: 'thesis', label: '学位论文 [D]' }, { value: 'web', label: '网页/电子资源 [EB/OL]' },
          { value: 'conference', label: '会议论文 [C]' },
        ] },
        { key: 'authors', label: '作者（多人用逗号分隔）', type: 'text', default: '' },
        { key: 'title', label: '题名', type: 'text', default: '' },
        { key: 'year', label: '年份', type: 'text', default: '' },
        { key: 'journal', label: '期刊名 / 会议名 / 学校', type: 'text', default: '', hint: '按类型填写对应项' },
        { key: 'volume', label: '卷期（如 45(3)）', type: 'text', default: '' },
        { key: 'pages', label: '页码（如 12-18）', type: 'text', default: '' },
        { key: 'url', label: '网址（网页类）', type: 'text', default: '' },
      ],
      compute: (v) => {
        // 「期刊名/出版社/学校/会议名」为同一输入框，按文献类型映射到引擎对应字段
        const source = String(v.journal ?? '')
        const f = {
          type: String(v.type),
          authors: String(v.authors ?? ''),
          title: String(v.title ?? ''),
          year: String(v.year ?? ''),
          journal: source,
          publisher: source,
          university: source,
          conference: source,
          volume: String(v.volume ?? ''),
          pages: String(v.pages ?? ''),
          url: String(v.url ?? ''),
        }
        if (!f.title) return [{ label: '请填写题名', value: '—' }]
        const r = formatCitation(f)
        return [
          { label: 'GB/T 7714-2015', value: r.gb, primary: true },
          { label: 'APA 7', value: r.apa },
        ]
      },
      note: '口径：GB/T 7714-2015 顺序编码制与 APA 第 7 版常用格式；投稿前请以目标期刊/学校的格式要求逐项核对。',
    },
  },
  {
    slug: 'blood-type-inheritance', title: '血型遗传计算', category: 'utility',
    desc: '父母 ABO 血型推出子女可能血型，附 Rh 血型说明。',
    keywords: ['血型', '遗传', 'abo'],
    calcDef: {
      fields: [
        { key: 'fa', label: '父亲血型', type: 'select', default: 'A', choices: [
          { value: 'A', label: 'A 型' }, { value: 'B', label: 'B 型' }, { value: 'AB', label: 'AB 型' }, { value: 'O', label: 'O 型' },
        ] },
        { key: 'mo', label: '母亲血型', type: 'select', default: 'B', choices: [
          { value: 'A', label: 'A 型' }, { value: 'B', label: 'B 型' }, { value: 'AB', label: 'AB 型' }, { value: 'O', label: 'O 型' },
        ] },
      ],
      compute: (v) => {
        const r = bloodInherit(v.fa as never, v.mo as never)
        const fmt = (arr: string[]) => arr.map((x) => x + ' 型').join('、')
        return [
          { label: '子女可能血型', value: fmt(r.possible), primary: true },
          { label: '子女不可能血型', value: r.impossible.length ? fmt(r.impossible) : '四种都有可能' },
          { label: 'Rh 血型说明', value: 'Rh+ 为显性遗传，父母均 Rh− 时子女必为 Rh−；其余组合以血检为准' },
        ]
      },
      note: '口径：ABO 血型按 AB 显性遗传规则推导可能集；极罕见孟买血型等例外未计入，实际以实验室血型鉴定为准。',
    },
  },
  {
    slug: 'clothing-size-chart', title: '服装尺码对照', category: 'utility',
    desc: '男女上衣/裤装尺码对照（国际/中国/身高体重推荐），海淘购物参考。',
    keywords: ['尺码', '服装', '衣服尺码', '海淘'],
    calcDef: {
      fields: [
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男装' }, { value: 'female', label: '女装' }] },
        { key: 'kind', label: '品类', type: 'select', default: 'top', choices: [
          { value: 'top', label: '上装（T恤/衬衫/外套）' }, { value: 'pants', label: '裤装' },
        ] },
        { key: 'h', label: '身高', type: 'number', default: '', suffix: 'cm' },
        { key: 'w', label: '体重', type: 'number', default: '', suffix: 'kg' },
      ],
      compute: (v) => {
        const female = v.sex === 'female'
        const kind = v.kind === 'pants' ? 'pants' : 'top'
        const h = Number(v.h), w = Number(v.w)
        if (!(h > 0 && w > 0)) return [{ label: '请填写身高与体重', value: '—' }]
        const rec = recommendSize(h, w, female)
        // SIZE_CHARTS 的 cat 是「上衣（男）」等中文键，kind 需按性别映射过去
        const cat = kind === 'pants' ? (female ? '裤装（女）' : '裤装（男）') : female ? '上衣（女）' : '上衣（男）'
        const chart = SIZE_CHARTS.find((c) => (c.female ?? false) === female && c.cat === cat)
        if (!chart) return [{ label: '暂无该品类对照', value: '—' }]
        const rows: CalcResultRow[] = chart.rows.map((r) => ({
          label: r.intl,
          value: `身高 ${r.cn} · 欧码 ${r.eu} · 胸围 ${r.chest} · 腰围 ${r.waist}`,
        }))
        rows.unshift({ label: '按身高体重推荐', value: rec, primary: true, hint: '宽松/修身偏好请上下调一档' })
        return rows
      },
      note: '口径：常见休闲服装版型对照表，不同品牌剪裁差异大（修身/宽松），以具体商品尺码表为准。',
    },
  },
  {
    slug: 'address-parser', title: '收货地址解析', category: 'utility',
    desc: '乱序地址智能拆出省/市/区/详细地址，支持批量，电商打单利器。',
    keywords: ['地址解析', '地址库', '省市区', '打单'],
    textDef: {
      options: [
        { key: 'fmt', label: '输出格式', type: 'select', default: 'lines', choices: [
          { value: 'lines', label: '分行（省/市/区/详址）' }, { value: 'csv', label: 'CSV（一行一条）' },
        ] },
      ],
      placeholder: '每行一条地址，支持乱序，如：上海市浦东新区张江高科技园区博云路2号 13800000000 王小明',
      transform: async (t, o) => parseAddresses(t, o.fmt === 'csv'),
    },
  },
  {
    slug: 'retirement-calculator', title: '退休年龄计算', category: 'utility',
    desc: '按渐进式延迟退休新政推算法定退休年月与距今年数。',
    keywords: ['退休', '延迟退休', '退休年龄'],
    calcDef: {
      fields: [
        { key: 'kind', label: '人员类别', type: 'select', default: 'male', choices: RETIRE_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { key: 'birth', label: '出生年月', type: 'date', default: '' },
      ],
      compute: (v) => {
        const birth = String(v.birth ?? '')
        if (!birth) return [{ label: '请选择出生年月', value: '—' }]
        const r = retirementFor(birth, v.kind as never)
        if (!r) return [{ label: '日期无效', value: '请检查出生年月' }]
        const awayYears = Math.floor(r.monthsAway / 12)
        const awayMonths = r.monthsAway % 12
        return [
          { label: '法定退休时间', value: r.retireYm, primary: true },
          { label: '退休年龄', value: r.ageText + `（较原规定延迟 ${r.delayMonths} 个月）` },
          { label: '距离退休', value: r.monthsAway <= 0 ? '已到退休年龄' : `还有 ${awayYears} 年 ${awayMonths} 个月` },
        ]
      },
      note: '口径：2024 年全国人大常委会「渐进式延迟法定退休年龄」决定（自 2025-01-01 起按每 4 个月延迟 1 个月）；实际以社保经办机构核定为准。',
    },
  },
  {
    slug: 'shelf-life-calculator', title: '保质期计算器', category: 'utility',
    desc: '生产日期 + 保质期算到期日与剩余天数，食品药妆临期提醒。',
    keywords: ['保质期', '到期日', '临期'],
    calcDef: {
      fields: [
        { key: 'prod', label: '生产日期', type: 'date', default: '' },
        { key: 'n', label: '保质期数值', type: 'number', default: 12 },
        { key: 'unit', label: '单位', type: 'select', default: 'month', choices: [
          { value: 'day', label: '天' }, { value: 'month', label: '月' }, { value: 'year', label: '年' },
        ] },
      ],
      compute: (v) => {
        const prod = String(v.prod ?? '')
        const n = Number(v.n)
        if (!prod || !(n > 0)) return [{ label: '请填写生产日期与保质期', value: '—' }]
        const [y, m, d] = prod.split('-').map(Number)
        let exp: Date
        if (v.unit === 'month' || v.unit === 'year') {
          // 整月/整年顺延带月末钳制：1-31 + 1 月 → 2-28/29（直接 setMonth 会溢出到下月）
          exp = new Date(dateAddMonths(prod, v.unit === 'month' ? Math.round(n) : Math.round(n) * 12) + 'T00:00:00')
        } else {
          exp = new Date(y!, m! - 1, d! + Math.round(n))
        }
        const days = Math.ceil((exp.getTime() - Date.now()) / 86400000)
        const state = days < 0 ? `已过期 ${-days} 天` : days <= 7 ? `⚠ 临期，仅剩 ${days} 天` : `剩余 ${days} 天`
        return [
          { label: '到期日期', value: `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`, primary: true },
          { label: '状态', value: state, primary: days < 0 },
        ]
      },
      note: '口径：按整月/整年顺延（如 1-31 + 1 月 → 2-28/29 回退）；开封后保质期与标注不同，请以包装说明为准。',
    },
  },
  {
    slug: 'shift-schedule-calculator', title: '倒班排班计算', category: 'utility',
    desc: '两班倒/三班倒/四班三运转：锚定班次查任意日期，快速排班参考。',
    keywords: ['倒班', '排班', '三班倒', '班次'],
    calcDef: {
      fields: [
        { key: 'model', label: '班制', type: 'select', default: 'two', choices: SHIFT_MODELS.map((m) => ({ value: m.id, label: m.label })) },
        { key: 'anchor', label: '锚点日期（该天上的班次）', type: 'date', default: '' },
        { key: 'anchorIdx', label: '锚点当天是第几班（从 0 开始）', type: 'number', default: 0 },
        { key: 'query', label: '查询日期', type: 'date', default: '' },
      ],
      compute: (v) => {
        const model = SHIFT_MODELS.find((m) => m.id === v.model)
        const anchor = String(v.anchor ?? '')
        const query = String(v.query ?? '')
        if (!model || !anchor || !query) return [{ label: '请选择班制并填写两个日期', value: '锚点=你知道班次的某一天' }]
        const r = shiftOn(model, anchor, Math.max(0, Math.round(Number(v.anchorIdx) || 0)), query)
        return [
          { label: `${query} 的班次`, value: r.name, primary: true },
          { label: '周期位置', value: `第 ${r.cyclePos + 1} 天 / 共 ${model.cycle.reduce((s, c) => s + c.days, 0)} 天` },
          { label: '班制说明', value: model.desc },
        ]
      },
      note: '口径：以「周期天数 + 锚点」线性推算；节假日是否上班与调休由单位排班表决定，本工具只按固定周期推算。',
    },
  },
]

export default tools
void textStats
void slugify
void piiScrub
