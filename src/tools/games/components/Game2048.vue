<script setup lang="ts">
/**
 * 2048（V1.2）：方向键合并（防页面滚动劫持）、撤销一步、最高分与进度持久化、
 * 2048 达成内联庆祝（无弹窗）、终局遮罩；Esc/失焦暂停遮罩（摸鱼公约）。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Undo2, RotateCcw } from 'lucide-vue-next'
import { isGameOver2048, move2048, newBoard2048, spawnTile, type Board2048, type Dir2048 } from '@/lib/games/g2048'
import { keyTargetBlocked } from '@/lib/games/keys'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const SAVE_KEY = 'toolhub.g2048.progress'
const BEST_KEY = 'toolhub.g2048.best'

const board = ref<Board2048>(newBoard2048())
const score = ref(0)
const best = ref(Number(localStorage.getItem(BEST_KEY) ?? 0))
const won = ref(false) // 已达成 2048（可继续）
const over = ref(false)
const paused = ref(false)
const canUndo = ref(false)
let lastSnap: { board: Board2048; score: number } | null = null

const fmt = (n: number) => n.toLocaleString('zh-CN')

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ board: board.value, score: score.value, won: won.value, over: over.value }))
}
function restore(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const d = JSON.parse(raw) as { board: Board2048; score: number; won: boolean; over: boolean }
    if (!Array.isArray(d.board) || d.board.length !== 16) return false
    board.value = d.board
    score.value = d.score ?? 0
    won.value = !!d.won
    over.value = !!d.over
    canUndo.value = false
    return !over.value
  } catch {
    return false
  }
}

function newGame() {
  board.value = newBoard2048()
  score.value = 0
  won.value = false
  over.value = false
  paused.value = false
  canUndo.value = false
  lastSnap = null
  save()
}

function doMove(dir: Dir2048) {
  if (over.value || paused.value) return
  const r = move2048(board.value, dir)
  if (!r.moved) return
  lastSnap = { board: [...board.value], score: score.value }
  board.value = spawnTile(r.board)
  score.value += r.gained
  canUndo.value = true
  if (score.value > best.value) {
    best.value = score.value
    localStorage.setItem(BEST_KEY, String(best.value))
  }
  if (!won.value && board.value.some((v) => v >= 2048)) {
    won.value = true
    toast.ok('达成 2048！可以继续挑战更大数字')
  }
  if (isGameOver2048(board.value)) {
    over.value = true
    toast.toast(`无可移动方向，本局 ${score.value} 分`)
  }
  save()
}

function undo() {
  if (!canUndo.value || !lastSnap || over.value) return toast.warn('只能撤销最近一步')
  board.value = lastSnap.board
  score.value = lastSnap.score
  canUndo.value = false
  lastSnap = null
  save()
}

const KEY_DIR: Record<string, Dir2048> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}
function onBlur() {
  if (!over.value) paused.value = true
}
function onKey(e: KeyboardEvent) {
  if (keyTargetBlocked(e)) return
  if (e.key === 'Escape') {
    if (!over.value) paused.value = !paused.value
    e.preventDefault()
    return
  }
  if (e.key.toLowerCase() === 'r') {
    newGame()
    e.preventDefault()
    return
  }
  const dir = KEY_DIR[e.key]
  if (!dir) return
  e.preventDefault()
  doMove(dir)
}

onMounted(() => {
  if (!restore()) newGame()
  else toast.toast('已恢复上局进度')
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur', onBlur)
})

/** 低饱和瓦片配色（数值越大越饱和，2048 紫色点题） */
const tileStyle = (v: number) => {
  const palette: Record<number, string> = {
    2: '#e8eaf2', 4: '#dde1f0', 8: '#c5c9ea', 16: '#aeb5e3', 32: '#97a0dc',
    64: '#8189d4', 128: '#6f76c9', 256: '#5d64be', 512: '#4c53b3', 1024: '#3f45a0', 2048: '#8f5fe8',
  }
  const bg = palette[v] ?? '#33407a'
  const dark = v >= 8
  return { background: bg, color: dark ? '#f4f5fb' : '#3a3f5c', fontSize: v >= 1024 ? '20px' : v >= 128 ? '24px' : '28px' }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <button class="btn btn-primary btn-sm" @click="newGame"><RotateCcw :size="14" /> 新一局</button>
        <button class="btn btn-sm" :disabled="!canUndo || over" @click="undo"><Undo2 :size="14" /> 撤销一步</button>
      </div>
      <p class="hint mt-1">方向键 / WASD 合并相同数字，Esc 暂停，R 重开；得分与进度自动保存，刷新后可续玩。</p>
    </div>

    <div class="status-bar mt-2">
      <span class="stat">得分 <b class="mono">{{ fmt(score) }}</b></span>
      <span class="stat">最高 <b class="mono">{{ fmt(best) }}</b></span>
      <span v-if="won" class="stat ok">已达成 2048 🎉</span>
    </div>

    <div class="stage mt-2">
      <div class="grid">
        <div v-for="(v, i) in board" :key="i" class="tile" :style="v ? tileStyle(v) : undefined">{{ v || '' }}</div>
      </div>
      <div v-if="paused && !over" class="mask" @click="paused = false">已暂停 · 按 Esc 继续</div>
      <div v-if="over" class="mask">
        <div class="mask-inner">
          <p>游戏结束 · {{ fmt(score) }} 分</p>
          <button class="btn btn-primary btn-sm" @click="newGame">再来一局（R）</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.hint { font-size: 12px; color: var(--muted); }
.status-bar { display: flex; justify-content: center; gap: 18px; }
.stat { font-size: 13px; color: var(--muted); }
.stat.ok { color: var(--ok); font-weight: 600; }
.mono { color: var(--accent-text); font-variant-numeric: tabular-nums; }
.stage { position: relative; width: fit-content; margin: 0 auto; }
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px;
  width: min(440px, calc(100vw - 96px));
  aspect-ratio: 1;
  background: var(--accent-soft);
  border: 2px solid var(--border-strong);
  border-radius: 10px;
}
.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  transition: background 0.08s ease;
  background: var(--panel-solid, #fff);
}
.mask {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid, #141d33) 82%, transparent);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.mask-inner { text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; }
</style>
