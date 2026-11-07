<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, X, CornerDownLeft } from 'lucide-vue-next'
import type { ToolDef } from '@/types'
import { searchTools } from '@/composables/useSearch'
import { categoryMap } from '@/data/categories'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ tools: ToolDef[] }>()
const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const activeIdx = ref(0)
const router = useRouter()
const toast = useToast()

const results = computed(() => searchTools(props.tools, query.value, 12))

watch(results, () => {
  activeIdx.value = 0
})

const go = (slug: string) => {
  router.push(`/t/${slug}`)
  query.value = ''
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
  } else if (e.key === 'Enter') {
    const t = results.value[activeIdx.value]
    if (t) go(t.slug)
  }
}

watch(
  () => query.value,
  () => nextTick(() => inputEl.value?.focus()),
)
defineExpose({ focus: () => nextTick(() => inputEl.value?.focus()) })
void toast
</script>

<template>
  <div class="search-modal" @click.self="$emit('close')">
    <div class="search-box">
      <div class="search-input-row">
        <Search :size="18" class="search-glyph" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="搜索 370+ 工具：压缩、合并、抠图、JSON…"
          autofocus
          @keydown="onKey"
        />
        <button class="close-btn" aria-label="关闭搜索" @click="$emit('close')"><X :size="17" /></button>
      </div>
      <div class="search-results">
        <template v-if="query.trim()">
          <button
            v-for="(t, i) in results"
            :key="t.slug"
            class="result-item"
            :class="{ active: i === activeIdx }"
            @click="go(t.slug)"
            @mouseenter="activeIdx = i"
          >
            <span
              class="r-icon"
              :style="{ background: (categoryMap.get(t.category)?.color ?? '#666') + '1f', color: categoryMap.get(t.category)?.color }"
            >
              {{ t.title.slice(0, 1) }}
            </span>
            <span class="r-body">
              <span class="r-title">{{ t.title }}</span>
              <span class="r-desc">{{ t.desc }}</span>
            </span>
            <span class="r-cat">{{ categoryMap.get(t.category)?.name }}</span>
          </button>
          <p v-if="!results.length" class="no-result">没有找到匹配「{{ query }}」的工具，换个关键词试试？</p>
        </template>
        <template v-else>
          <p class="hint"><CornerDownLeft :size="13" /> 输入关键词搜索，↑↓ 选择，回车打开</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { emits: ['close'] }
</script>

<style scoped>
.search-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 8, 18, 0.62);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  padding: 10vh 16px 16px;
}
.search-box {
  width: min(640px, 100%);
  background: var(--panel-solid);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
  height: fit-content;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}
.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 16px;
  border-bottom: 1px solid var(--border);
}
.search-glyph {
  color: var(--text-3);
  flex: none;
}
.search-input-row input {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  color: var(--text);
  font-size: 15.5px;
  font-family: inherit;
}
.close-btn {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.search-results {
  overflow-y: auto;
  padding: 6px;
}
.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  color: var(--text);
}
.result-item.active {
  background: var(--accent-soft);
}
.r-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  font-weight: 700;
  font-size: 14px;
}
.r-body {
  flex: 1;
  min-width: 0;
  display: grid;
}
.r-title {
  font-size: 14px;
  font-weight: 600;
}
.r-desc {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-cat {
  flex: none;
  font-size: 11.5px;
  color: var(--text-3);
}
.no-result,
.hint {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 13.5px;
}
.hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
</style>
