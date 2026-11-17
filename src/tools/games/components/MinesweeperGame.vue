<script setup lang="ts">
/**
 * 扫雷（V1.2）：初级/中级/高级三档规格、首开安全（首点及邻域无雷）、右键插旗、
 * 剩余雷数 + 计时、洪泛展开、胜负内联展示；高级 30×16 棋盘小屏横向滚动。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Flag, RotateCcw } from 'lucide-vue-next'
import {
  MS_LEVELS,
  createMinesweeper,
  minesLeft,
  openCell,
  resetMinesweeper,
  toggleFlag,
  type MinesweeperState,
} from '@/lib/games/minesweeper'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const levelId = ref('beginner')
const level = computed(() => MS_LEVELS.find((l) => l.id === levelId.value) ?? MS_LEVELS[0]!)

const state = ref<MinesweeperState>(createMinesweeper(level.value.w, level.value.h, level.value.mines))
/** 引擎就地修改 TypedArray，Vue 无法追踪——版本号强制重渲染 */
const version = ref(0)
const elapsed = ref(0)
let timerId = 0

/** 引擎状态含 TypedArray（Vue 无法追踪其元素写入），HUD 计算需引用 version 触发重算 */
const left = computed(() => {
  void version.value
  return minesLeft(state.value)
})
const face = computed(() => {
  void version.value
  return state.value.won ? 'win' : state.value.boom ? 'boom' : 'play'
})

function newGame() {
  state.value = createMinesweeper(level.value.w, level.value.h, level.value.mines)
  elapsed.value = 0
  version.value++
}

function onLevelChange() {
  newGame()
}

function open(i: number) {
  const s = state.value
  if (s.won || s.boom) return
  const firstOpen = !s.started
  openCell(s, i)
  version.value++
  if (firstOpen && s.started && !timerId) {
    timerId = window.setInterval(() => {
      const cur = state.value
      if (cur.started && !cur.boom && !cur.won) elapsed.value++
    }, 1000)
  }
  if (s.won) {
    stopTimer()
    // 胜局自动插旗余雷
    for (let k = 0; k < s.mine.length; k++) if (s.mine[k] && !s.flag[k]) s.flag[k] = 1
    version.value++
    toast.ok(`胜利！用时 ${elapsed.value} 秒`)
  } else if (s.boom) {
    stopTimer()
    toast.err('踩到雷了，再试一局')
  }
}

function flag(i: number) {
  toggleFlag(state.value, i)
  version.value++
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId)
    timerId = 0
  }
}

onMounted(() => stopTimer())
onBeforeUnmount(stopTimer)

/** 数字经典配色（低饱和微调） */
const NUM_COLORS = ['', '#5b8def', '#3fa46a', '#e0564f', '#4b5bd6', '#b8862f', '#2fa3a8', '#8a8fa8', '#c2564f']
function cellCls(i: number) {
  const s = state.value
  return {
    open: !!s.open[i],
    wrongFlag: s.boom === true && s.flag[i] === 1 && !s.mine[i],
    mine: s.boom === true && s.mine[i] === 1,
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap gap">
        <span class="field-label">难度</span>
        <select v-model="levelId" class="input wide" @change="onLevelChange">
          <option v-for="l in MS_LEVELS" :key="l.id" :value="l.id">{{ l.label }}</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="newGame"><RotateCcw :size="14" /> 重开</button>
      </div>
      <p class="hint mt-1">首次点击必安全（首点及周围一圈无雷）；左键开格、右键插旗；数字表示周围 8 格雷数，空格自动展开。</p>
    </div>

    <div class="hud mt-2">
      <span class="pill"><Flag :size="13" style="vertical-align: -2px" /> 剩余雷 {{ left }}</span>
      <span class="pill mono">⏱ {{ elapsed }}s</span>
      <span class="pill" :class="face">{{ state.won ? '胜利 🎉' : state.boom ? '踩雷 💥' : '进行中' }}</span>
    </div>

    <div class="scroll mt-2">
      <div
        class="grid"
        :key="version"
        :style="{ gridTemplateColumns: `repeat(${level.w}, ${level.w > 20 ? 24 : level.w > 10 ? 30 : 36}px)` }"
      >
        <button
          v-for="i in level.w * level.h"
          :key="i - 1"
          type="button"
          class="cell"
          :class="cellCls(i - 1)"
          @click="open(i - 1)"
          @contextmenu.prevent="flag(i - 1)"
        >
          <template v-if="state.open[i - 1] || (state.boom && state.mine[i - 1])">
            <span v-if="state.mine[i - 1]" class="mineMark">💥</span>
            <span v-else-if="state.adj[i - 1]" class="num" :class="'n' + state.adj[i - 1]">{{ state.adj[i - 1] }}</span>
          </template>
          <span v-else-if="state.flag[i - 1]" class="flagmark">🚩</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.wide { width: 176px; }
.hint { font-size: 12px; color: var(--muted); }
.hud { display: flex; justify-content: center; gap: 12px; }
.pill {
  font-size: 13px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 12px;
  background: var(--panel-solid, #fff);
}
.pill.win { color: var(--ok); border-color: var(--ok); }
.pill.boom { color: var(--err); border-color: var(--err); }
.mono { font-variant-numeric: tabular-nums; }
.scroll { overflow-x: auto; display: flex; justify-content: safe center; padding-bottom: 4px; }
.grid { display: grid; gap: 2px; width: fit-content; margin: 0 auto; }
.cell {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--accent-soft);
  cursor: pointer;
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell:hover { border-color: var(--accent); }
.cell.open { background: var(--panel-solid, #fff); border-color: var(--border); cursor: default; }
.cell.wrongFlag { opacity: 0.55; }
.cell.mine { background: rgba(239, 68, 68, 0.15); }
.mineMark { font-size: 13px; }
.num.n1 { color: #5b8def; }
.num.n2 { color: #3fa46a; }
.num.n3 { color: #e0564f; }
.num.n4 { color: #4b5bd6; }
.num.n5 { color: #b8862f; }
.num.n6 { color: #2fa3a8; }
.num.n7 { color: #8a8fa8; }
.num.n8 { color: #c2564f; }
</style>
