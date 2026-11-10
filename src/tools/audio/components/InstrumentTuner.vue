<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Mic, Square } from 'lucide-vue-next'
import { startMic, detectPitch, freqToNote, closeAudioCtx, type MicHandle } from '@/lib/audioSynth'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const running = ref(false)
const freq = ref(0)
const clarity = ref(0)
const noteName = ref('—')
const cents = ref(0)
const needle = ref(-50) // -50 ~ +50
const errText = ref('')

const TUNINGS: { label: string; notes: { name: string; freq: number }[] }[] = [
  {
    label: '吉他标准 EADGBE',
    notes: [
      { name: 'E2', freq: 82.41 }, { name: 'A2', freq: 110 }, { name: 'D3', freq: 146.83 },
      { name: 'G3', freq: 196 }, { name: 'B3', freq: 246.94 }, { name: 'E4', freq: 329.63 },
    ],
  },
  {
    label: '尤克里里 GCEA',
    notes: [
      { name: 'G4', freq: 392 }, { name: 'C4', freq: 261.63 }, { name: 'E4', freq: 329.63 }, { name: 'A4', freq: 440 },
    ],
  },
  {
    label: '贝斯 EADG',
    notes: [
      { name: 'E1', freq: 41.2 }, { name: 'A1', freq: 55 }, { name: 'D2', freq: 73.42 }, { name: 'G2', freq: 98 },
    ],
  },
]

let mic: MicHandle | null = null

const start = async () => {
  errText.value = ''
  try {
    mic = await startMic((buf, sr) => {
      const r = detectPitch(buf, sr)
      freq.value = r.freq
      clarity.value = r.clarity
      if (r.freq > 0 && r.clarity > 0.6) {
        const n = freqToNote(r.freq)
        noteName.value = `${n.name}${n.octave}`
        cents.value = Math.max(-50, Math.min(50, n.cents))
        needle.value = cents.value
      } else {
        noteName.value = '—'
        needle.value = -50
      }
    })
    running.value = true
    toast.ok('麦克风已开启，请靠近乐器拨弦')
  } catch (e) {
    errText.value = (e as Error).name === 'NotAllowedError' ? '麦克风授权被拒绝，请在浏览器地址栏允许后重试' : `无法访问麦克风：${(e as Error).message}`
    toast.err(errText.value)
  }
}

const stop = () => {
  mic?.stop()
  mic = null
  running.value = false
  freq.value = 0
  noteName.value = '—'
  needle.value = -50
}

onBeforeUnmount(() => {
  stop()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="gauge">
        <div class="ticks">
          <span v-for="v in [-50, -25, 0, 25, 50]" :key="v" class="tick" :style="{ left: `${((v + 50) / 100) * 100}%` }">{{ v > 0 ? '+' + v : v }}</span>
        </div>
        <div class="track"></div>
        <div class="pointer" :style="{ left: `calc(${((needle + 50) / 100) * 100}% - 2px)` }"></div>
        <div class="center-mark"></div>
      </div>
      <div class="readout">
        <span class="big" :class="{ inTune: running && Math.abs(needle) <= 5 && clarity > 0.6 }">{{ noteName }}</span>
        <span class="sub">{{ running ? (freq > 0 ? `${freq.toFixed(1)} Hz · 偏差 ${cents > 0 ? '+' : ''}${cents} 音分` : '未检测到音高，请拨弦') : '麦克风未开启' }}</span>
      </div>
      <div class="row center mt-2">
        <button class="btn btn-primary" @click="running ? stop() : start()">
          <Square v-if="running" :size="16" /><Mic v-else :size="16" /> {{ running ? '停止' : '开启麦克风' }}
        </button>
      </div>
      <div v-if="running" class="targets mt-2">
        <div v-for="t in TUNINGS" :key="t.label" class="tune-row">
          <span class="field-label">{{ t.label }}</span>
          <div class="chips">
            <span v-for="n in t.notes" :key="n.name" class="tune-chip" :class="{ hit: noteName === n.name || (noteName !== '—' && Math.abs(1200 * Math.log2(freq / n.freq)) < 8) }">
              {{ n.name }}
            </span>
          </div>
        </div>
      </div>
      <p v-if="errText" class="hint warn mt-2">{{ errText }}</p>
      <p class="hint mt-2">口径：自相关法（NSDF）测音高，A4=440Hz 基准；「偏差 ±5 音分以内」视为调准（变绿）。调音时环境越安静越准。</p>
    </div>
  </div>
</template>

<style scoped>
.gauge { position: relative; height: 64px; margin: 20px 30px 6px; }
.ticks { position: relative; height: 16px; }
.tick { position: absolute; transform: translateX(-50%); font-size: 11px; color: var(--muted); }
.track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--err), #f59e0b, var(--ok), #f59e0b, var(--err)); opacity: .85; }
.pointer { position: absolute; top: 22px; width: 4px; height: 34px; background: var(--text); border-radius: 2px; transition: left .08s; }
.center-mark { position: absolute; top: 0; left: 50%; width: 2px; height: 64px; background: var(--ok); opacity: .4; }
.readout { text-align: center; }
.big { font-size: 44px; font-weight: 800; color: var(--muted); }
.big.inTune { color: var(--ok); }
.sub { display: block; font-size: 13px; color: var(--muted); }
.row.center { justify-content: center; }
.targets { max-width: 520px; margin: 0 auto; }
.tune-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.tune-chip { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); font-size: 13px; color: var(--muted); }
.tune-chip.hit { background: var(--ok); color: #fff; border-color: var(--ok); font-weight: 700; }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
.hint.warn { color: var(--warn); }
</style>
