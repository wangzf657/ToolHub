<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play, Pause, RotateCcw, Flag, BellRing } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tab = ref<'sw' | 'cd'>('sw')

/* ---------------- Web Audio 蜂鸣 ---------------- */
let ctx: AudioContext | null = null
const beep = (times = 3) => {
  try {
    ctx = ctx ?? new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.45
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    }
  } catch {
    /* 无声环境忽略 */
  }
}

/* ---------------- 秒表 ---------------- */
const swRunning = ref(false)
const swCs = ref(0) // 百分秒
let swTimer: number | undefined
let swStart = 0
const laps = ref<number[]>([])

const swLabel = computed(() => {
  const total = swCs.value
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
})

const swToggle = () => {
  if (swRunning.value) {
    window.clearInterval(swTimer)
    swRunning.value = false
  } else {
    swStart = Date.now() - swCs.value * 10
    swTimer = window.setInterval(() => (swCs.value = Math.floor((Date.now() - swStart) / 10)), 33)
    swRunning.value = true
  }
}
const swReset = () => {
  window.clearInterval(swTimer)
  swRunning.value = false
  swCs.value = 0
  laps.value = []
}
const addLap = () => {
  laps.value.unshift(swCs.value)
}

/* ---------------- 倒计时 ---------------- */
const cdMin = ref(5)
const cdSec = ref(0)
const cdLeft = ref(0) // 剩余毫秒
const cdRunning = ref(false)
let cdTimer: number | undefined
let cdEnd = 0
let titleFlash: number | undefined
const originalTitle = document.title

const cdTotal = computed(() => (Math.max(0, cdMin.value) * 60 + Math.max(0, cdSec.value)) * 1000)
const cdLabel = computed(() => {
  const left = Math.max(0, Math.ceil(cdLeft.value / 1000))
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
})
const cdPct = computed(() => (cdTotal.value ? (cdLeft.value / cdTotal.value) * 100 : 0))

const stopTitleFlash = () => {
  if (titleFlash) window.clearInterval(titleFlash)
  titleFlash = undefined
  document.title = originalTitle
}

const startCd = () => {
  stopTitleFlash()
  const total = cdTotal.value
  if (total <= 0) {
    toast.warn('请输入大于 0 的分秒')
    return
  }
  cdEnd = Date.now() + (cdLeft.value > 0 ? cdLeft.value : total)
  cdTimer = window.setInterval(() => {
    cdLeft.value = Math.max(0, cdEnd - Date.now())
    if (cdLeft.value <= 0) {
      window.clearInterval(cdTimer)
      cdRunning.value = false
      beep(4)
      let flip = false
      titleFlash = window.setInterval(() => {
        flip = !flip
        document.title = flip ? '⏰ 时间到！' : originalTitle
      }, 700)
      toast.ok('倒计时结束！')
    }
  }, 200)
  if (cdLeft.value <= 0) cdLeft.value = total
  cdRunning.value = true
}
const pauseCd = () => {
  window.clearInterval(cdTimer)
  cdRunning.value = false
}
const resetCd = () => {
  stopTitleFlash()
  window.clearInterval(cdTimer)
  cdRunning.value = false
  cdLeft.value = 0
}
const setPreset = (m: number) => {
  resetCd()
  cdMin.value = m
  cdSec.value = 0
}

onBeforeUnmount(() => {
  window.clearInterval(swTimer)
  window.clearInterval(cdTimer)
  stopTitleFlash()
})
</script>

<template>
  <div>
    <div class="tabs row">
      <button class="chip" :class="{ active: tab === 'sw' }" @click="tab = 'sw'">秒表</button>
      <button class="chip" :class="{ active: tab === 'cd' }" @click="tab = 'cd'">倒计时</button>
    </div>

    <!-- 秒表 -->
    <div v-if="tab === 'sw'" class="timer-card mt-2">
      <div class="big mono">{{ swLabel }}</div>
      <div class="row mt-2" style="justify-content: center">
        <button class="btn btn-primary" @click="swToggle">
          <Pause v-if="swRunning" :size="16" /><Play v-else :size="16" />
          {{ swRunning ? '暂停' : swCs ? '继续' : '开始' }}
        </button>
        <button class="btn btn-ghost" :disabled="!swCs" @click="addLap"><Flag :size="16" /> 计次</button>
        <button class="btn btn-ghost" @click="swReset"><RotateCcw :size="16" /> 重置</button>
      </div>
      <div v-if="laps.length" class="lap-list mt-2">
        <div v-for="(l, i) in laps" :key="i" class="lap-row">
          <span>第 {{ laps.length - i }} 次</span>
          <span class="mono">{{ l }}</span>
        </div>
      </div>
    </div>

    <!-- 倒计时 -->
    <div v-else class="timer-card mt-2">
      <div class="big mono" :class="{ done: !cdRunning && cdLeft <= 0 && cdTotal > 0 }">{{ cdLabel }}</div>
      <div class="bar mt-1"><div class="bar-fill" :style="{ width: cdPct + '%' }"></div></div>

      <div class="row mt-2" style="justify-content: center; gap: 8px">
        <span class="muted small">分</span>
        <input v-model.number="cdMin" type="number" class="input time-in" min="0" max="999" :disabled="cdRunning" />
        <span class="muted small">秒</span>
        <input v-model.number="cdSec" type="number" class="input time-in" min="0" max="59" :disabled="cdRunning" />
      </div>

      <div class="row row-wrap mt-2" style="justify-content: center">
        <button v-if="!cdRunning" class="btn btn-primary" @click="startCd">
          <Play :size="16" /> {{ cdLeft > 0 ? '继续' : '开始' }}
        </button>
        <button v-else class="btn btn-primary" @click="pauseCd"><Pause :size="16" /> 暂停</button>
        <button class="btn btn-ghost" @click="resetCd"><RotateCcw :size="16" /> 重置</button>
      </div>

      <div class="row row-wrap mt-2" style="justify-content: center; gap: 8px">
        <button v-for="m in [1, 3, 5, 10, 25]" :key="m" class="chip" @click="setPreset(m)">{{ m }} 分钟</button>
      </div>

      <p class="muted small mt-2" style="text-align: center">
        <BellRing :size="13" /> 结束时播放蜂鸣音并闪烁页面标题
      </p>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  gap: 8px;
}
.timer-card {
  display: grid;
  justify-items: center;
  padding: 26px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.big {
  font-size: 64px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 2px;
  color: var(--text);
}
.big.done {
  color: var(--err);
}
.time-in {
  width: 84px;
  text-align: center;
}
.bar {
  width: 100%;
  max-width: 340px;
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s linear;
}
.lap-list {
  width: 100%;
  max-width: 340px;
  max-height: 200px;
  overflow: auto;
  display: grid;
  gap: 4px;
}
.lap-row {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
</style>
