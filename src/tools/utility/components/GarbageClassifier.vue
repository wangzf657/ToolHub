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
  favKey: 'garbage',
  quickChips: [
    { label: '猪大骨', value: '猪大骨' },
    { label: '外卖盒', value: '外卖盒' },
    { label: '粽子叶', value: '粽子叶' },
    { label: '奶茶杯', value: '奶茶杯' },
    { label: '电池', value: '电池' },
  ],
  zeroTip:
    '未收录「{q}」。按投放原则：无回收价值且非有害的物品可投入干垃圾（其他垃圾）；拿不准时可优先排除有害垃圾（电池/药品/灯管等）与可回收物（金属/塑料/纸类）。',
}
</script>

<template>
  <DatasetLookup :cfg="cfg" />
</template>
