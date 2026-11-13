<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { S } from './shared'

const faqRows = ref([{ q: '', a: '' }])
const addFaq = () => faqRows.value.push({ q: '', a: '' })

const json = defineModel<Record<string, unknown> | null>({ required: true })

const buildJson = computed<Record<string, unknown> | null>(() => {
  const rows = faqRows.value.filter((r) => r.q.trim() && r.a.trim())
  if (!rows.length) return null
  return {
    '@context': S,
    '@type': 'FAQPage',
    mainEntity: rows.map((r) => ({ '@type': 'Question', name: r.q, acceptedAnswer: { '@type': 'Answer', text: r.a } })),
  }
})
watchEffect(() => {
  json.value = buildJson.value
})
</script>

<template>
  <div class="form">
    <div v-for="(r, i) in faqRows" :key="i" class="faq-row">
      <div class="row"><span class="row-no">Q{{ i + 1 }}</span>
        <input v-model="r.q" class="input grow" :placeholder="`问题 ${i + 1}`" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="faqRows.splice(i, 1)"><Trash2 :size="14" /></button>
      </div>
      <textarea v-model="r.a" class="textarea mt-1" rows="2" :placeholder="`答案 ${i + 1}`"></textarea>
    </div>
    <button class="btn btn-ghost btn-sm" @click="addFaq"><Plus :size="14" /> 添加问答</button>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.row { display: flex; gap: 8px; }
.row-no {
  flex: none;
  min-width: 30px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.icon-btn {
  width: 30px; height: 30px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
</style>
