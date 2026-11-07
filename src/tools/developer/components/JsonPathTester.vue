<script setup lang="ts">
import { ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { jsonPathQuery } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const json = ref('{\n  "store": {\n    "book": [\n      { "title": "三体", "price": 45, "inStock": true },\n      { "title": "流浪地球", "price": 32, "inStock": false },\n      { "title": "球状闪电", "price": 28, "inStock": true }\n    ],\n    "location": "北京朝阳书店"\n  }\n}')
const path = ref('$.store.book[*].title')
const error = ref('')
const results = ref<unknown[]>([])
const resultTexts = ref<string[]>([])

const SYNTAX = [
  { token: '$', desc: '根对象' },
  { token: '.key', desc: '子属性' },
  { token: '["key"]', desc: '带特殊字符的属性' },
  { token: '[0]', desc: '数组下标（支持负数）' },
  { token: '[*]', desc: '所有子项' },
  { token: '..key', desc: '递归查找所有层级' },
  { token: '[0:2]', desc: '数组切片' },
  { token: '[?(@.price==45)]', desc: '过滤器（简化支持 ==）' },
]

const run = () => {
  error.value = ''
  results.value = []
  resultTexts.value = []
  if (!json.value.trim()) return toast.warn('请先粘贴 JSON')
  let data: unknown
  try {
    data = JSON.parse(json.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 100)}`
    return
  }
  if (!path.value.trim()) return toast.warn('请输入 JSONPath 表达式')
  try {
    results.value = jsonPathQuery(data, path.value)
    resultTexts.value = results.value.map((r) => JSON.stringify(r, null, 2))
    toast.ok(`命中 ${results.value.length} 条`)
  } catch (e) {
    error.value = `查询失败：${(e as Error).message}`
  }
}
</script>

<template>
  <div class="json-path">
    <div class="row row-wrap" style="gap: 10px; align-items: end">
      <div class="grow" style="min-width: 240px">
        <span class="field-label">JSONPath 表达式</span>
        <input v-model="path" type="text" class="input mono" spellcheck="false" @keyup.enter="run" />
      </div>
      <button class="btn btn-primary" @click="run"><Search :size="16" /> 执行查询</button>
    </div>

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON 输入</span>
        <textarea v-model="json" class="textarea mono" style="min-height: 260px" spellcheck="false"></textarea>
      </div>
      <div>
        <span class="field-label">查询结果（{{ results.length }} 条命中）</span>
        <div class="result-area">
          <div v-if="error" class="notice notice-err">{{ error }}</div>
          <div v-else-if="!results.length" class="notice notice-info">暂无结果：输入表达式后点击执行。</div>
          <pre v-for="(t, i) in resultTexts" :key="i" class="res-item mono">{{ t }}</pre>
        </div>
      </div>
    </div>

    <div class="mt-3">
      <span class="field-label">JSONPath 语法速查</span>
      <div class="syntax-grid">
        <div v-for="s in SYNTAX" :key="s.token" class="syn-row">
          <button class="syn-token mono" @click="path = s.token === '.key' ? '$.store.location' : path + s.token">{{ s.token }}</button>
          <span class="syn-desc">{{ s.desc }}</span>
        </div>
      </div>
      <p class="muted small mt-1">点击语法片段可快速插入（.key 会填入示例）。</p>
    </div>
  </div>
</template>

<style scoped>
.result-area {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  padding: 10px;
  min-height: 260px;
  max-height: 420px;
  overflow: auto;
  display: grid;
  gap: 8px;
  align-content: start;
}
.res-item {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 12.5px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.syntax-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 7px;
}
.syn-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
}
.syn-token {
  flex: none;
  border: none;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
}
.syn-desc {
  color: var(--text-2);
}
</style>
