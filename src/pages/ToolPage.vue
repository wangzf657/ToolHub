<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Star } from 'lucide-vue-next'
import { toolMap, toolsByCategory } from '@/tools'
import { categoryMap } from '@/data/categories'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import TrustSidebar from '@/components/common/TrustSidebar.vue'
import TextTool from '@/components/common/TextTool.vue'
import CalcTool from '@/components/common/CalcTool.vue'
import ImageConvertTool from '@/components/common/ImageConvertTool.vue'
import ToolCard from '@/components/common/ToolCard.vue'
import NotFoundPage from './NotFoundPage.vue'
import { useSaved } from '@/composables/useSaved'
import type { ToolDef } from '@/types'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const tool = ref<ToolDef | undefined>(undefined)
const component = ref<unknown>(null)
const loadingComp = ref(false)

const { isSaved, toggle } = useSaved()

watch(
  slug,
  async (s) => {
    tool.value = toolMap.get(s)
    component.value = null
    if (tool.value?.component) {
      loadingComp.value = true
      try {
        const mod = await tool.value.component()
        component.value = (mod as { default: unknown }).default
      } finally {
        loadingComp.value = false
      }
    }
  },
  { immediate: true },
)

const category = computed(() => (tool.value ? categoryMap.get(tool.value.category) : undefined))
const related = computed(() =>
  tool.value ? toolsByCategory(tool.value.category).filter((t) => t.slug !== tool.value!.slug).slice(0, 3) : [],
)

const defaultSteps = ['打开工具，输入或拖入内容', '按需调整选项', '点击执行并下载结果']
</script>

<template>
  <NotFoundPage v-if="!tool" />
  <div v-else class="container tool-page" style="padding-top: 14px">
    <Breadcrumbs
      :items="[
        { label: '首页', to: '/' },
        { label: category?.name ?? '', to: category?.path },
        { label: tool.title },
      ]"
    />

    <div class="tool-head">
      <div>
        <h1>{{ tool.title }}</h1>
        <span class="privacy-badge">
          🔒 100% 隐私 —— 在你的设备上运行，从不上传。加载后可离线使用。
          <em v-if="tool.needModel">（部分能力首次使用需下载模型）</em>
        </span>
      </div>
      <button class="bookmark-btn" :class="{ on: isSaved(tool.slug) }" @click="toggle(tool.slug)">
        <Star :size="15" :fill="isSaved(tool.slug) ? 'currentColor' : 'none'" />
        {{ isSaved(tool.slug) ? '已收藏' : '收藏' }}
      </button>
    </div>

    <div class="tool-layout" :class="{ 'tool-layout--wide': tool.studio }">
      <div class="panel tool-panel">
        <div v-if="loadingComp" class="loading"><span class="spinner"></span> 加载工具中…</div>
        <!-- 自定义组件 -->
        <component :is="component" v-else-if="component" />
        <!-- 通用文本工具 -->
        <TextTool v-else-if="tool.textDef" :def="tool.textDef" />
        <!-- 通用计算器（slug 用于输入记忆隔离） -->
        <CalcTool v-else-if="tool.calcDef" :def="tool.calcDef" :slug="tool.slug" />
        <!-- 通用图片格式转换 -->
        <ImageConvertTool
          v-else-if="tool.imgcvt"
          :target="tool.imgcvt.target"
          :target-label="tool.imgcvt.label"
          :with-quality="tool.imgcvt.quality !== false"
          :with-resize="tool.imgcvt.resize"
        />
        <div v-else class="notice notice-warn">该工具正在施工中，敬请期待。</div>
      </div>

      <!-- 工作室类工具豁免右侧信任栏：画布/时间线需要完整宽度（photo 中栏 400→≥750px） -->
      <TrustSidebar v-if="!tool.studio" :steps="tool.steps ?? defaultSteps" />
    </div>

    <p class="tool-about">{{ tool.desc }} 所有处理都在你的浏览器中完成——无上传、无注册、无水印。</p>

    <section v-if="related.length" class="related">
      <h2>同类工具</h2>
      <div class="related-grid">
        <ToolCard v-for="t in related" :key="t.slug" :tool="t" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.tool-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}
.tool-head h1 {
  font-size: clamp(24px, 3.4vw, 34px);
  letter-spacing: -0.6px;
  margin: 0 0 8px;
}
.privacy-badge {
  display: inline-block;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--accent-text);
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  padding: 5px 11px;
  border-radius: 10px;
}
.privacy-badge em {
  font-style: normal;
  color: var(--warn);
  font-size: 12px;
}
.bookmark-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.bookmark-btn:hover,
.bookmark-btn.on {
  border-color: var(--warn);
  color: var(--warn);
}
.tool-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}
.tool-layout--wide {
  grid-template-columns: minmax(0, 1fr);
}
@media (max-width: 900px) {
  .tool-layout {
    grid-template-columns: 1fr;
  }
}
.tool-panel {
  padding: 18px;
  min-height: 240px;
}
.loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-2);
  padding: 30px 0;
}
.tool-about {
  margin-top: 14px;
  color: var(--text-2);
  max-width: 760px;
}
.related h2 {
  font-size: 20px;
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 13px;
}
@media (max-width: 900px) {
  .related-grid {
    grid-template-columns: 1fr;
  }
}
</style>
