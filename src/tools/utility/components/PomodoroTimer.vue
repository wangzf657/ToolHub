<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play, Pause, RotateCcw, Coffee, Briefcase, SkipForward } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const workMin = ref(25)
const breakMin = ref(5)
const phase = ref<'work' | 'break'>('work')
const running = ref(false)
const leftMs = ref(25 * 60 * 1000)

let timer: number | undefined
let endAt = 0

/* 今日完成番茄数（localStorage 记忆） */
const todayKey = () => `toolhub:pomodoro:${new Date().toISOString().slice(0, 10)}`
const doneToday = ref(Number(localStorage.getItem(todayKey()) ?? '0') || 0)

const beep = (freq = 660, times = 2) => {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.5
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.45)
    }
  } catch {
    /* 忽略 */
  }
}

const totalMs = computed(() => (phase.value === 'work' ? Math.max(1, workMin.value) : Math.max(1, breakMin.value)) * 60 * 1000)
const label = computed(() => {
  const left = Math.max(0, Math.ceil(leftMs.value / 1000))
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
})
const pct = computed(() => (totalMs.value ? ((totalMs.value - leftMs.value) / totalMs.value) * 100 : 0))

const tick = () => {
  leftMs.value = Math.max(0, endAt - Date.now())
  if (leftMs.value <= 0) {
    window.clearInterval(timer)
    running.value = false
    if (phase.value === 'work') {
      doneToday.value++
      localStorage.setItem(todayKey(), String(doneToday.value))
      beep(660)
      toast.ok('一个番茄完成！休息一下吧 ☕'.replace(' ☕', ''))
      phase.value = 'break'
    } else {
      beep(520)
      toast.ok('休息结束，开始下一个番茄！')
      phase.value = 'work'
    }
    leftMs.value = totalMs.value
  }
}

const toggle = () => {
  if (running.value) {
    window.clearInterval(timer)
    running.value = false
  } else {
    endAt = Date.now() + leftMs.value
    timer = window.setInterval(tick, 250)
    running.value = true
  }
}

const reset = () => {
  window.clearInterval(timer)
  running.value = false
  phase.value = 'work'
  leftMs.value = totalMs.value
}

const skip = () => {
  window.clearInterval(timer)
  running.value = false
  if (phase.value === 'work') phase.value = 'break'
  else phase.value = 'work'
  leftMs.value = totalMs.value
}

/* 修改时长时若未在计时中则同步剩余时间 */
const syncLeft = () => {
  if (!running.value) leftMs.value = totalMs.value
}

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div>
    <div class="pomo-card" :class="{ work: phase === 'work' }">
      <div class="phase-tag">
        <Briefcase v-if="phase === 'work'" :size="15" />
        <Coffee v-else :size="15" />
        {{ phase === 'work' ? '专注工作中' : '休息一下' }}
      </div>
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120" class="ring">
          <circle cx="60" cy="60" r="54" class="ring-bg" />
          <circle cx="60" cy="60" r="54" class="ring-fg" :style="{ strokeDashoffset: `${251.2 * (1 - pct / 100)}` }" />
        </svg>
        <span class="ring-text mono">{{ label }}</span>
      </div>
      <div class="row row-wrap mt-2" style="justify-content: center">
        <button class="btn btn-primary" @click="toggle">
          <Pause v-if="running" :size="16" /><Play v-else :size="16" />
          {{ running ? '暂停' : leftMs < totalMs ? '继续' : '开始' }}
        </button>
        <button class="btn btn-ghost" @click="skip"><SkipForward :size="15" /> 跳到{{ phase === 'work' ? '休息' : '工作' }}</button>
        <button class="btn btn-ghost" @click="reset"><RotateCcw :size="15" /> 重置</button>
      </div>
      <p class="muted small mt-2">今日已完成番茄：<b>{{ doneToday }}</b> 个（按天记忆在本机）</p>
    </div>

    <div class="opts row row-wrap mt-2" style="gap: 20px">
      <div>
        <span class="field-label">工作时长（分钟）</span>
        <input v-model.number="workMin" type="number" class="input" style="width: 100px" min="1" max="120" @change="syncLeft" />
      </div>
      <div>
        <span class="field-label">休息时长（分钟）</span>
        <input v-model.number="breakMin" type="number" class="input" style="width: 100px" min="1" max="60" @change="syncLeft" />
      </div>
      <button class="btn btn-soft self-end" @click="workMin = 25; breakMin = 5; syncLeft()">恢复经典 25 / 5</button>
    </div>
  </div>
</template>

<style scoped>
.pomo-card {
  display: grid;
  justify-items: center;
  padding: 26px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.phase-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  background: var(--accent-soft);
  color: var(--accent-text);
}
.ring-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  margin-top: 14px;
}
.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg,
.ring-fg {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
}
.ring-bg {
  stroke: var(--border);
}
.ring-fg {
  stroke: var(--accent);
  stroke-dasharray: 251.2;
  transition: stroke-dashoffset 0.3s linear;
}
.ring-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 42px;
  font-weight: 800;
}
.opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.self-end {
  align-self: flex-end;
}
</style>
