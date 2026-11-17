<script setup lang="ts">
/**
 * 数独棋盘渲染（V1.2 旗舰）：给定格/选区高亮（行列宫+同数字）/冲突与错值标红/铅笔笔记小九宫/暂停遮罩。
 * 纯展示组件，交互状态由 SudokuGame 持有。
 */
import { computed } from 'vue'

const props = defineProps<{
  grid: number[]
  givens: number[]
  notes: number[][]
  size: number
  selected: number | null
  conflicts: Set<number>
  wrong: Set<number>
  checkOn: boolean
  paused: boolean
}>()

const emit = defineEmits<{ (e: 'select', i: number): void }>()

const box = computed(() => (props.size === 4 ? 2 : 3))

/** 选中格的同行/列/宫 + 同数字高亮集合 */
const highlight = computed(() => {
  const s = props.selected
  const out = new Set<number>()
  if (s === null || s < 0 || s >= props.size * props.size) return out
  const n = props.size
  const r = Math.floor(s / n)
  const c = s % n
  const b = box.value
  for (let k = 0; k < n; k++) {
    out.add(r * n + k)
    out.add(k * n + c)
  }
  const br = Math.floor(r / b) * b
  const bc = Math.floor(c / b) * b
  for (let dr = 0; dr < b; dr++) for (let dc = 0; dc < b; dc++) out.add((br + dr) * n + (bc + dc))
  return out
})

const sameVal = computed(() => {
  const s = props.selected
  if (s === null) return new Set<number>()
  const v = props.grid[s]
  const out = new Set<number>()
  if (!v) return out
  props.grid.forEach((g, i) => {
    if (g === v) out.add(i)
  })
  return out
})

function cls(i: number) {
  const n = props.size
  const r = Math.floor(i / n)
  const c = i % n
  const b = box.value
  return {
    given: props.givens[i] !== 0,
    sel: props.selected === i,
    peer: props.selected !== null && highlight.value.has(i) && props.selected !== i,
    same: sameVal.value.has(i) && props.selected !== i,
    bad: props.checkOn && (props.conflicts.has(i) || props.wrong.has(i)),
    'br-left': c % b === 0 && c !== 0,
    'br-top': r % b === 0 && r !== 0,
  }
}
</script>

<template>
  <div class="board-wrap" :class="{ s4: size === 4 }">
    <div class="board" :style="{ gridTemplateColumns: `repeat(${size}, 1fr)` }">
      <button
        v-for="i in size * size"
        :key="i - 1"
        type="button"
        class="cell"
        :class="cls(i - 1)"
        @click="emit('select', i - 1)"
      >
        <span v-if="grid[i - 1]" class="val">{{ grid[i - 1] }}</span>
        <span v-else-if="notes[i - 1]?.length" class="notes" :class="{ n4: size === 4 }">
          <!-- 显式行列定位：display:none 不参与 grid 流，避免候选数字错位 -->
          <i
            v-for="d in size"
            v-show="notes[i - 1].includes(d)"
            :key="d"
            :style="{ gridRow: Math.ceil(d / (size === 4 ? 2 : 3)), gridColumn: ((d - 1) % (size === 4 ? 2 : 3)) + 1 }"
          >{{ d }}</i>
        </span>
      </button>
    </div>
    <div v-if="paused" class="pause-mask">已暂停 · 按 Esc 继续</div>
  </div>
</template>

<style scoped>
.board-wrap {
  position: relative;
  width: fit-content;
  margin: 0 auto;
}
.board {
  display: grid;
  width: min(420px, calc(100vw - 96px));
  aspect-ratio: 1;
  background: var(--panel-solid, #fff);
  border: 2px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
}
.board-wrap.s4 .board {
  width: min(300px, calc(100vw - 96px));
}
.cell {
  position: relative;
  border: 1px solid var(--border);
  background: transparent;
  outline: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;
}
.cell.br-left {
  border-left: 2px solid var(--accent);
}
.cell.br-top {
  border-top: 2px solid var(--accent);
}
.cell.peer {
  background: var(--accent-soft);
}
.cell.same {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
.cell.sel {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow: inset 0 0 0 2px var(--accent);
}
.cell.bad .val {
  color: var(--err);
}
.cell.bad {
  background: rgba(239, 68, 68, 0.12);
}
.val {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-text);
  line-height: 1;
}
.s4 .val {
  font-size: 28px;
}
.cell.given .val {
  color: var(--text);
}
.notes {
  position: absolute;
  inset: 2px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  color: var(--muted);
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
}
.notes.n4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  font-size: 13px;
}
.notes i {
  font-style: normal;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pause-mask {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: var(--panel-solid, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  z-index: 2;
}
</style>
