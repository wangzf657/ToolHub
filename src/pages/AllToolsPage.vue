<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { allTools } from '@/tools'
import { menuTree } from '@/data/menuTree'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import GroupedToolGrid from '@/components/common/GroupedToolGrid.vue'

/** 全宽分组目录(V1.1 R3-a):按「菜单大类 → 领域族」与工作台菜单同源排序。
 *  ?cat=<菜单大类> 聚焦单个大类——顶栏/首页/页脚/面包屑的大类入口统一指向这里(全站 6 大类口径)。 */
const route = useRoute()
const catNode = computed(() => menuTree.find((c) => c.cat.id === String(route.query.cat ?? '')))
const count = computed(() => (catNode.value ? catNode.value.toolCount : allTools.length))
</script>

<template>
  <div class="all-tools-page">
    <Breadcrumbs
      :items="
        catNode
          ? [{ label: '首页', to: '/' }, { label: '全部工具', to: '/tools' }, { label: catNode.cat.name }]
          : [{ label: '首页', to: '/' }, { label: '全部工具' }]
      "
    />
    <h1>{{ catNode ? catNode.cat.name : '全部工具' }}</h1>
    <p class="muted page-lead">
      {{
        catNode
          ? `${catNode.cat.name}大类共 ${count} 个工具，按领域族分组排列。每个工具都在你的浏览器中运行——处理文件无需上传，也不需要注册账号。`
          : `浏览 ${count} 个本地工具，按使用频率与领域族分组排列。每个工具都在你的浏览器中运行——处理文件无需上传，也不需要注册账号。`
      }}
    </p>
    <!-- 大类切换(与顶栏/工作台菜单同口径) -->
    <nav class="cat-chips" aria-label="按大类浏览">
      <RouterLink to="/tools" class="chip" :class="{ active: !catNode }">全部</RouterLink>
      <RouterLink
        v-for="c in menuTree"
        :key="c.cat.id"
        :to="`/tools?cat=${c.cat.id}`"
        class="chip"
        :class="{ active: catNode?.cat.id === c.cat.id }"
      >{{ c.cat.name }}</RouterLink>
    </nav>
    <GroupedToolGrid scope="menu" :only-cat="catNode?.cat.id" />
  </div>
</template>

<style scoped>
.page-lead {
  max-width: 760px;
}
.cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 4px;
}
/* 胶囊禁止收缩/折行(CJK min-content 是单字宽,默认会被挤成两行) */
.cat-chips .chip {
  flex: none;
  white-space: nowrap;
}
</style>
