<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { allTools, toolsByCategory } from '@/tools'
import { categories, categoryByRoute } from '@/data/categories'
import ToolCard from '@/components/common/ToolCard.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import NotFoundPage from './NotFoundPage.vue'

const route = useRoute()
const catId = computed(() => route.params.id as string)
const category = computed(() => categoryByRoute(catId.value))
const tools = computed(() =>
  catId.value === 'all' ? allTools : toolsByCategory(category.value?.id ?? catId.value),
)
const filter = ref('')
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return tools.value
  return tools.value.filter((t) => t.title.toLowerCase().includes(q) || (t.keywords ?? []).some((k) => k.toLowerCase().includes(q)) || t.desc.toLowerCase().includes(q))
})
</script>

<template>
  <NotFoundPage v-if="!category && catId !== 'all'" />
  <div v-else class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: catId === 'all' ? '全部工具' : category!.name }]" />

    <div class="cat-hero">
      <div class="cat-big-icon" :style="{ background: (category?.color ?? '#6366f1') + '1c', color: category?.color }">
        <AppIcon :name="category?.icon ?? 'grid'" :size="30" />
      </div>
      <div>
        <h1>{{ catId === 'all' ? '全部工具' : category!.name }}</h1>
        <p class="muted">{{ catId === 'all' ? `共 ${allTools.length} 个工具，全部在浏览器本地运行，按分类浏览或直接搜索。` : category!.desc }}</p>
      </div>
    </div>

    <div class="tool-filter">
      <input v-model="filter" class="input" :placeholder="`在 ${tools.length} 个工具中筛选…`" />
    </div>

    <div class="tools-grid">
      <ToolCard v-for="t in filtered" :key="t.slug" :tool="t" />
    </div>
    <p v-if="!filtered.length" class="muted" style="padding: 40px 0">没有匹配的工具。</p>

    <div class="other-cats mt-3">
      <span class="muted small">其他分类：</span>
      <RouterLink v-for="c in categories.filter((x) => x.id !== category?.id)" :key="c.id" :to="c.path" class="chip">
        {{ c.name }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.cat-hero {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
}
.cat-hero h1 {
  margin: 0;
  font-size: 30px;
}
.cat-big-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
}
.tool-filter {
  margin-bottom: 18px;
}
.tool-filter .input {
  max-width: 420px;
}
.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 13px;
}
@media (max-width: 1000px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
}
.other-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  text-decoration: none;
}
.other-cats a {
  text-decoration: none;
}
</style>
