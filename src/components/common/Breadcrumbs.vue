<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    items: { label: string; to?: string }[]
  }>(),
  {},
)
</script>

<template>
  <nav class="breadcrumbs">
    <template v-for="(item, i) in items" :key="i">
      <ChevronRight v-if="i > 0" :size="13" class="sep" />
      <RouterLink v-if="item.to" :to="item.to" class="crumb link">{{ item.label }}</RouterLink>
      <span v-else class="crumb current">{{ item.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--text-3);
  margin-bottom: 18px;
}
.sep {
  color: var(--text-3);
  opacity: 0.6;
}
.crumb.link {
  color: var(--text-3);
  text-decoration: none !important;
}
.crumb.link:hover {
  color: var(--accent-text);
}
.crumb.current {
  color: var(--text-2);
}
</style>
