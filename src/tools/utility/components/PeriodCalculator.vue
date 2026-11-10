<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarHeart, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const lastPeriod = ref('')
const cycleLen = ref(28)
const periodLen = ref(5)
const monthsAhead = ref(3)

interface DayCell {
  date: string
  day: number
  kind: 'period' | 'fertile' | 'ovulation' | 'safe' | 'plain'
  inMonth: boolean
}

const STORE_KEY = 'toolhub-period'
interface HistRecord { start: string; cycle: number; period: number }
const history = ref<HistRecord[]>(loadHistory())

function loadHistory(): HistRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as HistRecord[]
  } catch {
    return []
  }
}

const saveHistory = () => {
  localStorage.setItem(STORE_KEY, JSON.stringify(history.value.slice(0, 12)))
}

const applyHist = (h: HistRecord) => {
  lastPeriod.value = h.start
  cycleLen.value = h.cycle
  periodLen.value = h.period
}

const removeHist = (h: HistRecord) => {
  history.value = history.value.filter((x) => x !== h)
  saveHistory()
}

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}

const days = computed<DayCell[]>(() => {
  if (!lastPeriod.value) return []
  const start = parseKey(lastPeriod.value)
  const cycle = Math.min(60, Math.max(20, cycleLen.value || 28))
  const period = Math.min(14, Math.max(2, periodLen.value || 5))
  const ovulation = cycle - 14
  const totalMonths = Math.max(1, monthsAhead.value + 1)
  const cells: DayCell[] = []
  for (let m = 0; m < totalMonths; m++) {
    const first = new Date(start.getFullYear(), start.getMonth() + m, 1)
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    for (let dnum = 1; dnum <= dim; dnum++) {
      const d = new Date(first.getFullYear(), first.getMonth(), dnum)
      const diffDays = Math.round((d.getTime() - start.getTime()) / 86400000)
      let kind: DayCell['kind'] = 'plain'
      if (diffDays >= 0) {
        const dc = diffDays % cycle
        if (dc < period) kind = 'period'
        else if (dc === ovulation) kind = 'ovulation'
        else if (dc >= ovulation - 4 && dc <= ovulation + 1) kind = 'fertile'
        else kind = 'safe'
      }
      cells.push({ date: toKey(d), day: dnum, kind, inMonth: true })
    }
  }
  return cells
})

const monthGroups = computed(() => {
  const groups: { title: string; cells: DayCell[] }[] = []
  for (const c of days.value) {
    const title = c.date.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.title !== title) {
      g = { title, cells: [] }
      groups.push(g)
    }
    g.cells.push(c)
  }
  return groups
})

const KIND_LABEL: Record<DayCell['kind'], string> = {
  period: '经期',
  fertile: '易孕期',
  ovulation: '排卵日',
  safe: '安全期',
  plain: '之前',
}

const run = () => {
  if (!lastPeriod.value) return toast.warn('请选择最近一次月经开始日期')
  const h = { start: lastPeriod.value, cycle: cycleLen.value || 28, period: periodLen.value || 5 }
  history.value = [h, ...history.value.filter((x) => x.start !== h.start)]
  saveHistory()
  toast.ok('已生成日历（数据仅保存在本机）')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">最近一次月经开始</span>
        <input v-model="lastPeriod" type="date" class="input" />
        <span class="field-label">周期天数</span>
        <input v-model.number="cycleLen" type="number" class="input n-input" min="20" max="60" />
        <span class="field-label">经期天数</span>
        <input v-model.number="periodLen" type="number" class="input n-input" min="2" max="14" />
        <span class="field-label">预测月数</span>
        <select v-model.number="monthsAhead" class="input n-input">
          <option :value="1">1 个月</option>
          <option :value="3">3 个月</option>
          <option :value="6">6 个月</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="run"><CalendarHeart :size="15" /> 生成日历</button>
      </div>
      <div v-if="history.length > 1" class="hist mt-2">
        <span class="field-label">历史周期（本机保存）</span>
        <div class="chips mt-1">
          <span v-for="h in history" :key="h.start" class="chip-h">
            {{ h.start }} · {{ h.cycle }} 天
            <button class="chip-x" @click="applyHist(h)">用</button>
            <button class="chip-x" @click="removeHist(h)"><Trash2 :size="11" /></button>
          </span>
        </div>
      </div>
    </div>

    <div v-if="monthGroups.length" class="mt-2">
      <div class="legend mb-2">
        <span class="lg period">经期</span><span class="lg fertile">易孕期</span><span class="lg ovulation">排卵日</span><span class="lg safe">安全期</span>
      </div>
      <div v-for="g in monthGroups" :key="g.title" class="month">
        <h4 class="m-title">{{ g.title }}</h4>
        <div class="grid7 head">
          <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
        </div>
        <div class="grid7">
          <span v-for="(c, i) in g.cells" :key="c.date" class="cell" :class="c.kind" :style="{ gridColumnStart: i === 0 ? new Date(c.date).getDay() + 1 : undefined }">
            <b>{{ c.day }}</b>
            <i v-if="c.kind !== 'safe' && c.kind !== 'plain'">{{ KIND_LABEL[c.kind] }}</i>
          </span>
        </div>
      </div>
      <p class="hint mt-2">⚠ 仅供参考，不作为避孕或医疗依据；周期不规律时预测偏差较大。所有数据仅保存在你的设备上，永不上传。</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; }
.n-input { width: 84px; }
.hist .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-h { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.chip-x { border: none; background: transparent; cursor: pointer; color: var(--muted); padding: 0 2px; }
.chip-x:hover { color: var(--text); }
.legend { display: flex; gap: 8px; flex-wrap: wrap; }
.lg { font-size: 12px; padding: 3px 10px; border-radius: 999px; }
.lg.period { background: rgba(239, 68, 68, .18); color: #ef4444; }
.lg.fertile { background: rgba(245, 158, 11, .18); color: #f59e0b; }
.lg.ovulation { background: rgba(168, 85, 247, .2); color: #a855f7; }
.lg.safe { background: rgba(16, 185, 129, .16); color: #10b981; }
.month { margin-bottom: 18px; max-width: 460px; }
.m-title { margin: 6px 0; font-size: 14px; }
.grid7 { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.head { font-size: 11px; color: var(--muted); text-align: center; margin-bottom: 4px; }
.cell { aspect-ratio: 1; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; border: 1px solid var(--border); }
.cell i { font-style: normal; font-size: 9px; }
.cell.period { background: rgba(239, 68, 68, .18); border-color: rgba(239, 68, 68, .4); }
.cell.fertile { background: rgba(245, 158, 11, .16); border-color: rgba(245, 158, 11, .4); }
.cell.ovulation { background: rgba(168, 85, 247, .2); border-color: #a855f7; }
.cell.safe { color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }
</style>
