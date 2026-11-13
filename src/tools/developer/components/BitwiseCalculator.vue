<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Cpu, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const router = useRouter()
const a = ref('0b1100')
const b = ref('10')
/** 位宽：8/16/32/64（64 位用 BigInt 精确运算） */
const width = ref(32)

/** 解析 0x/0b 前缀或十进制整数为 BigInt */
function parseIntBig(s: string): bigint {
  const t = s.trim().toLowerCase().replace(/_/g, '')
  if (!t) throw new Error('空输入')
  const neg = t.startsWith('-')
  const body = neg ? t.slice(1) : t
  const v = body.startsWith('0x') ? BigInt('0x' + body.slice(2)) : body.startsWith('0b') ? BigInt('0b' + body.slice(2)) : body.startsWith('0o') ? BigInt('0o' + body.slice(2)) : BigInt(body)
  return neg ? -v : v
}

const MASK = computed(() => (1n << BigInt(width.value)) - 1n)
const mask = (x: bigint) => ((x % (MASK.value + 1n)) + MASK.value + 1n) % (MASK.value + 1n)

const AV = computed(() => {
  try {
    return { ok: true as const, value: mask(parseIntBig(a.value)) }
  } catch {
    return { ok: false as const, value: 0n }
  }
})
const BV = computed(() => {
  try {
    return { ok: true as const, value: mask(parseIntBig(b.value)) }
  } catch {
    return { ok: false as const, value: 0n }
  }
})

const OPS = [
  { op: 'AND', calc: (x: bigint, y: bigint) => x & y, hint: '都为 1 才为 1' },
  { op: 'OR', calc: (x: bigint, y: bigint) => x | y, hint: '有 1 即为 1' },
  { op: 'XOR', calc: (x: bigint, y: bigint) => x ^ y, hint: '相同为 0 不同为 1' },
  { op: 'NOT A', calc: (x: bigint, _y: bigint) => ~x & MASK.value, hint: '按当前位宽按位取反' },
  { op: 'A << B', calc: (x: bigint, y: bigint) => mask(x << (y % BigInt(width.value))), hint: 'A 左移 B 位（按位宽截断）' },
  { op: 'A >> B', calc: (x: bigint, y: bigint) => x >> (y % BigInt(width.value)), hint: 'A 右移 B 位' },
] as const

/** 已执行操作列表：逐条堆叠展示、逐条可复制（rx3） */
interface OpRow {
  op: string
  value: bigint
}
const history = ref<OpRow[]>([])

const run = (o: (typeof OPS)[number]) => {
  if (!AV.value.ok || !BV.value.ok) {
    toast.err('两个输入都必须是合法整数（支持 0x / 0b / 0o 前缀与负号）')
    return
  }
  const value = o.calc(AV.value.value, BV.value.value)
  history.value = [{ op: o.op, value }, ...history.value].slice(0, 12)
  toast.ok(`已计算 ${o.op}`)
}

/* 实时重算：A/B 变化后 300ms 防抖自动重放最近一次操作（rx1） */
let lastOp: (typeof OPS)[number] | null = null
const runLatest = () => {
  if (lastOp && AV.value.ok && BV.value.ok) {
    history.value = [{ op: lastOp.op, value: lastOp.calc(AV.value.value, BV.value.value) }, ...history.value.filter((h) => h.op !== lastOp!.op)]
  }
}
const deb = debounceRun(runLatest, 300)
watch([a, b, width], () => deb.call())
// 记录最近操作
const runAndRemember = (o: (typeof OPS)[number]) => {
  lastOp = o
  run(o)
}

const fmt = (n: bigint) => ({
  dec: n.toString(10),
  hex: '0x' + n.toString(16).toUpperCase().padStart(width.value / 4, '0'),
  bin: n.toString(2).padStart(width.value, '0'),
})

/** 位板：各位可点击翻转，翻转后输入框同步更新（rx4） */
const W = computed(() => Array.from({ length: width.value }, (_, i) => width.value - 1 - i))
const flipA = (bit: number) => {
  if (!AV.value.ok) return
  a.value = '0x' + (AV.value.value ^ (1n << BigInt(bit))).toString(16)
}
const flipB = (bit: number) => {
  if (!BV.value.ok) return
  b.value = '0x' + (BV.value.value ^ (1n << BigInt(bit))).toString(16)
}

const bitsOf = (ok: boolean, v: bigint) => (ok ? v.toString(2).padStart(width.value, '0') : '—'.repeat(width.value))
const A_BITS = computed(() => bitsOf(AV.value.ok, AV.value.value))
const B_BITS = computed(() => bitsOf(BV.value.ok, BV.value.value))

const copiedIdx = ref(-1)
const copyRow = async (h: OpRow, i: number) => {
  const f = fmt(h.value)
  const okFlag = await copyText(`${h.op} = ${f.dec} (0x${f.hex.slice(2)}, ${f.bin})`)
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}

/** 互链：把 A 值带到进制转换工具（rx5） */
const goToBase = () => {
  if (AV.value.ok) sessionStorage.setItem('toolhub.transfer.number-base-converter', JSON.stringify({ input: '0x' + AV.value.value.toString(16), base: 16 }))
  router.push('/t/number-base-converter')
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
      <div>
        <span class="field-label">位宽</span>
        <div class="row" style="gap: 4px">
          <span v-for="w in [8, 16, 32, 64]" :key="w" class="kf" :class="{ on: width === w }" @click="width = w">{{ w }}</span>
        </div>
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 8px">
      <button v-for="o in OPS" :key="o.op" class="btn btn-primary btn-sm" :title="o.hint" @click="runAndRemember(o)">{{ o.op }}</button>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="goToBase">进制转换 →</button>
    </div>
    <p class="muted small mt-1">输入变化后 300ms 自动重算最近一次操作；位板各位可点击翻转（翻转后输入框同步更新）。</p>

    <div v-if="!AV.ok || !BV.ok" class="notice notice-warn mt-2">输入需为整数（按 {{ width }} 位无符号截断），支持 0x（十六进制）、0b（二进制）、0o（八进制）前缀与负号。</div>

    <div v-if="history.length" class="mt-3 result-card">
      <div v-for="(h, i) in history" :key="i" class="res-row hist-row">
        <b class="op-tag mono">{{ h.op }}</b>
        <span class="mono">{{ fmt(h.value).dec }}</span>
        <span class="mono">{{ fmt(h.value).hex }}</span>
        <span class="mono bin">{{ fmt(h.value).bin.replace(/(.{4})(?=.)/g, '$1 ') }}</span>
        <button class="mini-btn" title="复制本行" :aria-label="`复制 ${h.op} 结果`" @click="copyRow(h, i)">
          <Check v-if="copiedIdx === i" :size="13" color="#34d399" /><Copy v-else :size="13" />
        </button>
      </div>
    </div>

    <div class="mt-3 bit-board mono">
      <div class="bb-row">
        <span class="bb-tag">A</span>
        <span class="bb-bits">
          <button v-for="bit in W" :key="'a' + bit" class="bb-bit" :title="`翻转 A 第 ${bit} 位`" :aria-label="`翻转 A 第 ${bit} 位`" @click="flipA(bit)">
            {{ A_BITS[width - 1 - bit] }}
          </button>
        </span>
      </div>
      <div class="bb-row">
        <span class="bb-tag">B</span>
        <span class="bb-bits">
          <button v-for="bit in W" :key="'b' + bit" class="bb-bit" :title="`翻转 B 第 ${bit} 位`" :aria-label="`翻转 B 第 ${bit} 位`" @click="flipB(bit)">
            {{ B_BITS[width - 1 - bit] }}
          </button>
        </span>
      </div>
      <div class="bb-scale mono">{{ width - 1 }} … 0（点击任意一位翻转该位）</div>
    </div>

    <p class="notice notice-info mt-3 small"><Cpu :size="13" style="vertical-align: -2px" /> 按 {{ width }} 位无符号整数运算（BigInt 精确）；移位量取 B 对 {{ width }} 取模；NOT 按当前位宽取反。</p>
  </div>
</template>

<style scoped>
.kf {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 3px 10px;
  cursor: pointer;
  color: var(--text-2);
  font-size: 12.5px;
}
.kf.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
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
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  flex-wrap: wrap;
}
.hist-row > span:nth-of-type(1) {
  min-width: 70px;
}
.hist-row .bin {
  color: var(--text-2);
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
  margin-left: auto;
}
.mini-btn:hover {
  border-color: var(--accent);
}
.bin {
  letter-spacing: 1px;
}
.bb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bb-tag {
  flex: none;
  width: 20px;
  font-weight: 700;
  color: var(--text-3);
  text-align: center;
}
.bb-bits {
  display: flex;
  gap: 2px;
  overflow-x: auto;
}
.bb-bit {
  border: none;
  background: none;
  color: var(--text-2);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 1px;
  border-radius: 3px;
}
.bb-bit:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.bb-scale {
  font-size: 10.5px;
  color: var(--text-3);
  text-align: center;
}
</style>
