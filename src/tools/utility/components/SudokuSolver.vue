<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, Lightbulb, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { generateSudoku, solveSudoku, sudokuConflicts, type SudokuGrid } from '@/lib/utilExt'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const diff = ref<'easy' | 'medium' | 'hard'>('easy')
const grid = ref<SudokuGrid>(Array(81).fill(0))
const solution = ref<SudokuGrid | null>(null)
const solved = ref(false)
const busy = ref(false)
const steps = ref(0)

const conflicts = ref(new Set<number>())
const check = () => {
  conflicts.value = sudokuConflicts(grid.value)
}

const newGame = () => {
  busy.value = true
  try {
    const { puzzle, solution: sol } = generateSudoku(diff.value)
    grid.value = [...puzzle]
    solution.value = [...sol]
    solved.value = false
    steps.value = 0
    check()
    toast.ok(`已生成${diff.value === 'easy' ? '简单' : diff.value === 'medium' ? '中等' : '困难'}局（唯一解）`)
  } finally {
    busy.value = false
  }
}

const solve = () => {
  if (solution.value) {
    grid.value = [...solution.value]
  } else {
    const sol = solveSudoku(grid.value)
    if (!sol) return toast.warn('该题无解，请检查输入')
    grid.value = sol
  }
  solved.value = true
  check()
}

const hint = () => {
  const sol = solution.value ?? solveSudoku(grid.value)
  if (!sol) return toast.warn('该题无解，请检查输入')
  solution.value = sol
  const idx = grid.value.findIndex((v, i) => v !== sol[i])
  if (idx === -1) {
    solved.value = true
    return toast.ok('已完成！')
  }
  grid.value[idx] = sol[idx]!
  steps.value++
  check()
}

const clearAll = () => {
  grid.value = Array(81).fill(0)
  solution.value = null
  solved.value = false
  steps.value = 0
  check()
}

const onInput = (i: number, e: Event) => {
  const el = e.target as HTMLInputElement
  const v = el.value.replace(/\D/g, '').slice(-1)
  el.value = v === '0' ? '' : v
  grid.value[i] = v ? Number(v) : 0
  check()
}

const cellCls = (i: number) => {
  const r = Math.floor(i / 9)
  const c = i % 9
  return {
    conflict: conflicts.value.has(i),
    given: grid.value[i] !== 0,
    'br-left': c === 3 || c === 6,
    'br-top': r === 3 || r === 6,
  }
}

newGame()
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">难度</span>
        <select v-model="diff" class="input slim">
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="newGame"><Loader2 v-if="busy" :size="14" class="spin" /><RefreshCw v-else :size="14" /> 新一局</button>
        <button class="btn btn-sm" @click="hint"><Lightbulb :size="14" /> 提示一步（{{ steps }}）</button>
        <button class="btn btn-sm" @click="solve">直接解出</button>
        <button class="btn btn-sm" @click="clearAll">清空自填题</button>
      </div>
      <p class="hint mt-1">挖洞法生成保证唯一解；也可清空后手动输入题目（0 或空为待填），「直接解出」会检查可解性并标红冲突格。</p>
    </div>

    <div class="board mt-2" :class="{ done: solved }">
      <template v-for="i in 81" :key="i - 1">
        <input
          class="cell mono"
          :class="cellCls(i - 1)"
          :value="grid[i - 1] || ''"
          :readonly="solution !== null && solved"
          maxlength="2"
          @input="onInput(i - 1, $event)"
        />
      </template>
    </div>
    <p v-if="solved" class="ok-line mt-2"><CheckCircle2 :size="16" style="vertical-align: -3px" /> 完成！</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 90px; }
.board { display: grid; grid-template-columns: repeat(9, 40px); grid-template-rows: repeat(9, 40px); gap: 1px; width: fit-content; background: var(--border); border: 2px solid var(--accent); border-radius: 8px; overflow: hidden; }
.board.done { border-color: var(--ok); }
.cell { width: 40px; height: 40px; border: none; text-align: center; font-size: 18px; background: var(--panel-solid, #fff); color: var(--accent-text); font-weight: 700; outline: none; padding: 0; }
.cell.conflict { color: var(--err); background: rgba(239, 68, 68, .12); }
.cell.br-left { border-left: 2px solid var(--accent); }
.cell.br-top { border-top: 2px solid var(--accent); }
.ok-line { color: var(--ok); font-weight: 700; }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
