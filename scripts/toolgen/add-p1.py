# -*- coding: utf-8 -*-
"""向 utility/registry.ts 追加 P1 批次条目（textcleaner/fullwidth/statistics 等 16 件）。"""
import io

p = 'src/tools/utility/registry.ts'
s = io.open(p, encoding='utf-8').read()

ADD = r'''  {
    slug: 'statistics-calculator', title: '统计计算器', category: 'utility',
    desc: '一组数算均值/中位数/众数/方差/标准差/分位数，质检与运营数据一步到位。',
    keywords: ['标准差', '中位数', '方差', '统计'],
    calcDef: {
      fields: [
        { key: 'data', label: '数据（逗号/空格/换行分隔）', type: 'text', default: '', placeholder: '如 88, 92, 79, 85, 90' },
      ],
      compute: (v) => {
        const nums = String(v.data ?? '').split(/[,，\s;、]+/).map(Number).filter((x) => Number.isFinite(x))
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
        const list = [...new Set(String(v.phones ?? '').split(/[,，\s;、]+/).filter(Boolean))].slice(0, 200)
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
          { label: '基础代谢 BMR', value: fmt(bmr) + ' 千卡', primary: true },
          { label: '每日总消耗 TDEE', value: fmt(tdee) + ' 千卡', hint: 'BMR × 活动系数' },
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
        const eu = v.sys === 'cn' ? (n - 220) / 6.66 + 33 : v.sys === 'eu' ? n : v.sys === 'us' ? (male ? n + 1.5 : n + 2) : (male ? n + 2 : n + 2.5)
        if (!Number.isFinite(eu)) return [{ label: '请确认尺码制', value: '—' }]
        const foot = Math.round(((eu - 33) * 6.66 + 220) / 5) * 5
        const us = male ? eu - 1.5 : eu - 2
        const uk = male ? eu - 2 : eu - 2.5
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
      note: '口径：基于常见品牌尺码表的近似线性换算，各品牌存在 ±半码差异；下单前以该品牌官方尺码表为准。',
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
        const whole = rn / rd
        const rem = rn % rd
        const dec = Number(rn) / Number(rd)
        const mixed = rd === 1n || rem === 0n ? (rd === 1n ? rn.toString() : '—') : (whole < 0n ? -whole : whole) + ' 又 ' + (rem < 0n ? -rem : rem) + '/' + rd
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
]

export default tools'''

ANCHOR = '''    component: () => import('./components/BannedWordsChecker.vue'),
  },
]

export default tools'''
assert ANCHOR in s, 'anchor missing'
s = s.replace(ANCHOR, '''    component: () => import('./components/BannedWordsChecker.vue'),
  },
''' + ADD)

s = s.replace(
    "import { extractFromText, EXTRACT_TYPES, type ExtractType } from '@/lib/textExt'",
    "import { extractFromText, EXTRACT_TYPES, cleanText, fullToHalf, halfToFull, type ExtractType } from '@/lib/textExt'")
s = s.replace(
    "import { idCardValid, cnDate } from '@/lib/validators'",
    "import { idCardValid, cnDate, phoneCarrier } from '@/lib/validators'")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('utility ok, slug count:', s.count("slug: '"))

# ---------- developer ----------
p = 'src/tools/developer/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD2 = r'''  { slug: 'code-screenshot', title: '代码截图美化', category: 'developer', desc: '粘贴代码生成 Carbon 风格卡片：主题、窗口条、渐变背景，导出高清 PNG。', keywords: ['代码截图', 'carbon', '代码图片', '分享'], component: () => import('./components/CodeScreenshot.vue') },
  {
    slug: 'json-to-java-entity', title: 'JSON 转 Java 实体类', category: 'developer',
    desc: 'JSON 生成 Java POJO（可选 Lombok），嵌套对象自动拆子类，后端开发提效。',
    keywords: ['json', 'java', 'pojo', '实体类'],
    textDef: {
      options: [
        { key: 'cls', label: '根类名', type: 'text', default: 'Demo', placeholder: '如 User' },
        { key: 'lombok', label: '使用 Lombok @Data', type: 'toggle', default: true },
      ],
      placeholder: '粘贴 JSON（顶层对象或对象数组），生成 Java 实体类…',
      transform: (t, o) => jsonToJava(t, String(o.cls || 'Demo'), o.lombok !== false),
    },
  },
]

export default tools'''
ANCHOR2 = '''  { slug: 'encoding-converter', title: '文本编码检测与转换', category: 'developer', desc: '自动识别 GBK/GB18030/Big5/UTF-8 等编码并互转，专治 txt/CSV 打开乱码。', keywords: ['编码', 'GBK', '乱码', 'UTF-8', '转码'], component: () => import('./components/EncodingConverter.vue') },
]

export default tools'''
assert ANCHOR2 in s, 'dev anchor missing'
s = s.replace(ANCHOR2, '''  { slug: 'encoding-converter', title: '文本编码检测与转换', category: 'developer', desc: '自动识别 GBK/GB18030/Big5/UTF-8 等编码并互转，专治 txt/CSV 打开乱码。', keywords: ['编码', 'GBK', '乱码', 'UTF-8', '转码'], component: () => import('./components/EncodingConverter.vue') },
''' + ADD2)
s = s.replace("import { ", "import { jsonToJava, ", 1) if "jsonToJava" not in s else s
# add explicit import line after first import
if "jsonToJava, " not in s.split('\n')[0] and "from '@/lib/jsEngine'" not in s.split('\n')[0]:
    first_import_end = s.index("from '@/types'") + len("from '@/types'")
    s = s[:first_import_end] + "\nimport { jsonToJava } from '@/lib/jsEngine'" + s[first_import_end:]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('developer ok, slug count:', s.count("slug: '"))

# ---------- business ----------
p = 'src/tools/business/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD3 = r'''  { slug: 'email-signature-generator', title: '邮件签名生成器', category: 'business', desc: '生成 Outlook/Gmail/Foxmail 兼容的 HTML 邮件签名，一键复制富文本。', keywords: ['邮件签名', '签名档', 'outlook'], component: () => import('./components/EmailSignatureGenerator.vue') },
]

export default tools'''
if s.rstrip().endswith(']\n\nexport default tools') or ']\n\nexport default tools' in s:
    idx = s.rindex(']\n\nexport default tools')
    s = s[:idx] + ADD3[ADD3.index('  {'):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('business ok, slug count:', s.count("slug: '"))

# ---------- image ----------
p = 'src/tools/image/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD4 = r'''  { slug: 'screenshot-dress-up', title: '截图套壳美化', category: 'image', desc: '截图加浏览器/手机壳、圆角阴影与渐变背景，自媒体配图一键出片。', keywords: ['截图', '套壳', '美化', '配图'], component: () => import('./components/ScreenshotDressUp.vue') },
]

export default tools'''
idx = s.rindex(']\n\nexport default tools')
s = s[:idx] + ADD4[ADD4.index('  {'):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('image ok, slug count:', s.count("slug: '"))
