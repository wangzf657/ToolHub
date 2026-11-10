/** 编码规则校验器纯函数（GB 标准 / 行业规则，全部本地实现，不联网查询） */

/** Luhn 校验位算法（银行卡 / IMEI / 信用卡通用） */
export function luhnValid(num: string): boolean {
  const s = num.replace(/\D/g, '')
  if (s.length < 2) return false
  let sum = 0
  let dbl = false
  for (let i = s.length - 1; i >= 0; i--) {
    let d = s.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

/** 18 位身份证号校验位（GB 11643-1999 加权因子） */
export function idCardValid(id: string): boolean {
  const s = id.trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(s)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = s.slice(0, 17).split('').reduce((acc, d, i) => acc + Number(d) * weights[i]!, 0)
  return codes[sum % 11] === s[17]
}

/** 合同/票据日期大写：2026-11-05 → 贰零贰陆年壹拾壹月零伍日 */
export function cnDate(y: number, m: number, d: number): string {
  const D = '零壹贰叁肆伍陆柒捌玖'
  const two = (n: number): string => {
    if (n < 10) return `零${D[n]}`
    if (n === 10) return '壹拾'
    if (n < 20) return `壹拾${D[n % 10]}`
    const t = Math.floor(n / 10)
    const o = n % 10
    return `${D[t]}拾${o ? D[o] : ''}`
  }
  const year = String(y).split('').map((c) => D[Number(c)]).join('')
  return `${year}年${two(m)}月${two(d)}日`
}

/** 统一社会信用代码 GB 32100-2015 校验 */
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY'
const USCC_W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
export function usccValid(code: string): { valid: boolean; type?: string; dept?: string; reason?: string } {
  const s = code.trim().toUpperCase()
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(s)) return { valid: false, reason: '应为 18 位数字或大写字母（不含 I/O/Z/S/V）' }
  const deptChar = s[0]!
  const orgChar = s[1]!
  const deptMap: Record<string, string> = {
    '1': '机构编制', '2': '外交', '3': '教育', '4': '公安', '5': '民政', '6': '司法', '7': '交通运输',
    '8': '文化旅游', '9': '市场监管', 'A': '港澳台', 'N': '自然资源', 'Y': '其他',
  }
  const orgMap: Record<string, string> = {
    '1': '机关', '2': '事业单位', '3': '编办管理的群团', '9': '企业', 'A': '个体工商户',
    'F': '农民专业合作社', 'J': '社会组织（登记管理部门为其他）', 'N': '其他',
  }
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const v = USCC_CHARS.indexOf(s[i]!)
    if (v < 0) return { valid: false, reason: `第 ${i + 1} 位字符不合法` }
    sum += v * USCC_W[i]!
  }
  const check = (31 - (sum % 31)) % 31
  const ok = check === USCC_CHARS.indexOf(s[17]!)
  return {
    valid: ok,
    type: orgMap[orgChar],
    dept: deptMap[deptChar],
    reason: ok ? undefined : '校验位不符，代码无效',
  }
}

/** ISBN-10/13 校验与互转 */
export function isbnValid(isbn: string): { valid: boolean; type: 'ISBN-10' | 'ISBN-13' | null; reason?: string } {
  const s = isbn.replace(/[-\s]/g, '').toUpperCase()
  if (/^\d{13}$/.test(s)) {
    let sum = 0
    for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3)
    return { valid: sum % 10 === 0, type: 'ISBN-13' }
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0
    for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i)
    const c = s[9] === 'X' ? 10 : Number(s[9])
    return { valid: (sum + c * 1) % 11 === 0, type: 'ISBN-10' }
  }
  return { valid: false, type: null, reason: '应为 10 位或 13 位（可含连字符，末位可为 X）' }
}

export function isbn10To13(isbn10: string): string | null {
  const s = isbn10.replace(/[-\s]/g, '')
  if (!/^\d{9}[\dX]$/.test(s)) return null
  const core = '978' + s.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return core + ((10 - (sum % 10)) % 10)
}

export function isbn13To10(isbn13: string): string | null {
  const s = isbn13.replace(/[-\s]/g, '')
  if (!/^97[89]\d{10}$/.test(s)) return null
  const core = s.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i)
  const c = (11 - (sum % 11)) % 11
  return core + (c === 10 ? 'X' : `${c}`)
}

/** 车牌号校验（民用车/新能源/警车，不含港澳台与国际车牌） */
const PLATE_PROVINCES = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领'
export function plateValid(plate: string): { valid: boolean; kind?: string; province?: string; reason?: string } {
  const p = plate.trim().toUpperCase().replace(/\s/g, '')
  // 普通车：省份简称 + 字母 + 5 位（字母数字）；新能源：6 位（含 D/F 结尾或开头）
  const re = new RegExp(`^([${PLATE_PROVINCES}])[A-HJ-NP-Z]([A-HJ-NP-Z0-9]{5,6})$`)
  const m = re.exec(p)
  if (!m) return { valid: false, reason: '格式应为 省份简称+城市字母+5~6 位序号（如 京A12345 / 粤BD12345）' }
  const tail = m[3]!
  let kind = '普通车牌'
  if (tail.length === 6) {
    if (/^[DF]/.test(tail)) kind = '新能源小型车'
    else if (/[DF]$/.test(tail)) kind = '新能源大型车'
    else return { valid: false, province: m[1], reason: '6 位序号的新能源车牌应以 D/F 开头或结尾' }
  } else if (/^[IO]+$/.test(tail)) {
    return { valid: false, province: m[1], reason: '序号不应使用字母 I / O' }
  }
  return { valid: true, kind, province: m[1] }
}

/** 手机号运营商判断（号段公开规则，仅判运营商与虚商，不做归属地） */
const CARRIER_RANGES: { name: string; ranges: string[] }[] = [
  { name: '中国移动', ranges: ['134-139', '147', '148', '150-152', '157-159', '172', '178', '182-184', '187', '188', '195', '197', '198'] },
  { name: '中国联通', ranges: ['130-132', '145', '146', '155', '156', '166', '175', '176', '185', '186', '196'] },
  { name: '中国电信', ranges: ['133', '149', '153', '173', '174', '177', '180', '181', '189', '190', '191', '193', '199'] },
  { name: '中国广电', ranges: ['192'] },
  { name: '虚拟运营商', ranges: ['162', '165', '167', '170', '171'] },
]

function inRanges(prefix3: string, ranges: string[]): boolean {
  for (const r of ranges) {
    if (r.includes('-')) {
      const [a, b] = r.split('-')
      if (prefix3 >= a! && prefix3 <= b!) return true
    } else if (prefix3 === r) return true
  }
  return false
}

export function phoneCarrier(phone: string): { valid: boolean; carrier?: string; reason?: string } {
  const s = phone.replace(/\D/g, '').replace(/^86/, '')
  if (!/^1\d{10}$/.test(s)) return { valid: false, reason: '应为 11 位手机号（可带 +86 前缀）' }
  const p3 = s.slice(0, 3)
  // 虚商号段优先判定
  const v = CARRIER_RANGES.find((c) => c.name === '虚拟运营商')!
  if (inRanges(p3, v.ranges)) return { valid: true, carrier: '虚拟运营商（转售号码）' }
  for (const c of CARRIER_RANGES) {
    if (c.name === '虚拟运营商') continue
    if (inRanges(p3, c.ranges)) return { valid: true, carrier: c.name }
  }
  return { valid: true, carrier: '运营商未知（新号段或未收录）' }
}

/** IMEI 校验（15 位 Luhn，TAC 结构说明） */
export function imeiValid(imei: string): { valid: boolean; tac?: string; reason?: string } {
  const s = imei.replace(/\D/g, '')
  if (s.length !== 15) return { valid: false, reason: 'IMEI 应为 15 位数字' }
  if (!luhnValid(s)) return { valid: false, reason: 'Luhn 校验位不符' }
  return { valid: true, tac: s.slice(0, 8) }
}

/** 银行卡卡组织识别（公开卡段前缀；发卡行 BIN 库不收录，避免误判） */
const BANK_BINS: { bin: string; org: string }[] = [
  { bin: '62', org: '银联 UnionPay' },
  { bin: '81', org: '银联 UnionPay（部分）' },
  { bin: '4', org: 'Visa' },
  { bin: '51', org: 'Mastercard' },
  { bin: '52', org: 'Mastercard' },
  { bin: '53', org: 'Mastercard' },
  { bin: '22', org: 'Mastercard（2 系列）' },
  { bin: '27', org: 'Mastercard（2 系列）' },
  { bin: '34', org: 'American Express' },
  { bin: '37', org: 'American Express' },
  { bin: '35', org: 'JCB' },
  { bin: '30', org: 'Diners Club' },
  { bin: '36', org: 'Diners Club' },
  { bin: '38', org: 'Diners Club' },
  { bin: '60', org: 'Discover' },
  { bin: '65', org: 'Discover' },
]

export function bankCardInfo(card: string): { valid: boolean; org?: string; reason?: string } {
  const s = card.replace(/\D/g, '')
  if (s.length < 12 || s.length > 23) return { valid: false, reason: '银行卡号应为 12~23 位数字' }
  if (!luhnValid(s)) return { valid: false, reason: 'Luhn 校验位不符，卡号无效' }
  // 用最长匹配的前缀判卡组织
  let hit: { bin: string; org: string } | null = null
  for (const b of BANK_BINS) {
    if (s.startsWith(b.bin) && (!hit || b.bin.length > hit.bin.length)) hit = b
  }
  return { valid: true, org: hit?.org ?? '卡组织未收录（校验位有效）' }
}
