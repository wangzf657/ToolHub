<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Zap, Star, Sun, Moon, Menu, X, Github, Search as SearchIcon } from 'lucide-vue-next'
import { categories } from '@/data/categories'
import { site } from '@/data/site'
import { useTheme } from '@/composables/useTheme'
import { useSaved } from '@/composables/useSaved'
import { useSearch } from '@/composables/useSearch'
import { ref, watch } from 'vue'

const { theme, toggle } = useTheme()
const { saved } = useSaved()
const { openSearch } = useSearch()
const route = useRoute()
const mobileOpen = ref(false)

const navCats = categories.filter((c) => ['image', 'pdf', 'video', 'audio', 'data', 'utility', 'developer'].includes(c.id))

watch(
  () => route.path,
  () => {
    mobileOpen.value = false
  },
)
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-icon"><Zap :size="19" /></span>
        <span class="brand-name">Tool<em>Hub</em> 百宝工具箱</span>
      </RouterLink>

      <nav class="nav-desktop">
        <RouterLink
          v-for="c in navCats"
          :key="c.id"
          :to="c.path"
          class="nav-link"
          :class="{ active: route.path === c.path }"
        >{{ c.short }}</RouterLink>
        <RouterLink to="/tools" class="nav-link" :class="{ active: route.path === '/tools' }">全部工具</RouterLink>
        <RouterLink to="/guides" class="nav-link" :class="{ active: route.path.startsWith('/guides') }">指南</RouterLink>
        <RouterLink to="/about" class="nav-link" :class="{ active: route.path === '/about' }">关于</RouterLink>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" title="搜索工具" aria-label="搜索工具" @click="openSearch">
          <SearchIcon :size="17" />
        </button>
        <a
          class="icon-btn"
          :href="site.repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub 开源仓库"
          aria-label="GitHub 开源仓库"
        >
          <Github :size="17" />
        </a>
        <RouterLink to="/saved" class="saved-link" :class="{ active: route.path === '/saved' }">
          <Star :size="16" :fill="saved.length ? 'currentColor' : 'none'" />
          <span class="hide-mobile">收藏</span>
          <span v-if="saved.length" class="saved-count">{{ saved.length }}</span>
        </RouterLink>
        <button class="icon-btn" :title="theme === 'dark' ? '切换浅色' : '切换深色'" :aria-label="theme === 'dark' ? '切换浅色' : '切换深色'" @click="toggle">
          <Sun v-if="theme === 'dark'" :size="17" />
          <Moon v-else :size="17" />
        </button>
        <button class="icon-btn hide-desktop" :aria-label="mobileOpen ? '关闭菜单' : '打开菜单'" @click="mobileOpen = !mobileOpen">
          <X v-if="mobileOpen" :size="19" />
          <Menu v-else :size="19" />
        </button>
      </div>
    </div>

    <transition name="slide">
      <nav v-if="mobileOpen" class="nav-mobile">
        <RouterLink
          v-for="c in categories"
          :key="c.id"
          :to="c.path"
          class="nav-mobile-link"
        >{{ c.name }}</RouterLink>
        <RouterLink to="/tools" class="nav-mobile-link">全部工具</RouterLink>
        <RouterLink to="/guides" class="nav-mobile-link">指南</RouterLink>
        <RouterLink to="/about" class="nav-mobile-link">关于</RouterLink>
        <RouterLink to="/saved" class="nav-mobile-link">★ 我的收藏</RouterLink>
      </nav>
    </transition>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 60px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none !important;
}
.brand-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff;
}
.brand-name {
  font-weight: 700;
  font-size: 18.5px;
  color: var(--text);
  letter-spacing: -0.2px;
}
.brand-name em {
  font-style: normal;
  color: var(--accent-text);
}
.nav-desktop {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-desktop::-webkit-scrollbar {
  display: none;
}
.nav-link {
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none !important;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.nav-link:hover {
  color: var(--text);
  background: var(--accent-soft);
}
.nav-link.active {
  background: var(--accent);
  color: #fff;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  text-decoration: none !important;
  cursor: pointer;
  transition: all 0.15s ease;
}
.icon-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}
.saved-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none !important;
  transition: all 0.15s ease;
}
.saved-link:hover,
.saved-link.active {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.saved-count {
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
}
.nav-mobile {
  display: grid;
  gap: 2px;
  padding: 10px 16px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}
.nav-mobile-link {
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--text-2);
  text-decoration: none !important;
  font-size: 15px;
}
.nav-mobile-link:hover {
  background: var(--accent-soft);
  color: var(--text);
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.18s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (max-width: 860px) {
  .nav-desktop {
    display: none;
  }
  .hide-mobile {
    display: none;
  }
}
@media (min-width: 861px) {
  .hide-desktop {
    display: none;
  }
}
</style>
