<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

/** 常用语言代码（20 种） */
const LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt', 'it', 'ar', 'hi', 'th', 'vi', 'id', 'nl', 'pl', 'tr', 'sv', 'ms']
/** 常见地区代码（可选） */
const REGIONS = ['CN', 'TW', 'HK', 'SG', 'US', 'GB', 'AU', 'CA', 'JP', 'KR', 'FR', 'DE', 'AT', 'CH', 'ES', 'MX', 'BR', 'PT', 'RU', 'IN', 'IT', 'NL', 'TH', 'VN', 'ID', 'SA', 'EG']

interface Alt {
  lang: string
  region: string
  url: string
}

const rows = ref<Alt[]>([
  { lang: 'zh', region: 'CN', url: 'https://example.com/zh/' },
  { lang: 'en', region: 'US', url: 'https://example.com/en/' },
])
const useDefault = ref(true)
const defaultUrl = ref('https://example.com/')

const addRow = () => rows.value.push({ lang: 'zh', region: '', url: 'https://example.com/' })
const removeRow = (i: number) => rows.value.splice(i, 1)

/** 组合语言代码：zh-CN / en / … */
const codeOf = (r: Alt) => (r.region ? `${r.lang}-${r.region}` : r.lang)
const LANG_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/
const isValid = (r: Alt) => LANG_RE.test(codeOf(r)) && /^https?:\/\/.+/i.test(r.url.trim())
const hasError = computed(() => rows.value.some((r) => !isValid(r)))

const tags = computed(() => {
  const out: string[] = []
  for (const r of rows.value) {
    if (!r.url.trim()) continue
    out.push(`<link rel="alternate" hreflang="${codeOf(r)}" href="${r.url.trim()}" />`)
  }
  if (useDefault.value && defaultUrl.value.trim()) {
    out.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl.value.trim()}" />`)
  }
  return out.join('\n')
})
</script>

<template>
  <div>
    <div class="head-row">
      <span>语言</span><span>地区（可选）</span><span>对应 URL</span><span></span>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="alt-row">
      <select v-model="r.lang" class="select w-lang" :class="{ invalid: !LANG_RE.test(r.lang) }">
        <option v-for="l in LANGS" :key="l" :value="l">{{ l }}</option>
      </select>
      <select v-model="r.region" class="select w-lang">
        <option value="">不指定</option>
        <option v-for="g in REGIONS" :key="g" :value="g">{{ g }}</option>
      </select>
      <input
        v-model="r.url"
        class="input grow"
        :class="{ invalid: r.url && !/^https?:\/\//i.test(r.url) }"
        placeholder="https://example.com/zh/"
      />
      <span class="code" :class="{ bad: !isValid(r) }">{{ codeOf(r) }}</span>
      <button class="icon-btn danger" title="删除" @click="removeRow(i)"><Trash2 :size="14" /></button>
    </div>
    <button class="btn btn-ghost btn-sm mt-1" @click="addRow"><Plus :size="14" /> 添加语言版本</button>

    <div class="default-box mt-2">
      <label class="check">
        <input v-model="useDefault" type="checkbox" />
        生成 x-default（未匹配语言时使用的默认版本）
      </label>
      <input v-if="useDefault" v-model="defaultUrl" class="input mt-1" placeholder="https://example.com/" />
    </div>

    <div v-if="hasError" class="notice notice-err mt-2">有语言代码或 URL 未通过校验：语言需为 2–3 位小写字母（可选 -大写地区），URL 需以 http(s):// 开头。</div>

    <ResultBox class="mt-2" :model-value="tags" title="hreflang 标签（粘贴到 &lt;head&gt; 内）" :min-height="'170px'" />
    <p class="hint">每个语言版本页面都应包含全部互指标签（含自身）；x-default 指向语言选择页或默认版本。</p>
  </div>
</template>

<style scoped>
.head-row {
  display: grid;
  grid-template-columns: 96px 96px 1fr 64px 34px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.alt-row {
  display: grid;
  grid-template-columns: 96px 96px 1fr 64px 34px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.w-lang { width: 100%; }
.code {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--accent-text);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}
.code.bad { color: var(--err); font-weight: 700; }
.invalid { border-color: var(--err) !important; }
.icon-btn {
  width: 30px; height: 30px; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.check { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--text-2); }
.default-box { border: 1px dashed var(--border); border-radius: 10px; padding: 10px 12px; }
.hint { font-size: 12px; color: var(--text-3); }
@media (max-width: 640px) {
  .head-row, .alt-row { grid-template-columns: 80px 80px 1fr 34px; }
  .code { display: none; }
}
</style>
