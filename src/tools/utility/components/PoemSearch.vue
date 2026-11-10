<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

const cfg = {
  dataset: 'poetry',
  sizeHint: '唐诗 352 首 + 宋词 280 首（精选集）',
  placeholder: '按标题/作者/诗句搜索，如：月 / 李白 / 大江东去…',
  primary: 't',
  searchKeys: ['t', 'a', 'ps'],
  subs: [
    { key: 'a', label: '' },
    { key: 'dy', label: '' },
  ],
  detailKeys: [{ key: 'ps', label: '正文' }],
  random: true,
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
