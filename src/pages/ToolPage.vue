<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Star, Smartphone } from 'lucide-vue-next'
import { toolMap, toolsByCategory } from '@/tools'
import { menuCategoryOfSlug } from '@/data/menuTree'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import ToolMetaStrip from '@/components/common/ToolMetaStrip.vue'
import TextTool from '@/components/common/TextTool.vue'
import CalcTool from '@/components/common/CalcTool.vue'
import ImageConvertTool from '@/components/common/ImageConvertTool.vue'
import ToolCard from '@/components/common/ToolCard.vue'
import NotFoundPage from './NotFoundPage.vue'
import { useSaved } from '@/composables/useSaved'
import { isWeChat } from '@/lib/download'
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

/** 面包屑分类口径 = 菜单大类(与顶栏/工作台菜单/目录一致),指向 /tools?cat= 分组目录 */
const menuCat = computed(() => (tool.value ? menuCategoryOfSlug(tool.value.slug)?.cat : undefined))
const related = computed(() =>
  tool.value ? toolsByCategory(tool.value.category).filter((t) => t.slug !== tool.value!.slug).slice(0, 3) : [],
)

const defaultSteps = ['打开工具，输入或拖入内容', '按需调整选项', '点击执行并下载结果']
</script>

<template>
  <NotFoundPage v-if="!tool" />
  <!-- V1.1:脱离 .container 居中容器,面板全宽(R4);纯说明段落保留行宽上限 -->
  <div v-else class="tool-page">
    <Breadcrumbs
      :items="[
        { label: '首页', to: '/' },
        { label: menuCat?.name ?? '工具', to: menuCat ? `/tools?cat=${menuCat.id}` : '/tools' },
        { label: tool.title },
      ]"
    />

    <div class="tool-head">
      <div>
        <h1>{{ tool.title }}</h1>
        <span class="privacy-badge">
          🔒 100% 隐私 —— 在你的设备上运行，从不上传。加载后可离线使用。
          <em v-if="tool.needModel">（部分能力首次使用需下载模型，建议 Wi-Fi 环境）</em>
        </span>
      </div>
      <button class="bookmark-btn" :class="{ on: isSaved(tool.slug) }" :title="isSaved(tool.slug) ? '取消收藏' : '收藏工具'" @click="toggle(tool.slug)">
        <Star :size="15" :fill="isSaved(tool.slug) ? 'currentColor' : 'none'" />
        <span class="bookmark-text">{{ isSaved(tool.slug) ? '已收藏' : '收藏' }}</span>
      </button>
    </div>

    <!-- 微信内置浏览器下载降级提示(R5-d:blob 下载经常静默失效) -->
    <p v-if="isWeChat()" class="notice notice-warn wechat-tip">
      <Smartphone :size="15" style="flex: none; margin-top: 2px" />
      当前在微信内打开，文件可能无法直接保存——点右上角「···」选「在浏览器打开」后再下载。
    </p>

    <!-- 编辑器工作室移动降级提示(R5-e:面板垂直堆叠精简模式,仅 ≤860 显示) -->
    <p v-if="tool.studio" class="notice notice-info studio-mobile-tip">
      <Smartphone :size="15" style="flex: none; margin-top: 2px" />
      移动端精简模式：面板已改为垂直堆叠，复杂操作建议在桌面使用。
    </p>

    <!-- 单栏全宽：右侧不设栏，把空间让给工具本体；信任盾/快速指南压成面板下方一条横条 -->
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

    <!-- 工作室类工具面板内已有步骤向导，横条只保留信任要点，避免二次重复 -->
    <ToolMetaStrip :steps="tool.studio ? [] : (tool.steps ?? defaultSteps)" />

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
.wechat-tip {
  margin-bottom: 12px;
}
.studio-mobile-tip {
  display: none;
  margin-bottom: 12px;
}
@media (max-width: 860px) {
  .studio-mobile-tip {
    display: flex;
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
/* 可读性例外:纯说明段落保留行宽上限,交互面板全宽 */
.tool-about {
  margin-top: 14px;
  color: var(--text-2);
  max-width: 900px;
}
.related {
  margin-top: 26px;
}
.related h2 {
  font-size: 20px;
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 13px;
}
@media (max-width: 480px) {
  .bookmark-btn {
    padding: 8px 11px;
  }
  .bookmark-text {
    display: none;
  }
}
</style>
