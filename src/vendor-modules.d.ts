/** 无官方类型声明的第三方模块的最小类型补充（仅声明项目实际用到的面） */

declare module 'turndown-plugin-gfm' {
  const plugin: (service: unknown) => void
  /** GFM 全量插件：表格/删除线/任务列表/高亮代码块 */
  export const gfm: typeof plugin
  export const tables: typeof plugin
  export const strikethrough: typeof plugin
  export const taskListItems: typeof plugin
}

declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number
    pitch: number
    rate: number
    inputBuffer: unknown
  }
  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer)
  }
  export class SimpleFilter {
    constructor(sourceNode: unknown, soundTouch: SoundTouch)
    /** 抽取处理后的交错帧，返回实际写入帧数（0 表示流结束） */
    extract(target: Float32Array, numFrames?: number): number
  }
}

declare module 'lunar-javascript' {
  export class Solar {
    static fromDate(date: Date): Solar
    static fromYmd(y: number, m: number, d: number): Solar
    static fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getWeekInChinese(): string
    getXingZuo(): string
    /** 注意：节气方法在 Lunar 上（Solar 原型没有 getJieQi） */
    getFestivals(): string[]
    getLunar(): Lunar
  }
  export class Lunar {
    static fromYmd(y: number, m: number, d: number): Lunar
    /** 农历 → 公历 */
    getSolar(): Solar
    /** 农历日（1~30） */
    getDay(): number
    /** 闰月判定：lunar-javascript 以 getMonth() 为负表示闰月（闰六月 = -6） */
    getMonth(): number
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearInGanZhi(): string
    getMonthInGanZhi(): string
    getDayInGanZhi(): string
    getYearShengXiao(): string
    getMonthShengXiao(): string
    getDayShengXiao(): string
    getJieQi(): string
    getFestivals(): string[]
    getDayYi(): string[]
    getDayJi(): string[]
  }
  export class LunarYear {
    static fromYear(year: number): LunarYear
    getMonths(): LunarMonth[]
  }
  export class LunarMonth {
    getYear(): number
    getMonth(): number
    isLeap(): boolean
    getDayCount(): number
    /** 该农历月的第一天对应的公历 Solar */
    getFirstDaySolar(): Solar
    static fromYm(year: number, month: number): LunarMonth | null
  }
  /** 法定节假日查询（数据内置至 2027 年，含调休补班标记） */
  export class HolidayUtil {
    static getHoliday(date: string): { isWork: () => boolean; getName: () => string; getTarget: () => string; getStart?: () => unknown; getEnd?: () => unknown } | null
  }
}

declare module 'relationship.js' {
  interface RelationshipOptions {
    /** 称谓链文本（如「妈妈的哥哥」）或称谓（type=chain 时） */
    text: string
    /** 我的性别：1 男 / 0 女 */
    sex?: number
    /** 对方性别（chain 模式下用于推导） */
    target?: number
    /** default=由称谓链推称呼；chain=由称呼反推称谓链 */
    type?: 'default' | 'chain' | 'toggle'
    /** 家乡方言模式（本项目不用） */
    mode?: string
  }
  function relationship(options: RelationshipOptions): string[]
  const dataCount: number
  export { relationship as default, dataCount }
}

declare module 'gbk.js' {
  export function encode(text: string): number[]
  export function decode(bytes: number[] | Uint8Array): string
  export const URI: unknown
}
