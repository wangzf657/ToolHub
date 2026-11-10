<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Search, Zap, Lock, Zap as ZapIcon, WifiOff, Infinity as Inf, ArrowRight } from 'lucide-vue-next'
import { heroFeatures, site, formatGroups, faqs } from '@/data/site'
import { categories } from '@/data/categories'
import { guides } from '@/data/guides'
import { allTools, popularTools, studioTools, toolsByCategory } from '@/tools'
import ToolCard from '@/components/common/ToolCard.vue'
import CategorySection from '@/components/common/CategorySection.vue'
import FaqList from '@/components/common/FaqList.vue'
import { useSearch } from '@/composables/useSearch'
import { useToast } from '@/composables/useToast'

const { openSearch } = useSearch()
const toast = useToast()
const activeCat = ref<'all' | string>('all')
const input = ref('')

const heroIcons = [Lock, ZapIcon, WifiOff, Inf]

const filteredSections = computed(() => {
  const q = input.value.trim()
  if (q) {
    const lower = q.toLowerCase()
    return categories
      .map((c) => ({
        category: c,
        tools: toolsByCategory(c.id).filter(
          (t) => t.title.toLowerCase().includes(lower) || (t.keywords ?? []).some((k) => k.toLowerCase().includes(lower)),
        ),
      }))
      .filter((s) => s.tools.length)
  }
  return categories
    .filter((c) => activeCat.value === 'all' || c.id === activeCat.value)
    .map((c) => ({ category: c, tools: toolsByCategory(c.id) }))
})

const latestGuides = guides.slice(0, 3)

// 编辑器区只展示 editors 分类下的 4 个标准工作台；image/pdf/video/data 分类注册表里
// 另有 4 个同组件入口（photo-editor 等），全量渲染会出现 4 组重复卡（BUG-30）
const homeStudios = studioTools.filter((t) => t.category === 'editors')

const goSearch = () => {
  if (input.value.trim()) toast.warn('按回车或在搜索框中继续查看各分类的匹配结果')
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-left">
          <span class="badge">{{ site.toolCountLabel }}</span>
          <h1 class="hero-title">浏览器里的<br /><span class="grad">全能工具箱</span></h1>
          <p class="hero-sub">
            <strong>你的文件永不离机。</strong>PDF、视频、照片、表格的完整编辑器，加上数百个轻量小工具——全部在浏览器本地运行。无需上传、无需注册、没有水印。
          </p>
          <div class="hero-search" @click="openSearch">
            <Search :size="18" />
            <span class="hero-search-text">搜索 {{ allTools.length }} 个工具——压缩、合并、抠图、转写…</span>
          </div>
          <div class="hero-input-wrap">
            <input v-model="input" class="hero-input" placeholder="或直接在此输入关键词过滤下方工具…" @keyup.enter="goSearch" />
          </div>
        </div>
        <div class="hero-cards">
          <div v-for="(f, i) in heroFeatures" :key="f.title" class="hero-card">
            <component :is="heroIcons[i]" :size="22" class="hero-card-icon" />
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 编辑器 -->
    <section class="container studios">
      <h2 class="sec-title">浏览器里运行的免费编辑器</h2>
      <p class="sec-sub">完整编辑器，不是单一用途的转换器——通常这类软件按月收费，这里免费且不联网。</p>
      <div class="studio-grid">
        <div v-for="s in homeStudios" :key="s.slug" class="studio-card">
          <div class="studio-head">
            <span class="studio-icon"><Zap :size="18" /></span>
            <h3>{{ s.title }}</h3>
          </div>
          <p class="studio-desc">{{ s.desc }}</p>
          <ul class="studio-list">
            <li v-for="(step, i) in s.steps ?? []" :key="i">{{ step }}</li>
          </ul>
          <RouterLink :to="`/t/${s.slug}`" class="btn btn-primary btn-sm studio-btn">打开 {{ s.title }} →</RouterLink>
        </div>
      </div>
    </section>

    <!-- 工具目录 -->
    <div class="cat-bar">
      <div class="container cat-bar-inner">
        <button class="chip" :class="{ active: activeCat === 'all' }" @click="activeCat = 'all'">
          ✦ 全部
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          class="chip"
          :class="{ active: activeCat === c.id }"
          @click="activeCat = c.id"
        >
          {{ c.name }}
        </button>
      </div>
    </div>

    <main class="container">
      <!-- 热门工具 -->
      <section v-if="activeCat === 'all' && !input.trim()" class="popular">
        <div class="row">
          <h2 class="sec-title" style="margin: 0">热门工具</h2>
          <span class="badge badge-plain">其他平台通常收费</span>
        </div>
        <div class="popular-grid">
          <ToolCard v-for="t in popularTools" :key="t.slug" :tool="t" />
        </div>
      </section>

      <CategorySection
        v-for="sec in filteredSections"
        :key="sec.category.id"
        :category="sec.category"
        :tools="sec.tools"
        :limit="8"
      />

      <div v-if="!filteredSections.length" class="notice notice-info">没有匹配「{{ input }}」的工具。</div>

      <!-- 为什么选择 -->
      <section class="why">
        <h2 class="sec-title">为隐私、速度与简单而生</h2>
        <div class="why-grid">
          <div class="why-card">
            <strong>零上传架构</strong>
            <span class="why-metric">0 KB</span>
            <p>每个工具都在浏览器沙箱中处理文件。任何内容都不会被发送到服务器——连临时缓存都没有。</p>
          </div>
          <div class="why-card">
            <strong>即时处理</strong>
            <span class="why-metric">&lt;50ms</span>
            <p>没有上传队列。文件一放下就开始处理，WebAssembly 带来接近原生的速度。</p>
          </div>
          <div class="why-card">
            <strong>离线可用</strong>
            <span class="why-metric">100%</span>
            <p>页面加载完成后断网也能继续使用，适合机上办公与隐私环境。</p>
          </div>
        </div>

        <h2 class="sec-title mt-3">本地工具是如何工作的</h2>
        <div class="steps-grid">
          <div class="step-card"><span class="step-big">1</span><h4>加载工具</h4><p>打开页面时，浏览器下载轻量的处理脚本与资源，瞬间完成。</p></div>
          <div class="step-card"><span class="step-big">2</span><h4>拖入文件</h4><p>选择文件后，脚本在你标签页内的安全沙箱中处理它，用的是你自己的 CPU。</p></div>
          <div class="step-card"><span class="step-big">3</span><h4>即时下载</h4><p>结果以本地 Blob 形式生成，点击即保存到你的设备。完成。</p></div>
        </div>

        <h2 class="sec-title mt-3">支持的文件格式</h2>
        <div class="fmt-grid">
          <div v-for="g in formatGroups" :key="g.title" class="fmt-card">
            <h4>{{ g.title }}</h4>
            <div class="fmt-chips">
              <span v-for="f in g.items" :key="f" class="fmt-chip">{{ f }}</span>
            </div>
          </div>
        </div>

        <h2 class="sec-title mt-3">常见问题</h2>
        <FaqList :items="faqs" class="mt-2" />

        <h2 class="sec-title mt-3">最新指南</h2>
        <div class="guide-grid">
          <RouterLink v-for="g in latestGuides" :key="g.slug" :to="`/guides/${g.slug}`" class="guide-card card">
            <span class="guide-date">{{ g.date }}</span>
            <h4>{{ g.title }}</h4>
            <p class="muted small">{{ g.excerpt.slice(0, 60) }}…</p>
            <span class="guide-more">阅读全文 <ArrowRight :size="13" /></span>
          </RouterLink>
        </div>
        <RouterLink to="/guides" class="btn btn-ghost btn-sm mt-2">全部指南 →</RouterLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.hero {
  padding: 72px 0 56px;
}
.hero-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 44px;
  align-items: center;
}
@media (max-width: 960px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }
}
.hero-title {
  font-size: clamp(38px, 5.4vw, 58px);
  font-weight: 800;
  letter-spacing: -1.5px;
  line-height: 1.12;
  margin: 18px 0 16px;
}
.grad {
  background: linear-gradient(120deg, var(--accent-2), #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub {
  font-size: 16.5px;
  color: var(--text-2);
  max-width: 560px;
  line-height: 1.75;
}
.hero-sub strong {
  color: var(--text);
}
.hero-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--panel-solid) 75%, transparent);
  cursor: pointer;
  color: var(--text-3);
  max-width: 480px;
  transition: border-color 0.15s ease;
}
.hero-search:hover {
  border-color: var(--accent);
}
.hero-search-text {
  font-size: 14.5px;
}
.hero-input-wrap {
  margin-top: 10px;
  max-width: 480px;
}
.hero-input {
  width: 100%;
  padding: 11px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.hero-input:focus {
  border-color: var(--accent);
}
.hero-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
}
.hero-card {
  padding: 20px;
  border-radius: 15px;
  border: 1px solid var(--border);
  background: var(--panel);
}
.hero-card-icon {
  color: var(--accent-text);
}
.hero-card h3 {
  margin: 10px 0 6px;
  font-size: 15.5px;
}
.hero-card p {
  margin: 0;
  font-size: 12.8px;
  color: var(--text-3);
  line-height: 1.6;
}
.studios {
  padding: 26px 20px 6px;
}
.sec-title {
  font-size: 26px;
  letter-spacing: -0.4px;
}
.sec-sub {
  color: var(--text-2);
  margin-top: -6px;
}
.studio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 20px;
}
@media (max-width: 860px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }
}
.studio-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 22px;
  background: var(--panel);
  display: flex;
  flex-direction: column;
}
.studio-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.studio-head h3 {
  margin: 0;
  font-size: 19px;
}
.studio-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
}
.studio-desc {
  margin: 10px 0 8px;
  color: var(--text-2);
  font-size: 14px;
}
.studio-list {
  margin: 0 0 14px;
  padding-left: 18px;
  color: var(--text-3);
  font-size: 13.5px;
  line-height: 1.9;
}
.studio-btn {
  margin-top: auto;
  align-self: flex-start;
}
.cat-bar {
  position: sticky;
  top: 60px;
  z-index: 30;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  margin-top: 34px;
}
.cat-bar-inner {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 20px;
  scrollbar-width: none;
}
.cat-bar-inner::-webkit-scrollbar {
  display: none;
}
.popular {
  margin-top: 34px;
}
.popular-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
  margin-top: 16px;
}
@media (max-width: 1100px) {
  .popular-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .popular-grid {
    grid-template-columns: 1fr;
  }
}
.why {
  margin: 60px 0 30px;
}
.why-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 18px;
}
@media (max-width: 860px) {
  .why-grid {
    grid-template-columns: 1fr;
  }
}
.why-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 22px;
  background: var(--panel);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.why-metric {
  font-size: 30px;
  font-weight: 800;
  color: var(--accent-text);
}
.why-card p {
  margin: 4px 0 0;
  color: var(--text-2);
  font-size: 13.5px;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 18px;
}
@media (max-width: 860px) {
  .steps-grid {
    grid-template-columns: 1fr;
  }
}
.step-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}
.step-big {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  margin-bottom: 10px;
}
.step-card h4 {
  margin: 0 0 6px;
}
.step-card p {
  margin: 0;
  color: var(--text-3);
  font-size: 13.5px;
}
.fmt-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 18px;
}
@media (max-width: 960px) {
  .fmt-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.fmt-card h4 {
  font-size: 14px;
  color: var(--text-2);
}
.fmt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fmt-chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text-2);
}
.guide-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 18px;
}
@media (max-width: 860px) {
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
.guide-card {
  text-decoration: none !important;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.guide-card:hover {
  border-color: var(--accent);
}
.guide-date {
  font-size: 12px;
  color: var(--text-3);
}
.guide-card h4 {
  margin: 6px 0;
  font-size: 15px;
}
.guide-more {
  margin-top: auto;
  font-size: 13px;
  color: var(--accent-text);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
