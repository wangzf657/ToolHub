<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Play, Trash2, RotateCw, Volume2, VolumeX } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const raw = ref('一等奖\n二等奖\n谢谢参与\n再接再厉\n鼓励奖\n幸运奖')
const removing = ref(true)
const soundOn = ref(true)
const spinning = ref(false)
const winner = ref('')
const history = ref<string[]>([])

const PRESETS: { label: string; items: string }[] = [
  { label: '今天吃什么', items: '火锅\n烧烤\n麻辣烫\n饺子\n拉面\n沙县小吃\n汉堡\n轻食沙拉' },
  { label: '课堂点名', items: '张三\n李四\n王五\n赵六\n钱七\n孙八' },
  { label: '年会奖项', items: '特等奖\n一等奖\n二等奖\n三等奖\n参与奖\n幸运奖' },
]

const items = computed(() => raw.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6']

const canvasRef = ref<HTMLCanvasElement | null>(null)

const draw = (angle: number) => {
  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')!
  const size = cv.width
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 6
  const list = items.value
  ctx.clearRect(0, 0, size, size)
  if (!list.length) {
    ctx.fillStyle = '#888'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('请在左侧输入名单', cx, cy)
    return
  }
  const seg = (Math.PI * 2) / list.length
  for (let i = 0; i < list.length; i++) {
    const a0 = angle + i * seg
    const a1 = a0 + seg
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, a0, a1)
    ctx.closePath()
    ctx.fillStyle = COLORS[i % COLORS.length]!
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.35)'
    ctx.lineWidth = 1
    ctx.stroke()
    // 文字
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(a0 + seg / 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    const name = list[i]!
    ctx.font = `${name.length > 6 ? 11 : 13}px sans-serif`
    ctx.fillText(name.length > 8 ? name.slice(0, 8) + '…' : name, r - 12, 5)
    ctx.restore()
  }
  // 外圈与中心
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(127,127,127,.4)'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.fillStyle = 'var(--accent, #6366f1)'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('开始', cx, cy)
  // 顶部指针
  ctx.beginPath()
  ctx.moveTo(cx - 12, 2)
  ctx.lineTo(cx + 12, 2)
  ctx.lineTo(cx, 26)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()
}

let angle = 0
const render = () => draw(angle)
watch(items, () => render(), { immediate: true })

let raf = 0
let audioCtx: AudioContext | null = null

const beep = (freq: number, dur = 0.05) => {
  if (!soundOn.value) return
  try {
    audioCtx ??= new AudioContext()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.frequency.value = freq
    o.type = 'square'
    g.gain.value = 0.06
    o.connect(g).connect(audioCtx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur)
    o.stop(audioCtx.currentTime + dur)
  } catch { /* 无声环境忽略 */ }
}

const spin = () => {
  const list = items.value
  if (spinning.value) return
  if (!list.length) return toast.warn('请先输入抽奖名单')
  spinning.value = true
  winner.value = ''
  const total = (Math.random() * 4 + 4) * Math.PI * 2 // 4~8 圈
  const start = angle
  const duration = 4200 + Math.random() * 800
  const t0 = performance.now()
  let lastSeg = -1
  const segSize = (Math.PI * 2) / list.length
  const tick = (t: number) => {
    const p = Math.min(1, (t - t0) / duration)
    // easeOutQuart 缓动
    const eased = 1 - Math.pow(1 - p, 4)
    angle = start + total * eased
    const curSeg = Math.floor(((-angle - Math.PI / 2 + Math.PI * 2 * 4) / segSize)) % list.length
    if (curSeg !== lastSeg) {
      lastSeg = curSeg
      if (p < 0.85) beep(880, 0.03)
    }
    render()
    if (p < 1) raf = requestAnimationFrame(tick)
    else {
      // 指针（正上方 -π/2）落在哪个扇区
      const norm = ((-angle - Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      const idx = Math.floor(norm / segSize) % list.length
      winner.value = list[idx] ?? ''
      history.value = [winner.value, ...history.value].slice(0, 10)
      spinning.value = false
      beep(1320, 0.25)
      if (removing.value && list.length > 1) {
        const next = [...list]
        next.splice(idx, 1)
        raw.value = next.join('\n')
      }
    }
  }
  raf = requestAnimationFrame(tick)
}

const resetHistory = () => {
  history.value = []
  winner.value = ''
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  audioCtx?.close().catch(() => {})
})
</script>

<template>
  <div class="wrap">
    <div class="left">
      <div class="opts-panel">
        <div class="chips mb-2">
          <button v-for="p in PRESETS" :key="p.label" class="chip-btn" @click="raw = p.items">{{ p.label }}</button>
        </div>
        <textarea v-model="raw" class="input area" rows="9" placeholder="每行一项，如：一等奖"></textarea>
        <div class="row wrap gap mt-2">
          <label class="check"><input v-model="removing" type="checkbox" /> 中奖后移除该项</label>
          <button class="icon-btn" :title="soundOn ? '关闭音效' : '开启音效'" @click="soundOn = !soundOn">
            <Volume2 v-if="soundOn" :size="16" /><VolumeX v-else :size="16" />
          </button>
          <span class="hint">共 {{ items.length }} 项</span>
        </div>
      </div>
    </div>

    <div class="right">
      <div class="wheel-box">
        <canvas ref="canvasRef" width="340" height="340" @click="spin" :class="{ live: !spinning }"></canvas>
      </div>
      <button class="btn btn-primary mt-2" :disabled="spinning" @click="spin">
        <Play v-if="!spinning" :size="16" /><RotateCw v-else :size="16" class="spin" /> {{ spinning ? '转动中…' : '开始抽奖' }}
      </button>
      <div v-if="winner" class="winner mt-2" @click="copyText(winner)">
        🎉 {{ winner }}
      </div>
      <div v-if="history.length" class="mt-2">
        <div class="row gap">
          <span class="field-label">中奖记录</span>
          <button class="mini-btn" @click="resetHistory"><Trash2 :size="13" /></button>
        </div>
        <p class="hist mono">{{ history.join('、') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: flex; gap: 20px; flex-wrap: wrap; }
.left { flex: 1 1 260px; min-width: 240px; }
.right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.area { width: 100%; resize: vertical; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.gap { gap: 10px; }
.wheel-box { width: 340px; max-width: 100%; }
canvas { width: 100%; height: auto; }
canvas.live { cursor: pointer; }
.winner { padding: 14px 30px; border: 2px solid var(--accent); border-radius: 12px; font-size: 22px; font-weight: 700; color: var(--accent-text); cursor: pointer; text-align: center; }
.mini-btn { border: 1px solid var(--border); background: transparent; border-radius: 6px; padding: 3px 6px; cursor: pointer; color: var(--muted); }
.hist { font-size: 13px; color: var(--muted); margin-top: 4px; max-width: 340px; }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.mb-2 { margin-bottom: 10px; }
</style>
