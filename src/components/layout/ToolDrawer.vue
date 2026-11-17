<script setup lang="ts">
/**
 * 移动端工具抽屉(≤860px,顶栏汉堡=唯一入口):ToolMenu(菜单大类折叠+过滤框,族定位只走过滤框)
 * + 抽屉底部站点导航区(工具菜单与站点导航合并,杜绝双菜单)。
 * 关闭路径:遮罩点击 / 选中链接路由切换 / Esc / 浏览器返回(popstate,首次返回仅关抽屉);overscroll-behavior contain 防滚动穿透。
 */
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { X, Home, LayoutGrid, BookOpen, Info, Star } from 'lucide-vue-next'
import ToolMenu from '@/components/layout/ToolMenu.vue'
import { useWorkbench } from '@/composables/useWorkbench'
import { useSaved } from '@/composables/useSaved'

const { drawerOpen } = useWorkbench()
const route = useRoute()
const { saved } = useSaved()

const siteLinks = [
  { to: '/', label: '首页', icon: Home },
  { to: '/tools', label: '全部工具', icon: LayoutGrid },
  { to: '/guides', label: '使用指南', icon: BookOpen },
  { to: '/about', label: '关于', icon: Info },
]

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') drawerOpen.value = false
}
/** 浏览器返回（R5.3/BUG-004）：popstate 一律先关抽屉——openDrawer 压入的哨兵历史使首次返回
 *  delta=0 仅关抽屉不导航；哨兵缺失（pushState 失败/历史边界）时仅多余一次无感 popstate */
const onPopState = () => {
  drawerOpen.value = false
}
const closeOnRoute = () => {
  drawerOpen.value = false
}
/** 任何路由变化（抽屉内链接、程序化导航、跨页返回）都关闭抽屉——兜底哨兵未覆盖的路径 */
watch(() => route.fullPath, closeOnRoute)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('popstate', onPopState)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('popstate', onPopState)
})
void saved
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="drawerOpen" class="tool-drawer-overlay" @click.self="drawerOpen = false">
        <div class="tool-drawer" role="dialog" aria-label="工具菜单">
          <div class="drawer-head">
            <span class="drawer-title">ToolHub 百宝工具箱</span>
            <button class="drawer-close" aria-label="关闭菜单" @click="drawerOpen = false">
              <X :size="18" />
            </button>
          </div>
          <div class="drawer-body" @click="closeOnRoute">
            <ToolMenu mobile />
          </div>
          <nav class="drawer-foot">
            <RouterLink v-for="l in siteLinks" :key="l.to" :to="l.to" class="drawer-nav-link">
              <component :is="l.icon" :size="15" />
              {{ l.label }}
            </RouterLink>
            <RouterLink to="/saved" class="drawer-nav-link">
              <Star :size="15" />
              收藏<em v-if="saved.length">{{ saved.length }}</em>
            </RouterLink>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tool-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(5, 8, 18, 0.55);
  backdrop-filter: blur(4px);
}
.tool-drawer {
  position: absolute;
  top: 0;
  left: 0;
  width: min(320px, 86vw);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border-right: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
  padding-bottom: var(--safe-b);
}
.drawer-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px 18px;
  border-bottom: 1px solid var(--border);
}
.drawer-title {
  font-weight: 700;
  font-size: 15px;
}
.drawer-close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.drawer-body {
  /* 高度透传:滚动与底部固定区由 ToolMenu 内部的 .menu-scroll/.menu-foot 自持 */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.drawer-foot {
  flex: none;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  padding: 8px 10px calc(10px + var(--safe-b));
  border-top: 1px solid var(--border);
  background: var(--bg);
}
.drawer-nav-link {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 7px 2px;
  border-radius: 9px;
  color: var(--text-2);
  font-size: 11px;
  text-decoration: none !important;
}
.drawer-nav-link em {
  font-style: normal;
  font-size: 10px;
  color: var(--accent-text);
}
.drawer-nav-link:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active .tool-drawer,
.drawer-leave-active .tool-drawer {
  transition: transform 0.22s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .tool-drawer,
.drawer-leave-to .tool-drawer {
  transform: translateX(-100%);
}
</style>
