import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import { toolMap } from '@/tools'
import { guideBySlug } from '@/data/guides'
import { site } from '@/data/site'

/** history 路由：URL 无 #，百度/Google 才能正常收录；宿主需支持 SPA 回退（EdgeOne Pages 等） */
const router = createRouter({
  history: createWebHistory(),
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

/** 单页应用没有逐页 HTML，导航时同步 meta description（搜索引擎摘要用） */
function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

/** 同步 og 标签（微信/QQ 分享卡片抓取用） */
function setOg(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.content = content
}

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
  const descs: Record<string, string> = {
    home: site.desc,
    'all-tools': '520+ 个免费纯本地浏览器工具完整目录：图片、PDF、视频、音频、数据、开发与 AI，文件永不上传。',
    guides: '原创使用指南：图片压缩、PDF 处理、音视频转换等常见任务在浏览器本地完成的最简做法。',
    about: '关于百宝工具箱：为什么所有处理都留在你的浏览器里。',
  }
  document.title = titles[to.name as string] ?? '百宝工具箱 ToolHub'
  let desc = descs[to.name as string] ?? site.desc
  // 工具页标题带上工具名，便于多标签页区分与分享/SEO
  if (to.name === 'tool') {
    const tool = toolMap.get(String(to.params.slug ?? ''))
    if (tool) {
      document.title = `${tool.title} | 百宝工具箱`
      desc = tool.desc
    }
  }
  if (to.name === 'guide') {
    const guide = guideBySlug(String(to.params.slug ?? ''))
    if (guide) {
      document.title = `${guide.title} | 百宝工具箱`
      desc = guide.excerpt
    }
  }
  setMeta('description', desc)
  // og 标签供微信/QQ 等分享卡片抓取；站点域名（site.siteUrl）填入后附带 og:url
  setOg('og:title', document.title)
  setOg('og:description', desc)
  setOg('og:type', 'website')
  if (site.siteUrl) setOg('og:url', site.siteUrl.replace(/\/+$/, '') + to.path)
})

export default router
