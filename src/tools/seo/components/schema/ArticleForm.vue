<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import { clean, toIsoOffset, S, type Grade, GRADE_LABEL } from './shared'

/** 字段分级：headline 必填；image/datePublished/publisher 推荐（Google 富结果要求）；其余可选 */
const gradeOf: Record<string, Grade> = {
  headline: 'req', image: 'rec', datePublished: 'rec', publisher: 'rec',
  author: 'opt', dateModified: 'opt', url: 'opt', description: 'opt', logo: 'opt', authorUrl: 'opt',
}

const article = reactive({ headline: '', author: '', authorUrl: '', publisher: '', logo: '', description: '', image: '', datePublished: '', dateModified: '', url: '' })

const json = defineModel<Record<string, unknown> | null>({ required: true })

const buildJson = computed<Record<string, unknown> | null>(() => {
  if (!article.headline.trim()) return null
  return {
    '@context': S,
    '@type': 'Article',
    ...clean({
      headline: article.headline,
      description: article.description,
      image: article.image,
      datePublished: toIsoOffset(article.datePublished),
      dateModified: toIsoOffset(article.dateModified),
    }),
    ...(article.author
      ? { author: { '@type': 'Person', name: article.author, ...(article.authorUrl ? { url: article.authorUrl } : {}) } }
      : {}),
    ...(article.publisher
      ? { publisher: { '@type': 'Organization', name: article.publisher, ...(article.logo ? { logo: { '@type': 'ImageObject', url: article.logo } } : {}) } }
      : {}),
    ...(article.url ? { mainEntityOfPage: { '@type': 'WebPage', '@id': article.url } } : {}),
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
        <label class="field-label">标题 headline <span class="badge" :class="`b-${gradeOf.headline}`">{{ GRADE_LABEL[gradeOf.headline] }}</span></label>
        <input v-model="article.headline" class="input" placeholder="文章标题" />
      </div>
      <div>
        <label class="field-label">作者 <span class="badge" :class="`b-${gradeOf.author}`">{{ GRADE_LABEL[gradeOf.author] }}</span></label>
        <input v-model="article.author" class="input" placeholder="李四" />
      </div>
      <div>
        <label class="field-label">发布时间 <span class="badge" :class="`b-${gradeOf.datePublished}`">{{ GRADE_LABEL[gradeOf.datePublished] }}</span></label>
        <input v-model="article.datePublished" type="datetime-local" class="input" />
      </div>
      <div>
        <label class="field-label">更新时间 <span class="badge" :class="`b-${gradeOf.dateModified}`">{{ GRADE_LABEL[gradeOf.dateModified] }}</span></label>
        <input v-model="article.dateModified" type="datetime-local" class="input" />
      </div>
      <div>
        <label class="field-label">发布方 <span class="badge" :class="`b-${gradeOf.publisher}`">{{ GRADE_LABEL[gradeOf.publisher] }}</span></label>
        <input v-model="article.publisher" class="input" placeholder="站点/机构名" />
      </div>
      <div>
        <label class="field-label">发布方 Logo URL <span class="badge" :class="`b-${gradeOf.logo}`">{{ GRADE_LABEL[gradeOf.logo] }}</span></label>
        <input v-model="article.logo" class="input" placeholder="https://…/logo.png（留空省略）" />
      </div>
      <div>
        <label class="field-label">作者主页 URL <span class="badge" :class="`b-${gradeOf.authorUrl}`">{{ GRADE_LABEL[gradeOf.authorUrl] }}</span></label>
        <input v-model="article.authorUrl" class="input" placeholder="https://…（留空省略）" />
      </div>
      <div>
        <label class="field-label">页面 URL <span class="badge" :class="`b-${gradeOf.url}`">{{ GRADE_LABEL[gradeOf.url] }}</span></label>
        <input v-model="article.url" class="input" placeholder="https://example.com/post/1" />
      </div>
    </div>
    <div class="mt-1">
      <label class="field-label">头图 URL <span class="badge" :class="`b-${gradeOf.image}`">{{ GRADE_LABEL[gradeOf.image] }}</span></label>
      <input v-model="article.image" class="input" placeholder="https://…/cover.jpg" />
    </div>
    <div class="mt-1">
      <label class="field-label">摘要 <span class="badge" :class="`b-${gradeOf.description}`">{{ GRADE_LABEL[gradeOf.description] }}</span></label>
      <textarea v-model="article.description" class="textarea" rows="2" placeholder="一句话描述文章内容"></textarea>
    </div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.badge {
  margin-left: 6px;
  font-size: 10.5px;
  font-weight: 600;
  padding: 0 6px;
  border-radius: 999px;
  vertical-align: 1px;
}
.b-req { background: rgba(248, 113, 113, 0.12); color: var(--err); }
.b-rec { background: rgba(251, 191, 36, 0.12); color: var(--warn); }
.b-opt { background: rgba(127, 127, 127, 0.12); color: var(--text-3); }
</style>
