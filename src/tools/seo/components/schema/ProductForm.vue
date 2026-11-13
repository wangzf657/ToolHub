<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import { clean, S, type Grade, GRADE_LABEL } from './shared'

const gradeOf: Record<string, Grade> = {
  name: 'req', image: 'rec', price: 'rec', rating: 'opt',
  brand: 'opt', description: 'opt', sku: 'opt', gtin: 'opt', mpn: 'opt',
}

const product = reactive({ name: '', brand: '', description: '', image: '', price: '', currency: 'CNY', availability: 'InStock', rating: '', reviews: '', sku: '', gtin: '', mpn: '' })

const json = defineModel<Record<string, unknown> | null>({ required: true })

// rx2 评分配对提示：rating 与 reviewCount 必须成对出现才会输出 aggregateRating
const ratingLone = computed(() => (product.rating.trim() ? !product.reviews.trim() : !!product.reviews.trim()))

const buildJson = computed<Record<string, unknown> | null>(() => {
  if (!product.name.trim()) return null
  return {
    '@context': S,
    '@type': 'Product',
    ...clean({ name: product.name, description: product.description, image: product.image }),
    ...clean({ sku: product.sku, gtin13: product.gtin, mpn: product.mpn }),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.price
      ? { offers: { '@type': 'Offer', price: product.price, priceCurrency: product.currency, availability: S + product.availability } }
      : {}),
    ...(product.rating && product.reviews
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviews } }
      : {}),
  }
})
watchEffect(() => {
  json.value = buildJson.value
})
</script>

<template>
  <div class="form">
    <div class="grid-2">
      <div>
        <label class="field-label">商品名 <span class="badge" :class="`b-${gradeOf.name}`">{{ GRADE_LABEL[gradeOf.name] }}</span></label>
        <input v-model="product.name" class="input" placeholder="无线降噪耳机" />
      </div>
      <div>
        <label class="field-label">品牌 <span class="badge" :class="`b-${gradeOf.brand}`">{{ GRADE_LABEL[gradeOf.brand] }}</span></label>
        <input v-model="product.brand" class="input" placeholder="品牌名" />
      </div>
      <div>
        <label class="field-label">价格 <span class="badge" :class="`b-${gradeOf.price}`">{{ GRADE_LABEL[gradeOf.price] }}</span></label>
        <input v-model="product.price" type="number" class="input" placeholder="如 499" />
      </div>
      <div><label class="field-label">币种</label><input v-model="product.currency" class="input" placeholder="CNY" /></div>
      <div>
        <label class="field-label">库存状态</label>
        <select v-model="product.availability" class="select">
          <option value="InStock">有货 InStock</option>
          <option value="OutOfStock">缺货 OutOfStock</option>
          <option value="PreOrder">预售 PreOrder</option>
        </select>
      </div>
      <div>
        <label class="field-label">评分 / 评论数 <span class="badge" :class="`b-${gradeOf.rating}`">{{ GRADE_LABEL[gradeOf.rating] }}</span></label>
        <div class="row"><input v-model="product.rating" type="number" step="0.1" max="5" class="input" placeholder="4.6" /><input v-model="product.reviews" type="number" class="input" placeholder="128" /></div>
      </div>
    </div>
    <div v-if="ratingLone" class="notice notice-warn">评分与评论数必须成对填写：只填其一不会输出 aggregateRating，Google 会视为无效评分。</div>
    <div class="grid-2 mt-1">
      <div>
        <label class="field-label">SKU 编码 <span class="badge" :class="`b-${gradeOf.sku}`">{{ GRADE_LABEL[gradeOf.sku] }}</span></label>
        <input v-model="product.sku" class="input" placeholder="店铺内部货号，留空省略" />
        <p class="mini-hint">库存单位编号，商品在你的站点内的唯一标识。</p>
      </div>
      <div>
        <label class="field-label">GTIN 条码 <span class="badge" :class="`b-${gradeOf.gtin}`">{{ GRADE_LABEL[gradeOf.gtin] }}</span></label>
        <input v-model="product.gtin" class="input" placeholder="13 位条码，留空省略" />
        <p class="mini-hint">条码/出厂号（UPC/EAN/JAN/ISBN），购物搜索强推荐。</p>
      </div>
      <div>
        <label class="field-label">MPN 制造商编号 <span class="badge" :class="`b-${gradeOf.mpn}`">{{ GRADE_LABEL[gradeOf.mpn] }}</span></label>
        <input v-model="product.mpn" class="input" placeholder="无条码时填写，留空省略" />
        <p class="mini-hint">制造商零件号，无 GTIN 时用于精确匹配。</p>
      </div>
    </div>
    <div class="mt-1">
      <label class="field-label">图片 URL <span class="badge" :class="`b-${gradeOf.image}`">{{ GRADE_LABEL[gradeOf.image] }}</span></label>
      <input v-model="product.image" class="input" />
    </div>
    <div class="mt-1">
      <label class="field-label">描述 <span class="badge" :class="`b-${gradeOf.description}`">{{ GRADE_LABEL[gradeOf.description] }}</span></label>
      <textarea v-model="product.description" class="textarea" rows="2"></textarea>
    </div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.row { display: flex; gap: 8px; }
.badge { margin-left: 6px; font-size: 10.5px; font-weight: 600; padding: 0 6px; border-radius: 999px; vertical-align: 1px; }
.b-req { background: rgba(248, 113, 113, 0.12); color: var(--err); }
.b-rec { background: rgba(251, 191, 36, 0.12); color: var(--warn); }
.b-opt { background: rgba(127, 127, 127, 0.12); color: var(--text-3); }
.mini-hint { margin: 3px 2px 0; font-size: 11.5px; color: var(--text-3); }
</style>
