<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

const cfg = {
  dataset: 'ecdict',
  sizeHint: '约 2MB（COCA/BNC 高频 2 万词）· 英美双音标齐全',
  placeholder: '输入单词查询音标与释义，如：hello / beautiful…',
  primary: 'w',
  searchKeys: ['w', 'tr'],
  subs: [
    { key: 'uk', label: '英' },
    { key: 'us', label: '美' },
  ],
  detailKeys: [{ key: 'tr', label: '释义' }],
  speak: [
    { key: 'w', label: '英音', lang: 'en-GB' },
    { key: 'w', label: '美音', lang: 'en-US' },
  ],
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
