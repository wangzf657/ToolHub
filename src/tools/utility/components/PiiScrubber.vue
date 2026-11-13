<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ShieldCheck, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()

const input = ref('')
const output = ref('')
const found = ref<{ type: string; count: number }[]>([])
const copied = ref(false)

/* ---------- 本地脱敏管线：分段打星 + 记录高亮位置（与 lib 口径一致的六类规则） ---------- */
interface Rule { type: string; re: RegExp; keep?: number }
const RULES: Rule[] = [
  { type: '邮箱', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, keep: 2 },
  { type: '手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, keep: 4 },
  { type: '身份证', re: /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, keep: 4 },
  { type: '银行卡号', re: /(?<!\d)\d{16,19}(?!\d)/g, keep: 4 },
  { type: 'IP 地址', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, keep: 0 },
  { type: 'URL', re: /https?:\/\/[^\s<>"]+/g, keep: 0 },
]
/** 类型开关（默认全开；关闭后该类原样保留且不再统计） */
const enabled = ref<Record<string, boolean>>({})
for (const r of RULES) enabled.value[r.type] = true
/** 银行卡 Luhn 校验开关：仅校验通过的打星，未通过计入「疑似」行 */
const luhnOn = ref(false)

const luhn = (s: string) => {
  let sum = 0
  let alt = false
  for (let i = s.length - 1; i >= 0; i--) {
    let n = Number(s[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

interface Piece { text: string; hl: string }
const pieces = ref<Piece[]>([])

const maskOne = (m: string, rule: Rule): string => {
  if (rule.keep && m.includes('@')) {
    const [u, d] = m.split('@')
    return `${u.slice(0, rule.keep)}***@${d}`
  }
  if (rule.keep && /^\d+$/.test(m)) return '*'.repeat(Math.max(0, m.length - rule.keep)) + m.slice(-rule.keep)
  return '*'.repeat(Math.min(m.length, 12))
}

const runScrub = () => {
  const text = input.value
  if (!text) {
    output.value = ''
    found.value = []
    pieces.value = []
    return
  }
  let cur: Piece[] = [{ text, hl: '' }]
  const foundMap = new Map<string, number>()
  let suspectBank = 0
  for (const rule of RULES) {
    if (!enabled.value[rule.type]) continue
    const next: Piece[] = []
    for (const p of cur) {
      if (p.hl) {
        next.push(p)
        continue
      }
      let last = 0
      for (const m of p.text.matchAll(rule.re)) {
        const idx = m.index ?? 0
        if (idx > last) next.push({ text: p.text.slice(last, idx), hl: '' })
        if (rule.type === '银行卡号' && luhnOn.value && !luhn(m[0])) {
          // 未过 Luhn：不打星，计入疑似行
          next.push({ text: m[0], hl: '' })
          suspectBank++
        } else {
          next.push({ text: maskOne(m[0], rule), hl: rule.type })
          foundMap.set(rule.type, (foundMap.get(rule.type) ?? 0) + 1)
        }
        last = idx + m[0].length
      }
      if (last < p.text.length) next.push({ text: p.text.slice(last), hl: '' })
    }
    cur = next
  }
  pieces.value = cur
  output.value = cur.map((p) => p.text).join('')
  found.value = [...foundMap.entries()].map(([type, count]) => ({ type, count }))
  if (suspectBank > 0) found.value.push({ type: '疑似银行卡（未过校验）', count: suspectBank })
}

/* ---------- 实时脱敏：输入防抖 300ms 自动执行，保留手动按钮 ---------- */
let dTimer: number | null = null
watch(input, () => {
  if (dTimer !== null) window.clearTimeout(dTimer)
  dTimer = window.setTimeout(() => {
    dTimer = null
    runScrub()
  }, 300)
})
watch([enabled, luhnOn], runScrub, { deep: true })

/* ---------- ?text= 带参预填（ai/entity-extractor 互链跳转）并自动脱敏 ---------- */
const qtext = route.query.text
if (typeof qtext === 'string' && qtext) {
  input.value = qtext
  runScrub()
}

const doCopy = async () => {
  if (!output.value) return
  const okFlag = await copyText(output.value)
  if (okFlag) {
    copied.value = true
    toast.ok('脱敏结果已复制')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const maskRule = (type: string): string => {
  switch (type) {
    case '邮箱':
      return '保留前 2 位 + ***@域名'
    case '手机号':
    case '身份证':
    case '银行卡号':
      return '保留末 4 位，前部打星'
    default:
      return '整体打星遮盖'
  }
}

const clearAll = () => {
  input.value = ''
  output.value = ''
  found.value = []
  pieces.value = []
}
onBeforeUnmount(() => {
  if (dTimer !== null) window.clearTimeout(dTimer)
})
</script>

<template>
  <div>
    <div class="io-head">
      <span class="io-title">原始文本（输入后 0.3 秒自动脱敏）</span>
      <button class="btn btn-ghost btn-sm" :disabled="!input" @click="clearAll">清空</button>
    </div>
    <textarea
      v-model="input"
      class="textarea mono mt-1"
      style="min-height: 150px"
      placeholder="贴入包含邮箱、手机号、身份证、IP、URL 等信息的文本…（仅本地处理）"
    ></textarea>

    <div class="rule-row mt-2">
      <button
        v-for="r in RULES" :key="r.type" class="chip" :class="{ active: enabled[r.type] }"
        :title="enabled[r.type] ? '点击后该类原样保留' : '点击后启用该类脱敏'"
        @click="enabled[r.type] = !enabled[r.type]"
      >
        {{ enabled[r.type] ? '✓ ' : '' }}{{ r.type }}
      </button>
      <label class="check"><input v-model="luhnOn" type="checkbox" /> 银行卡 Luhn 校验</label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="runScrub">
        <ShieldCheck :size="16" /> 立即脱敏
      </button>
      <button v-if="output" class="btn btn-ghost" @click="doCopy">
        <Check v-if="copied" :size="15" />
        <Copy v-else :size="15" /> 复制结果
      </button>
    </div>

    <template v-if="output">
      <div class="io-head mt-2">
        <span class="io-title">脱敏结果（黄色为遮盖处）</span>
      </div>
      <pre class="code-block mt-1"><template v-for="(p, i) in pieces" :key="i"><mark v-if="p.hl" class="hl">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></pre>

      <div v-if="found.length" class="mt-2">
        <span class="io-title">发现统计</span>
        <div class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th>类型</th><th>识别数量</th><th>遮盖方式</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in found" :key="f.type">
                <td>{{ f.type }}</td>
                <td class="mono">{{ f.count }} 个</td>
                <td>{{ maskRule(f.type) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RouterLink class="ext-link mt-1" :to="{ path: '/t/text-extractor', query: { text: input } }">
          查看/导出这些敏感项 → 文本提取器
        </RouterLink>
      </div>
      <div v-else class="notice notice-ok mt-2">未发现邮箱 / 手机号 / 身份证 / 银行卡 / IP / URL。</div>
    </template>
  </div>
</template>

<style scoped>
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.code-block {
  white-space: pre-wrap;
  word-break: break-all;
}
.rule-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.hl {
  background: rgba(250, 204, 21, 0.45);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
}
.ext-link {
  display: inline-block;
  font-size: 13px;
  color: var(--accent-text);
}
</style>
