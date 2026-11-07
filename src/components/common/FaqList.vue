<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  items: { q: string; a: string }[]
}>()

const openIdx = ref<number | null>(0)
const toggle = (i: number) => {
  openIdx.value = openIdx.value === i ? null : i
}
void props
</script>

<template>
  <div class="faq-list">
    <div v-for="(item, i) in items" :key="i" class="faq-item">
      <button class="faq-q" @click="toggle(i)">
        <span class="faq-num">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="grow" style="text-align: left">{{ item.q }}</span>
        <ChevronDown :size="16" class="faq-chevron" :class="{ open: openIdx === i }" />
      </button>
      <div v-show="openIdx === i" class="faq-a">
        {{ item.a }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-list {
  display: grid;
  gap: 10px;
}
.faq-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.faq-q {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  background: none;
  color: var(--text);
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.faq-num {
  color: var(--accent-text);
  font-size: 12.5px;
  font-weight: 700;
}
.faq-chevron {
  color: var(--text-3);
  transition: transform 0.18s ease;
}
.faq-chevron.open {
  transform: rotate(180deg);
}
.faq-a {
  padding: 0 16px 14px 46px;
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.7;
}
</style>
