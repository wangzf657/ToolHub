<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { densityItems as densityItemsCore, targetStatOf, type DensityItem } from './keywordDensityCore'

const toast = useToast()

const text = ref('')
const target = ref('')
const useStopwords = ref(true) // 停用词过滤（仅英文单词条目生效）
const ngram1 = ref(true)
const ngram2 = ref(true)
const ngram3 = ref(true)

// rx5 防抖：粘贴大文本时 200ms 合并统计，避免逐键长任务
const parsed = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (parsed.value = v), 200)
})

// 纯逻辑在 ./keywordDensityCore（可测性提取，与测试同源）
const densityItems = computed<DensityItem[]>(() =>
  densityItemsCore(parsed.value, { n1: ngram1.value, n2: ngram2.value, n3: ngram3.value, stopwords: useStopwords.value }),
)

const maxCount = computed(() => densityItems.value[0]?.count ?? 1)

// rx1 目标词模式：次数、密度与判级（偏低 <0.5% / 健康 0.5–2.5% / 堆砌 >2.5%）
const targetStat = computed(() => targetStatOf(parsed.value, target.value))

const copyPhrase = async (p: string) => {
  if (await copyText(p)) toast.ok(`已复制「${p}」`)
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <!-- rx1 目标词模式 -->
    <div class="target-row">
      <div class="grow">
        <label class="field-label">查目标词（可选）</label>
        <input v-model="target" class="input" placeholder="输入核心关键词，如 工具箱" />
      </div>
      <div v-if="targetStat" class="target-card" :class="{ bad: targetStat.grade === '堆砌风险' }">
        <span class="t-word">{{ target.trim() }}</span>
        <span class="t-stat">出现 {{ targetStat.count }} 次 · 密度 {{ targetStat.density.toFixed(2) }}%</span>
        <span class="t-grade" :class="{ 'g-bad': targetStat.grade === '堆砌风险', 'g-ok': targetStat.grade === '健康' }">
          {{ targetStat.grade === '堆砌风险' ? '堆砌风险' : targetStat.grade }}
        </span>
      </div>
    </div>

    <textarea v-model="text" class="textarea mono mt-2" style="min-height: 150px" placeholder="粘贴文章内容…"></textarea>

    <div class="row row-wrap mt-2">
      <span class="opt-label">词组长短：</span>
      <button class="chip" :class="{ active: ngram1 }" @click="ngram1 = !ngram1">1 词</button>
      <button class="chip" :class="{ active: ngram2 }" @click="ngram2 = !ngram2">2 词组</button>
      <button class="chip" :class="{ active: ngram3 }" @click="ngram3 = !ngram3">3 词组</button>
      <label class="check ml-2"><input v-model="useStopwords" type="checkbox" /> 过滤停用词（仅英文）</label>
    </div>

    <!-- rx2 表格化输出 -->
    <div v-if="densityItems.length" class="table mt-2">
      <div class="thead">
        <span>词组</span><span>次数</span><span>密度</span><span class="bar-col">占比</span>
      </div>
      <button v-for="it in densityItems" :key="it.phrase" class="trow" :title="`点击复制「${it.phrase}」`" @click="copyPhrase(it.phrase)">
        <span class="phrase">{{ it.phrase }}</span>
        <span class="num">{{ it.count }}</span>
        <span class="num">{{ it.density.toFixed(2) }}%</span>
        <span class="bar-col"><span class="bar" :style="{ width: `${Math.max(2, (it.count / maxCount) * 100)}%` }"></span></span>
      </button>
    </div>
    <div v-else-if="parsed.trim()" class="notice notice-warn mt-2">（未发现出现 2 次以上的词组）</div>

    <!-- rx4 口径披露 -->
    <p class="hint mt-2">
      中文按 1–3 字滑窗统计（无分词），伪词仅供语感参考；密度 = 出现次数 × 词组长 ÷ 总词数。条形宽度按第一名次数归一化；点击行可复制词组。
    </p>
  </div>
</template>

<style scoped>
.target-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.grow { flex: 1 1 260px; }
.target-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.target-card.bad { border-color: var(--err); }
.t-word { font-weight: 700; color: var(--text-1); }
.t-stat { font-size: 13px; color: var(--text-2); }
.t-grade { font-size: 12px; font-weight: 700; padding: 1px 9px; border-radius: 999px; background: rgba(127, 127, 127, 0.14); color: var(--text-3); }
.g-ok { background: rgba(52, 211, 153, 0.12); color: var(--ok); }
.g-bad { background: rgba(248, 113, 113, 0.14); color: var(--err); }
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.opt-label { font-size: 13px; color: var(--text-3); }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.ml-2 { margin-left: 12px; }
.table { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.thead, .trow {
  display: grid;
  grid-template-columns: 1fr 70px 90px 1fr;
  gap: 10px;
  align-items: center;
  padding: 7px 12px;
}
.thead { font-size: 12px; color: var(--text-3); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); }
.trow {
  width: 100%;
  border: none;
  border-top: 1px solid var(--border);
  background: none;
  font: inherit;
  text-align: left;
  cursor: copy;
}
.trow:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.phrase { font-family: var(--font-mono); font-size: 13px; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num { font-size: 13px; color: var(--text-2); text-align: right; font-variant-numeric: tabular-nums; }
.bar-col { display: block; }
.bar { display: block; height: 9px; border-radius: 999px; background: var(--accent); min-width: 2px; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
