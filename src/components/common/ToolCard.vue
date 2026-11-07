<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Star } from 'lucide-vue-next'
import type { ToolDef } from '@/types'
import { categoryMap } from '@/data/categories'
import AppIcon from './AppIcon.vue'
import { useSaved } from '@/composables/useSaved'

const props = defineProps<{ tool: ToolDef }>()
const { isSaved, toggle } = useSaved()
const cat = categoryMap.get(props.tool.category)
</script>

<template>
  <RouterLink :to="`/t/${tool.slug}`" class="tool-card card" :title="tool.desc">
    <div class="tool-icon" :style="{ background: (cat?.color ?? '#6366f1') + '1f', color: cat?.color }">
      <AppIcon :name="cat?.icon ?? 'info'" :size="19" />
    </div>
    <div class="tool-body">
      <div class="tool-title-row">
        <h3 class="tool-title">{{ tool.title }}</h3>
        <button
          class="star-btn"
          :class="{ on: isSaved(tool.slug) }"
          :title="isSaved(tool.slug) ? '取消收藏' : '收藏'"
          @click.prevent="toggle(tool.slug)"
        >
          <Star :size="15" :fill="isSaved(tool.slug) ? 'currentColor' : 'none'" />
        </button>
      </div>
      <p class="tool-desc">{{ tool.desc }}</p>
    </div>
  </RouterLink>
</template>

<style scoped>
.tool-card {
  display: flex;
  gap: 13px;
  text-decoration: none !important;
  color: inherit;
  cursor: pointer;
}
.tool-card:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateY(-2px);
}
.tool-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  margin-top: 2px;
}
.tool-body {
  flex: 1;
  min-width: 0;
}
.tool-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.tool-title {
  font-size: 14.5px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
  line-height: 1.4;
}
.star-btn {
  flex: none;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.star-btn:hover {
  color: var(--warn);
}
.star-btn.on {
  color: var(--warn);
}
.tool-desc {
  margin: 5px 0 0;
  font-size: 12.8px;
  color: var(--text-3);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
