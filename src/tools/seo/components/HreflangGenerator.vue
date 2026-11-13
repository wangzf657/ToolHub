<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2, Wand2, ExternalLink } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

/** 常用语言代码（含 ISO 文字子标签） */
const LANGS = ['zh', 'zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt', 'it', 'ar', 'hi', 'th', 'vi', 'id', 'nl', 'pl', 'tr', 'sv', 'ms']
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

// rx4 路径模板：按 {code} 批量推导各语言行 URL
const pathTemplate = ref('https://example.com/{code}/')
const applyTemplate = () => {
  const tpl = pathTemplate.value.trim()
  if (!tpl || !tpl.includes('{code}')) {
    return
  }
  for (const r of rows.value) {
    r.url = tpl.replace('{code}', codeOf(r).toLowerCase())
  }
}

const addRow = () => rows.value.push({ lang: 'zh', region: '', url: 'https://example.com/' })
const removeRow = (i: number) => rows.value.splice(i, 1)

/** 组合语言代码：zh-CN / zh-Hant-TW / en / … */
const codeOf = (r: Alt) => (r.region ? `${r.lang}-${r.region}` : r.lang)
// 语言部分允许 2–3 位小写字母或 zh-Hans/zh-Hant 文字子标签；地区必须 2 位大写
const LANG_PART_RE = /^[a-z]{2,3}$|^zh-(Hans|Hant)$/
const REGION_RE = /^[A-Z]{2}$/
const codeValid = (r: Alt) => LANG_PART_RE.test(r.lang) && (!r.region || REGION_RE.test(r.region))
const urlValid = (r: Alt) => /^https?:\/\/.+/i.test(r.url.trim())
const isValid = (r: Alt) => codeValid(r) && urlValid(r)

// rx2 重复检测：同一 lang-region 组合出现两次
const dupRows = computed(() => {
  const counts = new Map<string, number>()
  for (const r of rows.value) counts.set(codeOf(r), (counts.get(codeOf(r)) ?? 0) + 1)
  const dup = new Set<number>()
  rows.value.forEach((r, i) => {
    if ((counts.get(codeOf(r)) ?? 0) > 1) dup.add(i)
  })
  return dup
})
const dupGroups = computed(() => {
  const counts = new Map<string, number>()
  for (const r of rows.value) counts.set(codeOf(r), (counts.get(codeOf(r)) ?? 0) + 1)
  let n = 0
  for (const [, c] of counts) if (c > 1) n++
  return n
})

// rx3 错误定位：逐行列出（第 N 行：原因）
const rowErrors = computed(() => {
  const out: { row: number; msg: string }[] = []
  rows.value.forEach((r, i) => {
    if (!codeValid(r)) out.push({ row: i + 1, msg: `第 ${i + 1} 行：语言代码需为 2–3 位小写字母或 zh-Hans/zh-Hant，地区需为 2 位大写字母` })
    else if (!urlValid(r)) out.push({ row: i + 1, msg: `第 ${i + 1} 行：URL 需以 http(s):// 开头` })
    else if (dupRows.value.has(i)) out.push({ row: i + 1, msg: `第 ${i + 1} 行：组合码 ${codeOf(r)} 重复出现` })
  })
  return out
})
const hasError = computed(() => rowErrors.value.length > 0)

const tags = computed(() => {
  const out: string[] = []
  for (const r of rows.value) {
    if (!r.url.trim() || !isValid(r)) continue
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
    <!-- rx4 路径模板 -->
    <div class="tpl-box">
      <label class="field-label">路径模板批量推导 URL（占位符 <code>{code}</code> = 语言-地区全小写）</label>
      <div class="row mt-1">
        <input v-model="pathTemplate" class="input grow" placeholder="https://example.com/{code}/" />
        <button class="btn btn-ghost" @click="applyTemplate"><Wand2 :size="15" /> 按模板填充全部行</button>
      </div>
    </div>

    <div class="head-row mt-2">
      <span>语言</span><span>地区（可选）</span><span>对应 URL</span><span></span>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="alt-row" :class="{ 'row-dup': dupRows.has(rows.indexOf(r)) }">
      <select v-model="r.lang" class="select w-lang">
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
      <span class="code" :class="{ bad: !isValid(r), good: isValid(r) }">{{ codeOf(r) }}</span>
      <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeRow(i)"><Trash2 :size="14" /></button>
    </div>
    <button class="btn btn-ghost btn-sm mt-1" @click="addRow"><Plus :size="14" /> 添加语言版本</button>

    <div class="default-box mt-2">
      <label class="check">
        <input v-model="useDefault" type="checkbox" />
        生成 x-default（未匹配语言时使用的默认版本）
      </label>
      <input v-if="useDefault" v-model="defaultUrl" class="input mt-1" placeholder="https://example.com/" />
    </div>

    <!-- rx3 逐行错误定位 -->
    <div v-if="rowErrors.length" class="notice notice-err mt-2">
      <div>共 {{ rowErrors.length }} 行未通过校验：</div>
      <div v-for="(e, i) in rowErrors" :key="i" class="err-line">{{ e.msg }}</div>
    </div>
    <div v-else-if="dupGroups" class="notice notice-warn mt-2">重复 {{ dupGroups }} 组语言-地区组合，Google 只会采用第一条，请删除多余行。</div>

    <ResultBox class="mt-2" :model-value="tags" title="hreflang 标签（粘贴到 &lt;head&gt; 内）" :min-height="'170px'" />

    <div class="family-link mt-1">
      <router-link class="mini-link" to="/t/sitemap-generator"><ExternalLink :size="13" /> 多语言站还需要 sitemap.xml → 去站点地图生成</router-link>
    </div>

    <p class="hint">每个语言版本页面都应包含全部互指标签（含自身）；x-default 指向语言选择页或默认版本。zh-Hans/zh-Hant 为文字子标签，可与地区组合（如 zh-Hant-TW）。</p>
  </div>
</template>

<style scoped>
.tpl-box {
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}
code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 4px;
}
.row { display: flex; gap: 8px; }
.head-row {
  display: grid;
  grid-template-columns: 120px 96px 1fr 64px 34px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.alt-row {
  display: grid;
  grid-template-columns: 120px 96px 1fr 64px 34px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  border-radius: 8px;
}
.row-dup { outline: 1.5px solid var(--err); outline-offset: 2px; background: color-mix(in srgb, var(--err) 6%, transparent); }
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
.code.good { color: var(--ok); }
.invalid { border-color: var(--err) !important; }
.icon-btn {
  width: 30px; height: 30px; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.check { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--text-2); }
.default-box { border: 1px dashed var(--border); border-radius: 10px; padding: 10px 12px; }
.err-line { margin-top: 4px; }
.mini-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--accent); }
.mini-link:hover { text-decoration: underline; }
.hint { font-size: 12px; color: var(--text-3); }
@media (max-width: 640px) {
  .head-row, .alt-row { grid-template-columns: 100px 80px 1fr 34px; }
  .code { display: none; }
}
</style>
