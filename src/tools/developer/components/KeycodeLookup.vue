<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Keyboard, MousePointerClick, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

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
  capsLock: boolean
}
const info = ref<KeyInfo | null>(null)
const box = ref<HTMLDivElement | null>(null)
/** 事件流回看（rx4）：最近 20 条 */
const history = ref<(KeyInfo & { mods: string })[]>([])
/** 复制反馈（rx3） */
const copiedTile = ref('')

/** 需要阻止默认行为的键（按 e.code 判定防误伤，rx2；不影响复制刷新） */
const PREVENT = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Home', 'End', 'PageUp', 'PageDown', 'Slash', 'Quote'])

const modsOf = (e: KeyboardEvent) => [e.shiftKey && 'Shift', e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Meta'].filter(Boolean).join('+')

const onKey = (e: KeyboardEvent) => {
  // 统一按物理键位拦截（Firefox 下 "/" 不再触发快速查找，rx2）
  if (PREVENT.has(e.code) || (PREVENT.has(e.key) && e.code !== 'NumpadAdd')) e.preventDefault()
  const caps = e.getModifierState('CapsLock')
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
    capsLock: caps,
  }
  if (e.type === 'keydown') {
    history.value = [{ ...info.value, mods: modsOf(e) || '—' }, ...history.value].slice(0, 20)
  }
}

/** 失焦复位（rx5）：弹窗/切走后「按下」chip 不残留 */
const onBlur = () => {
  info.value = null
}

const copyTile = async (label: string, value: string) => {
  const ok = await copyText(value)
  if (ok) {
    copiedTile.value = label
    setTimeout(() => (copiedTile.value = ''), 1500)
    toast.ok(`已复制 ${value}`)
  } else toast.err('复制失败')
}

onMounted(() => {
  box.value?.focus()
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  info.value = null
  window.removeEventListener('blur', onBlur)
})

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
          <div class="tile">
            <span class="t-k">event.key</span>
            <span class="t-v mono">{{ info.key === ' ' ? '(空格)' : info.key }}</span>
            <button class="tile-copy" title="复制" @click="copyTile('key', info.key)"><Check v-if="copiedTile === 'key'" :size="12" color="#34d399" /><Copy v-else :size="12" /></button>
          </div>
          <div class="tile">
            <span class="t-k">event.code</span>
            <span class="t-v mono">{{ info.code }}</span>
            <button class="tile-copy" title="复制" @click="copyTile('code', info.code)"><Check v-if="copiedTile === 'code'" :size="12" color="#34d399" /><Copy v-else :size="12" /></button>
          </div>
          <div class="tile">
            <span class="t-k">keyCode（已废弃）</span>
            <span class="t-v mono">{{ info.keyCode }}</span>
            <button class="tile-copy" title="复制" @click="copyTile('kc', String(info.keyCode))"><Check v-if="copiedTile === 'kc'" :size="12" color="#34d399" /><Copy v-else :size="12" /></button>
          </div>
        </div>
        <div class="mods">
          <span v-for="(v, k) in { Shift: info.shift, Ctrl: info.ctrl, Alt: info.alt, Meta: info.meta }" :key="k" class="mod" :class="{ on: v }">{{ k }}</span>
          <span class="mod" :class="{ on: info.capsLock }" title="按 getModifierState('CapsLock') 实时判定">CapsLock{{ info.capsLock ? ' 开' : ' 关' }}</span>
          <span v-if="info.repeat" class="mod on">长按重复</span>
          <span class="mod" :class="{ on: true }">{{ info.type === 'keydown' ? '按下' : '松开' }}</span>
        </div>
      </template>
    </div>

    <div v-if="history.length" class="mt-3">
      <span class="field-label">最近按键（{{ history.length }} 条，倒序）</span>
      <div class="hist-list mt-2">
        <div v-for="(h, i) in history" :key="i" class="hist-row mono">
          <b>{{ h.key === ' ' ? '(空格)' : h.key }}</b>
          <span>{{ h.code }}</span>
          <span>{{ h.keyCode }}</span>
          <span class="muted">{{ h.type === 'keydown' ? '按下' : '松开' }}{{ h.mods !== '—' ? ` · ${h.mods}` : '' }}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="history = []">清空记录</button>
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
.tile { padding: 14px 12px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 70%, transparent); display: flex; flex-direction: column; gap: 6px; position: relative; }
.tile-copy { position: absolute; top: 8px; right: 8px; border: 1px solid var(--border); background: var(--panel-solid); color: var(--text-3); border-radius: 6px; width: 22px; height: 22px; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.12s; padding: 0; }
.tile:hover .tile-copy { opacity: 1; }
@media (hover: none) { .tile-copy { opacity: 0.55; } }
.hist-list { display: grid; gap: 4px; max-height: 220px; overflow: auto; }
.hist-row { display: flex; gap: 16px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 12.5px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); }
.hist-row b { min-width: 90px; color: var(--accent-text); }
.t-k { font-size: 12px; color: var(--muted); }
.t-v { font-size: 24px; font-weight: 700; color: var(--accent-text); overflow-wrap: anywhere; }
.mods { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.mod { font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.mod.on { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent); }
</style>
