<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import CookieBanner from '@/components/layout/CookieBanner.vue'
import SearchModal from '@/components/common/SearchModal.vue'
import { useSearch } from '@/composables/useSearch'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { useWorkbench } from '@/composables/useWorkbench'
import { allTools } from '@/tools'

// 抽屉(含 Element Plus 菜单)按需异步:桌面端不挂载则不加载 chunk,EP 不进静态入口与首页首屏
const ToolDrawer = defineAsyncComponent(() => import('@/components/layout/ToolDrawer.vue'))

const { searchOpen, closeSearch, openSearch } = useSearch()
const { drawerOpen } = useWorkbench()
const { toasts } = useToast()
useTheme()

const isMobile = ref(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 860px)').matches)

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
  <!-- 移动端工具抽屉(顶栏汉堡=唯一入口;移动端常挂载,桌面仅打开时加载) -->
  <ToolDrawer v-if="drawerOpen || isMobile" />
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
