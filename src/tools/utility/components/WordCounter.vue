<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eraser } from 'lucide-vue-next'
import { textStats } from '@/lib/textEngine'

const text = ref('')
const s = computed(() => textStats(text.value))

const tiles = computed(() => [
  { label: '总字数', value: s.value.words, hint: '汉字 + 英文单词' },
  { label: '字符数', value: s.value.chars, hint: '含空格与换行' },
  { label: '字符（不含空格）', value: s.value.charsNoSpaces, hint: '去除所有空白' },
  { label: '中文汉字', value: s.value.cjk, hint: '中日韩统一表意文字' },
  { label: '英文单词', value: s.value.englishWords, hint: '字母数字连续串' },
  { label: '行数', value: s.value.lines, hint: '按换行计' },
  { label: '句子数', value: s.value.sentences, hint: '按 。.!? 计' },
  { label: '段落数', value: s.value.paragraphs, hint: '按空行分隔' },
  { label: '预计阅读时长', value: s.value.readingMinutes, hint: '按 300 字/分钟' },
])

const clear = () => {
  text.value = ''
}
</script>

<template>
  <div>
    <div class="io-head">
      <span class="io-title">输入文本（实时统计）</span>
      <button class="btn btn-ghost btn-sm" :disabled="!text" @click="clear"><Eraser :size="14" /> 清空</button>
    </div>
    <textarea v-model="text" class="textarea mono mt-1" style="min-height: 220px" placeholder="在此粘贴或输入要统计的文本…"></textarea>

    <div class="tiles mt-2">
      <div v-for="t in tiles" :key="t.label" class="tile">
        <span class="tile-num">{{ t.value }}</span>
        <span class="tile-label">{{ t.label }}</span>
        <span class="tile-hint">{{ t.hint }}</span>
      </div>
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
.tiles {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
@media (max-width: 900px) {
  .tiles {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 560px) {
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}
.tile {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 14px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  text-align: center;
}
.tile-num {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent-text);
  line-height: 1.1;
}
.tile-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.tile-hint {
  font-size: 11.5px;
  color: var(--text-3);
}
</style>
