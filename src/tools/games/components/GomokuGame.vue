<script setup lang="ts">
/**
 * 五子棋（V1.2）：15×15 无禁手（长连亦胜）；人机三档（AI 在 Web Worker 中 α-β 搜索，主线程零阻塞）
 * + 双人同屏；悔棋（人机一次回撤一回合）、最后一手标记、五连连线高亮；无音效（摸鱼公约）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Undo2, RotateCcw, Loader2 } from 'lucide-vue-next'
import { GOMOKU_SIZE, winLine } from '@/lib/games/gomoku'
import { gomokuBestMove, type GomokuLevel } from '@/lib/games/gomokuAI'
import { useToast } from '@/composables/useToast'

const toast = useToast()

type Player = 1 | 2
const mode = ref<'ai' | 'pvp'>('ai')
const aiLevel = ref<GomokuLevel>('medium')
const humanSide = ref<Player>(1)

const board = ref<number[]>(Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0))
const turn = ref<Player>(1)
const history = ref<number[]>([])
const winner = ref<0 | 1 | 2>(0)
const winCells = ref<Set<number>>(new Set())
const thinking = ref(false)

const NAMES: Record<Player, string> = { 1: '黑棋', 2: '白棋' }

const over = computed(() => winner.value !== 0 || history.value.length === GOMOKU_SIZE * GOMOKU_SIZE)
const statusText = computed(() => {
  if (winner.value) {
    const w = winner.value as Player
    return mode.value === 'ai' ? (w === humanSide.value ? '你赢了！' : `AI（${NAMES[w]}）获胜。`) : `${NAMES[w]}获胜！`
  }
  if (history.value.length === GOMOKU_SIZE * GOMOKU_SIZE) return '棋盘已满，平局。'
  if (mode.value === 'ai') {
    if (thinking.value) return `AI（${NAMES[turn.value as Player]}）思考中…`
    return turn.value === humanSide.value ? `轮到你（${NAMES[turn.value as Player]}）` : `等待 AI（${NAMES[turn.value as Player]}）`
  }
  return `${NAMES[turn.value]}落子`
})

/* ---------- Worker（懒创建，超时/失败回退主线程） ---------- */
let worker: Worker | null = null
let reqSeq = 0
const pending = new Map<number, (move: number) => void>()
function ensureWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('../../../lib/games/gomokuWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; move: number }>) => {
      const done = pending.get(e.data.id)
      pending.delete(e.data.id)
      done?.(e.data.move)
    }
    worker.onerror = () => {
      worker?.terminate()
      worker = null
    }
    return worker
  } catch {
    return null
  }
}

/** AI 走子：Worker 优先，不可用回退主线程小预算同步搜索 */
function askAI(me: Player): Promise<number> {
  const w = ensureWorker()
  const snapshot = [...board.value]
  if (!w) {
    return Promise.resolve(gomokuBestMove(Int8Array.from(snapshot), me, { level: aiLevel.value, budgetMs: 400 }))
  }
  return new Promise((resolve) => {
    const id = ++reqSeq
    const timer = window.setTimeout(() => {
      if (pending.delete(id)) resolve(gomokuBestMove(Int8Array.from(snapshot), me, { level: aiLevel.value, budgetMs: 300 }))
    }, 1500)
    pending.set(id, (move) => {
      window.clearTimeout(timer)
      resolve(move)
    })
    w.postMessage({ id, board: snapshot, me, level: aiLevel.value })
  })
}

/* ---------- 对局 ---------- */
/** 落子（thinking 守卫由调用方负责：人落子入口 onCellClick 已挡，AI 内部落子不挡自己） */
function place(i: number) {
  if (over.value || board.value[i]) return
  board.value[i] = turn.value
  history.value.push(i)
  const line = winLine(Int8Array.from(board.value), i)
  if (line) {
    winner.value = turn.value
    winCells.value = new Set(line)
    toast.ok(`${NAMES[turn.value as Player]}五连获胜！`)
  } else {
    turn.value = turn.value === 1 ? 2 : 1
  }
}

async function onCellClick(i: number) {
  if (over.value || thinking.value || board.value[i]) return
  if (mode.value === 'ai' && turn.value !== humanSide.value) return
  place(i)
  if (mode.value === 'ai' && !over.value) void aiTurn()
}

async function aiTurn() {
  thinking.value = true
  try {
    const mv = await askAI(turn.value as Player)
    if (!over.value && mode.value === 'ai' && turn.value !== humanSide.value) place(mv)
  } finally {
    thinking.value = false
  }
}

function newGame() {
  board.value = Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0)
  turn.value = 1
  history.value = []
  winner.value = 0
  winCells.value = new Set()
  thinking.value = false
  if (mode.value === 'ai' && humanSide.value === 2) void aiTurn()
}

function undo() {
  if (thinking.value) return
  if (!history.value.length) return toast.warn('还没有落子')
  // 人机：回撤到轮到人类（通常一回合两手；人执白首手是 AI 单手）
  const steps = mode.value === 'ai' ? (turn.value === humanSide.value && history.value.length >= 2 ? 2 : 1) : 1
  for (let s = 0; s < steps && history.value.length; s++) {
    const last = history.value.pop()!
    board.value[last] = 0
    turn.value = turn.value === 1 ? 2 : 1
  }
  winner.value = 0
  winCells.value = new Set()
}

onMounted(() => {
  if (mode.value === 'ai' && humanSide.value === 2) void aiTurn()
})
onBeforeUnmount(() => {
  worker?.terminate()
  worker = null
})

const cellCls = (i: number) => ({
  b: board.value[i] === 1,
  w: board.value[i] === 2,
  last: history.value.length > 0 && history.value[history.value.length - 1] === i,
  win: winCells.value.has(i),
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <span class="field-label">模式</span>
        <select v-model="mode" class="input slim" @change="newGame">
          <option value="ai">人机对战</option>
          <option value="pvp">双人同屏</option>
        </select>
        <template v-if="mode === 'ai'">
          <span class="field-label">难度</span>
          <select v-model="aiLevel" class="input slim">
            <option value="easy">入门</option>
            <option value="medium">中级</option>
            <option value="hard">困难</option>
          </select>
          <span class="field-label">我执</span>
          <select v-model="humanSide" class="input slim2" @change="newGame">
            <option :value="1">黑（先手）</option>
            <option :value="2">白（后手）</option>
          </select>
        </template>
        <button class="btn btn-sm" :disabled="!history.length || thinking" @click="undo"><Undo2 :size="14" /> 悔棋</button>
        <button class="btn btn-primary btn-sm" @click="newGame"><RotateCcw :size="14" /> 重开</button>
      </div>
      <p class="hint mt-1">无禁手规则（长连亦胜），先连成五子者胜；困难档 AI 为 α-β 深度搜索，在后台线程计算，页面不卡顿。</p>
    </div>

    <div class="status-bar mt-2">
      <span class="stat">
        <Loader2 v-if="thinking" :size="14" class="spin" style="vertical-align: -2px" /> {{ statusText }}
      </span>
      <span class="stat muted">第 {{ history.length }} 手</span>
    </div>

    <div class="board-wrap mt-2">
      <div class="board" :class="{ locked: over || thinking || (mode === 'ai' && turn !== humanSide) }">
        <button
          v-for="i in GOMOKU_SIZE * GOMOKU_SIZE"
          :key="i - 1"
          type="button"
          class="cell"
          :class="cellCls(i - 1)"
          :aria-label="`第 ${i - 1} 格`"
          @click="onCellClick(i - 1)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 104px; }
.slim2 { width: 122px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.hint { font-size: 12px; color: var(--muted); }
.status-bar { display: flex; justify-content: center; gap: 14px; }
.stat { font-size: 13px; color: var(--muted); font-weight: 600; }
.board-wrap { display: flex; justify-content: center; }
.board {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  width: min(462px, calc(100vw - 96px));
  aspect-ratio: 1;
  background: var(--panel-solid, #fff);
  border: 2px solid var(--border-strong);
  border-radius: 8px;
  overflow: hidden;
}
.board.locked .cell { cursor: default; }
.cell {
  position: relative;
  border: 1px solid var(--border);
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.cell:not(.b):not(.w):hover { background: var(--accent-soft); }
.cell.b::after,
.cell.w::after {
  content: '';
  position: absolute;
  inset: 12%;
  border-radius: 50%;
}
.cell.b::after { background: #1f2937; }
.cell.w::after { background: #f8fafc; border: 1px solid rgba(148, 163, 205, 0.6); }
.cell.last::before {
  content: '';
  position: absolute;
  inset: 35%;
  border-radius: 50%;
  background: var(--warn, #fbbf24);
  z-index: 1;
}
.cell.win { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
</style>
