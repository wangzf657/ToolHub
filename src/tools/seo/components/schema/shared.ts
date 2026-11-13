/** schema 六件套共享常量与工具（各 Tab 表单组件共用） */

/** Google 富媒体测试工具（验证直达外链） */
export const RICH_TEST_URL = 'https://search.google.com/test/rich-results'

export const S = 'https://schema.org/'

/**
 * datetime-local 值（YYYY-MM-DDTHH:mm）转带本地时区的 ISO 串，
 * 输出形如 2026-01-01T09:30:00+08:00；无法解析时原样返回
 */
export function toIsoOffset(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  const base = v.length === 16 ? `${v}:00` : v
  return `${base}${sign}${hh}${mm}`
}

/** 清理对象：剔除空串/空值字段 */
export function clean<T extends object>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== '' && v !== null && v !== undefined) out[k] = v
  return out
}

/** 字段分级徽章：必填 / 推荐 / 可选（与 Google 文档分级一致） */
export type Grade = 'req' | 'rec' | 'opt'
export const GRADE_LABEL: Record<Grade, string> = { req: '必填', rec: '推荐', opt: '可选' }
