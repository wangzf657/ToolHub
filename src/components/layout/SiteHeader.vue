<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Zap, Star, Sun, Moon, Menu, Github, Search as SearchIcon } from 'lucide-vue-next'
import { menuTree, menuCategoryOfSlug } from '@/data/menuTree'
import { site } from '@/data/site'
import { useTheme } from '@/composables/useTheme'
import { useSaved } from '@/composables/useSaved'
import { useSearch } from '@/composables/useSearch'
import { useWorkbench } from '@/composables/useWorkbench'
import { useMenuSync } from '@/composables/useMenuSync'

const { theme, toggle } = useTheme()
const { saved } = useSaved()
const { openSearch } = useSearch()
const { openDrawer } = useWorkbench()
const { solo, expandAll } = useMenuSync()
const route = useRoute()

/** 顶栏大类与工作台菜单同口径(V1.1 验收追加):6 个菜单大类 + 全部工具;
 *  激活态跟随当前工具/目录页所属大类 */
const activeMenuCat = computed(() => {
  if (route.name === 'tool') return menuCategoryOfSlug(String(route.params.slug ?? ''))?.cat.id ?? ''
  if (route.name === 'all-tools') {
    const mc = String(route.query.cat ?? '')
    return menuTree.some((c) => c.cat.id === mc) ? mc : ''
  }
  return ''
})
const allToolsActive = computed(() => route.name === 'all-tools' && !activeMenuCat.value)
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-icon"><Zap :size="19" /></span>
        <span class="brand-name">Tool<em>Hub</em> 百宝工具箱</span>
      </RouterLink>

      <nav class="nav-desktop">
        <!-- 与工作台菜单同口径:6 菜单大类(点击=菜单独占展开该类并折叠其他) + 全部工具(点击=全部展开) -->
        <RouterLink
          v-for="c in menuTree"
          :key="c.cat.id"
          :to="`/tools?cat=${c.cat.id}`"
          class="nav-link"
          :class="{ active: activeMenuCat === c.cat.id }"
          @click="solo(c.cat.id)"
        >{{ c.cat.name }}</RouterLink>
        <RouterLink to="/tools" class="nav-link" :class="{ active: allToolsActive }" @click="expandAll()">全部工具</RouterLink>
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
        <button class="icon-btn hide-desktop" aria-label="打开工具菜单" @click="openDrawer">
          <Menu :size="19" />
        </button>
      </div>
    </div>
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
  min-width: 0;
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
  min-width: 0;
  font-weight: 700;
  font-size: 18.5px;
  color: var(--text);
  letter-spacing: -0.2px;
  /* 窄视口行内截断(BUG-001):头部行各子项均有 44px 触控契约不可收缩,
     溢出压力全由品牌名吸收(省略号),避免全站页面级横向滚动 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
@media (max-width: 860px) {
  .nav-desktop {
    display: none;
  }
  .hide-mobile {
    display: none;
  }
  /* 触控目标镜像 base.css 基座契约(BUG-005):局部样式带 [data-v] 特异性高于单类名媒体规则,
     不在组件内显式对齐就会被 34px 覆盖——哨兵 R5-S3 锁定两侧一致 */
  .icon-btn {
    width: 40px;
    height: 40px;
  }
}
@media (hover: none) and (pointer: coarse) {
  .icon-btn {
    width: 44px;
    height: 44px;
  }
}
/* ≤480 收紧间隙(BUG-001):触屏指针下动作区 5 项 ×44px 不可减,
   间隙让位后 320 视口亦无横向溢出(间隙仅在挤压时生效,常态由 margin-left:auto 吸收) */
@media (max-width: 480px) {
  .header-inner {
    gap: 12px;
  }
  .header-actions {
    gap: 4px;
  }
}
@media (min-width: 861px) {
  .hide-desktop {
    display: none;
  }
}
</style>
