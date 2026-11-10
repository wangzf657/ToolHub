<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

/** 成语词典：通用查询壳 + 成语专属配置（首条成语接龙在下方扩展） */
const cfg = {
  dataset: 'idiom',
  sizeHint: '约 8MB，首次加载需数秒',
  placeholder: '输入成语、拼音或释义关键词，如：一鸣惊人 / jing / 形容迅速…',
  primary: 'w',
  searchKeys: ['w', 'p', 'e'],
  subs: [{ key: 'p', label: '' }],
  detailKeys: [
    { key: 'e', label: '释义' },
    { key: 'd', label: '出处' },
    { key: 'ex', label: '例句' },
  ],
  random: true,
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
