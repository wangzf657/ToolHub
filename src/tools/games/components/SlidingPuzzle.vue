<script setup lang="ts">
/**
 * 数字华容道（V1.2）：3×3 / 4×4 / 5×5；随机打乱保证可解（逆序奇偶校验，引擎保证）；
 * 步数 + 计时、Esc/失焦暂停、进度续玩；键盘（方向键 = 把该方向相邻块滑入空格）与点击皆可玩。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { applyMove, canMove, isSolved, shuffledBoard, solvedBoard, type SlidingBoard } from '@/lib/games/slidingPuzzle'
import { keyTargetBlocked } from '@/lib/games/keys'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const SAVE_KEY = 'toolhub.sliding.progress'

const n = ref(4)
const board = ref<SlidingBoard>(shuffledBoard(4))
const moves = ref(0)
const elapsed = ref(0)
const paused = ref(false)
const solved = ref(false)
let timerId = 0

const fmtTime = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function save() {
  if (solved.value) {
    localStorage.removeItem(SAVE_KEY)
    return
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, n: n.value, board: board.value, moves: moves.value, elapsed: elapsed.value }))
}
function restore(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const d = JSON.parse(raw) as { v: number; n: number; board: SlidingBoard; moves: number; elapsed: number }
    if (d.v !== 1 || ![3, 4, 5].includes(d.n) || !Array.isArray(d.board) || d.board.length !== d.n * d.n) return false
    if (isSolved(d.board)) return false
    n.value = d.n
    board.value = d.board
    moves.value = d.moves ?? 0
    elapsed.value = d.elapsed ?? 0
    return true
  } catch {
    return false
  }
}

function newGame() {
  board.value = shuffledBoard(n.value)
  moves.value = 0
  elapsed.value = 0
  solved.value = false
  paused.value = false
  save()
  toast.toast(`已生成 ${n.value}×${n.value} 新题（保证可解）`)
}

function onSizeChange() {
  newGame()
}

function move(i: number) {
  if (solved.value || paused.value) return
  if (!canMove(board.value, n.value, i)) return
  applyMove(board.value, n.value, i)
  moves.value++
  if (isSolved(board.value)) {
    solved.value = true
    stopTimer()
    save()
    toast.ok(`完成！共 ${moves.value} 步 · ${fmtTime.value}`)
  } else save()
}

/** 方向键语义：把该方向上与空格相邻的块滑入空格（ArrowUp = 空格下方那块上滑） */
function onKey(e: KeyboardEvent) {
  if (keyTargetBlocked(e)) return
  if (e.key === 'Escape') {
    if (!solved.value) paused.value = !paused.value
    e.preventDefault()
    return
  }
  if (e.key.toLowerCase() === 'r') {
    newGame()
    e.preventDefault()
    return
  }
  if (paused.value || solved.value) return
  const z = board.value.indexOf(0)
  const zx = z % n.value
  const zy = Math.floor(z / n.value)
  const target = (() => {
    switch (e.key) {
      case 'ArrowUp': return zy + 1 < n.value ? (zy + 1) * n.value + zx : -1
      case 'ArrowDown': return zy - 1 >= 0 ? (zy - 1) * n.value + zx : -1
      case 'ArrowLeft': return zx + 1 < n.value ? zy * n.value + zx + 1 : -1
      case 'ArrowRight': return zx - 1 >= 0 ? zy * n.value + zx - 1 : -1
      default: return -1
    }
  })()
  if (target >= 0) {
    e.preventDefault()
    move(target)
  }
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId)
    timerId = 0
  }
}

onMounted(() => {
  if (!restore()) newGame()
  else toast.toast(`已恢复上局进度（${moves.value} 步）`)
  timerId = window.setInterval(() => {
    if (!paused.value && !solved.value && moves.value > 0) elapsed.value++
  }, 1000)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', () => {
    if (!solved.value) paused.value = true
  })
})
onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <span class="field-label">阶数</span>
        <select v-model="n" class="input slim" @change="onSizeChange">
          <option :value="3">3×3（八数码）</option>
          <option :value="4">4×4（经典）</option>
          <option :value="5">5×5（挑战）</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="newGame"><RotateCcw :size="14" /> 重开</button>
      </div>
      <p class="hint mt-1">点击空格旁边的数字块滑动，或用方向键（把对应方向的块滑入空格）；按 1 到 n²-1 顺序排好即胜，打乱算法保证必有解。</p>
    </div>

    <div class="status-bar mt-2">
      <span class="stat">步数 <b class="mono">{{ moves }}</b></span>
      <span class="stat">用时 <b class="mono">{{ fmtTime }}</b></span>
      <span v-if="solved" class="stat ok">已完成 🎉</span>
    </div>

    <div class="stage mt-2">
      <div class="grid" :style="{ gridTemplateColumns: `repeat(${n}, 1fr)` }">
        <template v-for="(v, i) in board" :key="i">
          <button v-if="v" type="button" class="tile" :class="{ movable: canMove(board, n, i) }" @click="move(i)">{{ v }}</button>
          <div v-else class="blank" />
        </template>
      </div>
      <div v-if="paused && !solved" class="mask" @click="paused = false">已暂停 · 按 Esc 继续</div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 128px; }
.hint { font-size: 12px; color: var(--muted); }
.status-bar { display: flex; justify-content: center; gap: 18px; }
.stat { font-size: 13px; color: var(--muted); }
.stat.ok { color: var(--ok); font-weight: 700; }
.mono { color: var(--accent-text); font-variant-numeric: tabular-nums; }
.stage { position: relative; width: fit-content; margin: 0 auto; }
.grid {
  display: grid;
  gap: 6px;
  padding: 8px;
  width: min(400px, calc(100vw - 96px));
  aspect-ratio: 1;
  background: var(--accent-soft);
  border: 2px solid var(--border-strong);
  border-radius: 10px;
}
.tile {
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--panel-solid, #fff);
  color: var(--text);
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: default;
  transition: transform 0.06s ease;
}
.tile.movable { cursor: pointer; color: var(--accent-text); }
.tile.movable:hover { background: var(--accent-soft); }
.blank { border-radius: 8px; background: transparent; }
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
</style>
