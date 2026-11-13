<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight, Eraser } from 'lucide-vue-next'
import { isAnagram, isPalindrome } from '@/lib/textEngine'

/** 与引擎一致的清洗规则，用于展示「对称串」与差异定位 */
const cleanOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

const palText = ref('')
const palClean = computed(() => cleanOf(palText.value))
const palRev = computed(() => [...palClean.value].reverse().join(''))
const palOk = computed(() => palClean.value.length > 0 && palClean.value === palRev.value)
const palEmpty = computed(() => palClean.value.length === 0)

/** 差一步提示：找出第一个不对称位置，说明该位两侧字符 */
const mismatch = computed(() => {
  const s = palClean.value
  if (!s || palOk.value) return null
  for (let i = 0; i < Math.floor(s.length / 2); i++) {
    if (s[i] !== s[s.length - 1 - i]) {
      return { n: i, k: i + 1, x: s[i], y: s[s.length - 1 - i] }
    }
  }
  return null // 奇数长度中间位不参与（引擎口径亦如此）
})

const EXAMPLES = ['上海自来水来自海上', 'A man, a plan, a canal: Panama', '今天好天气']

/* ---------- 判定历史：双 pane 各自最近 5 条，点击回填重判 ---------- */
interface HistItem { text: string; ok: boolean }
const HIST_KEYS = { pal: 'toolhub.palindrome-history', ana: 'toolhub.anagram-history' }
const loadHist = (key: string): HistItem[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as HistItem[]
  } catch {
    return []
  }
}
const palHistory = ref<HistItem[]>(loadHist(HIST_KEYS.pal))
const anaHistory = ref<HistItem[]>(loadHist(HIST_KEYS.ana))

const truncate = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n)}…` : s)
const pushHist = (key: string, list: { value: HistItem[] }, text: string, ok: boolean) => {
  const t = text.trim()
  if (!t) return
  if (list.value[0]?.text === truncate(t)) return // 与最新一条相同不重复记
  list.value = [{ text: truncate(t), ok }, ...list.value.filter((x) => x.text !== truncate(t))].slice(0, 5)
  try {
    localStorage.setItem(key, JSON.stringify(list.value))
  } catch {
    /* 隐私模式忽略 */
  }
}

watch([palText, palOk], () => {
  if (palText.value.trim() && !palEmpty.value) pushHist(HIST_KEYS.pal, palHistory, palText.value, palOk.value)
})
const applyPalHist = (h: HistItem) => {
  palText.value = h.text
}

const anaA = ref('')
const anaB = ref('')
const anaOk = computed(() => {
  if (!anaA.value || !anaB.value) return false
  return isAnagram(anaA.value, anaB.value)
})
const anaPending = computed(() => !anaA.value.trim() || !anaB.value.trim())

watch([anaA, anaB, anaOk], () => {
  if (!anaPending.value) pushHist(HIST_KEYS.ana, anaHistory, `${anaA.value} ↔ ${anaB.value}`, anaOk.value)
})
const applyAnaHist = (h: HistItem) => {
  const [a, b] = h.text.split(' ↔ ')
  if (a && b) {
    anaA.value = a
    anaB.value = b
  }
}

const clearPal = () => (palText.value = '')
const clearAna = () => {
  anaA.value = ''
  anaB.value = ''
}
const swapAna = () => {
  ;[anaA.value, anaB.value] = [anaB.value, anaA.value]
}
</script>

<template>
  <div class="grid-2">
    <!-- 回文检测 -->
    <div class="pane">
      <div class="pane-head">
        <span class="pane-title">回文检测</span>
        <button class="btn btn-ghost btn-sm" :disabled="!palText" @click="clearPal"><Eraser :size="13" /> 清空</button>
      </div>
      <input v-model="palText" class="input" placeholder="例如 上海自来水来自海上 / A man, a plan..." />
      <div class="chips">
        <span class="chips-label">示例：</span>
        <button v-for="e in EXAMPLES" :key="e" class="chip-btn" @click="palText = e">{{ truncate(e, 14) }}</button>
      </div>
      <div v-if="palText" class="verdict mt-2" :class="palEmpty ? 'neutral' : palOk ? 'yes' : 'no'">
        {{ palEmpty ? '（去除标点后为空，无法判断）' : palOk ? '是回文' : '不是回文' }}
      </div>
      <div v-if="mismatch" class="mismatch-tip">
        前 {{ mismatch.n }} 位对称一致，差异在：清洗后第 {{ mismatch.k }} 位『{{ mismatch.x }}』vs『{{ mismatch.y }}』
      </div>
      <div v-if="palClean" class="mono clean-box">
        <div>清洗后：{{ palClean }}</div>
        <div>反转后：{{ palRev }}</div>
      </div>
      <p class="muted small">自动忽略大小写、空格与标点，仅保留英文字母、数字与汉字后正反比对；全角数字与带声调字母不参与判定。</p>
      <div v-if="palHistory.length" class="hist">
        <span class="chips-label">最近判定：</span>
        <button v-for="(h, i) in palHistory" :key="i" class="hist-chip" @click="applyPalHist(h)">
          <span class="dot" :class="h.ok ? 'ok' : 'bad'"></span>{{ h.text }}
        </button>
      </div>
    </div>

    <!-- 变位词检测 -->
    <div class="pane">
      <div class="pane-head">
        <span class="pane-title">变位词检测（Anagram）</span>
        <button class="btn btn-ghost btn-sm" :disabled="!anaA && !anaB" @click="clearAna"><Eraser :size="13" /> 清空</button>
      </div>
      <div class="ana-inputs">
        <input v-model="anaA" class="input mono" placeholder="第一个词，例如 listen" />
        <button class="swap-btn" title="交换" aria-label="交换" @click="swapAna"><ArrowLeftRight :size="15" /></button>
        <input ref="anaInputEl" v-model="anaB" class="input mono" placeholder="第二个词，例如 silent" />
      </div>
      <div v-if="anaA || anaB" class="verdict mt-2" :class="anaPending ? 'neutral' : anaOk ? 'yes' : 'no'">
        {{ anaPending ? '（请填入两个词再判断）' : anaOk ? '互为变位词' : '不是变位词' }}
      </div>
      <p class="muted small">把两个词的全部字符排序后比较是否完全一致（同样忽略大小写与标点）。例如 listen 与 silent。</p>
      <p class="muted small">中文按单字比较（上海 ↔ 海上 会判定为互为变位词）。</p>
      <div v-if="anaHistory.length" class="hist">
        <span class="chips-label">最近判定：</span>
        <button v-for="(h, i) in anaHistory" :key="i" class="hist-chip" @click="applyAnaHist(h)">
          <span class="dot" :class="h.ok ? 'ok' : 'bad'"></span>{{ h.text }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pane {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  display: grid;
  gap: 10px;
  align-content: start;
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pane-title {
  font-weight: 700;
  font-size: 15px;
}
.verdict {
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
}
.verdict.yes {
  background: rgba(52, 211, 153, 0.1);
  color: var(--ok);
  border: 1px solid rgba(52, 211, 153, 0.3);
}
.verdict.no {
  background: rgba(248, 113, 113, 0.08);
  color: var(--err);
  border: 1px solid rgba(248, 113, 113, 0.25);
}
.verdict.neutral {
  background: color-mix(in srgb, var(--text-3) 10%, transparent);
  color: var(--text-2);
  border: 1px solid var(--border);
}
.mismatch-tip {
  font-size: 13px;
  color: #d97706;
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 10px;
  padding: 8px 12px;
}
.clean-box {
  font-size: 13px;
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  word-break: break-all;
}
.ana-inputs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}
@media (max-width: 560px) {
  .ana-inputs {
    grid-template-columns: 1fr;
  }
}
.swap-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--accent-soft);
  color: var(--accent-text);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.chips-label {
  font-size: 12.5px;
  color: var(--text-3);
}
.chip-btn {
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--text);
}
.chip-btn:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}
.hist {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.hist-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--text);
  max-width: 100%;
}
.hist-chip:hover {
  border-color: var(--accent);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.dot.ok {
  background: var(--ok);
}
.dot.bad {
  background: var(--err);
}
</style>
