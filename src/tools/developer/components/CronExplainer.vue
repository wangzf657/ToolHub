<script lang="ts">
/** Cron 表达式共享解析逻辑（CrontabBuilder 亦复用） */
export interface CronFieldInfo {
  name: string
  raw: string
  desc: string
  ok: boolean
}

export interface CronExplain {
  ok: boolean
  error?: string
  fields: CronFieldInfo[]
  summary: string
}

const DOW_NAMES: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
const MON_NAMES: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

const tokenNum = (t: string, names: Record<string, number>): number => {
  const up = t.toUpperCase()
  return up in names ? names[up]! : Number(t)
}

/** 把单字段表达式展开为允许值集合；失败返回 null */
export function expandField(raw: string, min: number, max: number, names: Record<string, number> = {}): Set<number> | null {
  const out = new Set<number>()
  for (const part of raw.split(',')) {
    const p = part.trim()
    if (!p) return null
    if (p === '*') {
      for (let i = min; i <= max; i++) out.add(i)
      continue
    }
    let m = p.match(/^\*\/(\d+)$/)
    if (m) {
      const step = Number(m[1])
      if (!step) return null
      for (let i = min; i <= max; i += step) out.add(i)
      continue
    }
    m = p.match(/^(\w+)-(\w+)(?:\/(\d+))?$/)
    if (m) {
      const a = tokenNum(m[1]!, names)
      const b = tokenNum(m[2]!, names)
      const step = m[3] ? Number(m[3]) : 1
      if (Number.isNaN(a) || Number.isNaN(b) || a < min || b > max || a > b || !step) return null
      for (let i = a; i <= b; i += step) out.add(i)
      continue
    }
    m = p.match(/^(\w+)(?:\/(\d+))?$/)
    if (m) {
      const a = tokenNum(m[1]!, names)
      const step = m[2] ? Number(m[2]) : 0
      if (Number.isNaN(a) || a < min || a > max) return null
      out.add(a)
      if (step) for (let i = a + step; i <= max; i += step) out.add(i)
      continue
    }
    return null
  }
  return out.size ? out : null
}

/** 单字段中文描述 */
export function describeField(raw: string, unitNoun: string, values: Set<number>, min: number, max: number): string {
  const list = [...values].sort((a, b) => a - b)
  if (values.size === max - min + 1) return `每${unitNoun}`
  const n = unitNoun
  const isStep = raw.includes('*/')
  if (isStep) {
    const step = Number(raw.split('*/')[1])
    return `每 ${step || '?'} ${n}（从第 ${list[0]} ${n}开始）`
  }
  // 连续区间
  const contiguous = list.every((v, i) => i === 0 || v === list[i - 1]! + 1)
  if (contiguous && list.length > 1) return `第 ${list[0]} 到 ${list[list.length - 1]} ${n}内每${n}`
  if (n === '星期') return list.map((v) => `周${WEEK_CN[v % 7]}`).join('、')
  return `第 ${list.join('、')} ${n}`
}

/** 完整解读一条 cron（5 字段） */
export function explainCron(expr: string): CronExplain {
  let text = expr.trim().toLowerCase()
  const aliases: Record<string, string> = { '@hourly': '0 * * * *', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@weekly': '0 0 * * 0', '@monthly': '0 0 1 * *', '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *' }
  if (text in aliases) text = aliases[text]!
  const parts = text.split(/\s+/)
  if (parts.length !== 5) return { ok: false, error: '需要恰好 5 个字段：分 时 日 月 星期', fields: [], summary: '' }
  const defs: { name: string; min: number; max: number; noun: string; names: Record<string, number> }[] = [
    { name: '分钟', min: 0, max: 59, noun: '分钟', names: {} },
    { name: '小时', min: 0, max: 23, noun: '小时', names: {} },
    { name: '日', min: 1, max: 31, noun: '天', names: {} },
    { name: '月', min: 1, max: 12, noun: '月', names: MON_NAMES },
    { name: '星期', min: 0, max: 7, noun: '星期', names: DOW_NAMES },
  ]
  const fields: CronFieldInfo[] = []
  const sets: (Set<number> | null)[] = []
  parts.forEach((raw, i) => {
    const d = defs[i]!
    const set = expandField(raw, d.min, d.max, d.names)
    sets.push(set)
    fields.push({
      name: d.name,
      raw,
      ok: !!set,
      desc: set ? describeField(raw, d.noun, set, d.min, d.max) : '格式无效',
    })
  })
  const bad = fields.find((f) => !f.ok)
  if (bad) return { ok: false, error: `「${bad.name}」字段 “${bad.raw}” 无法解析（支持 * 、*/n、具体值、a-b、a-b/n、逗号列表）`, fields, summary: '' }
  const summary = [
    fields[2]!.raw === '*' && fields[4]!.raw !== '*' ? `每${fields[4]!.desc.replace('星期', '')}的 ` : '',
    fields[1]!.raw === '*' ? '' : '',
    `在 ${fields[0]!.desc}、${fields[1]!.desc} 执行`,
    fields[2]!.raw !== '*' ? `，日期限定为${fields[2]!.desc}` : '',
    fields[3]!.raw !== '*' ? `，仅${fields[3]!.desc}` : '',
  ].join('')
  return { ok: true, fields, summary }
}

function dayMatches(sets: Set<number>[], d: Date): boolean {
  const dom = sets[2]!
  const dow = sets[4]!
  const domRestricted = dom.size !== 31
  const dowRestricted = dow.size !== 7
  const domOk = dom.has(d.getDate())
  const dowOk = dow.has(d.getDay()) || (d.getDay() === 0 && dow.has(7))
  if (domRestricted && dowRestricted) return domOk || dowOk
  if (domRestricted) return domOk
  if (dowRestricted) return dowOk
  return domOk && dowOk
}

/** 从当前时间起向后找下一次执行时间（分钟粒度扫描，约 9 个月内） */
export function nextRuns(expr: string, count = 5): { runs: Date[]; error?: string } {
  const ex = explainCron(expr)
  if (!ex.ok) return { runs: [], error: ex.error }
  const sets = ex.fields.map((_, i) => expandField(ex.fields[i]!.raw, [0, 0, 1, 1, 0][i]!, [59, 23, 31, 12, 7][i]!, i === 3 ? MON_NAMES : i === 4 ? DOW_NAMES : {}))
  const runs: Date[] = []
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  let scanned = 0
  const s = sets as Set<number>[]
  const cap = 400000
  while (runs.length < count && scanned < cap) {
    if (s[1]!.has(d.getHours()) && s[3]!.has(d.getMonth() + 1) && dayMatches(s, d) && s[0]!.has(d.getMinutes())) {
      runs.push(new Date(d))
    }
    d.setMinutes(d.getMinutes() + 1)
    scanned++
  }
  if (!runs.length) return { runs, error: '在扫描范围内（约 9 个月）未找到匹配的执行时间，请检查日/月/星期组合。' }
  return { runs }
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { CalendarClock, Timer } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const expr = ref('*/5 9-18 * * 1-5')
const result = ref<ReturnType<typeof explainCron> | null>(null)
const runs = ref<Date[]>([])
const runError = ref('')

const run = () => {
  const ex = explainCron(expr.value)
  result.value = ex
  runs.value = []
  runError.value = ''
  if (!ex.ok) {
    toast.err(ex.error ?? '表达式无效')
    return
  }
  const r = nextRuns(expr.value, 5)
  runs.value = r.runs
  runError.value = r.error ?? ''
  toast.ok('解读完成')
}
</script>

<template>
  <div class="cron-explainer">
    <span class="field-label">Cron 表达式（5 字段：分 时 日 月 星期）</span>
    <div class="row" style="gap: 8px">
      <input v-model="expr" type="text" class="input mono grow" placeholder="*/5 9-18 * * 1-5" spellcheck="false" @keyup.enter="run" />
      <button class="btn btn-primary" @click="run"><CalendarClock :size="16" /> 解读</button>
    </div>

    <div v-if="result && !result.ok" class="notice notice-err mt-2">{{ result.error }}</div>

    <p class="muted small mt-1">
      想可视化搭建而不是手写表达式？去
      <RouterLink to="/t/crontab-builder">Cron 表达式生成器</RouterLink>
      逐字段拼好再粘回来解读。
    </p>

    <template v-if="result && result.ok">
      <div class="notice notice-ok mt-2">{{ result.summary }}</div>

      <div class="mt-3 field-table">
        <div v-for="f in result.fields" :key="f.name" class="field-row">
          <span class="f-name">{{ f.name }}</span>
          <code class="f-raw mono">{{ f.raw }}</code>
          <span class="f-desc">{{ f.desc }}</span>
        </div>
      </div>

      <div class="mt-3">
        <span class="field-label"><Timer :size="14" style="vertical-align: -2px" /> 未来 5 次执行时间</span>
        <div v-if="runError" class="notice notice-warn">{{ runError }}</div>
        <div v-else class="runs">
          <div v-for="(r, i) in runs" :key="i" class="run-row">
            <span class="idx mono">#{{ i + 1 }}</span>
            <b>{{ r.toLocaleString('zh-CN', { hour12: false }) }}</b>
            <span class="muted small mono">{{ r.toISOString() }}</span>
          </div>
        </div>
      </div>
    </template>

    <p class="notice notice-info mt-3 small">
      支持标准 5 字段 crontab 语法（*、*/n、a、a-b、a-b/n、逗号列表、JAN/DEC、MON/SAT 名称）与 @hourly @daily @weekly @monthly @yearly 别名。
    </p>
  </div>
</template>

<style scoped>
.field-table {
  display: grid;
  gap: 6px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.f-name {
  flex: none;
  width: 44px;
  font-weight: 700;
  color: var(--text-2);
}
.f-raw {
  flex: none;
  width: 90px;
  color: var(--accent-text);
  overflow: hidden;
  text-overflow: ellipsis;
}
.f-desc {
  color: var(--text-2);
}
.runs {
  display: grid;
  gap: 6px;
}
.run-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
}
.run-row .idx {
  color: var(--text-3);
}
</style>
