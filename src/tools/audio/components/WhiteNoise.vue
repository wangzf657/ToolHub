<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Play, Square, Volume2, Timer } from 'lucide-vue-next'
import { startNoise, closeAudioCtx, type NoiseKind } from '@/lib/audioSynth'

const KINDS: { k: NoiseKind; label: string; icon: string }[] = [
  { k: 'white', label: '白噪音', icon: '⚪' },
  { k: 'pink', label: '粉噪音', icon: '🌸' },
  { k: 'brown', label: '棕噪音', icon: '🟤' },
  { k: 'rain', label: '雨声', icon: '🌧️' },
  { k: 'wave', label: '海浪', icon: '🌊' },
  { k: 'fan', label: '风扇', icon: '🌀' },
]

const kind = ref<NoiseKind>('rain')
const volume = ref(0.5)
const playing = ref(false)
const timerMin = ref(0) // 0 = 不定时
const remain = ref(0)

let handle: { stop: () => void; setVolume: (v: number) => void } | null = null
let timer: number | null = null

const play = () => {
  stopAll()
  handle = startNoise(kind.value, volume.value)
  playing.value = true
  if (timerMin.value > 0) {
    remain.value = timerMin.value * 60
    timer = window.setInterval(() => {
      remain.value--
      if (remain.value <= 0) stopAll()
    }, 1000)
  }
}

const stopAll = () => {
  handle?.stop()
  handle = null
  playing.value = false
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  remain.value = 0
}

const switchKind = (k: NoiseKind) => {
  kind.value = k
  if (playing.value) play()
}

const setVolume = () => {
  // 运行中实时调音量，不再重启（重启会打断氛围）
  handle?.setVolume(volume.value)
}

onBeforeUnmount(() => {
  stopAll()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="grid6">
        <button v-for="k in KINDS" :key="k.k" class="kind-btn" :class="{ active: kind === k.k }" @click="switchKind(k.k)">
          <span class="ic">{{ k.icon }}</span><span>{{ k.label }}</span>
        </button>
      </div>
      <div class="row wrap gap mt-2">
        <Volume2 :size="16" />
        <input type="range" min="0" max="1" step="0.05" v-model.number="volume" @change="setVolume" class="grow" />
        <Timer :size="16" />
        <select v-model.number="timerMin" class="input slim">
          <option :value="0">不限时</option>
          <option :value="15">15 分钟</option>
          <option :value="30">30 分钟</option>
          <option :value="60">60 分钟</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="playing ? stopAll() : play()">
          <Square v-if="playing" :size="15" /><Play v-else :size="15" /> {{ playing ? '停止' : '播放' }}
        </button>
      </div>
      <p v-if="playing && remain > 0" class="hint mt-1">⏳ 将在 {{ Math.floor(remain / 60) }}:{{ String(remain % 60).padStart(2, '0') }} 后自动停止</p>
      <p class="hint mt-1">声音由浏览器实时合成（无任何音频文件），无限时长不重复。播放期间请保持本页打开；音量变化会重启播放。</p>
    </div>
  </div>
</template>

<style scoped>
.grid6 { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.kind-btn { padding: 12px 8px; border-radius: 12px; border: 1px solid var(--border); background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; color: var(--text); }
.kind-btn.active { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.ic { font-size: 22px; }
.gap { gap: 12px; align-items: center; }
.grow { flex: 1; min-width: 120px; }
.slim { width: 110px; }
.hint { font-size: 12px; color: var(--muted); }
</style>
