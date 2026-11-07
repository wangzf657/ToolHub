<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { guideBySlug, guides } from '@/data/guides'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import { toolMap } from '@/tools'
import NotFoundPage from './NotFoundPage.vue'

const route = useRoute()
const guide = computed(() => guideBySlug(route.params.slug as string))
const relatedTool = computed(() => (guide.value?.tool ? toolMap.get(guide.value.tool) : undefined))
const html = computed(() => (guide.value ? DOMPurify.sanitize(marked.parse(guide.value.body) as string) : ''))
const more = computed(() => guides.filter((g) => g.slug !== route.params.slug).slice(0, 3))
</script>

<template>
  <NotFoundPage v-if="!guide" />
  <div v-else class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '使用指南', to: '/guides' }, { label: guide!.title }]" />
    <div class="guide-layout">
      <article class="prose">
        <span class="guide-date">{{ guide!.date }}</span>
        <h1>{{ guide!.title }}</h1>
        <div v-html="html"></div>
        <RouterLink v-if="relatedTool" :to="`/t/${relatedTool.slug}`" class="btn btn-primary mt-2">
          打开「{{ relatedTool.title }}」工具 →
        </RouterLink>
      </article>
      <aside class="guide-side">
        <h3>更多指南</h3>
        <RouterLink v-for="g in more" :key="g.slug" :to="`/guides/${g.slug}`" class="side-item">
          <strong>{{ g.title }}</strong>
          <span class="muted small">{{ g.date }}</span>
        </RouterLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.guide-date {
  font-size: 13px;
  color: var(--text-3);
}
.guide-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 32px;
  margin-top: 8px;
}
@media (max-width: 900px) {
  .guide-layout {
    grid-template-columns: 1fr;
  }
}
.guide-side h3 {
  font-size: 15px;
}
.side-item {
  display: grid;
  gap: 3px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  text-decoration: none !important;
  color: var(--text);
}
.side-item:hover strong {
  color: var(--accent-text);
}
.side-item strong {
  font-size: 14px;
  line-height: 1.45;
}
</style>
