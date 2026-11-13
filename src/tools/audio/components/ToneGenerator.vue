<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Play, Square, Radio } from 'lucide-vue-next'
import { getAudioCtx, closeAudioCtx, type WaveKind } from '@/lib/audioSynth'

const freq = ref(440)
const kind = ref<WaveKind>('sine')
const volume = ref(0.3)
const pan = ref<'both' | 'left' | 'right'>('both')
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

/** 本地发声链：osc → gain → StereoPanner → destination（需支持声道分置，lib startTone 不带声像） */
interface ToneHandle {
  setFreq: (f: number) => void
  setVolume: (v: number) => void
  setKind: (k: WaveKind) => void
  setPan: (p: number) => void
  /** 指数扫频：连续变频（ramp），duration 秒内从 from 到 to */
  sweep: (from: number, to: number, duration: number) => void
  stop: () => void
}
let handle: ToneHandle | null = null
let sweepTimer: number | null = null
let visualTimer: number | null = null

const PAN_VALUE = { both: 0, left: -1, right: 1 } as const

function startTonePanned(freq0: number, kind0: WaveKind, gain0: number, pan0: number): ToneHandle {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const panner = ctx.createStereoPanner()
  osc.type = kind0
  osc.frequency.value = freq0
  g.gain.value = gain0
  panner.pan.value = pan0
  osc.connect(g).connect(panner).connect(ctx.destination)
  osc.start()
  return {
    setFreq: (f) => osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.01),
    setVolume: (v) => g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.03),
    setKind: (k) => {
      osc.type = k
    },
    setPan: (p) => panner.pan.setTargetAtTime(p, ctx.currentTime, 0.02),
    sweep: (from, to, duration) => {
      const t0 = ctx.currentTime
      osc.frequency.cancelScheduledValues(t0)
      osc.frequency.setValueAtTime(from, t0)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration)
    },
    stop: () => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
      setTimeout(() => {
        try {
          osc.stop()
          osc.disconnect()
          g.disconnect()
          panner.disconnect()
        } catch {
          /* ignore */
        }
      }, 120)
    },
  }
}

// 播放中实时生效：波形/音量/声道即时切换，无需重开
watch(kind, (k) => handle?.setKind(k))
watch(volume, (v) => handle?.setVolume(v))
watch(pan, (p) => handle?.setPan(PAN_VALUE[p]))

const start = () => {
  stopAll()
  handle = startTonePanned(freq.value, kind.value, volume.value, PAN_VALUE[pan.value])
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
  if (visualTimer !== null) {
    clearInterval(visualTimer)
    visualTimer = null
  }
  sweeping.value = false
}

const setFreq = () => {
  if (playing.value && handle) handle.setFreq(Math.min(20000, Math.max(1, freq.value)))
}

/** 扫频：exponentialRampToValueAtTime 连续变频（无 50ms 步进台阶），界面数值单独刷新 */
const startSweep = () => {
  stopAll()
  const from = Math.max(20, sweepFrom.value)
  const to = Math.max(from * 1.01, Math.min(20000, sweepTo.value))
  const total = Math.max(2, sweepSec.value)
  handle = startTonePanned(from, kind.value, volume.value, PAN_VALUE[pan.value])
  playing.value = true
  sweeping.value = true
  handle.sweep(from, to, total)
  const ctx = getAudioCtx()
  const t0 = ctx.currentTime
  // 界面频率数值按时间推进（仅显示，不驱动真实频率）
  visualTimer = window.setInterval(() => {
    const p = Math.min(1, (ctx.currentTime - t0) / total)
    freq.value = Math.round(from * Math.pow(to / from, p))
    if (p >= 1) stopAll()
  }, 60)
}

const PRESETS = [
  { label: 'A4 440Hz（调音基准）', v: 440 },
  { label: '60Hz（低频下潜）', v: 60 },
  { label: '1kHz（中频参考）', v: 1000 },
  { label: '15kHz（高频极限）', v: 15000 },
]

/** 相对满量程的 dB 读数（0~1 线性音量） */
const dbLabel = computed(() => {
  if (volume.value <= 0) return '-∞ dB'
  return `${(20 * Math.log10(volume.value)).toFixed(1)} dB`
})

const PAN_CHIPS = [
  { k: 'both', t: '双声道' },
  { k: 'left', t: '仅左耳' },
  { k: 'right', t: '仅右耳' },
] as const

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
        <span class="db-tag" :title="'相对满量程 ' + dbLabel">{{ dbLabel }}</span>
      </div>
      <div class="row wrap gap mt-2">
        <span class="field-label">声道</span>
        <button
          v-for="p in PAN_CHIPS" :key="p.k" class="chip-btn" :class="{ active: pan === p.k }"
          :title="p.k === 'both' ? '双声道同声' : p.k === 'left' ? '仅左耳机出声' : '仅右耳机出声'"
          @click="pan = p.k"
        >
          {{ p.t }}
        </button>
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
      <p class="hint">dB 为相对满量程的读数；听力自测请先固定系统音量，再做横向比较。</p>
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
.db-tag { font-size: 12.5px; color: var(--text-3); font-variant-numeric: tabular-nums; min-width: 64px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn.active, .chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
