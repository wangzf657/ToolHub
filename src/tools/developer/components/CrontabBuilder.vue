<script setup lang="ts">
/** Cron 表达式构建器：五字段档位 + 小时勾选面板 + 导入表达式 + 实时执行时间 + 复制。
 *  与 cron-explainer 互链：读 query.re 自动导入；顶部挂跳转。 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Hammer, CalendarClock, Copy, Check, LogIn } from 'lucide-vue-next'
import { explainCron, nextRuns } from './CronExplainer.vue'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()

type Mode = 'every' | 'step' | 'at' | 'range' | 'panel'
interface FieldState {
  mode: Mode
  step: number
  value: string
  from: number
  to: number
  rangeStep: number
  /** panel 模式：勾选的小时集合 */
  picks: number[]
}

const make = (): FieldState => ({ mode: 'every', step: 1, value: '', from: 0, to: 0, rangeStep: 1, picks: [] })

const minute = ref<FieldState>(make())
const hour = ref<FieldState>(make())
const dom = ref<FieldState>(make())
const month = ref<FieldState>({ ...make(), value: '1', from: 1, to: 1 })
const dow = ref<FieldState>(make())

const DEFS = [
  { key: 'minute', label: '分钟', min: 0, max: 59, noun: '分钟', state: minute },
  { key: 'hour', label: '小时', min: 0, max: 23, noun: '小时', state: hour },
  { key: 'dom', label: '日', min: 1, max: 31, noun: '天', state: dom },
  { key: 'month', label: '月', min: 1, max: 12, noun: '月', state: month },
  { key: 'dow', label: '星期', min: 0, max: 6, noun: '星期', state: dow },
] as const

const fieldRaw = (s: FieldState, def: (typeof DEFS)[number]): string => {
  switch (s.mode) {
    case 'every':
      return '*'
    case 'step':
      return `*/${Math.max(1, s.step)}`
    case 'at':
      return s.value.trim() || String(def.min)
    case 'panel': {
      // 勾选面板：空选退化为每{noun}，避免产出非法表达式
      const list = [...s.picks].sort((a, b) => a - b)
      return list.length ? list.join(',') : '*'
    }
    case 'range':
      return s.from <= s.to ? `${s.from}-${s.to}${s.rangeStep > 1 ? `/${s.rangeStep}` : ''}` : '*'
  }
}

const expr = computed(() => DEFS.map((d) => fieldRaw(d.state.value, d)).join(' '))

const explained = computed(() => explainCron(expr.value))
const runs = ref<Date[]>([])

const computeRuns = () => {
  const r = nextRuns(expr.value, 5)
  runs.value = r.runs
  return r
}

/* 执行时间实时化：expr 变化 500ms 防抖自动刷新 */
let timer: number | null = null
watch(expr, () => {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    const r = computeRuns()
    if (r.error) runs.value = []
  }, 500)
})
onBeforeUnmount(() => {
  if (timer !== null) window.clearTimeout(timer)
})

/* 复制按钮：1.5s 对勾反馈 */
const copied = ref(false)
const copyExpr = async () => {
  if (await copyText(expr.value)) {
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1500)
    toast.ok('表达式已复制')
  } else toast.err('复制失败')
}

/* ---------- 导入表达式：五字段档位自动回显 ---------- */
const importText = ref('')
const importExpr = (raw: string, silent = false) => {
  const parts = raw.trim().toLowerCase().split(/\s+/)
  if (parts.length !== 5) {
    if (!silent) toast.err('需要恰好 5 个字段（分 时 日 月 星期），如 30 9-18 * * 1-5')
    return false
  }
  const parseField = (r: string): FieldState => {
    const s = make()
    if (r === '*') return s
    let m = r.match(/^\*\/(\d+)$/)
    if (m) return { ...s, mode: 'step', step: Number(m[1]) }
    m = r.match(/^(\d+)-(\d+)(?:\/(\d+))?$/)
    if (m) return { ...s, mode: 'range', from: Number(m[1]), to: Number(m[2]), rangeStep: m[3] ? Number(m[3]) : 1 }
    if (/^\d+(,\d+)+$/.test(r)) return { ...s, mode: 'at', value: r }
    if (/^\d+$/.test(r)) return { ...s, mode: 'at', value: r }
    return { ...s, mode: 'at', value: r }
  }
  minute.value = parseField(parts[0]!)
  hour.value = parseField(parts[1]!)
  dom.value = parseField(parts[2]!)
  month.value = parseField(parts[3]!)
  dow.value = parseField(parts[4]!)
  if (!silent) toast.ok('已按表达式回显五字段档位')
  return true
}

/* ---------- 小时勾选面板 ---------- */
const HOUR_LIST = Array.from({ length: 24 }, (_, i) => i)
const togglePick = (h: number) => {
  const picks = hour.value.picks.includes(h) ? hour.value.picks.filter((x) => x !== h) : [...hour.value.picks, h]
  hour.value = { ...hour.value, picks }
}
const pickAll = () => (hour.value = { ...hour.value, mode: 'panel', picks: [...HOUR_LIST] })
const pickInvert = () => (hour.value = { ...hour.value, mode: 'panel', picks: HOUR_LIST.filter((h) => !hour.value.picks.includes(h)) })
const pickWorktime = () => (hour.value = { ...hour.value, mode: 'panel', picks: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] })

const preset = (name: string) => {
  const reset = (): FieldState => make()
  minute.value = reset()
  hour.value = reset()
  dom.value = reset()
  month.value = { ...reset(), value: '1', from: 1, to: 1 }
  dow.value = reset()
  if (name === 'daily9') {
    hour.value = { ...reset(), mode: 'at', value: '9' }
    minute.value = { ...reset(), mode: 'at', value: '0' }
  } else if (name === 'workday') {
    minute.value = { ...reset(), mode: 'at', value: '30' }
    hour.value = { ...reset(), mode: 'range', from: 9, to: 18 }
    dow.value = { ...reset(), mode: 'range', from: 1, to: 5 }
  } else if (name === 'every15') {
    minute.value = { ...reset(), mode: 'step', step: 15 }
  }
  toast.ok(`已应用预设：${name === 'daily9' ? '每天 9 点' : name === 'workday' ? '工作日 9-18 点半' : '每 15 分钟'}`)
}

/* 初始化：互链接收（cron-explainer「去构建」带 query.re）→ 导入；并先算一次执行时间 */
onMounted(() => {
  const re = route.query.re
  if (typeof re === 'string' && re) {
    importText.value = re
    importExpr(re, true)
    toast.ok('已从 Cron 解读带入表达式')
  }
  runs.value = computeRuns().runs
})
</script>

<template>
  <div class="cron-builder">
    <div class="row row-wrap mb-2" style="gap: 8px">
      <input
        v-model="importText"
        type="text"
        class="input mono grow"
        style="min-width: 220px"
        placeholder="粘贴已有表达式导入，如 30 9-18 * * 1-5，回车回显"
        spellcheck="false"
        @keyup.enter="importExpr(importText)"
      />
      <button class="btn btn-soft btn-sm" @click="importExpr(importText)"><LogIn :size="14" /> 导入</button>
      <button class="btn btn-soft btn-sm" @click="preset('every15')">每 15 分钟</button>
      <button class="btn btn-soft btn-sm" @click="preset('daily9')">每天 9 点</button>
      <button class="btn btn-soft btn-sm" @click="preset('workday')">工作日 9-18 点</button>
    </div>

    <div class="builder-grid">
      <div v-for="d in DEFS" :key="d.key" class="b-row">
        <span class="b-label">{{ d.label }}</span>
        <select v-model="d.state.value.mode" class="select b-mode">
          <option value="every">每{{ d.noun }}</option>
          <option value="step">间隔</option>
          <option value="at">指定</option>
          <option value="range">范围</option>
          <option v-if="d.key === 'hour'" value="panel">面板</option>
        </select>
        <span v-if="d.state.value.mode === 'step'" class="b-ctrl">
          每 <input v-model.number="d.state.value.step" type="number" class="input" min="1" :max="d.max" style="width: 74px" /> {{ d.noun }}
        </span>
        <span v-else-if="d.state.value.mode === 'at'" class="b-ctrl">
          <input v-model="d.state.value.value" type="text" class="input mono" :placeholder="`${d.min}`" style="width: 150px" />
          <em class="muted small">可填 5 或 0,15,30,45</em>
        </span>
        <span v-else-if="d.state.value.mode === 'panel'" class="b-ctrl panel-wrap">
          <span class="panel-ops">
            <button class="chip" @click="pickAll">全选</button>
            <button class="chip" @click="pickInvert">反选</button>
            <button class="chip" @click="pickWorktime">工作时间 9-18</button>
          </span>
          <span class="hour-grid">
            <button v-for="h in HOUR_LIST" :key="h" class="hour-cell mono" :class="{ on: hour.picks.includes(h) }" @click="togglePick(h)">{{ h }}</button>
          </span>
          <em v-if="!hour.picks.length" class="muted small">未勾选任何小时，按每小时处理</em>
        </span>
        <span v-else-if="d.state.value.mode === 'range'" class="b-ctrl">
          <input v-model.number="d.state.value.from" type="number" class="input" :min="d.min" :max="d.max" style="width: 74px" />
          至
          <input v-model.number="d.state.value.to" type="number" class="input" :min="d.min" :max="d.max" style="width: 74px" />
          <template v-if="d.key !== 'dom' && d.key !== 'dow'">
            步长 <input v-model.number="d.state.value.rangeStep" type="number" class="input" min="1" style="width: 64px" />
          </template>
          <em v-if="d.state.value.from > d.state.value.to" class="range-warn small">起始 {{ d.state.value.from }} 大于结束 {{ d.state.value.to }}，已按每{{ d.noun }}处理——请交换两端</em>
        </span>
        <span v-else class="b-ctrl muted small">不限制</span>
      </div>
    </div>

    <div class="mt-3 expr-card">
      <div class="row" style="justify-content: space-between; align-items: center">
        <span class="field-label">生成的表达式</span>
        <button class="btn btn-ghost btn-sm" @click="copyExpr">
          <Check v-if="copied" :size="14" style="color: var(--ok)" />
          <Copy v-else :size="14" />
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
      <code class="expr mono">{{ expr }}</code>
    </div>

    <div v-if="explained.ok" class="notice notice-ok mt-2">{{ explained.summary }}</div>
    <div v-else class="notice notice-err mt-2">{{ explained.error }}</div>

    <p class="muted small mt-1">
      已有表达式想逐字段核对含义？去
      <RouterLink :to="{ path: '/t/cron-explainer', query: { re: expr } }">Cron 表达式解读</RouterLink>
      （表达式自动带入），逐字段解释并预览下次执行时间。
    </p>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="computeRuns"><CalendarClock :size="16" /> 计算未来执行时间</button>
      <span class="muted small">改动任意字段后 0.5 秒自动刷新下方时间</span>
    </div>

    <div v-if="runs.length" class="mt-2 runs">
      <div v-for="(r, i) in runs" :key="i" class="run-row">
        <span class="idx mono">#{{ i + 1 }}</span>
        <b>{{ r.toLocaleString('zh-CN', { hour12: false }) }}</b>
      </div>
    </div>

    <p class="notice notice-info mt-3 small"><Hammer :size="13" style="vertical-align: -2px" /> 星期字段 0 = 周日，1-5 = 周一至周五；指定模式支持逗号列表；小时可用「面板」勾选多个。</p>
  </div>
</template>

<style scoped>
.builder-grid {
  display: grid;
  gap: 10px;
}
.b-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 14px;
}
.b-label {
  flex: none;
  width: 44px;
  font-weight: 700;
  color: var(--accent-text);
}
.b-mode {
  width: 96px;
  padding: 6px 30px 6px 10px;
  font-size: 13.5px;
}
.b-ctrl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.b-ctrl .input {
  padding: 6px 10px;
  font-size: 13.5px;
  width: 74px;
}
.range-warn {
  color: var(--err);
}
.panel-wrap {
  flex-wrap: wrap;
}
.panel-ops {
  display: inline-flex;
  gap: 6px;
}
.hour-grid {
  display: grid;
  grid-template-columns: repeat(12, 30px);
  gap: 4px;
}
.hour-cell {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  font-size: 12px;
  height: 26px;
  cursor: pointer;
}
.hour-cell.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}
.expr-card .expr {
  display: block;
  padding: 14px 16px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}
.runs {
  display: grid;
  gap: 6px;
}
.run-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
}
.run-row .idx {
  color: var(--text-3);
}
</style>
