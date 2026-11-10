<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Eraser } from 'lucide-vue-next'

/** 简化键位布局（87 键），k = event.code */
interface KeyDef { code: string; label: string; w?: number }
const ROWS: KeyDef[][] = [
  [{ code: 'Escape', label: 'Esc', w: 1.3 }, { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3' }, { code: 'F4', label: 'F4' }, { code: 'F5', label: 'F5' }, { code: 'F6', label: 'F6' }, { code: 'F7', label: 'F7' }, { code: 'F8', label: 'F8' }, { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' }, { code: 'F12', label: 'F12' }],
  [{ code: 'Backquote', label: '`' }, { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' }, { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' }, { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' }, { code: 'Digit9', label: '9' }, { code: 'Digit0', label: '0' }, { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' }, { code: 'Backspace', label: '⌫', w: 2 }],
  [{ code: 'Tab', label: 'Tab', w: 1.5 }, { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' }, { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' }, { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' }, { code: 'KeyP', label: 'P' }, { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' }, { code: 'Backslash', label: '\\', w: 1.5 }],
  [{ code: 'CapsLock', label: 'Caps', w: 1.75 }, { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' }, { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' }, { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' }, { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" }, { code: 'Enter', label: 'Enter', w: 2.25 }],
  [{ code: 'ShiftLeft', label: 'Shift', w: 2.25 }, { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' }, { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' }, { code: 'KeyM', label: 'M' }, { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' }, { code: 'ShiftRight', label: 'Shift', w: 2.75 }],
  [{ code: 'ControlLeft', label: 'Ctrl', w: 1.25 }, { code: 'MetaLeft', label: 'Win', w: 1.25 }, { code: 'AltLeft', label: 'Alt', w: 1.25 }, { code: 'Space', label: 'Space', w: 6.25 }, { code: 'AltRight', label: 'Alt', w: 1.25 }, { code: 'MetaRight', label: 'Fn', w: 1.25 }, { code: 'ContextMenu', label: '☰', w: 1.25 }, { code: 'ControlRight', label: 'Ctrl', w: 1.25 }],
]

const counts = ref(new Map<string, number>())
const down = ref(new Set<string>())
const downAt = ref(new Map<string, number>())
const cpm = ref(0)
let hits = 0
let startedAt = 0

const onKeyDown = (e: KeyboardEvent) => {
  const k = e.code
  down.value = new Set(down.value).add(k)
  if (!downAt.value.has(k)) downAt.value.set(k, Date.now())
  counts.value.set(k, (counts.value.get(k) ?? 0) + 1)
  hits++
  if (!startedAt) startedAt = Date.now()
  cpm.value = Math.round(hits / Math.max(0.05, (Date.now() - startedAt) / 60000))
  // 防止空格/方向键滚动页面
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'Slash', 'Quote'].includes(k)) e.preventDefault()
}

const onKeyUp = (e: KeyboardEvent) => {
  const s = new Set(down.value)
  s.delete(e.code)
  down.value = s
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

const total = computed(() => [...counts.value.values()].reduce((a, b) => a + b, 0))

/** 按住超过 0.8 秒的键视为疑似卡键 */
const stuckKeys = computed(() => {
  const now = Date.now()
  return [...down.value].filter((c) => now - (downAt.value.get(c) ?? now) > 800)
})

const stateOf = (c: string) => (down.value.has(c) ? 'down' : counts.value.has(c) ? 'tested' : '')

const reset = () => {
  counts.value = new Map()
  downAt.value = new Map()
  down.value = new Set()
  hits = 0
  startedAt = 0
  cpm.value = 0
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="stat-chip">覆盖键位 {{ counts.size }}</span>
        <span class="stat-chip">累计 {{ total }} 次</span>
        <span class="stat-chip">CPM {{ cpm }}</span>
        <span v-if="stuckKeys.length" class="stat-chip warn">疑似卡键：{{ stuckKeys.join('、') }}</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" @click="reset"><Eraser :size="14" /> 重置</button>
      </div>
      <p class="hint mt-1">直接敲键盘即可（本页会拦截空格等防滚动）；一直按住超过 0.8 秒的键会提示「疑似卡键」。测完逐个键变蓝即为正常。</p>
    </div>

    <div class="kb mt-2" @contextmenu.prevent>
      <div v-for="(row, ri) in ROWS" :key="ri" class="kb-row">
        <div
          v-for="k in row"
          :key="k.code + k.label"
          class="key"
          :class="stateOf(k.code)"
          :style="{ flex: `${k.w ?? 1} 1 0` }"
        >
          <span class="kl">{{ k.label }}</span>
          <span v-if="counts.get(k.code)" class="kc">{{ counts.get(k.code) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.stat-chip { padding: 4px 12px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.stat-chip.warn { color: var(--warn); }
.kb { max-width: 860px; }
.kb-row { display: flex; gap: 4px; margin-bottom: 4px; }
.key { position: relative; height: 46px; border: 1px solid var(--border); border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-direction: column; background: var(--surface-2, rgba(127,127,127,.06)); user-select: none; }
.key.tested { border-color: var(--accent); background: var(--accent-soft); }
.key.down { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 30%, transparent); transform: scale(.96); }
.kl { font-size: 11.5px; }
.kc { position: absolute; top: 2px; right: 5px; font-size: 10px; color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); }
</style>
