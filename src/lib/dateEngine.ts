/** 日期与时间引擎 */

/** 按本地时区格式化 yyyy-mm-dd（toISOString 按 UTC 输出，东八区本地午夜会偏移成前一天） */
const fmtLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface AgeResult {
  years: number
  months: number
  days: number
  totalDays: number
  totalWeeks: number
  totalHours: number
  nextBirthday: { days: number; date: string }
}

export function calcAge(birth: string, refDate = new Date()): AgeResult {
  const b = new Date(birth + 'T00:00:00')
  if (Number.isNaN(b.getTime())) throw new Error('日期格式无效')
  let years = refDate.getFullYear() - b.getFullYear()
  let months = refDate.getMonth() - b.getMonth()
  let days = refDate.getDate() - b.getDate()
  if (days < 0) {
    months--
    const prevMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years--
    months += 12
  }
  const totalDays = Math.floor((refDate.getTime() - b.getTime()) / 86400000)
  // 下一个生日
  let next = new Date(refDate.getFullYear(), b.getMonth(), b.getDate())
  if (next.getTime() < refDate.getTime()) {
    next = new Date(refDate.getFullYear() + 1, b.getMonth(), b.getDate())
  }
  const toNext = Math.ceil((next.getTime() - refDate.getTime()) / 86400000)
  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    totalHours: totalDays * 24,
    nextBirthday: { days: toNext, date: fmtLocalDate(next) },
  }
}

export interface DateDiffResult {
  days: number
  weeks: number
  months: number
  years: number
  hours: number
  businessDays: number
}

export function dateDiff(a: string, b: string): DateDiffResult {
  const d1 = new Date(a + 'T00:00:00')
  const d2 = new Date(b + 'T00:00:00')
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) throw new Error('日期格式无效')
  const [s, e] = d1 <= d2 ? [d1, d2] : [d2, d1]
  const msPerDay = 86400000
  const days = Math.round((e.getTime() - s.getTime()) / msPerDay)
  // 月数
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (e.getDate() < s.getDate()) months--
  // 工作日
  let businessDays = 0
  const cur = new Date(s)
  while (cur < e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) businessDays++
    cur.setDate(cur.getDate() + 1)
  }
  return {
    days,
    weeks: Math.floor(days / 7),
    months,
    years: Math.floor(months / 12),
    hours: days * 24,
    businessDays,
  }
}

/** 时区换算 */
export function convertTimezone(
  dateStr: string,
  timeStr: string,
  fromTz: string,
  toTz: string,
): { from: string; to: string } {
  // 构造源时区的 UTC 时间戳：假定 dateStr/timeStr 是 fromTz 的本地时间
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  if (Number.isNaN(naive.getTime())) throw new Error('日期或时间格式无效')
  const utcFrom = zonedToUtc(naive, fromTz)
  return {
    from: formatInTz(utcFrom, fromTz),
    to: formatInTz(utcFrom, toTz),
  }
}

function zonedToUtc(d: Date, tz: string): Date {
  const inv = new Date(d.toLocaleString('en-US', { timeZone: tz }))
  const diff = d.getTime() - inv.getTime()
  return new Date(d.getTime() + diff)
}

export function formatInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d)
}

/** 常用时区列表：UTC 偏移随夏令时变化，标签不写死偏移，实际偏移由 tzOffsetAt 按日期实时计算 */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Shanghai', label: '北京' },
  { value: 'Asia/Tokyo', label: '东京' },
  { value: 'Asia/Singapore', label: '新加坡' },
  { value: 'Asia/Dubai', label: '迪拜' },
  { value: 'Europe/London', label: '伦敦' },
  { value: 'Europe/Paris', label: '巴黎' },
  { value: 'Europe/Berlin', label: '柏林' },
  { value: 'Europe/Moscow', label: '莫斯科' },
  { value: 'America/New_York', label: '纽约' },
  { value: 'America/Chicago', label: '芝加哥' },
  { value: 'America/Los_Angeles', label: '洛杉矶' },
  { value: 'Australia/Sydney', label: '悉尼' },
  { value: 'Pacific/Auckland', label: '奥克兰' },
  { value: 'UTC', label: 'UTC 标准时间' },
]

/** 用 Intl 按指定时刻实时解析时区偏移（分钟）；不依赖写死偏移表，夏令时自动正确 */
function offsetMinutesAt(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at)
  const gmt = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = gmt.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** 时区在指定时刻的实际偏移与夏令时状态（夏令时=时钟拨快，偏移大于全年标准偏移） */
export function tzOffsetAt(tz: string, at: Date): { offset: string; dst: boolean } {
  const cur = offsetMinutesAt(tz, at)
  // 标准偏移取当年 1 月/7 月中旬的较小值（夏令时只会把时钟拨快、偏移变大）
  const jan = offsetMinutesAt(tz, new Date(at.getFullYear(), 0, 15))
  const jul = offsetMinutesAt(tz, new Date(at.getFullYear(), 6, 15))
  const std = Math.min(jan, jul)
  const sign = cur < 0 ? '-' : '+'
  const abs = Math.abs(cur)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return {
    offset: `UTC${sign}${hh}${mm ? `:${`${mm}`.padStart(2, '0')}` : ''}`,
    dst: cur > std,
  }
}

/** 工时累计（多段开始-结束时间） */
export function sumHours(ranges: { start: string; end: string; breakMinutes?: number }[]): { totalMinutes: number; perDay: number[] } {
  let total = 0
  const perDay: number[] = []
  for (const r of ranges) {
    const [sh, sm] = r.start.split(':').map(Number)
    const [eh, em] = r.end.split(':').map(Number)
    if (Number.isNaN(sh) || Number.isNaN(eh)) continue
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    mins -= r.breakMinutes ?? 0
    perDay.push(mins)
    total += Math.max(0, mins)
  }
  return { totalMinutes: total, perDay }
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h} 小时 ${m} 分钟`
}
