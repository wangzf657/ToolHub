<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Plus, Trash2, CalendarClock } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Ev {
  id: number
  name: string
  target: string // datetime-local 格式
}
const KEY = 'toolhub:event-countdown'

const load = (): Ev[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Ev[]
    return Array.isArray(arr) ? arr.filter((e) => e && e.name && e.target) : []
  } catch {
    return []
  }
}
const events = ref<Ev[]>(load())

const save = () => {
  localStorage.setItem(KEY, JSON.stringify(events.value))
}

const name = ref('')
const target = ref('')

const addEvent = () => {
  if (!name.value.trim()) {
    toast.warn('请输入事件名称')
    return
  }
  if (!target.value) {
    toast.warn('请选择目标日期时间')
    return
  }
  events.value.push({ id: Date.now(), name: name.value.trim(), target: target.value })
  save()
  name.value = ''
  target.value = ''
  toast.ok('已添加事件')
}
const removeEvent = (id: number) => {
  events.value = events.value.filter((e) => e.id !== id)
  save()
}

/** 预设（春节按近年公历近似标注，非农历精确推算） */
const now0 = () => {
  const d = new Date()
  d.setSeconds(0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00`
}
const presets: { label: string; name: string; at: () => string; note?: string }[] = [
  { label: '元旦', name: '元旦', at: () => `${new Date().getFullYear() + 1}-01-01T00:00` },
  { label: '春节（公历近似）', name: '春节', at: () => `${new Date().getFullYear() + 1}-02-17T00:00`, note: '按公历近似' },
  { label: '国庆节', name: '国庆节', at: () => `${new Date().getFullYear()}-10-01T00:00` },
]
const applyPreset = (p: (typeof presets)[number]) => {
  name.value = p.name
  const at = p.at()
  if (new Date(at).getTime() < Date.now()) {
    // 国庆若已过则取明年
    const y = new Date().getFullYear() + 1
    target.value = p.name === '国庆节' ? `${y}-10-01T00:00` : at
  } else {
    target.value = at
  }
  toast.ok(`已选择 ${p.label}${p.note ? `（${p.note}，可自行修改日期）` : '，可自行修改日期'}`)
}
void now0

const now = ref(Date.now())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))

const partsOf = (target_: string) => {
  const ms = new Date(target_).getTime() - now.value
  const past = ms <= 0
  const abs = Math.abs(ms)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const s = Math.floor((abs % 60000) / 1000)
  return { past, d, h, m, s, date: new Date(target_).toLocaleString('zh-CN') }
}

const sorted = computed(() => [...events.value].sort((a, b) => new Date(a.target).getTime() - new Date(b.target).getTime()))
</script>

<template>
  <div>
    <div class="add-card">
      <div class="grid-2">
        <div>
          <span class="field-label">事件名称</span>
          <input v-model="name" class="input" placeholder="例如 项目上线 / 生日聚会" @keydown.enter="addEvent" />
        </div>
        <div>
          <span class="field-label">目标日期时间</span>
          <input v-model="target" type="datetime-local" class="input" />
        </div>
      </div>
      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" @click="addEvent"><Plus :size="16" /> 添加事件</button>
        <span class="muted small">预设：</span>
        <button v-for="p in presets" :key="p.label" class="chip" @click="applyPreset(p)">{{ p.label }}</button>
      </div>
    </div>

    <div v-if="sorted.length" class="list mt-2">
      <div v-for="e in sorted" :key="e.id" class="ev-card">
        <div class="ev-head">
          <CalendarClock :size="16" />
          <span class="ev-name">{{ e.name }}</span>
          <button class="mini-del" title="删除" @click="removeEvent(e.id)"><Trash2 :size="14" /></button>
        </div>
        <p class="muted small">目标：{{ partsOf(e.target).date }}</p>
        <div v-if="partsOf(e.target).past" class="ev-past">已到达 / 已过期</div>
        <div v-else class="ev-grid">
          <div class="ev-cell"><span class="ev-num">{{ partsOf(e.target).d }}</span><span>天</span></div>
          <div class="ev-cell"><span class="ev-num">{{ String(partsOf(e.target).h).padStart(2, '0') }}</span><span>时</span></div>
          <div class="ev-cell"><span class="ev-num">{{ String(partsOf(e.target).m).padStart(2, '0') }}</span><span>分</span></div>
          <div class="ev-cell"><span class="ev-num">{{ String(partsOf(e.target).s).padStart(2, '0') }}</span><span>秒</span></div>
        </div>
      </div>
    </div>
    <div v-else class="notice notice-info mt-2">还没有事件，添加一个或使用上方预设开始倒计时。</div>
  </div>
</template>

<style scoped>
.add-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.list {
  display: grid;
  gap: 12px;
}
.ev-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.ev-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ev-name {
  font-weight: 700;
  font-size: 15.5px;
  flex: 1;
}
.mini-del {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-del:hover {
  border-color: var(--err);
  color: var(--err);
}
.ev-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 8px;
  max-width: 420px;
}
.ev-cell {
  display: grid;
  justify-items: center;
  padding: 10px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  font-size: 12px;
  color: var(--text-2);
}
.ev-num {
  font-size: 24px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--accent-text);
}
.ev-past {
  margin-top: 8px;
  color: var(--warn);
  font-weight: 600;
  font-size: 14px;
}
</style>
