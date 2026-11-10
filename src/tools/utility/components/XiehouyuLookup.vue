<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

const cfg = {
  dataset: 'xiehouyu',
  sizeHint: '约 700KB',
  placeholder: '搜索歇后语，如：泥菩萨 / 黄鼠狼…',
  primary: 'r',
  searchKeys: ['r', 'a'],
  subs: [],
  detailKeys: [{ key: 'a', label: '谜底' }],
  random: true,
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
