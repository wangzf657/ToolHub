<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import { startMetronome, closeAudioCtx } from '@/lib/audioSynth'

const bpm = ref(100)
const beats = ref(4)
const subdiv = ref(1)
const running = ref(false)
const curBeat = ref(-1)

const TEMPO_PRESETS = [
  { label: '慢板 60', v: 60 },
  { label: '行板 80', v: 80 },
  { label: '中板 100', v: 100 },
  { label: '快板 132', v: 132 },
  { label: '急板 168', v: 168 },
]

let handle: { stop: () => void; setBpm: (b: number) => void; setBeats: (b: number) => void } | null = null

// 运行中实时调速/改拍号：下一拍生效，不打断节拍
watch(bpm, (b) => handle?.setBpm(b))
watch(beats, (b) => handle?.setBeats(b))

const start = () => {
  stop()
  running.value = true
  handle = startMetronome(bpm.value, beats.value, subdiv.value, (b) => {
    curBeat.value = b
  })
}

const stop = () => {
  handle?.stop()
  handle = null
  running.value = false
  curBeat.value = -1
}

onBeforeUnmount(() => {
  stop()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="dots">
        <span v-for="i in beats" :key="i" class="dot" :class="{ on: running && curBeat === i - 1, accent: i === 1 }"></span>
      </div>
      <div class="bpm-line">
        <span class="bpm-val">{{ bpm }}</span>
        <span class="field-label">BPM</span>
      </div>
      <input v-model.number="bpm" type="range" min="30" max="300" step="1" class="bpm-range" />
      <div class="row wrap gap mt-2">
        <button class="btn btn-primary" @click="running ? stop() : start()">
          <Square v-if="running" :size="16" /><Play v-else :size="16" /> {{ running ? '停止' : '开始' }}
        </button>
        <span class="field-label">拍号</span>
        <select v-model.number="beats" class="input slim">
          <option :value="2">2/4</option>
          <option :value="3">3/4</option>
          <option :value="4">4/4</option>
          <option :value="6">6/8</option>
        </select>
        <span class="field-label">细分</span>
        <select v-model.number="subdiv" class="input slim">
          <option :value="1">不细分</option>
          <option :value="2">八分音符</option>
          <option :value="3">三连音</option>
          <option :value="4">十六分音符</option>
        </select>
      </div>
      <div class="chips mt-2">
        <button v-for="p in TEMPO_PRESETS" :key="p.v" class="chip-btn" @click="bpm = p.v">{{ p.label }}</button>
      </div>
      <p class="hint mt-1">Web Audio lookahead 调度，节拍精度不受 UI 掉帧影响；页面切到后台时浏览器可能限流。</p>
    </div>
  </div>
</template>

<style scoped>
.dots { display: flex; gap: 10px; justify-content: center; margin: 10px 0; }
.dot { width: 22px; height: 22px; border-radius: 50%; background: var(--surface-2, rgba(127,127,127,.18)); transition: transform .08s, background .08s; }
.dot.accent.on { background: var(--accent); transform: scale(1.3); }
.dot.on { background: var(--accent-text); opacity: .8; transform: scale(1.25); }
.bpm-line { display: flex; align-items: baseline; gap: 8px; justify-content: center; }
.bpm-val { font-size: 44px; font-weight: 800; color: var(--accent-text); }
.bpm-range { width: 100%; max-width: 420px; display: block; margin: 0 auto; }
.gap { gap: 10px; align-items: center; }
.slim { width: 110px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
