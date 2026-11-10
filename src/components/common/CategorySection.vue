<script setup lang="ts">
import { computed } from 'vue'
import type { ToolDef, CategoryDef } from '@/types'
import ToolCard from './ToolCard.vue'
import AppIcon from './AppIcon.vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{ category: CategoryDef; tools: ToolDef[]; limit?: number }>()
// 必须保持响应式：首页搜索过滤时 tools 整体替换，顶层常量切片会让卡片列表停留在旧数据
const shown = computed(() => (props.limit ? props.tools.slice(0, props.limit) : props.tools))
</script>

<template>
  <section class="cat-section">
    <div class="cat-head">
      <div class="cat-icon" :style="{ background: category.color + '1f', color: category.color }">
        <AppIcon :name="category.icon" :size="22" />
      </div>
      <div class="grow">
        <div class="row" style="gap: 10px">
          <h2 class="cat-title">{{ category.name }}</h2>
          <span class="badge badge-plain">{{ tools.length }}</span>
        </div>
        <p class="cat-desc">{{ category.desc }}</p>
      </div>
      <RouterLink v-if="limit && tools.length > limit" :to="category.path" class="btn btn-ghost btn-sm view-all">
        查看全部 →
      </RouterLink>
    </div>
    <div class="tool-grid">
      <ToolCard v-for="t in shown" :key="t.slug" :tool="t" />
    </div>
  </section>
</template>

<style scoped>
.cat-section {
  margin: 44px 0;
}
.cat-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}
.cat-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
}
.cat-title {
  font-size: 22px;
  margin: 0;
}
.cat-desc {
  margin: 4px 0 0;
  font-size: 13.5px;
  color: var(--text-3);
  max-width: 640px;
}
.view-all {
  white-space: nowrap;
  margin-top: 6px;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
}
@media (max-width: 1100px) {
  .tool-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 800px) {
  .tool-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 520px) {
  .tool-grid {
    grid-template-columns: 1fr;
  }
}
</style>
