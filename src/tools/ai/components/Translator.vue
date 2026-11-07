<script setup lang="ts">
import { computed, ref } from 'vue'
import { Languages } from 'lucide-vue-next'
import { translateBasic, TRANSLATE_LANGS } from '@/lib/nlpEngine'
import ResultBox from '@/components/common/ResultBox.vue'

const text = ref('你好，我的朋友。今天工作顺利吗？谢谢！')
const from = ref('auto')
const target = ref('en')

/** 目标语言：内置词库除中文外共 7 种 */
const targetLangs = computed(() => TRANSLATE_LANGS.filter((l) => l.value !== 'zh'))

const result = computed(() => translateBasic(text.value, target.value))
const coverage = computed(() => Math.round(result.value.coverage * 100))
const targetLabel = computed(() => targetLangs.value.find((l) => l.value === target.value)?.label ?? target.value)

const swapToZh = () => {
  target.value = 'zh'
}
</script>

<template>
  <div>
    <div class="notice notice-warn">
      <b>诚实说明：</b>本页使用内置小词库的<b>离线规则翻译</b>，覆盖常用问候与基础词汇；未命中的词保持原文不动。
      完整的神经网络翻译需要部署 transformers.js 等端侧模型（本站已预留能力位），当前版本适合轻量场景，请勿用于正式文书。
    </div>

    <div class="lang-row mt-2">
      <div class="grow">
        <label class="field-label">源语言</label>
        <select v-model="from" class="select w-full">
          <option value="auto">自动检测（按中文处理）</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <button class="swap" title="反向翻译（目标改为中文）" aria-label="反向翻译（目标改为中文）" @click="swapToZh"><Languages :size="16" /></button>
      <div class="grow">
        <label class="field-label">目标语言</label>
        <select v-model="target" class="select w-full">
          <option v-for="l in targetLangs" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </div>
    </div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 110px" placeholder="输入要翻译的短句或段落…"></textarea>

    <div class="cov-row mt-2">
      <span class="chip">词库命中率：{{ coverage }}%</span>
      <span class="chip">{{ targetLabel }}（离线基础翻译）</span>
    </div>

    <ResultBox class="mt-2" :model-value="result.result" title="翻译结果" :min-height="'110px'" />

    <p class="hint mt-1">
      词库覆盖：你好 / 谢谢 / 再见 / 我 / 你 / 爱 / 时间 / 工作 / 朋友 等 20 组高频词的
      英语、日语、韩语、法语、德语、西班牙语、俄语对照；命中率越低说明原文越超出词库范围。
    </p>
  </div>
</template>

<style scoped>
.lang-row { display: flex; gap: 12px; align-items: flex-end; }
.w-full { width: 100%; }
.swap {
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: none;
  color: var(--text-2);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.swap:hover { border-color: var(--accent); color: var(--accent-text); }
.cov-row { display: flex; gap: 8px; flex-wrap: wrap; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
