<script setup lang="ts">
import { computed, ref } from 'vue'
import { Hammer, CalendarClock } from 'lucide-vue-next'
import { explainCron, nextRuns } from './CronExplainer.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

type Mode = 'every' | 'step' | 'at' | 'range'
interface FieldState {
  mode: Mode
  step: number
  value: string
  from: number
  to: number
  rangeStep: number
}

const make = (): FieldState => ({ mode: 'every', step: 1, value: '', from: 0, to: 0, rangeStep: 1 })

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
  if (r.error) toast.warn(r.error)
  else toast.ok('已刷新执行时间')
}

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
</script>

<template>
  <div class="cron-builder">
    <div class="row row-wrap mb-2" style="gap: 8px">
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
        </select>
        <span v-if="d.state.value.mode === 'step'" class="b-ctrl">
          每 <input v-model.number="d.state.value.step" type="number" class="input" min="1" :max="d.max" style="width: 74px" /> {{ d.noun }}
        </span>
        <span v-else-if="d.state.value.mode === 'at'" class="b-ctrl">
          <input v-model="d.state.value.value" type="text" class="input mono" :placeholder="`${d.min}`" style="width: 150px" />
          <em class="muted small">可填 5 或 0,15,30,45</em>
        </span>
        <span v-else-if="d.state.value.mode === 'range'" class="b-ctrl">
          <input v-model.number="d.state.value.from" type="number" class="input" :min="d.min" :max="d.max" style="width: 74px" />
          至
          <input v-model.number="d.state.value.to" type="number" class="input" :min="d.min" :max="d.max" style="width: 74px" />
          <template v-if="d.key !== 'dom' && d.key !== 'dow'">
            步长 <input v-model.number="d.state.value.rangeStep" type="number" class="input" min="1" style="width: 64px" />
          </template>
        </span>
        <span v-else class="b-ctrl muted small">不限制</span>
      </div>
    </div>

    <div class="mt-3 expr-card">
      <span class="field-label">生成的表达式</span>
      <code class="expr mono">{{ expr }}</code>
    </div>

    <div v-if="explained.ok" class="notice notice-ok mt-2">{{ explained.summary }}</div>
    <div v-else class="notice notice-err mt-2">{{ explained.error }}</div>

    <p class="muted small mt-1">
      已有表达式想逐字段核对含义？去
      <RouterLink to="/t/cron-explainer">Cron 表达式解读</RouterLink>
      粘贴即可逐字段解释并预览下次执行时间。
    </p>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="computeRuns"><CalendarClock :size="16" /> 计算未来执行时间</button>
    </div>

    <div v-if="runs.length" class="mt-2 runs">
      <div v-for="(r, i) in runs" :key="i" class="run-row">
        <span class="idx mono">#{{ i + 1 }}</span>
        <b>{{ r.toLocaleString('zh-CN', { hour12: false }) }}</b>
      </div>
    </div>

    <p class="notice notice-info mt-3 small"><Hammer :size="13" style="vertical-align: -2px" /> 星期字段 0 = 周日，1-5 = 周一至周五；指定模式支持逗号列表。</p>
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
