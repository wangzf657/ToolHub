<script setup lang="ts">
import { ref } from 'vue'
import { CalendarDays, Loader2 } from 'lucide-vue-next'
import { businessDaysBetween, addBusinessDays, type BusinessDayResult } from '@/lib/chinaCalendar'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const mode = ref<'range' | 'add'>('range')
const start = ref('')
const end = ref('')
const n = ref(3)
const busy = ref(false)

const rangeResult = ref<BusinessDayResult | null>(null)
const addResult = ref<{ date: string; makeup?: boolean }[]>([])
const covered = ref(true)

const fmtMd = (ds: string) => ds.slice(5).replace('-', '月') + '日'

const run = async () => {
  busy.value = true
  rangeResult.value = null
  addResult.value = []
  try {
    if (mode.value === 'range') {
      if (!start.value || !end.value) return toast.warn('请选择开始与结束日期')
      const r = await businessDaysBetween(start.value, end.value)
      rangeResult.value = r
      covered.value = r.dataCovered
    } else {
      if (!start.value) return toast.warn('请选择起始日期')
      if (!n.value) return toast.warn('请填写工作日天数')
      const steps = await addBusinessDays(start.value, n.value)
      const target = steps[steps.length - 1]
      addResult.value = [{ date: target?.date ?? '' }]
      // 补充展示沿途最后 2 个节点
      covered.value = true
    }
  } catch (e) {
    toast.err((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row gap">
        <label class="seg" :class="{ active: mode === 'range' }"><input v-model="mode" type="radio" value="range" class="sr" /> 区间工作日</label>
        <label class="seg" :class="{ active: mode === 'add' }"><input v-model="mode" type="radio" value="add" class="sr" /> 加减工作日</label>
      </div>

      <div class="row mt-2 wrap">
        <span class="field-label">{{ mode === 'range' ? '开始日期' : '起始日期' }}</span>
        <input v-model="start" type="date" class="input" />
        <template v-if="mode === 'range'">
          <span class="field-label">结束日期</span>
          <input v-model="end" type="date" class="input" />
        </template>
        <template v-else>
          <span class="field-label">工作日数</span>
          <input v-model.number="n" type="number" class="input n-input" step="1" />
          <span class="field-label muted">正数向后 / 负数向前</span>
        </template>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="run">
          <Loader2 v-if="busy" :size="15" class="spin" /><CalendarDays v-else :size="15" /> 计算
        </button>
      </div>
      <p class="hint mt-1">口径：双休 + 内置法定节假日与调休补班表（数据覆盖至 2027 年，每年 12 月更新）。缺少数据的年份按「仅扣周末」估算。</p>
    </div>

    <div v-if="rangeResult" class="result mt-2">
      <div class="stat-grid">
        <div class="stat primary"><span class="v">{{ rangeResult.workDays }}</span><span class="l">工作日</span></div>
        <div class="stat"><span class="v">{{ rangeResult.offDays }}</span><span class="l">休息日</span></div>
        <div class="stat"><span class="v">{{ rangeResult.holidayDays }}</span><span class="l">法定假日</span></div>
        <div class="stat"><span class="v">{{ rangeResult.makeupDays }}</span><span class="l">调休补班</span></div>
        <div class="stat"><span class="v">{{ rangeResult.totalDays }}</span><span class="l">自然日</span></div>
      </div>
      <div v-if="rangeResult.holidays.length" class="hol-list mt-2">
        <span class="field-label">区间内法定假日</span>
        <div class="chips mt-1">
          <span v-for="h in rangeResult.holidays" :key="h.date + h.name" class="chip">{{ fmtMd(h.date) }} {{ h.name }}</span>
        </div>
      </div>
      <p v-if="!covered" class="hint warn mt-1">⚠ 区间年份暂无内置放假安排，以上按「仅扣周末」估算；待次年 12 月官方公布后更新数据。</p>
    </div>

    <div v-if="addResult.length" class="result mt-2">
      <p class="big-line">
        {{ start }} 之后（前）第 <b>{{ n }}</b> 个工作日是 <b class="hl">{{ addResult[0]?.date }}</b>
      </p>
    </div>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.n-input { width: 90px; }
.stat-grid { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; gap: 2px; min-width: 86px; }
.stat .v { font-size: 22px; font-weight: 700; }
.stat .l { font-size: 12px; color: var(--muted); }
.stat.primary { border-color: var(--accent); }
.stat.primary .v { color: var(--accent-text); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.big-line { font-size: 16px; }
.hl { color: var(--accent-text); font-size: 18px; }
.hint { font-size: 12px; color: var(--muted); }
.hint.warn { color: var(--warn); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
