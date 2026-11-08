<script setup lang="ts">
/** 农历/万年历：月历网格（农历日/节气/节日标注）+ 详情面板 + 公农历互转 */
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, CalendarDays, Search } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface DayCell {
  date: Date
  day: number
  inMonth: boolean
  isToday: boolean
  lunarDay: string
  lunarMonth: string
  ganzhiYear: string
  shengxiao: string
  jieqi: string
  festivals: string[]
  yi: string[]
  ji: string[]
  xingzuo: string
  week: string
}

const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth() + 1)
const selected = ref<Date | null>(null)
const cells = ref<DayCell[]>([])
const loading = ref(false)

let lunarMod: typeof import('lunar-javascript') | null = null

/** 构建当前月 6×7 网格（含前后月补位） */
const buildMonth = async () => {
  loading.value = true
  try {
    lunarMod ??= await import('lunar-javascript')
    const { Solar } = lunarMod
    const first = new Date(year.value, month.value - 1, 1)
    const startOffset = first.getDay() // 周日=0
    const daysInMonth = new Date(year.value, month.value, 0).getDate()
    const out: DayCell[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(year.value, month.value - 1, 1 - startOffset + i)
      const solar = Solar.fromDate(d)
      const lunar = solar.getLunar()
      // 节气只在 Lunar 上有 getJieQi（Solar 原型无此方法）；闰月以 getMonth() 为负表示，
      // getMonthInChinese() 已自带「闰X」前缀
      const isDayOne = lunar.getDay() === 1
      out.push({
        date: d,
        day: d.getDate(),
        inMonth: d.getMonth() === month.value - 1,
        isToday: d.toDateString() === today.toDateString(),
        lunarDay: isDayOne ? `${lunar.getMonthInChinese()}月` : lunar.getDayInChinese(),
        lunarMonth: lunar.getMonthInChinese(),
        ganzhiYear: lunar.getYearInGanZhi(),
        shengxiao: lunar.getYearShengXiao(),
        jieqi: lunar.getJieQi() || '',
        festivals: [...solar.getFestivals(), ...lunar.getFestivals()],
        yi: lunar.getDayYi().slice(0, 4),
        ji: lunar.getDayJi().slice(0, 4),
        xingzuo: solar.getXingZuo(),
        week: solar.getWeekInChinese(),
      })
    }
    cells.value = out
    // 默认选中今天/当月 1 日
    if (!selected.value || selected.value.getMonth() !== month.value - 1 || selected.value.getFullYear() !== year.value) {
      selected.value = today.toDateString() === new Date(year.value, month.value - 1, today.getDate()).toDateString() && month.value === today.getMonth() + 1 ? today : new Date(year.value, month.value - 1, 1)
    }
  } catch (e) {
    // 渲染失败给占位提示而非静默空白
    cells.value = []
    toast.err((e as Error).message || '月历数据渲染失败，请刷新重试')
  } finally {
    loading.value = false
  }
}
watch([year, month], buildMonth, { immediate: true })

const prev = () => {
  if (month.value === 1) { year.value--; month.value = 12 } else month.value--
}
const next = () => {
  if (month.value === 12) { year.value++; month.value = 1 } else month.value++
}
const backToday = () => {
  year.value = today.getFullYear()
  month.value = today.getMonth() + 1
  selected.value = today
}

const selectedCell = computed(() => cells.value.find((c) => c.date.toDateString() === selected.value?.toDateString()))

/* ---- 公历 ↔ 农历互转 ---- */
const convSolar = ref('') // yyyy-mm-dd
const convResult = ref('')
const lunarY = ref<number | ''>('')
const lunarM = ref(1)
const lunarD = ref(1)
const lunarLeap = ref(false)
const backResult = ref('')

const solarToLunar = async () => {
  lunarMod ??= await import('lunar-javascript')
  const { Solar } = lunarMod
  if (!/^\d{4}-\d{2}-\d{2}$/.test(convSolar.value)) return toast.warn('请选择日期')
  const [y, m, d] = convSolar.value.split('-').map(Number)
  const lunar = Solar.fromYmd(y, m, d).getLunar()
  convResult.value = `农历 ${lunar.getYearInGanZhi()}年（${lunar.getYearShengXiao()}） ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} · 干支日 ${lunar.getDayInGanZhi()}`
}

const lunarToSolar = async () => {
  lunarMod ??= await import('lunar-javascript')
  const { Lunar } = lunarMod
  if (!lunarY.value || lunarY.value < 1900 || lunarY.value > 2100) return toast.warn('请输入 1900~2100 年份')
  try {
    // 闰月以负数月份传入（lunar-javascript 约定：闰六月 = -6）
    const solar = Lunar.fromYmd(Number(lunarY.value), lunarLeap.value ? -lunarM.value : lunarM.value, lunarD.value).getSolar()
    backResult.value = `公历 ${solar.getYear()} 年 ${solar.getMonth()} 月 ${solar.getDay()} 日`
  } catch {
    backResult.value = ''
    toast.err('该农历日期不存在（注意闰月），请检查输入')
  }
}

const title = computed(() => `${year.value} 年 ${month.value} 月`)
</script>

<template>
  <div class="lunar-tool">
    <div class="cal-head">
      <button class="btn btn-ghost btn-sm" aria-label="上一月" @click="prev"><ChevronLeft :size="16" /></button>
      <strong class="cal-title"><CalendarDays :size="16" /> {{ title }}</strong>
      <button class="btn btn-ghost btn-sm" aria-label="下一月" @click="next"><ChevronRight :size="16" /></button>
      <button class="btn btn-soft btn-sm" @click="backToday">今天</button>
    </div>

    <div class="cal-grid">
      <div v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="cal-week">{{ w }}</div>
      <div
        v-for="(c, i) in cells"
        :key="i"
        class="cal-cell"
        :class="{ dim: !c.inMonth, today: c.isToday, sel: selected?.toDateString() === c.date.toDateString() }"
        @click="selected = c.date"
      >
        <span class="solar">{{ c.day }}</span>
        <span class="lunar" :class="{ festival: c.jieqi || c.festivals.length }">{{ c.jieqi || c.festivals[0] || c.lunarDay }}</span>
      </div>
    </div>

    <div v-if="selectedCell" class="detail">
      <div class="detail-main">
        <strong>{{ selectedCell.date.getFullYear() }} 年 {{ selectedCell.date.getMonth() + 1 }} 月 {{ selectedCell.date.getDate() }} 日 · 星期{{ selectedCell.week }}</strong>
        <p class="lunar-line">农历 {{ selectedCell.ganzhiYear }}年（{{ selectedCell.shengxiao }}） {{ selectedCell.lunarMonth }}月{{ selectedCell.lunarDay }} · {{ selectedCell.xingzuo }}</p>
        <p class="muted small">节气：{{ selectedCell.jieqi || '—' }} · 节日：{{ selectedCell.festivals.join('、') || '—' }}</p>
      </div>
      <div class="detail-yiji">
        <p><span class="tag ok">宜</span>{{ selectedCell.yi.join(' ') || '—' }}</p>
        <p><span class="tag bad">忌</span>{{ selectedCell.ji.join(' ') || '—' }}</p>
      </div>
    </div>

    <div class="conv">
      <div class="conv-row">
        <label>公历 → 农历</label>
        <input v-model="convSolar" type="date" class="input" style="width: 160px" @change="solarToLunar" />
        <span class="conv-out">{{ convResult || '—' }}</span>
      </div>
      <div class="conv-row">
        <label>农历 → 公历</label>
        <input v-model.number="lunarY" type="number" min="1900" max="2100" class="input" style="width: 90px" placeholder="年" />
        <select v-model.number="lunarM" class="select" style="width: 110px">
          <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
        </select>
        <label class="check"><input v-model="lunarLeap" type="checkbox" /><span>闰月</span></label>
        <select v-model.number="lunarD" class="select" style="width: 110px">
          <option v-for="d in 30" :key="d" :value="d">{{ d }} 日</option>
        </select>
        <button class="btn btn-soft btn-sm" @click="lunarToSolar"><Search :size="13" /> 查询</button>
        <span class="conv-out">{{ backResult || '—' }}</span>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">节假日与节气由本地历法计算；调休补班以国务院每年公布为准，本页不做联网查询。</p>
  </div>
</template>

<style scoped>
.cal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.cal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  margin: 0 4px;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-week {
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  padding: 4px 0;
}
.cal-cell {
  aspect-ratio: 1 / 0.86;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}
.cal-cell:hover {
  background: var(--accent-soft);
}
.cal-cell.dim {
  opacity: 0.38;
}
.cal-cell.today .solar {
  color: var(--accent-text);
  font-weight: 700;
}
.cal-cell.sel {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.solar {
  font-size: 15px;
  line-height: 1.1;
}
.lunar {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.lunar.festival {
  color: var(--accent-text);
}
.detail {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.lunar-line {
  margin: 6px 0 4px;
  font-size: 14px;
}
.detail-yiji p {
  margin: 0 0 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  flex: none;
}
.tag.ok { background: #1a9c74; }
.tag.bad { background: #d9534f; }
.conv {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}
.conv-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.conv-row > label:first-child {
  font-size: 13px;
  color: var(--text-2);
  width: 84px;
  flex: none;
}
.conv-out {
  font-size: 13.5px;
  color: var(--text-2);
}
.check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
</style>
