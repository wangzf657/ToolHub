<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import CookieBanner from '@/components/layout/CookieBanner.vue'
import SearchModal from '@/components/common/SearchModal.vue'
import { useSearch } from '@/composables/useSearch'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { allTools } from '@/tools'

const { searchOpen, closeSearch, openSearch } = useSearch()
const { toasts } = useToast()
useTheme()

const onKey = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    openSearch()
  } else if (e.key === 'Escape') {
    closeSearch()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <SiteHeader />
  <RouterView />
  <SiteFooter />
  <CookieBanner />
  <SearchModal v-if="searchOpen" :tools="allTools" @close="closeSearch" />

  <!-- 全局提示 -->
  <div class="toast-wrap">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.text }}</div>
    </transition-group>
  </div>
</template>

<style>
.toast-wrap {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: grid;
  gap: 8px;
  justify-items: center;
  pointer-events: none;
}
.toast {
  background: var(--panel-solid);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 10px 18px;
  border-radius: 12px;
  font-size: 13.5px;
  box-shadow: var(--shadow);
  max-width: min(480px, calc(100vw - 40px));
}
.toast.ok {
  border-color: var(--ok);
}
.toast.err {
  border-color: var(--err);
}
.toast.warn {
  border-color: var(--warn);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
