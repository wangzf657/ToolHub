<script setup lang="ts">
/**
 * 贪吃蛇（V1.2）：Canvas 固定 tick 渲染（rAF + 步进累积器，60fps 无卡顿）；
 * 方向键/WASD（防页面滚动劫持）、速度三档、穿墙开关、计分 + 最高分持久化、Esc/失焦自动暂停。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { newSnake, tickSnake, turn, SNAKE_W, SNAKE_H, cellXY, type Dir, type SnakeState } from '@/lib/games/snake'
import { keyTargetBlocked } from '@/lib/games/keys'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const CELL = 20
const SPEEDS: { id: string; label: string; tps: number }[] = [
  { id: 'slow', label: '慢速', tps: 7 },
  { id: 'normal', label: '中速', tps: 11 },
  { id: 'fast', label: '快速', tps: 16 },
]
const BEST_KEY = 'toolhub.snake.best'

const speed = ref('normal')
const wrap = ref(false)
const score = ref(0)
const best = ref(Number(localStorage.getItem(BEST_KEY) ?? 0))
const phase = ref<'ready' | 'running' | 'paused' | 'dead'>('ready')

const canvasRef = ref<HTMLCanvasElement | null>(null)
let st: SnakeState = newSnake(false)
let rafId = 0
let lastTs = 0
let acc = 0

const speedTps = computed(() => SPEEDS.find((s) => s.id === speed.value)?.tps ?? 11)
const overlayText = computed(() =>
  phase.value === 'ready'
    ? '按方向键或点击开始'
    : phase.value === 'paused'
      ? '已暂停 · 按 Esc 继续'
      : phase.value === 'dead'
        ? `游戏结束 · 得分 ${score.value}（点击重开）`
        : '',
)

function reset() {
  st = newSnake(wrap.value)
  score.value = 0
  acc = 0
  phase.value = 'ready'
  draw()
}

function start() {
  if (phase.value === 'dead') reset()
  phase.value = 'running'
  lastTs = performance.now()
}

function pause() {
  if (phase.value === 'running') phase.value = 'paused'
}

/* ---------- 渲染 ---------- */
function draw() {
  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')!
  const css = getComputedStyle(document.documentElement)
  const accent = css.getPropertyValue('--accent').trim() || '#6366f1'
  const err = css.getPropertyValue('--err').trim() || '#f87171'
  const panel = css.getPropertyValue('--panel-solid').trim() || '#141d33'
  ctx.fillStyle = panel
  ctx.fillRect(0, 0, cv.width, cv.height)
  // 食物
  const [fx, fy] = cellXY(st.food)
  ctx.fillStyle = err
  ctx.beginPath()
  ctx.arc(fx * CELL + CELL / 2, fy * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2)
  ctx.fill()
  // 蛇身：头部实色，身体透明度递减
  st.snake.forEach((i, k) => {
    const [x, y] = cellXY(i)
    ctx.globalAlpha = k === 0 ? 1 : Math.max(0.35, 0.95 - k * 0.03)
    ctx.fillStyle = accent
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
    if (k === 0) {
      ctx.globalAlpha = 1
      ctx.fillStyle = panel
      ctx.fillRect(x * CELL + 5, y * CELL + 6, 3, 3)
      ctx.fillRect(x * CELL + CELL - 8, y * CELL + 6, 3, 3)
    }
  })
  ctx.globalAlpha = 1
}

function loop(ts: number) {
  rafId = requestAnimationFrame(loop)
  if (phase.value !== 'running') {
    lastTs = ts
    return
  }
  acc += ts - lastTs
  lastTs = ts
  const step = 1000 / speedTps.value
  let guard = 4
  while (acc >= step && guard-- > 0) {
    acc -= step
    const ev = tickSnake(st)
    if (ev === 'ate') score.value = st.score
    if (ev === 'died') {
      phase.value = 'dead'
      if (score.value > best.value) {
        best.value = score.value
        localStorage.setItem(BEST_KEY, String(best.value))
        toast.ok(`新纪录：${best.value} 分！`)
      } else toast.toast(`游戏结束，得分 ${score.value}`)
      break
    }
  }
  draw()
}

/* ---------- 输入 ---------- */
const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}
function onKey(e: KeyboardEvent) {
  if (keyTargetBlocked(e)) return
  if (e.key === 'Escape') {
    if (phase.value === 'running') pause()
    else if (phase.value === 'paused') start()
    e.preventDefault()
    return
  }
  if (e.key.toLowerCase() === 'r') {
    reset()
    e.preventDefault()
    return
  }
  const dir = KEY_DIR[e.key]
  if (!dir) return
  e.preventDefault()
  if (phase.value === 'ready' || phase.value === 'paused') {
    // 方向键启动：不允许直接反向启动（初始朝右）
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' } as const
    if (phase.value === 'ready' && opposite[dir] === st.dir) return
    start()
  }
  if (phase.value === 'running') turn(st, dir)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', pause)
  rafId = requestAnimationFrame(loop)
  reset()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur', pause)
})

function onCanvasClick() {
  if (phase.value === 'ready' || phase.value === 'paused') start()
  else if (phase.value === 'dead') reset()
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <span class="field-label">速度</span>
        <select v-model="speed" class="input slim" :disabled="phase === 'running'">
          <option v-for="s in SPEEDS" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
        <label class="chk"><input v-model="wrap" type="checkbox" :disabled="phase === 'running'" @change="reset" /> 穿墙模式</label>
        <button class="btn btn-primary btn-sm" @click="phase === 'running' ? pause() : start()">
          {{ phase === 'running' ? '暂停' : phase === 'paused' ? '继续' : phase === 'dead' ? '再来一局' : '开始' }}
        </button>
        <button class="btn btn-sm" @click="reset">重开（R）</button>
      </div>
      <p class="hint mt-1">方向键 / WASD 控制，Esc 暂停，R 重开；吃食物 +3 分，撞墙或咬到自己结束；页面失焦自动暂停。</p>
    </div>

    <div class="status-bar mt-2">
      <span class="stat">得分 <b class="mono">{{ score }}</b></span>
      <span class="stat">最高 <b class="mono">{{ best }}</b></span>
    </div>

    <div class="stage mt-2">
      <canvas ref="canvasRef" :width="SNAKE_W * CELL" :height="SNAKE_H * CELL" class="cv" @click="onCanvasClick" />
      <div v-if="phase !== 'running'" class="mask" @click="onCanvasClick">{{ overlayText }}</div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 96px; }
.chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }
.status-bar { display: flex; justify-content: center; gap: 18px; }
.stat { font-size: 13px; color: var(--muted); }
.mono { color: var(--accent-text); font-variant-numeric: tabular-nums; }
.stage { position: relative; width: fit-content; margin: 0 auto; }
.cv { max-width: 100%; border: 2px solid var(--border-strong); border-radius: 8px; display: block; }
.mask {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-solid, #141d33) 82%, transparent);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
}
</style>
