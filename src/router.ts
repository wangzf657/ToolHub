import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'

/** 使用 hash 路由：纯静态部署无需服务器重写规则 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/tools', name: 'all-tools', component: () => import('@/pages/AllToolsPage.vue') },
    { path: '/tools/:id', name: 'category-all', component: () => import('@/pages/CategoryPage.vue') },
    { path: '/:id(image-tools|video-tools|audio-tools|pdf-tools|data-tools|utility-tools|developer-tools|finance-tools|business-tools|seo-tools|ai-tools|studios)', name: 'category', component: () => import('@/pages/CategoryPage.vue') },
    { path: '/t/:slug', name: 'tool', component: () => import('@/pages/ToolPage.vue') },
    { path: '/saved', name: 'saved', component: () => import('@/pages/SavedPage.vue') },
    { path: '/guides', name: 'guides', component: () => import('@/pages/GuidesPage.vue') },
    { path: '/guides/:slug', name: 'guide', component: () => import('@/pages/GuidePage.vue') },
    { path: '/about', name: 'about', component: () => import('@/pages/AboutPage.vue') },
    { path: '/contact', name: 'contact', component: () => import('@/pages/ContactPage.vue') },
    { path: '/privacy', name: 'privacy', component: () => import('@/pages/PrivacyPage.vue') },
    { path: '/terms', name: 'terms', component: () => import('@/pages/TermsPage.vue') },
    { path: '/studio/:id', redirect: (to) => {
      const map: Record<string, string> = { pdf: 'pdf-editor', video: 'video-editor', photo: 'photo-editor', data: 'data-analysis-tool' }
      return `/t/${map[to.params.id as string] ?? 'tools'}`
    } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const titles: Record<string, string> = {
    home: '百宝工具箱 ToolHub — 免费、纯本地的浏览器工具集',
    'all-tools': '全部工具 | 百宝工具箱',
    saved: '我的收藏 | 百宝工具箱',
    guides: '使用指南 | 百宝工具箱',
    about: '关于 | 百宝工具箱',
    contact: '联系我们 | 百宝工具箱',
    privacy: '隐私政策 | 百宝工具箱',
    terms: '使用条款 | 百宝工具箱',
  }
  document.title = titles[to.name as string] ?? '百宝工具箱 ToolHub'
})

export default router
