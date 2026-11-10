<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Mic, Square } from 'lucide-vue-next'
import { startMic, type MicHandle } from '@/lib/audioSynth'
import { rmsOf, toDb } from '@/lib/audioExt'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const running = ref(false)
const db = ref(0)
const peak = ref(0)
const min = ref(120)
const offset = ref(0)
const errText = ref('')
const canvasRef = ref<HTMLCanvasElement | null>(null)

let mic: MicHandle | null = null
let raf = 0
const history: number[] = []

const start = async () => {
  errText.value = ''
  try {
    mic = await startMic((buf) => {
      const v = Math.round(toDb(rmsOf(buf), offset.value))
      db.value = v
      if (v > peak.value) peak.value = v
      if (v > -99 && v < min.value) min.value = v
      history.push(v)
      if (history.length > 180) history.shift()
      draw()
    })
    running.value = true
    toast.ok('麦克风已开启，正在测量环境噪音')
  } catch (e) {
    errText.value = (e as Error).name === 'NotAllowedError' ? '麦克风授权被拒绝，请在浏览器地址栏允许后重试' : `无法访问麦克风：${(e as Error).message}`
    toast.err(errText.value)
  }
}

const draw = () => {
  const cv = canvasRef.value
  if (!cv) return
  const g = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  g.clearRect(0, 0, W, H)
  // 网格
  g.strokeStyle = 'rgba(127,127,127,.18)'
  g.lineWidth = 1
  for (let d = 0; d <= 120; d += 20) {
    const y = H - (d / 120) * H
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  // 曲线
  g.strokeStyle = db.value > 85 ? '#ef4444' : db.value > 60 ? '#f59e0b' : '#10b981'
  g.lineWidth = 2
  g.beginPath()
  history.forEach((v, i) => {
    const x = (i / 180) * W
    const y = H - (Math.max(0, Math.min(120, v)) / 120) * H
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
  })
  g.stroke()
}

const stop = () => {
  mic?.stop()
  mic = null
  running.value = false
  cancelAnimationFrame(raf)
  db.value = 0
  peak.value = 0
  min.value = 120
  history.length = 0
}

const levelLabel = (v: number): string => {
  if (v < 30) return '安静（图书馆级）'
  if (v < 50) return '正常（办公室级）'
  if (v < 70) return '吵闹（街道级）'
  if (v < 85) return '很吵（地铁/车间级）'
  return '过响（长期暴露伤听力）'
}

onBeforeUnmount(() => stop())
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="dial">
        <span class="db-val" :class="{ loud: db > 85, noisy: db > 60 && db <= 85 }">{{ running ? db : '—' }}</span>
        <span class="db-unit">dB（估算声级）</span>
        <span class="db-label">{{ running ? levelLabel(db) : '麦克风未开启' }}</span>
      </div>
      <canvas ref="canvasRef" width="640" height="160" class="chart mt-2"></canvas>
      <div class="row wrap gap mt-2">
        <button class="btn btn-primary" @click="running ? stop() : start()">
          <Square v-if="running" :size="16" /><Mic v-else :size="16" /> {{ running ? '停止' : '开启麦克风' }}
        </button>
        <span class="field-label">校准偏移</span>
        <input v-model.number="offset" type="range" min="-20" max="20" step="1" style="width: 140px" />
        <span class="hint">{{ offset > 0 ? '+' : '' }}{{ offset }} dB</span>
        <span class="spacer"></span>
        <span class="stat-chip">峰值 {{ peak }}</span>
        <span class="stat-chip">最低 {{ min > 119 ? '—' : min }}</span>
      </div>
      <p v-if="errText" class="hint warn mt-2">{{ errText }}</p>
      <p class="hint mt-1">口径：按麦克风 RMS 换算的估算声级（满量程映射到 100dB），手机与电脑麦克风差异较大，仅供娱乐参考，不能替代专业分贝仪。</p>
    </div>
  </div>
</template>

<style scoped>
.dial { text-align: center; }
.db-val { font-size: 64px; font-weight: 800; color: var(--ok); }
.db-val.noisy { color: #f59e0b; }
.db-val.loud { color: var(--err); }
.db-unit { display: block; color: var(--muted); font-size: 13px; }
.db-label { display: block; margin-top: 4px; font-size: 14px; }
.chart { width: 100%; max-width: 640px; display: block; margin: 0 auto; border: 1px solid var(--border); border-radius: 10px; }
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.stat-chip { padding: 3px 12px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.hint { font-size: 12px; color: var(--muted); }
.hint.warn { color: var(--warn); }
</style>
