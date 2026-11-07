<script setup lang="ts">
import { computed, ref } from 'vue'
import { Binary, Copy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('255')
const fromBase = ref(10)
const customBase = ref(32)
const results = ref<{ copied: boolean }[]>([])

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
  return target.map((base) => ({
    base,
    label: R.find((r) => r.base === base)?.label ?? `${base} 进制`,
    value: parsed.ok ? fromBigInt(parsed.value, base) : '—',
  }))
})

const bits32 = computed(() => {
  const parsed = toBigInt.value
  if (!parsed.ok) return ''
  const v = parsed.value
  if (v < 0n || v > 0xffffffffn) return ''
  return v.toString(2).padStart(32, '0').replace(/(.{4})(?=.)/g, '$1 ')
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

    <p class="notice notice-info mt-3 small">内部使用 BigInt 运算，支持超大整数；输入可带负号。</p>
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
</style>
