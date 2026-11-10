<script setup lang="ts">
import DatasetLookup from './DatasetLookup.vue'

const cfg = {
  dataset: 'garbage',
  sizeHint: '约 4000 条常见物品（上海四分类口径）',
  placeholder: '输入物品查询分类，如：奶茶杯 / 电池 / 猪大骨…',
  primary: 'n',
  searchKeys: ['n', 'c'],
  subs: [],
  detailKeys: [{ key: 'c', label: '分类' }],
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
