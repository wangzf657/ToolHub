<script setup lang="ts">
import { computed, ref } from 'vue'
import { Cpu } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const a = ref('0b1100')
const b = ref('10')
const result = ref<{ op: string; value: number } | null>(null)

/** 解析 0x/0b 前缀或十进制整数为 32 位无符号 */
function parseInt32(s: string): number {
  const t = s.trim().toLowerCase().replace(/_/g, '')
  if (!t) throw new Error('空输入')
  const v = t.startsWith('0x') ? Number.parseInt(t.slice(2), 16) : t.startsWith('0b') ? Number.parseInt(t.slice(2), 2) : Number.parseInt(t, 10)
  if (Number.isNaN(v)) throw new Error(`无法解析 “${s}”`)
  return v >>> 0
}

const AV = computed(() => {
  try {
    return { ok: true as const, value: parseInt32(a.value) }
  } catch {
    return { ok: false as const, value: 0 }
  }
})
const BV = computed(() => {
  try {
    return { ok: true as const, value: parseInt32(b.value) }
  } catch {
    return { ok: false as const, value: 0 }
  }
})

const OPS = [
  { op: 'AND', calc: (x: number, y: number) => (x & y) >>> 0, hint: '都为 1 才为 1' },
  { op: 'OR', calc: (x: number, y: number) => (x | y) >>> 0, hint: '有 1 即为 1' },
  { op: 'XOR', calc: (x: number, y: number) => (x ^ y) >>> 0, hint: '相同为 0 不同为 1' },
  { op: 'A << B', calc: (x: number, y: number) => (x << (y % 32)) >>> 0, hint: 'A 左移 B 位' },
  { op: 'A >> B', calc: (x: number, y: number) => (x >> (y % 32)) >>> 0, hint: 'A 右移 B 位' },
] as const

const run = (o: (typeof OPS)[number]) => {
  if (!AV.value.ok || !BV.value.ok) {
    toast.err('两个输入都必须是合法整数（支持 0x / 0b 前缀）')
    return
  }
  result.value = { op: o.op, value: o.calc(AV.value.value, BV.value.value) }
  toast.ok(`已计算 ${o.op}`)
}

const fmt = (n: number) => ({
  dec: String(n),
  hex: '0x' + n.toString(16).toUpperCase().padStart(8, '0'),
  bin: n.toString(2).padStart(32, '0'),
})

const A_BITS = computed(() => (AV.value.ok ? AV.value.value.toString(2).padStart(32, '0') : '—'.repeat(32)))
const B_BITS = computed(() => (BV.value.ok ? BV.value.value.toString(2).padStart(32, '0') : '—'.repeat(32)))
const R_BITS = computed(() => (result.value ? result.value.value.toString(2).padStart(32, '0') : ''))

const copyResult = async () => {
  if (!result.value) return
  const f = fmt(result.value.value)
  const okFlag = await copyText(`${f.dec} (0x${f.hex.slice(2)}, ${f.bin})`)
  okFlag ? toast.ok('结果已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="bit-calc">
    <div class="row row-wrap" style="gap: 12px">
      <div class="grow" style="min-width: 180px">
        <span class="field-label">整数 A</span>
        <input v-model="a" type="text" class="input mono" spellcheck="false" placeholder="42 或 0x2A 或 0b101010" />
      </div>
      <div class="grow" style="min-width: 180px">
        <span class="field-label">整数 B</span>
        <input v-model="b" type="text" class="input mono" spellcheck="false" placeholder="10 或 0x0A 或 0b1010" />
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 8px">
      <button v-for="o in OPS" :key="o.op" class="btn btn-primary btn-sm" :title="o.hint" @click="run(o)">{{ o.op }}</button>
    </div>

    <div v-if="!AV.ok || !BV.ok" class="notice notice-warn mt-2">输入需为 0 ~ 4294967295 的整数，支持 0x（十六进制）与 0b（二进制）前缀。</div>

    <div v-if="result" class="mt-3 result-card">
      <div class="row" style="align-items: center; margin-bottom: 8px">
        <b class="op-tag mono">{{ result.op }}</b>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copyResult">复制</button>
      </div>
      <div class="res-row"><span>十进制</span><b class="mono">{{ fmt(result.value).dec }}</b></div>
      <div class="res-row"><span>十六进制</span><b class="mono">{{ fmt(result.value).hex }}</b></div>
      <div class="res-row"><span>二进制</span><b class="mono bin">{{ fmt(result.value).bin.replace(/(.{4})(?=.)/g, '$1 ') }}</b></div>
    </div>

    <div class="mt-3 bit-board mono">
      <div class="bb-row"><span class="bb-tag">A</span><span class="bb-bits">{{ A_BITS.replace(/(.{4})(?=.)/g, '$1 ') }}</span></div>
      <div class="bb-row"><span class="bb-tag">B</span><span class="bb-bits">{{ B_BITS.replace(/(.{4})(?=.)/g, '$1 ') }}</span></div>
      <div v-if="R_BITS" class="bb-row active"><span class="bb-tag">R</span><span class="bb-bits">{{ R_BITS.replace(/(.{4})(?=.)/g, '$1 ') }}</span></div>
      <div class="bb-scale mono">31 … 24 · 23 … 16 · 15 … 8 · 7 … 0</div>
    </div>

    <p class="notice notice-info mt-3 small"><Cpu :size="13" style="vertical-align: -2px" /> 按 32 位无符号整数运算；移位量取 B 对 32 取模。</p>
  </div>
</template>

<style scoped>
.op-tag {
  color: var(--accent-text);
  background: var(--accent-soft);
  padding: 3px 10px;
  border-radius: 7px;
  font-size: 13px;
}
.result-card,
.bit-board {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 8px;
}
.res-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
}
.res-row span {
  color: var(--text-3);
}
.bin {
  letter-spacing: 1px;
}
.bb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bb-row.active .bb-bits {
  color: var(--accent-text);
}
.bb-tag {
  flex: none;
  width: 20px;
  font-weight: 700;
  color: var(--text-3);
  text-align: center;
}
.bb-bits {
  font-size: 13px;
  letter-spacing: 1.5px;
  color: var(--text-2);
  overflow-x: auto;
  white-space: nowrap;
}
.bb-scale {
  font-size: 10.5px;
  color: var(--text-3);
  text-align: center;
}
</style>
