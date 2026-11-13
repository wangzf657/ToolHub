<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ExternalLink } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { RICH_TEST_URL } from './schema/shared'
import ArticleForm from './schema/ArticleForm.vue'
import ProductForm from './schema/ProductForm.vue'
import FaqForm from './schema/FaqForm.vue'
import LocalForm from './schema/LocalForm.vue'
import EventForm from './schema/EventForm.vue'
import BreadcrumbForm from './schema/BreadcrumbForm.vue'

type Tab = 'article' | 'product' | 'faq' | 'local' | 'event' | 'breadcrumb'
// 六个 schema-* 入口共用本组件：按 slug 预选对应 Tab，首屏表单与工具名一致
const SLUG_TAB: Record<string, Tab> = {
  'schema-article-generator': 'article',
  'schema-product-generator': 'product',
  'schema-faq-generator': 'faq',
  'schema-localbusiness-generator': 'local',
  'schema-event-generator': 'event',
  'schema-breadcrumb-generator': 'breadcrumb',
}
const route = useRoute()
const tab = ref<Tab>(SLUG_TAB[String(route.params.slug ?? '')] ?? 'article')
watch(
  () => route.params.slug,
  (s2) => {
    const t = SLUG_TAB[String(s2 ?? '')]
    if (t) tab.value = t
  },
)
const TABS: { v: Tab; label: string }[] = [
  { v: 'article', label: 'Article 文章' },
  { v: 'product', label: 'Product 商品' },
  { v: 'faq', label: 'FAQ 问答' },
  { v: 'local', label: 'LocalBusiness 本地商家' },
  { v: 'event', label: 'Event 活动' },
  { v: 'breadcrumb', label: 'Breadcrumb 面包屑' },
]

// 各表单自持状态（v-show 保持挂载，切 Tab 不丢值），经 defineModel 上报 JSON
const articleJson = ref<Record<string, unknown> | null>(null)
const productJson = ref<Record<string, unknown> | null>(null)
const faqJson = ref<Record<string, unknown> | null>(null)
const localJson = ref<Record<string, unknown> | null>(null)
const eventJson = ref<Record<string, unknown> | null>(null)
const crumbJson = ref<Record<string, unknown> | null>(null)

const buildJson = computed<Record<string, unknown> | null>(() => {
  switch (tab.value) {
    case 'article': return articleJson.value
    case 'product': return productJson.value
    case 'faq': return faqJson.value
    case 'local': return localJson.value
    case 'event': return eventJson.value
    case 'breadcrumb': return crumbJson.value
  }
})

const jsonStr = computed(() => (buildJson.value ? JSON.stringify(buildJson.value, null, 2) : ''))
/** 嵌入 HTML 时把小于号转义，避免脚本标签提前闭合或被注入 */
const htmlCode = computed(() => (jsonStr.value ? `<script type="application/ld+json">\n${jsonStr.value.replace(/</g, '\\u003c')}\n<` + '/script>' : ''))

const toast = useToast()
const copyJson = async () => {
  if (!jsonStr.value) {
    toast.warn('还没有可复制的 JSON，请先填写必填项')
    return
  }
  const okFlag = await copyText(jsonStr.value)
  if (okFlag) toast.ok('纯 JSON 已复制，可直接粘贴到校验器')
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <button v-for="t in TABS" :key="t.v" class="chip" :class="{ active: tab === t.v }" @click="tab = t.v">{{ t.label }}</button>
    </div>

    <!-- v-show 保持六个表单挂载，切换 Tab 不丢失已填字段 -->
    <ArticleForm v-show="tab === 'article'" v-model="articleJson" />
    <ProductForm v-show="tab === 'product'" v-model="productJson" />
    <FaqForm v-show="tab === 'faq'" v-model="faqJson" />
    <LocalForm v-show="tab === 'local'" v-model="localJson" />
    <EventForm v-show="tab === 'event'" v-model="eventJson" />
    <BreadcrumbForm v-show="tab === 'breadcrumb'" v-model="crumbJson" />

    <ResultBox class="mt-2" :model-value="htmlCode" title="JSON-LD 代码（插入 &lt;head&gt;）" download="html" :min-height="'190px'" />
    <ResultBox class="mt-2" :model-value="jsonStr" title="纯 JSON（用于校验器）" download="json" :min-height="'150px'" />

    <div class="verify-row mt-1">
      <a class="verify-link" :href="RICH_TEST_URL" target="_blank" rel="noopener noreferrer"><ExternalLink :size="13" /> 打开 Google 富媒体测试工具验证</a>
      <button class="btn btn-ghost btn-sm" @click="copyJson">复制纯 JSON</button>
    </div>
    <p class="hint">提示：复制纯 JSON 粘贴到富媒体测试工具或 validator.schema.org 校验；空字段会自动省略。</p>
  </div>
</template>

<style scoped>
.verify-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.verify-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--accent); }
.verify-link:hover { text-decoration: underline; }
.hint { font-size: 12px; color: var(--text-3); }
.btn-sm { padding: 4px 12px; font-size: 13px; }
</style>
