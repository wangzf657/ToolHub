<script setup lang="ts">
import { ref, watch } from 'vue'
import { Printer, Download } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const yearMode = ref(false)
const stageRef = ref<HTMLDivElement | null>(null)

let lunarMod: typeof import('lunar-javascript') | null = null
const loadLunar = async () => {
  lunarMod ??= await import('lunar-javascript')
  return lunarMod
}

interface HolidayInfo { off: boolean; name: string; makeup: boolean }

const holidayOf = (y: number, m: number, d: number): HolidayInfo | null => {
  const { HolidayUtil } = lunarMod!
  const h = HolidayUtil.getHoliday(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  if (!h) return null
  return { off: !h.isWork(), name: h.getName(), makeup: h.isWork() }
}

interface Cell { d: number | null; lunar: string; off: boolean; fest: string; makeup: boolean }

const buildMonth = (y: number, m: number): Cell[] => {
  const { Solar } = lunarMod!
  const first = new Date(y, m - 1, 1)
  const dim = new Date(y, m, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < first.getDay(); i++) cells.push({ d: null, lunar: '', off: false, fest: '', makeup: false })
  for (let d = 1; d <= dim; d++) {
    const solar = Solar.fromYmd(y, m, d)
    const lunar = solar.getLunar()
    const dow = new Date(y, m - 1, d).getDay()
    const h = holidayOf(y, m, d)
    const festival = solar.getFestivals()[0] ?? lunar.getFestivals()[0] ?? ''
    cells.push({
      d,
      lunar: lunar.getDay() === 1 ? `${lunar.getMonthInChinese()}月` : lunar.getDayInChinese(),
      off: h ? h.off : dow === 0 || dow === 6,
      fest: h && h.off ? h.name : festival,
      makeup: h ? h.makeup : false,
    })
  }
  return cells
}

const oneGrid = ref<Cell[]>([])
const yearGrids = ref<Cell[][]>([])

const rebuild = async () => {
  await loadLunar()
  if (yearMode.value) yearGrids.value = Array.from({ length: 12 }, (_, i) => buildMonth(year.value, i + 1))
  else oneGrid.value = buildMonth(year.value, month.value)
}
void rebuild()
watch([year, month, yearMode], () => void rebuild())

const print = () => window.print()

const exportPng = async () => {
  if (!stageRef.value) return
  try {
    const url = await toPng(stageRef.value, { pixelRatio: 2, backgroundColor: '#ffffff' })
    saveBlob(await (await fetch(url)).blob(), `${year.value}年${yearMode.value ? '全年' : month.value + '月'}日历.png`)
    toast.ok('已导出 PNG')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  }
}

const WK = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <input v-model.number="year" type="number" class="input slim" min="1900" max="2200" @change="rebuild" /> 年
        <template v-if="!yearMode">
          <input v-model.number="month" type="number" class="input slim" min="1" max="12" @change="rebuild" /> 月
        </template>
        <label class="check"><input v-model="yearMode" type="checkbox" @change="rebuild" /> 全年模式（12 月网格）</label>
        <button class="btn btn-primary btn-sm" @click="print"><Printer :size="15" /> 打印 / 存 PDF</button>
        <button class="btn btn-sm" @click="exportPng"><Download :size="15" /> 导出 PNG</button>
      </div>
      <p class="hint mt-1">自带农历与法定节假日：红色格为休息日（含调休放假），右上角「班」为调休补班日；节假日数据内置至 2027 年。</p>
    </div>

    <div ref="stageRef" class="paper mt-2">
      <template v-if="!yearMode">
        <h2 class="title">{{ year }} 年 {{ month }} 月</h2>
        <div class="cal">
          <span v-for="w in WK" :key="w" class="wk" :class="{ red: w === '日' || w === '六' }">{{ w }}</span>
          <div v-for="(c, i) in oneGrid" :key="i" class="day" :class="{ off: c.off && c.d, fest: !!c.fest && !c.makeup }">
            <template v-if="c.d">
              <b class="d">{{ c.d }}</b>
              <span class="l">{{ c.lunar }}</span>
              <span v-if="c.fest && !c.makeup" class="tag red-tag">{{ c.fest }}</span>
              <span v-if="c.makeup" class="tag ban-tag">班</span>
            </template>
          </div>
        </div>
        <p class="foot">ToolHub 农历万年历 · 打印版</p>
      </template>
      <template v-else>
        <h2 class="title">{{ year }} 年历</h2>
        <div class="year-grid">
          <div v-for="(grid, mi) in yearGrids" :key="mi" class="mini">
            <h4>{{ mi + 1 }} 月</h4>
            <div class="mini-cal">
              <span v-for="(c, i) in grid" :key="i" class="mc" :class="{ off: c.off && c.d }">{{ c.d ?? '' }}</span>
            </div>
          </div>
        </div>
        <p class="foot">ToolHub 农历万年历 · 打印版</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 84px; }
.hint { font-size: 12px; color: var(--muted); }
.paper { padding: 22px; background: #fff; color: #111827; border-radius: 12px; border: 1px solid var(--border); }
.title { text-align: center; font-size: 22px; margin-bottom: 14px; color: #111827; }
.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.wk { text-align: center; font-size: 12px; color: #6b7280; padding: 4px 0; }
.wk.red { color: #dc2626; }
.day { position: relative; aspect-ratio: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 5px; }
.day.off { background: #fef2f2; }
.day .d { font-size: 16px; }
.day .l { font-size: 10px; color: #6b7280; }
.day.fest { border-color: #fca5a5; }
.tag { position: absolute; top: 3px; right: 5px; font-size: 9px; }
.red-tag { color: #dc2626; }
.ban-tag { color: #2563eb; }
.year-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.mini h4 { text-align: center; font-size: 14px; margin-bottom: 4px; }
.mini-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.mc { aspect-ratio: 1; display: grid; place-items: center; font-size: 10px; border-radius: 3px; }
.mc.off { background: #fee2e2; color: #b91c1c; }
.foot { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 10px; }
@media print { body * { visibility: hidden; } .paper, .paper * { visibility: visible; } .paper { position: fixed; inset: 0; margin: auto; border: none; } }
</style>
