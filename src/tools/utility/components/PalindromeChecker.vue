<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, Eraser } from 'lucide-vue-next'
import { isAnagram, isPalindrome } from '@/lib/textEngine'

/** 与引擎一致的清洗规则，用于展示「对称串」 */
const cleanOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

const palText = ref('')
const palClean = computed(() => cleanOf(palText.value))
const palRev = computed(() => [...palClean.value].reverse().join(''))
const palOk = computed(() => palClean.value.length > 0 && palClean.value === palRev.value)
const palEmpty = computed(() => palClean.value.length === 0)

const anaA = ref('')
const anaB = ref('')
const anaOk = computed(() => {
  if (!anaA.value || !anaB.value) return false
  return isAnagram(anaA.value, anaB.value)
})
const anaPending = computed(() => !anaA.value.trim() || !anaB.value.trim())

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
      <input v-model="palText" class="input" placeholder="例如 上海自来水来自海上 / A man, a plan..." @keydown.enter.prevent />
      <div v-if="palText" class="verdict mt-2" :class="palEmpty ? 'neutral' : palOk ? 'yes' : 'no'">
        {{ palEmpty ? '（去除标点后为空，无法判断）' : palOk ? '是回文' : '不是回文' }}
      </div>
      <div v-if="palClean" class="mono clean-box">
        <div>清洗后：{{ palClean }}</div>
        <div>反转后：{{ palRev }}</div>
      </div>
      <p class="muted small">自动忽略大小写、空格与标点，仅保留英文字母、数字与汉字后正反比对。</p>
    </div>

    <!-- 变位词检测 -->
    <div class="pane">
      <div class="pane-head">
        <span class="pane-title">变位词检测（Anagram）</span>
        <button class="btn btn-ghost btn-sm" :disabled="!anaA && !anaB" @click="clearAna"><Eraser :size="13" /> 清空</button>
      </div>
      <div class="ana-inputs">
        <input v-model="anaA" class="input mono" placeholder="第一个词，例如 listen" />
        <button class="swap-btn" title="交换" @click="swapAna"><ArrowLeftRight :size="15" /></button>
        <input v-model="anaB" class="input mono" placeholder="第二个词，例如 silent" />
      </div>
      <div v-if="anaA || anaB" class="verdict mt-2" :class="anaPending ? 'neutral' : anaOk ? 'yes' : 'no'">
        {{ anaPending ? '（请填入两个词再判断）' : anaOk ? '互为变位词' : '不是变位词' }}
      </div>
      <p class="muted small">把两个词的全部字符排序后比较是否完全一致（同样忽略大小写与标点）。例如 listen 与 silent。</p>
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
</style>
