<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { useSearch } from '@/composables/useSearch'

const { openSearch } = useSearch()
</script>

<template>
  <div class="container nf" style="padding-top: 60px">
    <h1>404</h1>
    <h2>页面走丢了</h2>
    <p class="muted">这个地址不存在或已移动。试试搜索，或从分类入口进入。</p>
    <div class="row" style="justify-content: center">
      <button class="btn btn-primary" @click="openSearch"><Search :size="15" /> 搜索工具</button>
      <RouterLink to="/tools" class="btn btn-ghost">浏览全部工具</RouterLink>
      <RouterLink to="/" class="btn btn-ghost">回到首页</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.nf {
  text-align: center;
  padding-bottom: 80px;
}
.nf h1 {
  font-size: 84px;
  margin: 0;
  letter-spacing: -3px;
  color: var(--accent-text);
}
</style>
