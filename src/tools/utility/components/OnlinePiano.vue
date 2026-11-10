<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getAudioCtx, closeAudioCtx } from '@/lib/audioSynth'

/** 虚拟钢琴：Web Audio 包络合成琴音，鼠标点击 + 键盘映射双输入 */

interface Note { semi: number; label: string; black: boolean; key?: string }

const NOTES: Note[] = [
  { semi: 0, label: 'C4', black: false, key: 'a' },
  { semi: 1, label: 'C♯', black: true },
  { semi: 2, label: 'D4', black: false, key: 's' },
  { semi: 3, label: 'D♯', black: true },
  { semi: 4, label: 'E4', black: false, key: 'd' },
  { semi: 5, label: 'F4', black: false, key: 'f' },
  { semi: 6, label: 'F♯', black: true },
  { semi: 7, label: 'G4', black: false, key: 'g' },
  { semi: 8, label: 'G♯', black: true },
  { semi: 9, label: 'A4', black: false, key: 'h' },
  { semi: 10, label: 'A♯', black: true },
  { semi: 11, label: 'B4', black: false, key: 'j' },
  { semi: 12, label: 'C5', black: false, key: 'k' },
  { semi: 13, label: 'C♯5', black: true },
  { semi: 14, label: 'D5', black: false, key: 'l' },
  { semi: 15, label: 'D♯5', black: true },
  { semi: 16, label: 'E5', black: false, key: ';' },
]

const BASE = 261.63 // C4

const active = ref(new Set<number>())
let ctx: AudioContext | null = null

const noteFreq = (semi: number) => BASE * Math.pow(2, semi / 12)

const playNote = (semi: number) => {
  try {
    ctx ??= getAudioCtx()
    const t = ctx.currentTime
    // 双振荡器（基频 + 八度泛音）+ attack/decay 包络，模拟钢琴质感
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    const o1 = ctx.createOscillator()
    o1.type = 'triangle'
    o1.frequency.value = noteFreq(semi)
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = noteFreq(semi) * 2
    const g2 = ctx.createGain()
    g2.gain.value = 0.3
    o1.connect(g)
    o2.connect(g2).connect(g)
    g.connect(ctx.destination)
    o1.start(t)
    o2.start(t)
    o1.stop(t + 1.5)
    o2.stop(t + 1.5)
    active.value.add(semi)
    setTimeout(() => active.value.delete(semi), 260)
  } catch { /* 无声环境 */ }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.repeat) return
  const n = NOTES.find((x) => x.key === e.key.toLowerCase())
  if (n) playNote(n.semi)
}

const KEYMAP = NOTES.filter((n) => n.key).map((n) => `${n.label} = ${n.key!.toUpperCase()}`).join(' · ')

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <p class="hint">鼠标点击或敲键盘弹奏：<span class="mono">{{ KEYMAP }}</span></p>
    </div>
    <div class="piano mt-2">
      <div class="keys">
        <template v-for="n in NOTES" :key="n.semi">
          <button
            v-if="!n.black"
            class="key white"
            :class="{ on: active.has(n.semi) }"
            @pointerdown.prevent="playNote(n.semi)"
          >
            <span>{{ n.key?.toUpperCase() }}</span>
          </button>
        </template>
      </div>
      <div class="blacks">
        <template v-for="n in NOTES" :key="n.semi">
          <button
            v-if="n.black"
            class="key black"
            :class="{ on: active.has(n.semi) }"
            :style="{ left: `${((n.semi - 1) / 17) * 100 + 3.2}%` }"
            @pointerdown.prevent="playNote(n.semi)"
          >
            <span>{{ n.key?.toUpperCase() }}</span>
          </button>
        </template>
      </div>
    </div>
    <p class="hint mt-2">双振荡器 + 衰减包络合成音色，本八度起 C4 到 E5；接入 MIDI 键盘暂不支持。</p>
  </div>
</template>

<style scoped>
.piano { position: relative; max-width: 760px; margin: 0 auto; user-select: none; }
.keys { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; }
.key { border: 1px solid var(--border); cursor: pointer; }
.key.white { height: 210px; border-radius: 0 0 8px 8px; background: #fff; color: #999; font-size: 12px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; }
.key.white.on { background: #ddd6fe; }
.key.black { position: absolute; top: 0; width: 5.2%; height: 130px; border-radius: 0 0 6px 6px; background: #1c1917; color: #aaa; font-size: 10px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px; z-index: 2; }
.key.black.on { background: #6d28d9; }
.blacks { position: absolute; inset: 0; pointer-events: none; }
.key.black { pointer-events: auto; }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
