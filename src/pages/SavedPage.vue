<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Star, Trash2 } from 'lucide-vue-next'
import { toolMap } from '@/tools'
import ToolCard from '@/components/common/ToolCard.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import { useSaved } from '@/composables/useSaved'
import type { ToolDef } from '@/types'

const { saved, remove } = useSaved()
const tools = computed(() => saved.value.map((s) => toolMap.get(s)).filter((t): t is ToolDef => Boolean(t)))
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '我的收藏' }]" />
    <div class="row">
      <h1 style="margin: 0">★ 我的收藏</h1>
      <span class="badge badge-plain">{{ tools.length }}</span>
    </div>
    <p class="muted">收藏保存在浏览器本地，不会同步到任何服务器。</p>

    <div v-if="tools.length" class="tools-grid">
      <div v-for="t in tools" :key="t.slug" class="saved-item">
        <ToolCard :tool="t" />
        <button class="remove-btn" title="移除收藏" @click="remove(t.slug)"><Trash2 :size="14" /></button>
      </div>
    </div>

    <div v-else class="empty card">
      <Star :size="36" class="empty-icon" />
      <h3>还没有收藏任何工具</h3>
      <p class="muted">点击任意工具卡片右上角的 ☆ 星标，把它加到这里，下次直达。</p>
      <RouterLink to="/tools" class="btn btn-primary btn-sm">去逛逛全部工具</RouterLink>
    </div>
  </div>
</template>

<style scoped>
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
.saved-item {
  position: relative;
}
.remove-btn {
  position: absolute;
  right: 10px;
  bottom: 10px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.remove-btn:hover {
  color: var(--err);
  border-color: var(--err);
}
.empty {
  text-align: center;
  padding: 60px 20px;
  display: grid;
  justify-items: center;
  gap: 10px;
}
.empty-icon {
  color: var(--text-3);
}
</style>
