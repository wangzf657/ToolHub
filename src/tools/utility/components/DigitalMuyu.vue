<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RotateCcw } from 'lucide-vue-next'

const count = ref(Number(localStorage.getItem('toolhub-muyu') ?? 0))
const total = ref(Number(localStorage.getItem('toolhub-muyu-total') ?? 0))
const pop = ref(false)
const popText = ref('')
const autoOn = ref(false)

const PHRASES = ['功德 +1', '功德 +1', '功德 +1', '功德无量', '心诚则灵', '祥瑞御免']
let audio: AudioContext | null = null
let timer: number | null = null

const hit = () => {
  count.value++
  total.value++
  localStorage.setItem('toolhub-muyu', String(count.value))
  localStorage.setItem('toolhub-muyu-total', String(total.value))
  pop.value = false
  requestAnimationFrame(() => {
    pop.value = true
    popText.value = Math.random() < 0.15 ? PHRASES[Math.floor(Math.random() * PHRASES.length)]! : PHRASES[0]!
  })
  playSound()
}

const playSound = () => {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(620, t)
    o.frequency.exponentialRampToValueAtTime(180, t + 0.14)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    o.connect(g).connect(audio.destination)
    o.start(t)
    o.stop(t + 0.24)
  } catch { /* 无声环境忽略 */ }
}

const reset = () => {
  count.value = 0
  localStorage.setItem('toolhub-muyu', '0')
}

const toggleAuto = () => {
  autoOn.value = !autoOn.value
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (autoOn.value) timer = window.setInterval(hit, 420)
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  audio?.close().catch(() => {})
})
</script>

<template>
  <div class="muyu">
    <div class="stage" @pointerdown.prevent="hit">
      <div class="fish" :class="{ pop }">🪵</div>
      <div class="float" :class="{ pop }">{{ popText }}</div>
      <p class="tap">敲击木鱼积累功德</p>
    </div>
    <div class="stats">
      <span class="n">本次功德：<b>{{ count }}</b></span>
      <span class="n">累计功德：<b>{{ total }}</b></span>
      <button class="btn btn-sm" @click="reset"><RotateCcw :size="14" /> 归零</button>
      <label class="check"><input v-model="autoOn" type="checkbox" @change="toggleAuto" /> 自动敲（挂机功德）</label>
    </div>
  </div>
</template>

<style scoped>
.muyu { text-align: center; }
.stage { position: relative; padding: 30px 0 10px; user-select: none; }
.fish { font-size: 120px; line-height: 1; cursor: pointer; transition: transform .1s; }
.fish:active { transform: scale(.9); }
.fish.pop { animation: knock .18s; }
@keyframes knock { 0% { transform: scale(1); } 40% { transform: scale(.88) rotate(-4deg); } 100% { transform: scale(1); } }
.face { display: none; }
.float { position: absolute; top: 10px; left: 0; right: 0; font-size: 22px; color: #fbbf24; font-weight: 700; opacity: 0; pointer-events: none; }
.float.pop { animation: rise 0.7s ease-out; }
@keyframes rise { 0% { opacity: 0; transform: translateY(18px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
.tap { color: var(--muted); font-size: 13px; margin-top: 10px; }
.stats { display: flex; align-items: center; justify-content: center; gap: 18px; margin-top: 12px; flex-wrap: wrap; }
.n { font-size: 14px; }
.n b { color: #fbbf24; font-size: 18px; }
</style>
