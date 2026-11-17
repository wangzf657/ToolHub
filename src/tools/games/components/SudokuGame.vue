<script setup lang="ts">
/**
 * 数独游戏（V1.2 旗舰，自 utility/SudokuSolver 升级迁移，slug/URL 不变）：
 * 4 阶 + 9 阶三档唯一解出题（异步预算 + 诚实降级标注）、铅笔笔记、错误检查开关、行列宫/同数字高亮、
 * 计时（可暂停可隐藏）、撤销、提示一步、直接解出、Word 打印、进度续玩、Esc 暂停、手输求解保留。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshCw, Lightbulb, Loader2, Pencil, Undo2, Printer, RotateCcw, Eye, EyeOff } from 'lucide-vue-next'
import SudokuBoard from './SudokuBoard.vue'
import {
  generateSudokuAsync,
  solveSudoku,
  sudokuConflicts,
  type SudokuGrid,
  type SudokuLevel,
} from '@/lib/games/sudoku'
import { sudokuPuzzlesToDocx } from '@/lib/games/sudokuDocx'
import { keyTargetBlocked } from '@/lib/games/keys'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const LEVELS: { id: SudokuLevel; label: string }[] = [
  { id: 'x4', label: '4 阶' },
  { id: 'easy', label: '9 阶 · 简单' },
  { id: 'medium', label: '9 阶 · 中级' },
  { id: 'hard', label: '9 阶 · 高级' },
]
const levelLabel = (l: SudokuLevel) => LEVELS.find((x) => x.id === l)?.label ?? ''

const SAVE_KEY = 'toolhub.sudoku.progress'
const size = ref(9)
const level = ref<SudokuLevel>('easy')
const givens = ref<SudokuGrid>(Array(81).fill(0))
const grid = ref<SudokuGrid>(Array(81).fill(0))
const notes = ref<number[][]>(Array.from({ length: 81 }, () => []))
const solution = ref<SudokuGrid | null>(null)
const selected = ref<number | null>(null)
const pencil = ref(false)
const checkOn = ref(true)
const busy = ref(false)
const done = ref(false)
const paused = ref(false)
const hideTimer = ref(false)
const elapsed = ref(0)
const hintCount = ref(0)
const undoStack = ref<{ grid: SudokuGrid; notes: number[][] }[]>([])
const genNote = ref('')

/** 手输求解模式：无题面且无解（清空后自填） */
const handMode = computed(() => givens.value.every((v) => !v) && !solution.value)

const conflicts = computed(() => sudokuConflicts(grid.value, size.value))
const wrong = computed(() => {
  const out = new Set<number>()
  if (!checkOn.value || !solution.value) return out
  grid.value.forEach((v, i) => {
    if (v && v !== solution.value![i]) out.add(i)
  })
  return out
})

const fmtTime = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

/* ---------- 存档 ---------- */
function save() {
  if (handMode.value) {
    localStorage.removeItem(SAVE_KEY)
    return
  }
  const data = {
    v: 2,
    level: level.value,
    givens: givens.value,
    grid: grid.value,
    notes: notes.value,
    solution: solution.value,
    elapsed: elapsed.value,
    hints: hintCount.value,
    done: done.value,
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}
/** 存档结构（v2） */
interface SudokuSave {
  v: number
  level: SudokuLevel
  givens: SudokuGrid
  grid: SudokuGrid
  notes: number[][]
  solution: SudokuGrid | null
  elapsed: number
  hints: number
  done: boolean
}

function restore(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const d = JSON.parse(raw) as SudokuSave
    if (d.v !== 2 || !Array.isArray(d.givens) || !d.givens.some((v: number) => v)) return false
    if (!Array.isArray(d.grid) || d.grid.length !== d.givens.length) return false
    level.value = d.level
    size.value = d.level === 'x4' ? 4 : 9
    givens.value = d.givens
    grid.value = d.grid
    notes.value = Array.isArray(d.notes) && d.notes.length === d.givens.length ? d.notes : d.givens.map(() => [])
    solution.value = d.solution
    elapsed.value = d.elapsed ?? 0
    hintCount.value = d.hints ?? 0
    done.value = !!d.done
    return true
  } catch {
    return false
  }
}

/* ---------- 出题 ---------- */
async function newGame() {
  if (busy.value) return
  busy.value = true
  genNote.value = '正在生成唯一解题目…'
  try {
    const p = await generateSudokuAsync(level.value, {
      onProgress: (n) => (genNote.value = n > 0 ? `第 ${n + 1} 次尝试：调整难度中…` : '正在生成唯一解题目…'),
    })
    size.value = p.size
    givens.value = [...p.puzzle]
    grid.value = [...p.puzzle]
    notes.value = Array.from({ length: p.size * p.size }, () => [])
    solution.value = [...p.solution]
    done.value = false
    elapsed.value = 0
    hintCount.value = 0
    undoStack.value = []
    selected.value = null
    paused.value = false
    genNote.value = p.degraded
      ? `${levelLabel(p.level)}（${p.clues} 提示${p.level !== level.value ? '，难度按实际标注' : ''}）`
      : `${levelLabel(p.level)} · ${p.clues} 提示 · 唯一解`
    toast.ok(`已生成${levelLabel(level.value)}题目（唯一解）`)
    save()
  } finally {
    busy.value = false
  }
}

function restart() {
  if (handMode.value) return clearAll()
  grid.value = [...givens.value]
  notes.value = Array.from({ length: size.value * size.value }, () => [])
  undoStack.value = []
  elapsed.value = 0
  hintCount.value = 0
  done.value = false
  paused.value = false
  save()
  toast.toast('已重开本题')
}

function clearAll() {
  const n = size.value * size.value
  givens.value = Array(n).fill(0)
  grid.value = Array(n).fill(0)
  notes.value = Array.from({ length: n }, () => [])
  solution.value = null
  undoStack.value = []
  elapsed.value = 0
  hintCount.value = 0
  done.value = false
  paused.value = false
  selected.value = null
  localStorage.removeItem(SAVE_KEY)
  toast.toast('已清空：可手动输入题目后「直接解出」')
}

/* ---------- 作答 ---------- */
function pushUndo() {
  undoStack.value.push({ grid: [...grid.value], notes: notes.value.map((x) => [...x]) })
  if (undoStack.value.length > 200) undoStack.value.shift()
}
function undo() {
  const s = undoStack.value.pop()
  if (!s) return toast.warn('没有可撤销的操作')
  grid.value = s.grid
  notes.value = s.notes
  done.value = false
  save()
}

function checkDone() {
  if (grid.value.some((v) => !v)) return
  if (conflicts.value.size) return
  done.value = true
  paused.value = true
  save()
  toast.ok(`完成！用时 ${fmtTime.value}${hintCount.value ? ` · 提示 ${hintCount.value} 次` : ''}`)
}

function typeDigit(i: number, v: number) {
  if (done.value || paused.value) return
  if (givens.value[i]) return
  if (v < 1 || v > size.value) return
  pushUndo()
  if (pencil.value) {
    if (grid.value[i]) {
      undoStack.value.pop()
      return
    }
    const cell = notes.value[i]!
    const at = cell.indexOf(v)
    if (at >= 0) cell.splice(at, 1)
    else {
      cell.push(v)
      cell.sort((a, b) => a - b)
    }
  } else {
    grid.value[i] = grid.value[i] === v ? 0 : v
    notes.value[i] = []
    if (grid.value[i]) {
      // 落子后清理同行/列/宫的该候选笔记
      const n = size.value
      const b = size.value === 4 ? 2 : 3
      const r = Math.floor(i / n)
      const c = i % n
      for (let k = 0; k < n; k++) {
        for (const p of [r * n + k, k * n + c]) notes.value[p] = notes.value[p]!.filter((x) => x !== v)
      }
      const br = Math.floor(r / b) * b
      const bc = Math.floor(c / b) * b
      for (let dr = 0; dr < b; dr++) for (let dc = 0; dc < b; dc++) {
        const p = (br + dr) * n + (bc + dc)
        notes.value[p] = notes.value[p]!.filter((x) => x !== v)
      }
      checkDone()
    }
  }
  save()
}

function eraseCell(i: number) {
  if (done.value || givens.value[i]) return
  if (!grid.value[i] && !notes.value[i]!.length) return
  pushUndo()
  grid.value[i] = 0
  notes.value[i] = []
  done.value = false
  save()
}

function hint() {
  if (busy.value || done.value || handMode.value) return
  let sol: SudokuGrid | null = solution.value
  if (!sol) {
    sol = solveSudoku(grid.value, size.value)
    if (!sol) return toast.warn('当前盘面无解，请检查输入')
    solution.value = sol
  }
  // 优先提示选中格（空或错），否则第一个空/错格
  const sel = selected.value
  const pickIdx = sel !== null && !givens.value[sel] && grid.value[sel] !== sol[sel] ? sel : -1
  const idx = pickIdx >= 0 ? pickIdx : grid.value.findIndex((v, i) => !givens.value[i] && v !== sol![i])
  if (idx === -1) {
    done.value = true
    return toast.ok('已完成！')
  }
  pushUndo()
  grid.value[idx] = sol[idx]!
  notes.value[idx] = []
  hintCount.value++
  selected.value = idx
  checkDone()
  save()
}

function solveAll() {
  let sol = solution.value
  if (!sol) {
    sol = solveSudoku(grid.value, size.value)
    if (!sol) return toast.warn('该题无解，请检查输入')
  }
  grid.value = [...sol]
  notes.value = notes.value.map(() => [])
  done.value = true
  paused.value = true
  save()
}

/* ---------- 计时 ---------- */
let timerId = 0
onMounted(() => {
  if (restore()) toast.toast(`已恢复上局进度（${levelLabel(level.value)} · ${fmtTime.value}）`)
  else void newGame()
  timerId = window.setInterval(() => {
    if (!paused.value && !done.value && !handMode.value && !busy.value) elapsed.value++
  }, 1000)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur', onBlur)
})
function onBlur() {
  if (!done.value && !handMode.value && solution.value) paused.value = true
}

function onKey(e: KeyboardEvent) {
  if (keyTargetBlocked(e)) return
  if (e.key === 'Escape') {
    if (!handMode.value && solution.value && !done.value && !busy.value) {
      paused.value = !paused.value
      e.preventDefault()
    }
    return
  }
  if (paused.value || done.value) return
  const n = size.value
  const move = (di: number) => {
    if (selected.value === null) selected.value = 0
    else selected.value = Math.min(n * n - 1, Math.max(0, selected.value + di))
    e.preventDefault()
  }
  if (e.key === 'ArrowLeft') return move(-1)
  if (e.key === 'ArrowRight') return move(1)
  if (e.key === 'ArrowUp') return move(-n)
  if (e.key === 'ArrowDown') return move(n)
  if (selected.value === null) return
  if (/^[1-9]$/.test(e.key)) {
    typeDigit(selected.value, Number(e.key))
    e.preventDefault()
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    eraseCell(selected.value)
    e.preventDefault()
  } else if (e.key.toLowerCase() === 'n') {
    pencil.value = !pencil.value
    e.preventDefault()
  }
}

/* ---------- Word 打印 ---------- */
const printOpen = ref(false)
const printPerPage = ref<1 | 2 | 4>(2)
const printCount = ref(4)
const printAnswers = ref(true)
const printing = ref(false)
async function doPrint() {
  if (printing.value) return
  printing.value = true
  try {
    const items: { puzzle: SudokuGrid; solution?: SudokuGrid; size: number; label: string }[] = []
    // 当前局（生成题）放第一题；其余现场生成
    if (!handMode.value && givens.value.some((v) => v)) {
      items.push({
        puzzle: [...givens.value],
        solution: solution.value ? [...solution.value] : undefined,
        size: size.value,
        label: `题 1 · ${levelLabel(level.value)}`,
      })
    }
    while (items.length < printCount.value) {
      const p = await generateSudokuAsync(level.value)
      items.push({
        puzzle: p.puzzle,
        solution: p.solution,
        size: p.size,
        label: `题 ${items.length + 1} · ${levelLabel(level.value)}`,
      })
    }
    const blob = await sudokuPuzzlesToDocx(items, { perPage: printPerPage.value, withAnswers: printAnswers.value })
    saveBlob(blob, `数独练习题-${levelLabel(level.value)}.docx`)
    toast.ok('已导出 Word 题目卡')
    printOpen.value = false
  } catch (err) {
    toast.err(`导出失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <span class="field-label">难度</span>
        <select v-model="level" class="input slim" :disabled="busy">
          <option v-for="l in LEVELS" :key="l.id" :value="l.id">{{ l.label }}</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="newGame">
          <Loader2 v-if="busy" :size="14" class="spin" /><RefreshCw v-else :size="14" /> 新题
        </button>
        <button class="btn btn-sm" :disabled="busy || handMode" @click="restart"><RotateCcw :size="14" /> 重开</button>
        <button class="btn btn-sm" :disabled="!undoStack.length" @click="undo"><Undo2 :size="14" /> 撤销</button>
        <button class="btn btn-sm" :disabled="busy || done || handMode" @click="hint"><Lightbulb :size="14" /> 提示一步（{{ hintCount }}）</button>
        <button class="btn btn-sm" @click="solveAll">直接解出</button>
        <button class="btn btn-sm" @click="clearAll">清空自填题</button>
        <button class="btn btn-sm" @click="printOpen = !printOpen"><Printer :size="14" /> Word 打印</button>
      </div>
      <p class="hint mt-1">
        挖洞法生成并逐格校验唯一解；键盘可玩（方向键移动、数字填写、N 切换笔记、Esc 暂停）；
        也可清空后手动输入题目，「直接解出」会检查可解性并标红冲突。
      </p>
    </div>

    <!-- Word 打印面板 -->
    <div v-if="printOpen" class="opts-panel mt-2">
      <div class="row row-wrap gap">
        <span class="field-label">每页题数</span>
        <select v-model="printPerPage" class="input slim">
          <option :value="1">1 题</option>
          <option :value="2">2 题</option>
          <option :value="4">4 题</option>
        </select>
        <span class="field-label">共</span>
        <select v-model="printCount" class="input slim">
          <option v-for="c in [1, 2, 4, 6, 8]" :key="c" :value="c">{{ c }} 题</option>
        </select>
        <label class="chk"><input v-model="printAnswers" type="checkbox" /> 附答案页</label>
        <button class="btn btn-primary btn-sm" :disabled="printing" @click="doPrint">
          <Loader2 v-if="printing" :size="14" class="spin" /><Printer v-else :size="14" />
          生成 .docx（{{ levelLabel(level) }}）
        </button>
      </div>
      <p class="hint mt-1">当前局排第一题，其余现场生成（高级档可能需要数秒）；支持 MS Word 与 WPS 打开打印。</p>
    </div>

    <!-- 状态条 -->
    <div class="status-bar mt-2">
      <span class="stat" :class="{ muted: handMode }">
        <template v-if="handMode">手输求解模式</template>
        <template v-else>{{ genNote || levelLabel(level) }}</template>
      </span>
      <span class="stat mono" :title="'已用时'">
        <template v-if="handMode">--:--</template>
        <template v-else-if="hideTimer">计时已隐藏</template>
        <template v-else>{{ fmtTime }}</template>
      </span>
      <button class="icon-mini" :title="hideTimer ? '显示计时' : '隐藏计时'" @click="hideTimer = !hideTimer">
        <EyeOff v-if="!hideTimer" :size="14" /><Eye v-else :size="14" />
      </button>
    </div>

    <!-- 棋盘 -->
    <div class="mt-2">
      <SudokuBoard
        :grid="grid"
        :givens="givens"
        :notes="notes"
        :size="size"
        :selected="selected"
        :conflicts="conflicts"
        :wrong="wrong"
        :check-on="checkOn"
        :paused="paused && !done"
        @select="(i) => (selected = i)"
      />
    </div>

    <!-- 数字键盘 -->
    <div class="pad mt-2">
      <button
        v-for="d in size"
        :key="d"
        type="button"
        class="key mono"
        @click="selected !== null && typeDigit(selected, d)"
      >{{ d }}</button>
      <button type="button" class="key" @click="selected !== null && eraseCell(selected)">擦除</button>
      <button type="button" class="key" :class="{ on: pencil }" @click="pencil = !pencil">
        <Pencil :size="13" style="vertical-align: -2px" /> 笔记{{ pencil ? '开' : '关' }}
      </button>
      <label class="chk"><input v-model="checkOn" type="checkbox" /> 错误检查</label>
    </div>

    <p v-if="done" class="ok-line mt-2">🎉 本题完成！可开下一题，或用 Word 打印带去纸上做。</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 116px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.stat { font-size: 13px; color: var(--muted); }
.stat.muted { font-style: italic; }
.mono { font-variant-numeric: tabular-nums; }
.icon-mini {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
}
.icon-mini:hover { color: var(--accent-text); }
.pad {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;
}
.key {
  min-width: 44px;
  height: 38px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--panel-solid, #fff);
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.key:hover { border-color: var(--accent); color: var(--accent-text); }
.key.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.chk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}
.ok-line { text-align: center; color: var(--ok); font-weight: 700; }
.hint { font-size: 12px; color: var(--muted); }
</style>
