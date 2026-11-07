<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileDown } from 'lucide-vue-next'
import { STOPWORDS, wordFrequency } from '@/lib/textEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('')
const ignoreCase = ref(true)
const useStopwords = ref(false)
const topN = ref(50)

const total = computed(() => freq.value.reduce((a, c) => a + c.count, 0))
const freq = computed(() => {
  if (!text.value.trim()) return []
  try {
    return wordFrequency(text.value, {
      ignoreCase: ignoreCase.value,
      stopwords: useStopwords.value,
      top: Math.max(1, Math.min(1000, topN.value)),
    })
  } catch {
    return []
  }
})

const pct = (count: number): string => (total.value ? `${((count / total.value) * 100).toFixed(1)}%` : '0%')

const downloadCsv = () => {
  if (!freq.value.length) return
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = ['词,次数,占比', ...freq.value.map((r) => `${esc(r.word)},${r.count},${pct(r.count)}`)]
  saveText('\ufeff' + lines.join('\n'), '词频统计.csv', 'text/csv;charset=utf-8')
  toast.ok('已下载 CSV')
}
</script>

<template>
  <div>
    <div class="io-head">
      <span class="io-title">输入文本</span>
    </div>
    <textarea v-model="text" class="textarea mono mt-1" style="min-height: 180px" placeholder="粘贴文章或语料，统计每个词出现的次数…"></textarea>

    <div class="opts row row-wrap mt-2">
      <label class="check">
        <input v-model="ignoreCase" type="checkbox" />
        <span>忽略大小写</span>
      </label>
      <label class="check">
        <input v-model="useStopwords" type="checkbox" />
        <span>过滤英文停用词（{{ STOPWORDS.size }} 个）</span>
      </label>
      <span class="field-label" style="margin: 0">Top</span>
      <input v-model.number="topN" type="number" class="input top-in" min="1" max="1000" />
    </div>

    <div v-if="freq.length" class="mt-2">
      <div class="io-head">
        <span class="io-title">共 {{ freq.length }} 个词 · 总计 {{ total }} 次</span>
        <button class="btn btn-ghost btn-sm" @click="downloadCsv"><FileDown :size="14" /> 下载 CSV</button>
      </div>
      <div class="table-wrap mt-1">
        <table class="data-table">
          <thead>
            <tr><th>排名</th><th>词</th><th>次数</th><th>占比</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in freq" :key="r.word">
              <td>{{ i + 1 }}</td>
              <td class="mono">{{ r.word }}</td>
              <td class="mono">{{ r.count }}</td>
              <td class="mono">{{ pct(r.count) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small mt-1">中文按相邻两字组合统计（简化分词），英文按连续字母数字切分。</p>
    </div>
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
.opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  gap: 16px;
}
.top-in {
  width: 90px;
}
</style>
