import type { ToolDef, CalcResultRow } from '@/types'
import {
  toCase, sortLines, removeDuplicateLines, reverseText, removeLineBreaks, repeatText,
  morseEncode, morseDecode, textToBinary, binaryToText, caesar, toRoman, fromRoman,
  numberToChinese, wordFrequency, isPalindrome, isAnagram, findReplace, randomString,
  uuidv4, slugify, piiScrub, textStats,
} from '@/lib/textEngine'
import { loanPayment, compoundInterest } from '@/lib/finance'
import { calcAge, convertTimezone, dateDiff, COMMON_TIMEZONES } from '@/lib/dateEngine'

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

/** 实用工具注册表（65 项）—— 文本/编码类走内联 textDef，其余为自定义组件 */
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
    slug: 'number-to-words', title: '数字转中文大写', category: 'utility',
    desc: '把整数与小数转成中文汉字或财务大写（壹贰叁），适合填单据与合同。',
    keywords: ['大写', '数字', '人民币'],
    textDef: {
      options: [{ key: 'finance', label: '财务大写（壹贰叁）', type: 'toggle', default: true }],
      transform: (t, o) => numberToChinese(t.trim(), !!o.finance),
      singleLine: true,
      placeholder: '输入数字，如 1234.56',
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
          return [
            { label: '源时区时间', value: r.from },
            { label: '目标时区时间', value: r.to, primary: true },
          ]
        } catch (e) {
          return [{ label: '错误', value: (e as Error).message }]
        }
      },
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
    slug: 'average-calculator', title: '平均数计算器', category: 'utility',
    desc: '粘贴一组数字，即刻得出均值、中位数、众数、标准差与极差。',
    keywords: ['平均', '均值', '中位数'],
    calcDef: {
      fields: [
        { key: 'nums', label: '数字列表（逗号/空格/换行分隔）', type: 'text', default: '', placeholder: '如 3, 5, 7, 10' },
      ],
      compute: (v) => {
        const arr = String(v.nums)
          .split(/[,，;；\s]+/)
          .map(Number)
          .filter((x) => !Number.isNaN(x))
        if (!arr.length) return [{ label: '请输入数字列表', value: '—' }]
        const sum = arr.reduce((a2, b2) => a2 + b2, 0)
        const mean = sum / arr.length
        const sorted = [...arr].sort((a2, b2) => a2 - b2)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        const freq = new Map<number, number>()
        arr.forEach((n) => freq.set(n, (freq.get(n) ?? 0) + 1))
        const maxFreq = Math.max(...freq.values())
        const modes = [...freq.entries()].filter(([, c]) => c === maxFreq && maxFreq > 1).map(([n]) => n)
        const sd = Math.sqrt(arr.reduce((a2, b2) => a2 + (b2 - mean) ** 2, 0) / arr.length)
        return [
          { label: '平均值', value: fmtN(mean), primary: true },
          { label: '中位数', value: fmtN(median) },
          { label: '众数', value: modes.length ? modes.slice(0, 5).join('、') : '无' },
          { label: '总和 / 数量', value: `${fmtN(sum)} / ${arr.length}` },
          { label: '标准差', value: fmtN(sd) },
          { label: '最大 / 最小 / 极差', value: `${fmtN(sorted[sorted.length - 1])} / ${fmtN(sorted[0])} / ${fmtN(sorted[sorted.length - 1] - sorted[0])}` },
        ]
      },
    },
  },
  {
    slug: 'calorie-calculator', title: '卡路里计算器', category: 'utility',
    desc: 'Mifflin-St Jeor 公式计算基础代谢（BMR）与每日总消耗（TDEE），附三大营养素建议。',
    keywords: ['卡路里', 'bmr', 'tdee'],
    calcDef: {
      fields: [
        { key: 'age', label: '年龄', type: 'number', default: '' },
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
        { key: 'h', label: '身高（cm）', type: 'number', default: '' },
        { key: 'w', label: '体重（kg）', type: 'number', default: '' },
        { key: 'act', label: '活动水平', type: 'select', default: '1.375', choices: [
          { value: '1.2', label: '久坐' }, { value: '1.375', label: '轻度活动' },
          { value: '1.55', label: '中度活动' }, { value: '1.725', label: '高强度' }, { value: '1.9', label: '极高强度' },
        ] },
        { key: 'goal', label: '目标', type: 'select', default: 'keep', choices: [
          { value: 'lose', label: '减脂（-20%）' }, { value: 'keep', label: '维持' }, { value: 'gain', label: '增肌（+15%）' },
        ] },
      ],
      compute: (v) => {
        const s = Number(v.sex) === 1 || v.sex === 'female' ? -161 : 5
        const bmr = 10 * Number(v.w) + 6.25 * Number(v.h) - 5 * Number(v.age) + s
        const tdee = bmr * Number(v.act)
        const goalK = v.goal === 'lose' ? 0.8 : v.goal === 'gain' ? 1.15 : 1
        const target = tdee * goalK
        return [
          { label: '基础代谢 BMR', value: `${Math.round(bmr)} 千卡/天` },
          { label: '每日总消耗 TDEE', value: `${Math.round(tdee)} 千卡/天` },
          { label: '目标热量', value: `${Math.round(target)} 千卡/天`, primary: true },
          { label: '蛋白质建议', value: `${Math.round((target * 0.3) / 4)} g（30%）` },
          { label: '碳水建议', value: `${Math.round((target * 0.4) / 4)} g（40%）` },
          { label: '脂肪建议', value: `${Math.round((target * 0.3) / 9)} g（30%）` },
        ]
      },
      note: 'Mifflin-St Jeor 公式为常用估算，个体差异可达 ±10%，不构成医疗建议。',
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
]

export default tools
void textStats
void slugify
void piiScrub
