<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { guides } from '@/data/guides'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '使用指南' }]" />
    <h1>使用指南</h1>
    <p class="muted" style="max-width: 720px">
      关于文件处理的实用技巧与隐私知识——如何在不上传任何文件的前提下，把日常的转换、压缩与修复做得又快又好。
    </p>
    <div class="guides-grid">
      <RouterLink v-for="g in guides" :key="g.slug" :to="`/guides/${g.slug}`" class="card guide-card">
        <span class="guide-date">{{ g.date }}</span>
        <h3>{{ g.title }}</h3>
        <p class="muted small">{{ g.excerpt }}</p>
        <span class="guide-link">阅读全文 →</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.guides-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 20px;
}
@media (max-width: 900px) {
  .guides-grid {
    grid-template-columns: 1fr;
  }
}
.guide-card {
  text-decoration: none !important;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.guide-card:hover {
  border-color: var(--accent);
}
.guide-date {
  font-size: 12px;
  color: var(--text-3);
}
.guide-card h3 {
  margin: 0;
  font-size: 16.5px;
}
.guide-link {
  margin-top: auto;
  color: var(--accent-text);
  font-size: 13.5px;
}
</style>
