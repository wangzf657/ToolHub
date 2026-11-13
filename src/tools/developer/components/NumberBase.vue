<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Binary, Copy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('255')
const fromBase = ref(10)
const customBase = ref(32)
const results = ref<{ copied: boolean }[]>([])

/* 家族互链转料：位运算/其他工具跳转过来时回显输入与进制 */
onMounted(() => {
  const t = sessionStorage.getItem('toolhub.transfer.number-base-converter')
  if (t) {
    try {
      const { input: v, base } = JSON.parse(t) as { input: string; base?: number }
      input.value = v
      if (base) fromBase.value = base
      sessionStorage.removeItem('toolhub.transfer.number-base-converter')
    } catch {
      /* 转料损坏则忽略 */
    }
  }
})

const R = [
  { base: 2, label: '二进制' },
  { base: 8, label: '八进制' },
  { base: 10, label: '十进制' },
  { base: 16, label: '十六进制' },
  { base: 36, label: '36 进制' },
]

const cleanInput = computed(() => input.value.trim().replace(/^0[bBoOxX]/, '') || '0')

const toBigInt = computed(() => {
  const b = fromBase.value === -1 ? clampCustom() : fromBase.value
  try {
    return { ok: true as const, value: parseBase(cleanInput.value, b) }
  } catch {
    return { ok: false as const, value: 0n }
  }
})

function clampCustom(): number {
  const n = Math.floor(customBase.value)
  return Math.min(36, Math.max(2, Number.isNaN(n) ? 10 : n))
}

function parseBase(s: string, base: number): bigint {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
  let acc = 0n
  const bigBase = BigInt(base)
  let negative = false
  let t = s.toLowerCase()
  if (t.startsWith('-')) {
    negative = true
    t = t.slice(1)
  }
  if (!t) throw new Error('空输入')
  for (const c of t) {
    const d = digits.indexOf(c)
    if (d < 0 || d >= base) throw new Error(`字符 “${c}” 不是 ${base} 进制数字`)
    acc = acc * bigBase + BigInt(d)
  }
  return negative ? -acc : acc
}

function fromBigInt(v: bigint, base: number): string {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
  if (v === 0n) return '0'
  const neg = v < 0n
  let t = v < 0n ? -v : v
  let out = ''
  while (t > 0n) {
    out = digits[Number(t % BigInt(base))] + out
    t /= BigInt(base)
  }
  return (neg ? '-' : '') + out
}

const outputs = computed(() => {
  const parsed = toBigInt.value
  const target = [...R.map((r) => r.base)]
  const cb = clampCustom()
  if (!target.includes(cb)) target.unshift(cb)
  return target.map((base) => {
    let value = parsed.ok ? fromBigInt(parsed.value, base) : '—'
    if (base === 16 && hexUpper.value && parsed.ok) value = value.toUpperCase()
    return {
      base,
      label: R.find((r) => r.base === base)?.label ?? `${base} 进制`,
      value,
    }
  })
})

const bits32 = computed(() => {
  const parsed = toBigInt.value
  if (!parsed.ok) return ''
  const v = parsed.value
  if (v < 0n || v > 0xffffffffn) return ''
  return v.toString(2).padStart(32, '0').replace(/(.{4})(?=.)/g, '$1 ')
})

/* ---- 前缀纠偏：0x/0b/0o 前缀与当前进制不符时提供一键重解析（rx1） ---- */
const prefixHint = computed(() => {
  const t = input.value.trim().toLowerCase()
  if (/^0x/.test(t) && fromBase.value !== 16) return { base: 16, label: '16' }
  if (/^0b/.test(t) && fromBase.value !== 2) return { base: 2, label: '2' }
  if (/^0o/.test(t) && fromBase.value !== 8) return { base: 8, label: '8' }
  return null
})
const applyPrefix = () => {
  if (prefixHint.value) fromBase.value = prefixHint.value.base
}

/* ---- 大写十六进制（rx3） ---- */
const hexUpper = ref(false)

/* ---- 补码视图：按所选位宽显示补码位模式（rx2） ---- */
const compWidth = ref(32)
const complement = computed(() => {
  const parsed = toBigInt.value
  if (!parsed.ok) return ''
  const w = BigInt(compWidth.value)
  const mod = 1n << w
  const v = ((parsed.value % mod) + mod) % mod
  return v.toString(2).padStart(Number(w), '0').replace(/(.{4})(?=.)/g, '$1 ')
})

const copy = async (value: string, i: number) => {
  const okFlag = await copyText(value)
  if (okFlag) {
    results.value[i] = { copied: true }
    setTimeout(() => results.value.splice(i, 1), 1500)
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="num-base">
    <div class="row row-wrap" style="gap: 12px; align-items: end">
      <div class="grow" style="min-width: 220px">
        <span class="field-label">输入数值</span>
        <input v-model="input" type="text" class="input mono" spellcheck="false" />
      </div>
      <div>
        <span class="field-label">输入进制</span>
        <select v-model.number="fromBase" class="select" style="width: 130px">
          <option :value="2">2 进制</option>
          <option :value="8">8 进制</option>
          <option :value="10">10 进制</option>
          <option :value="16">16 进制</option>
          <option :value="-1">自定义…</option>
        </select>
      </div>
      <div v-if="fromBase === -1">
        <span class="field-label">进制（2-36）</span>
        <input v-model.number="customBase" type="number" class="input" min="2" max="36" style="width: 90px" />
      </div>
    </div>

    <div v-if="prefixHint && input.trim()" class="notice notice-warn mt-2">
      输入含 <code class="mono">{{ input.trim().slice(0, 4) }}</code> 前缀，与当前所选进制不符。
      <button class="btn btn-ghost btn-sm" style="margin-left: 8px" @click="applyPrefix">按 {{ prefixHint.label }} 进制重新解析</button>
    </div>

    <div v-if="!toBigInt.ok && input.trim()" class="notice notice-err mt-2">无法按当前进制解析该数值，请检查字符是否属于对应进制。</div>

    <div class="mt-3 res-list">
      <div v-for="(r, i) in outputs" :key="r.base" class="res-row">
        <span class="r-label">{{ r.label }}</span>
        <code class="r-value mono" :class="{ dim: !toBigInt.ok }">{{ r.value }}</code>
        <button class="mini-btn" title="复制" aria-label="复制" :disabled="!toBigInt.ok" @click="copy(r.value, i)">
          <Copy v-if="!results[i]?.copied" :size="13" />
          <span v-else class="ok-mark">✓</span>
        </button>
      </div>
    </div>

    <div v-if="bits32" class="mt-3">
      <span class="field-label"><Binary :size="14" style="vertical-align: -2px" /> 32 位位模式（每 4 位分组）</span>
      <div class="bits mono">{{ bits32 }}</div>
      <p class="muted small mt-1">仅当数值落在 0 ~ 4294967295 范围内时展示。</p>
    </div>

    <div class="mt-3">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0"><Binary :size="14" style="vertical-align: -2px" /> 补码位模式</span>
        <span v-for="w in [8, 16, 32, 64]" :key="w" class="kf" :class="{ on: compWidth === w }" @click="compWidth = w">{{ w }} 位</span>
        <label class="check"><input v-model="hexUpper" type="checkbox" /> 大写十六进制</label>
      </div>
      <div v-if="complement" class="bits mono mt-2">{{ complement }}</div>
      <p class="muted small mt-1">负数按所选位宽显示补码（如 -1 在 8 位下为 1111 1111）；结果行复制时仍为原进制字符串。</p>
    </div>

    <p class="notice notice-info mt-3 small">内部使用 BigInt 运算，支持超大整数；输入可带负号。小数进制冷暂不支持（仅整数）。</p>
  </div>
</template>

<style scoped>
.res-list {
  display: grid;
  gap: 8px;
}
.res-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.r-label {
  flex: none;
  width: 86px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}
.r-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  color: var(--accent-text);
}
.r-value.dim {
  color: var(--text-3);
}
.mini-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover:not(:disabled) {
  border-color: var(--accent);
}
.mini-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ok-mark {
  color: #34d399;
  font-weight: 700;
}
.bits {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--text-2);
  overflow-x: auto;
}
.kf {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 10px;
  cursor: pointer;
  color: var(--text-2);
  font-size: 12.5px;
}
.kf.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
</style>
