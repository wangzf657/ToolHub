<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { allTools, toolsByCategory } from '@/tools'
import { categoryByRoute } from '@/data/categories'
import { menuTree } from '@/data/menuTree'
import AppIcon from '@/components/common/AppIcon.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import GroupedToolGrid from '@/components/common/GroupedToolGrid.vue'
import NotFoundPage from './NotFoundPage.vue'

/** 分类目录页(12 数据分类的历史 URL,SEO 兼容保留;主导航已统一 6 菜单大类口径 → /tools?cat=):
 *  本页按领域族分组全宽网格,排序与工作台菜单同源。 */
const route = useRoute()
const catId = computed(() => route.params.id as string)
const category = computed(() => categoryByRoute(catId.value))
const filter = ref('')
</script>

<template>
  <NotFoundPage v-if="!category && catId !== 'all'" />
  <div v-else class="cat-page">
    <Breadcrumbs
      :items="
        catId === 'all'
          ? [{ label: '首页', to: '/' }, { label: '全部工具' }]
          : [{ label: '首页', to: '/' }, { label: '全部工具', to: '/tools' }, { label: category!.name }]
      "
    />

    <div class="cat-hero">
      <div class="cat-big-icon" :style="{ background: (category?.color ?? '#6366f1') + '1c', color: category?.color }">
        <AppIcon :name="category?.icon ?? 'grid'" :size="30" />
      </div>
      <div class="cat-hero-main">
        <h1>{{ catId === 'all' ? '全部工具' : category!.name }}</h1>
        <p class="muted cat-desc">
          {{ catId === 'all' ? `共 ${allTools.length} 个工具，全部在浏览器本地运行，按领域族分组浏览或直接筛选。` : category!.desc }}
        </p>
      </div>
      <div class="cat-filter">
        <input v-model="filter" class="input" :placeholder="`在 ${catId === 'all' ? allTools.length : toolsByCategory(category!.id).length} 个工具中筛选…`" />
      </div>
    </div>

    <GroupedToolGrid v-if="catId === 'all'" scope="menu" :filter="filter" />
    <GroupedToolGrid v-else scope="category" :category-id="category!.id" :filter="filter" />

    <div class="other-cats">
      <span class="muted small">按大类浏览：</span>
      <RouterLink to="/tools" class="chip">全部</RouterLink>
      <RouterLink v-for="c in menuTree" :key="c.cat.id" :to="`/tools?cat=${c.cat.id}`" class="chip">
        {{ c.cat.name }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.cat-hero {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.cat-hero-main {
  flex: 1;
  min-width: 240px;
}
.cat-hero h1 {
  margin: 0;
  font-size: 30px;
}
.cat-desc {
  max-width: 640px;
  margin: 4px 0 0;
}
.cat-big-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
}
.cat-filter {
  flex: none;
  width: min(320px, 100%);
}
.other-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 30px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.other-cats a {
  text-decoration: none !important;
}
@media (max-width: 860px) {
  .cat-filter {
    order: 3;
  }
}
</style>
