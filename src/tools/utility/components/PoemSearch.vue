<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

const cfg = {
  dataset: 'poetry',
  sizeHint: '唐宋精选 632 首',
  placeholder: '按标题/作者/诗句搜索，如：月 / 李白 / 大江东去…',
  primary: 't',
  searchKeys: ['t', 'a', 'ps'],
  subs: [
    { key: 'a', label: '' },
    { key: 'dy', label: '' },
  ],
  detailKeys: [{ key: 'ps', label: '正文' }],
  emptyTip: '语料边界：唐宋诗/词精选集，不含诗经、元曲、现当代作品；收录以名篇为主，非全量文库。',
  zeroTip: '「{q}」不在收录范围内。本库为唐宋名篇精选（不含诗经/元曲/乐府），可尝试「月」「李白」等更常见的标题、作者或诗句。',
  random: true,
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
