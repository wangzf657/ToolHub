<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Trash2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

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

const article = reactive({ headline: '', author: '', publisher: '', description: '', image: '', datePublished: '', dateModified: '', url: '' })
const product = reactive({ name: '', brand: '', description: '', image: '', price: '', currency: 'CNY', availability: 'InStock', rating: '', reviews: '' })
const faqRows = ref([{ q: '', a: '' }])
const local = reactive({ name: '', image: '', phone: '', street: '', city: '', region: '', postal: '', country: 'CN', lat: '', lng: '', hours: '', priceRange: '', url: '' })
const event = reactive({ name: '', startDate: '', endDate: '', venue: '', address: '', city: '', url: '', price: '', currency: 'CNY', status: 'EventScheduled' })
const crumbRows = ref([{ name: '', url: '' }])

const addFaq = () => faqRows.value.push({ q: '', a: '' })
const addCrumb = () => crumbRows.value.push({ name: '', url: '' })

const S = 'https://schema.org/'

/** 按当前 Tab 构造 JSON-LD 对象（空值字段自动省略） */
const buildJson = computed<Record<string, unknown> | null>(() => {
  const clean = <T extends object>(o: T) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) if (v !== '' && v !== null && v !== undefined) out[k] = v
    return out
  }
  switch (tab.value) {
    case 'article':
      if (!article.headline.trim()) return null
      return {
        '@context': S, '@type': 'Article',
        ...clean({ headline: article.headline, description: article.description, image: article.image, datePublished: article.datePublished, dateModified: article.dateModified }),
        ...(article.author ? { author: { '@type': 'Person', name: article.author } } : {}),
        ...(article.publisher ? { publisher: { '@type': 'Organization', name: article.publisher } } : {}),
        ...(article.url ? { mainEntityOfPage: { '@type': 'WebPage', '@id': article.url } } : {}),
      }
    case 'product':
      if (!product.name.trim()) return null
      return {
        '@context': S, '@type': 'Product',
        ...clean({ name: product.name, description: product.description, image: product.image }),
        ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
        ...(product.price ? { offers: { '@type': 'Offer', price: product.price, priceCurrency: product.currency, availability: S + product.availability } } : {}),
        ...(product.rating && product.reviews ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviews } } : {}),
      }
    case 'faq': {
      const rows = faqRows.value.filter((r) => r.q.trim() && r.a.trim())
      if (!rows.length) return null
      return { '@context': S, '@type': 'FAQPage', mainEntity: rows.map((r) => ({ '@type': 'Question', name: r.q, acceptedAnswer: { '@type': 'Answer', text: r.a } })) }
    }
    case 'local':
      if (!local.name.trim()) return null
      return {
        '@context': S, '@type': 'LocalBusiness',
        ...clean({ name: local.name, image: local.image, telephone: local.phone, priceRange: local.priceRange, openingHours: local.hours, url: local.url }),
        address: {
          '@type': 'PostalAddress',
          ...clean({ streetAddress: local.street, addressLocality: local.city, addressRegion: local.region, postalCode: local.postal, addressCountry: local.country }),
        },
        ...(local.lat && local.lng ? { geo: { '@type': 'GeoCoordinates', latitude: local.lat, longitude: local.lng } } : {}),
      }
    case 'event':
      if (!event.name.trim()) return null
      return {
        '@context': S, '@type': 'Event',
        ...clean({ name: event.name, startDate: event.startDate, endDate: event.endDate, url: event.url, eventStatus: S + event.status }),
        ...(event.venue ? { location: { '@type': 'Place', name: event.venue, address: [event.address, event.city].filter(Boolean).join(', ') } } : {}),
        ...(event.price ? { offers: { '@type': 'Offer', price: event.price, priceCurrency: event.currency, ...(event.url ? { url: event.url } : {}) } } : {}),
      }
    case 'breadcrumb': {
      const rows = crumbRows.value.filter((r) => r.name.trim())
      if (!rows.length) return null
      return { '@context': S, '@type': 'BreadcrumbList', itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, ...(r.url ? { item: r.url } : {}) })) }
    }
  }
})

const jsonStr = computed(() => (buildJson.value ? JSON.stringify(buildJson.value, null, 2) : ''))
/** 嵌入 HTML 时把小于号转义，避免脚本标签提前闭合或被注入 */
const htmlCode = computed(() => (jsonStr.value ? `<script type="application/ld+json">\n${jsonStr.value.replace(/</g, '\\u003c')}\n<` + '/script>' : ''))
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <button v-for="t in TABS" :key="t.v" class="chip" :class="{ active: tab === t.v }" @click="tab = t.v">{{ t.label }}</button>
    </div>

    <!-- Article -->
    <div v-if="tab === 'article'" class="form">
      <div class="grid-2">
        <div><label class="field-label">标题 headline *</label><input v-model="article.headline" class="input" placeholder="文章标题" /></div>
        <div><label class="field-label">作者</label><input v-model="article.author" class="input" placeholder="李四" /></div>
        <div><label class="field-label">发布时间</label><input v-model="article.datePublished" type="date" class="input" /></div>
        <div><label class="field-label">更新时间</label><input v-model="article.dateModified" type="date" class="input" /></div>
        <div><label class="field-label">发布方</label><input v-model="article.publisher" class="input" placeholder="站点/机构名" /></div>
        <div><label class="field-label">页面 URL</label><input v-model="article.url" class="input" placeholder="https://example.com/post/1" /></div>
      </div>
      <div class="mt-1"><label class="field-label">头图 URL</label><input v-model="article.image" class="input" placeholder="https://…/cover.jpg" /></div>
      <div class="mt-1"><label class="field-label">摘要</label><textarea v-model="article.description" class="textarea" rows="2" placeholder="一句话描述文章内容"></textarea></div>
    </div>

    <!-- Product -->
    <div v-else-if="tab === 'product'" class="form">
      <div class="grid-2">
        <div><label class="field-label">商品名 *</label><input v-model="product.name" class="input" placeholder="无线降噪耳机" /></div>
        <div><label class="field-label">品牌</label><input v-model="product.brand" class="input" placeholder="品牌名" /></div>
        <div><label class="field-label">价格</label><input v-model="product.price" type="number" class="input" placeholder="如 499" /></div>
        <div><label class="field-label">币种</label><input v-model="product.currency" class="input" placeholder="CNY" /></div>
        <div><label class="field-label">库存状态</label>
          <select v-model="product.availability" class="select"><option value="InStock">有货</option><option value="OutOfStock">缺货</option><option value="PreOrder">预售</option></select>
        </div>
        <div><label class="field-label">评分 / 评论数</label>
          <div class="row"><input v-model="product.rating" type="number" step="0.1" max="5" class="input" placeholder="4.6" /><input v-model="product.reviews" type="number" class="input" placeholder="128" /></div>
        </div>
      </div>
      <div class="mt-1"><label class="field-label">图片 URL</label><input v-model="product.image" class="input" /></div>
      <div class="mt-1"><label class="field-label">描述</label><textarea v-model="product.description" class="textarea" rows="2"></textarea></div>
    </div>

    <!-- FAQ -->
    <div v-else-if="tab === 'faq'" class="form">
      <div v-for="(r, i) in faqRows" :key="i" class="faq-row">
        <div class="row"><span class="row-no">Q{{ i + 1 }}</span>
          <input v-model="r.q" class="input grow" :placeholder="`问题 ${i + 1}`" />
          <button class="icon-btn danger" title="删除" aria-label="删除" @click="faqRows.splice(i, 1)"><Trash2 :size="14" /></button>
        </div>
        <textarea v-model="r.a" class="textarea mt-1" rows="2" :placeholder="`答案 ${i + 1}`"></textarea>
      </div>
      <button class="btn btn-ghost btn-sm" @click="addFaq"><Plus :size="14" /> 添加问答</button>
    </div>

    <!-- LocalBusiness -->
    <div v-else-if="tab === 'local'" class="form">
      <div class="grid-2">
        <div><label class="field-label">商家名 *</label><input v-model="local.name" class="input" /></div>
        <div><label class="field-label">电话</label><input v-model="local.phone" class="input" placeholder="021-12345678" /></div>
        <div><label class="field-label">街道地址</label><input v-model="local.street" class="input" placeholder="中山路 100 号" /></div>
        <div><label class="field-label">城市</label><input v-model="local.city" class="input" placeholder="上海" /></div>
        <div><label class="field-label">省/州</label><input v-model="local.region" class="input" placeholder="上海市" /></div>
        <div><label class="field-label">邮编</label><input v-model="local.postal" class="input" /></div>
        <div><label class="field-label">国家代码</label><input v-model="local.country" class="input" placeholder="CN" /></div>
        <div><label class="field-label">价位</label><input v-model="local.priceRange" class="input" placeholder="如 ¥¥" /></div>
        <div><label class="field-label">纬度</label><input v-model="local.lat" class="input" placeholder="31.23" /></div>
        <div><label class="field-label">经度</label><input v-model="local.lng" class="input" placeholder="121.47" /></div>
      </div>
      <div class="mt-1"><label class="field-label">营业时间（schema 格式）</label><input v-model="local.hours" class="input" placeholder="Mo-Sa 09:00-19:00" /></div>
      <div class="mt-1"><label class="field-label">图片 URL</label><input v-model="local.image" class="input" /></div>
      <div class="mt-1"><label class="field-label">官网</label><input v-model="local.url" class="input" /></div>
    </div>

    <!-- Event -->
    <div v-else-if="tab === 'event'" class="form">
      <div class="grid-2">
        <div><label class="field-label">活动名 *</label><input v-model="event.name" class="input" /></div>
        <div><label class="field-label">活动状态</label>
          <select v-model="event.status" class="select">
            <option value="EventScheduled">按计划举行</option><option value="EventPostponed">延期</option>
            <option value="EventCancelled">取消</option><option value="EventMovedOnline">改为线上</option>
          </select>
        </div>
        <div><label class="field-label">开始时间</label><input v-model="event.startDate" type="datetime-local" class="input" /></div>
        <div><label class="field-label">结束时间</label><input v-model="event.endDate" type="datetime-local" class="input" /></div>
        <div><label class="field-label">场地名</label><input v-model="event.venue" class="input" placeholder="如 上海大剧院" /></div>
        <div><label class="field-label">城市</label><input v-model="event.city" class="input" /></div>
        <div><label class="field-label">票价</label><input v-model="event.price" type="number" class="input" placeholder="如 180" /></div>
        <div><label class="field-label">币种</label><input v-model="event.currency" class="input" placeholder="CNY" /></div>
      </div>
      <div class="mt-1"><label class="field-label">详细地址</label><input v-model="event.address" class="input" /></div>
      <div class="mt-1"><label class="field-label">活动页 URL</label><input v-model="event.url" class="input" /></div>
    </div>

    <!-- Breadcrumb -->
    <div v-else class="form">
      <div v-for="(r, i) in crumbRows" :key="i" class="row mb-1">
        <span class="row-no">{{ i + 1 }}</span>
        <input v-model="r.name" class="input grow" :placeholder="`层级 ${i + 1} 名称，如 首页`" />
        <input v-model="r.url" class="input grow" placeholder="https://…（末级可留空）" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="crumbRows.splice(i, 1)"><Trash2 :size="14" /></button>
      </div>
      <button class="btn btn-ghost btn-sm" @click="addCrumb"><Plus :size="14" /> 添加层级</button>
    </div>

    <ResultBox class="mt-2" :model-value="htmlCode" title="JSON-LD 代码（插入 &lt;head&gt;）" download="html" :min-height="'190px'" />
    <ResultBox class="mt-2" :model-value="jsonStr" title="纯 JSON（用于校验器）" download="json" :min-height="'150px'" />
    <p class="hint">提示：生成后可用 Google 富媒体测试工具验证；空字段会自动省略。</p>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
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
.hint { font-size: 12px; color: var(--text-3); }
.mb-1 { margin-bottom: 8px; }
</style>
