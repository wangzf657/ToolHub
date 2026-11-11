<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Keyboard, MousePointerClick } from 'lucide-vue-next'

/** 最近一次按键事件信息 */
interface KeyInfo {
  key: string
  code: string
  keyCode: number
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
  repeat: boolean
  type: 'keydown' | 'keyup'
}
const info = ref<KeyInfo | null>(null)
const box = ref<HTMLDivElement | null>(null)

/** 需要阻止默认行为的键（防滚动/快捷搜索，不影响复制刷新） */
const PREVENT = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Home', 'End', 'PageUp', 'PageDown', 'Slash', 'Quote'])

const onKey = (e: KeyboardEvent) => {
  if (PREVENT.has(e.key)) e.preventDefault()
  info.value = {
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    meta: e.metaKey,
    repeat: e.repeat,
    type: e.type as 'keydown' | 'keyup',
  }
}

onMounted(() => {
  box.value?.focus()
})
onBeforeUnmount(() => info.value = null)

/** 常用键码速查表 */
const COMMON: { key: string; code: string; kc: string }[] = [
  { key: 'Enter', code: 'Enter', kc: '13' },
  { key: 'Esc', code: 'Escape', kc: '27' },
  { key: '空格', code: 'Space', kc: '32' },
  { key: 'Tab', code: 'Tab', kc: '9' },
  { key: 'Backspace 退格', code: 'Backspace', kc: '8' },
  { key: 'Delete', code: 'Delete', kc: '46' },
  { key: '← 左', code: 'ArrowLeft', kc: '37' },
  { key: '↑ 上', code: 'ArrowUp', kc: '38' },
  { key: '→ 右', code: 'ArrowRight', kc: '39' },
  { key: '↓ 下', code: 'ArrowDown', kc: '40' },
  { key: 'Home / End', code: 'Home / End', kc: '36 / 35' },
  { key: 'PageUp / PageDown', code: 'PageUp / PageDown', kc: '33 / 34' },
  { key: 'Shift', code: 'ShiftLeft / Right', kc: '16' },
  { key: 'Ctrl', code: 'ControlLeft / Right', kc: '17' },
  { key: 'Alt', code: 'AltLeft / Right', kc: '18' },
  { key: 'Meta / Win / ⌘', code: 'MetaLeft / Right', kc: '91' },
  { key: 'CapsLock', code: 'CapsLock', kc: '20' },
  { key: 'Insert', code: 'Insert', kc: '45' },
  { key: '0–9 数字', code: 'Digit0–9', kc: '48–57' },
  { key: 'A–Z 字母', code: 'KeyA–Z', kc: '65–90' },
  { key: '小键盘 0–9', code: 'Numpad0–9', kc: '96–105' },
  { key: '小键盘 + - * /', code: 'NumpadAdd 等', kc: '106–111' },
  { key: 'F1–F12', code: 'F1–F12', kc: '112–123' },
]
const filter = ref('')
/** 速查表筛选：按键名 / event.code / keyCode 数字列三者任一命中即保留（输入数字可反查按键，如 13 → Enter） */
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const raw = filter.value.trim()
  if (!q) return COMMON
  return COMMON.filter((c) => c.key.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.kc.includes(raw))
})
</script>

<template>
  <div class="kc">
    <div
      ref="box"
      class="capture"
      tabindex="0"
      @keydown="onKey"
      @keyup="onKey"
      @click="box?.focus()"
    >
      <MousePointerClick :size="18" style="color: var(--accent-text)" />
      <p class="cap-tip">点击此区域，然后按下键盘上的任意键（组合键也支持）</p>
      <template v-if="info">
        <div class="trio">
          <div class="tile"><span class="t-k">event.key</span><span class="t-v mono">{{ info.key === ' ' ? '(空格)' : info.key }}</span></div>
          <div class="tile"><span class="t-k">event.code</span><span class="t-v mono">{{ info.code }}</span></div>
          <div class="tile"><span class="t-k">keyCode（已废弃）</span><span class="t-v mono">{{ info.keyCode }}</span></div>
        </div>
        <div class="mods">
          <span v-for="(v, k) in { Shift: info.shift, Ctrl: info.ctrl, Alt: info.alt, Meta: info.meta }" :key="k" class="mod" :class="{ on: v }">{{ k }}</span>
          <span v-if="info.repeat" class="mod on">长按重复</span>
          <span class="mod" :class="{ on: true }">{{ info.type === 'keydown' ? '按下' : '松开' }}</span>
        </div>
      </template>
    </div>

    <div class="mt-3">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">常用键码速查</span>
        <input v-model="filter" class="input" style="max-width: 220px" placeholder="筛选，如 F、arrow、13" />
      </div>
      <div class="mt-2 table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>按键</th><th>event.code</th><th>keyCode</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.key + c.kc">
              <td>{{ c.key }}</td>
              <td class="mono">{{ c.code }}</td>
              <td class="mono">{{ c.kc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="muted small mt-2"><Keyboard :size="13" style="vertical-align: -2px" /> keyCode 是历史遗留属性，不同浏览器可能有差异；新项目请优先使用 <code>event.key</code>（语义值）与 <code>event.code</code>（物理键位）。</p>
  </div>
</template>

<style scoped>
.capture {
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 26px 20px;
  text-align: center;
  outline: none;
  cursor: pointer;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.capture:focus { border-color: var(--accent); }
.cap-tip { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
.trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 18px; }
.tile { padding: 14px 12px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 70%, transparent); display: flex; flex-direction: column; gap: 6px; }
.t-k { font-size: 12px; color: var(--muted); }
.t-v { font-size: 24px; font-weight: 700; color: var(--accent-text); overflow-wrap: anywhere; }
.mods { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.mod { font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.mod.on { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent); }
</style>
