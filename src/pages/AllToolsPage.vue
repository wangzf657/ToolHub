<script setup lang="ts">
import { allTools, toolsByCategory } from '@/tools'
import { categories } from '@/data/categories'
import ToolCard from '@/components/common/ToolCard.vue'
import CategorySection from '@/components/common/CategorySection.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '全部工具' }]" />
    <h1>全部工具</h1>
    <p class="muted" style="max-width: 720px">
      浏览 {{ allTools.length }} 个本地工具。每个工具都在你的浏览器中运行——处理文件无需上传，也不需要注册账号。
    </p>

    <CategorySection v-for="c in categories" :key="c.id" :category="c" :tools="toolsByCategory(c.id)" />
  </div>
</template>
