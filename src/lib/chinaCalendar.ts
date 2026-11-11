/** 中国法定节假日与工作日计算（lunar-javascript HolidayUtil 懒加载，数据内置至 2027 年） */

type HolidayUtilLike = {
  getHoliday: (date: string) => { isWork: () => boolean; getName: () => string; getTarget: () => string } | null
}

let mod: typeof import('lunar-javascript') | null = null

async function load() {
  mod ??= await import('lunar-javascript')
  return mod
}

export interface DayInfo {
  date: string // YYYY-MM-DD
  off: boolean // 是否休息
  holidayName?: string // 法定节假日名
  makeup: boolean // 调休补班日（周末但上班）
}

const DAY_MS = 86400000

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

function isWeekend(d: Date): boolean {
  const w = d.getDay()
  return w === 0 || w === 6
}

/** 逐日判定休息/补班；节假日数据缺失的年份回退「仅周末」并在 meta 中标注 */
async function* eachDay(start: Date, end: Date, hu: HolidayUtilLike | null): AsyncGenerator<DayInfo> {
  const cur = new Date(start)
  while (cur <= end) {
    const ds = fmt(cur)
    const h = hu ? hu.getHoliday(ds) : null
    if (h) {
      yield { date: ds, off: !h.isWork(), holidayName: h.isWork() ? undefined : h.getName(), makeup: isWeekend(cur) && h.isWork() }
    } else {
      yield { date: ds, off: isWeekend(cur), makeup: false }
    }
    cur.setTime(cur.getTime() + DAY_MS)
  }
}

export interface BusinessDayResult {
  totalDays: number
  workDays: number
  offDays: number
  holidayDays: number // 法定节假日放假天数（不含普通周末）
  makeupDays: number // 调休补班天数
  dataCovered: boolean // 该区间年份是否有内置节假日数据
  holidays: { date: string; name: string }[] // 区间内法定节假日列表
}

/** 区间工作日统计（含法定节假日与调休） */
export async function businessDaysBetween(startStr: string, endStr: string): Promise<BusinessDayResult> {
  const lunar = await load()
  const hu = (lunar as unknown as { HolidayUtil: HolidayUtilLike }).HolidayUtil
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  if (start > end) throw new Error('开始日期不能晚于结束日期')
  let workDays = 0
  let offDays = 0
  let holidayDays = 0
  let makeupDays = 0
  let totalDays = 0
  const holidays: { date: string; name: string }[] = []
  let covered = 0
  let years = 0
  const yearSet = new Set<number>()
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    years++
    yearSet.add(y)
    if (hu.getHoliday(`${y}-01-01`) || hu.getHoliday(`${y}-05-01`) || hu.getHoliday(`${y}-10-01`)) covered++
  }
  const dataCovered = covered === years
  for await (const d of eachDay(start, end, dataCovered ? hu : null)) {
    totalDays++
    if (d.off) {
      offDays++
      if (d.holidayName) {
        holidayDays++
        if (!holidays.some((x) => x.name === d.holidayName && x.date === d.date)) holidays.push({ date: d.date, name: d.holidayName! })
      }
    } else {
      workDays++
      if (d.makeup) makeupDays++
    }
  }
  return { totalDays, workDays, offDays, holidayDays, makeupDays, dataCovered, holidays }
}

/** 从某日期起加减 N 个工作日（含当日不算，方向由正负决定；跳过法定节假日与周末，补班日算工作日） */
export async function addBusinessDays(startStr: string, n: number): Promise<{ date: string; result: DayInfo }[]> {
  const lunar = await load()
  const hu = (lunar as unknown as { HolidayUtil: HolidayUtilLike }).HolidayUtil
  const start = parseDate(startStr)
  const cur = new Date(start)
  const steps: { date: string; result: DayInfo }[] = []
  let left = Math.abs(Math.round(n))
  const dir = n >= 0 ? 1 : -1
  while (left > 0) {
    cur.setTime(cur.getTime() + dir * DAY_MS)
    const ds = fmt(cur)
    const h = hu.getHoliday(ds)
    const off = h ? !h.isWork() : isWeekend(cur)
    if (!off) {
      steps.push({ date: ds, result: { date: ds, off: false, holidayName: h && !h.isWork() ? undefined : undefined, makeup: h ? isWeekend(cur) : false } })
      left--
    }
  }
  return steps
}

export function dateAddMonths(dateStr: string, months: number): string {
  const d = parseDate(dateStr)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0) // 月末溢出回退
  return fmt(d)
}

/** 下一个春节（农历正月初一）的公历日期 YYYY-MM-DD，用 lunar-javascript 精确推算（替代写死的公历近似） */
export async function nextSpringFestival(from: Date = new Date()): Promise<string> {
  const lunar = await load()
  // 与上方 HolidayUtil 相同的属性访问模式：兼容打包器对 CJS 动态导入的 interop（命名解构在部分打包形态下为 undefined）
  const Lunar = (lunar as unknown as { Lunar: typeof import('lunar-javascript')['Lunar'] }).Lunar
  const ymd = (ly: number) => {
    const s = Lunar.fromYmd(ly, 1, 1).getSolar()
    return `${s.getYear()}-${`${s.getMonth()}`.padStart(2, '0')}-${`${s.getDay()}`.padStart(2, '0')}`
  }
  // 农历年与公历年存在错位（公历 1~2 月可能仍属上一个农历年），前后各探一年取第一个未来日期
  for (let y = from.getFullYear() - 1; y <= from.getFullYear() + 1; y++) {
    const ds = ymd(y)
    if (new Date(`${ds}T00:00:00`).getTime() > from.getTime()) return ds
  }
  // 理论不可达（相邻三个农历年必有未过的春节），兜底再往后推一个农历年
  return ymd(from.getFullYear() + 2)
}
