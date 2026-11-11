<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Play, Square, Radio } from 'lucide-vue-next'
import { startTone, closeAudioCtx, type WaveKind } from '@/lib/audioSynth'

const freq = ref(440)
const kind = ref<WaveKind>('sine')
const volume = ref(0.3)
const playing = ref(false)

// 扫频状态
const sweepFrom = ref(20)
const sweepTo = ref(20000)
const sweepSec = ref(10)
const sweeping = ref(false)

const WAVES: { k: WaveKind; label: string }[] = [
  { k: 'sine', label: '正弦波' },
  { k: 'square', label: '方波' },
  { k: 'triangle', label: '三角波' },
  { k: 'sawtooth', label: '锯齿波' },
]

let handle: { stop: () => void; setFreq: (f: number) => void; setVolume: (v: number) => void; setKind: (k: WaveKind) => void } | null = null

// 播放中实时生效：波形/音量即时切换，无需重开
watch(kind, (k) => handle?.setKind(k))
watch(volume, (v) => handle?.setVolume(v))
let sweepTimer: number | null = null

const start = () => {
  stopAll()
  handle = startTone(freq.value, kind.value, volume.value)
  playing.value = true
}

const stopAll = () => {
  handle?.stop()
  handle = null
  playing.value = false
  if (sweepTimer !== null) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
  sweeping.value = false
}

const setFreq = () => {
  if (playing.value && handle) handle.setFreq(Math.min(20000, Math.max(1, freq.value)))
}

const startSweep = () => {
  stopAll()
  const from = Math.max(20, sweepFrom.value)
  const to = Math.min(20000, sweepTo.value)
  const total = Math.max(2, sweepSec.value) * 1000
  handle = startTone(from, kind.value, volume.value)
  playing.value = true
  sweeping.value = true
  const t0 = performance.now()
  sweepTimer = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / total)
    // 对数扫频更贴近听感
    const f = from * Math.pow(to / from, p)
    handle?.setFreq(f)
    freq.value = Math.round(f)
    if (p >= 1) stopAll()
  }, 50)
}

const PRESETS = [
  { label: 'A4 440Hz（调音基准）', v: 440 },
  { label: '60Hz（低频下潜）', v: 60 },
  { label: '1kHz（中频参考）', v: 1000 },
  { label: '15kHz（高频极限）', v: 15000 },
]

onBeforeUnmount(() => {
  stopAll()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="freq-line">
        <span class="freq-val">{{ freq }}</span>
        <span class="field-label">Hz</span>
      </div>
      <input v-model.number="freq" type="range" min="20" max="20000" step="1" class="range" @input="setFreq" />
      <div class="row wrap gap mt-2">
        <label class="check"><input v-model="kind" type="radio" value="sine" /> 正弦</label>
        <label class="check"><input v-model="kind" type="radio" value="square" /> 方波</label>
        <label class="check"><input v-model="kind" type="radio" value="triangle" /> 三角</label>
        <label class="check"><input v-model="kind" type="radio" value="sawtooth" /> 锯齿</label>
        <span class="field-label">音量</span>
        <input type="range" min="0" max="1" step="0.05" v-model.number="volume" class="slim-vol" />
      </div>
      <div class="row wrap gap mt-2">
        <button class="btn btn-primary" @click="playing ? stopAll() : start()">
          <Square v-if="playing" :size="16" /><Play v-else :size="16" /> {{ playing ? '停止' : '播放定频' }}
        </button>
        <span class="field-label">扫频</span>
        <input v-model.number="sweepFrom" type="number" class="input n-input" /> →
        <input v-model.number="sweepTo" type="number" class="input n-input" />
        <input v-model.number="sweepSec" type="number" class="input n-input" title="秒" /> 秒
        <button class="btn btn-sm" :disabled="sweeping" @click="startSweep"><Radio :size="14" /> {{ sweeping ? '扫频中…' : '开始扫频' }}</button>
      </div>
      <div class="chips mt-2">
        <button v-for="p in PRESETS" :key="p.v" class="chip-btn" @click="freq = p.v; playing && setFreq()">{{ p.label }}</button>
      </div>
      <p class="hint mt-1">⚠ 请先把系统音量调低再播放，方波/锯齿波含大量高频谐波，大音量可能损伤听力。高频（>15kHz）部分设备扬声器无法发声属正常。</p>
    </div>
  </div>
</template>

<style scoped>
.freq-line { display: flex; align-items: baseline; gap: 8px; justify-content: center; }
.freq-val { font-size: 42px; font-weight: 800; color: var(--accent-text); }
.range { width: 100%; max-width: 460px; display: block; margin: 0 auto; }
.gap { gap: 10px; align-items: center; }
.n-input { width: 84px; }
.slim-vol { width: 110px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
