<script setup lang="ts">
import { ref } from 'vue'
import { FileType2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { jsonToTs } from '@/lib/jsEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('{\n  "id": 1,\n  "name": "张三",\n  "email": "zhang@example.com",\n  "tags": ["vip", "beta"],\n  "profile": {\n    "age": 28,\n    "city": "北京",\n    "vip": true\n  },\n  "orders": [\n    { "orderId": "A001", "amount": 99.5, "paid": true }\n  ]\n}')
const rootName = ref('Order')
const output = ref('')
const error = ref('')

const generate = () => {
  error.value = ''
  output.value = ''
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON')
  try {
    output.value = jsonToTs(input.value, rootName.value.trim() || 'Root')
    toast.ok('TypeScript 接口已生成')
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 120)}`
  }
}

const download = () => {
  if (!output.value) return
  saveText(output.value, `${(rootName.value || 'types').toLowerCase()}.types.ts`, 'text/plain;charset=utf-8')
  toast.ok('已下载 .ts 文件')
}
</script>

<template>
  <div class="json2ts">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">根类型名</span>
        <input v-model="rootName" type="text" class="input mono" style="width: 150px" placeholder="Order" />
      </div>
      <button class="btn btn-primary" @click="generate"><FileType2 :size="16" /> 生成接口</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="TypeScript 接口" download="ts" min-height="300px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <div class="row mt-2">
      <button class="btn btn-ghost btn-sm" :disabled="!output" @click="download">下载 .ts 文件</button>
    </div>

    <p class="notice notice-info mt-2 small">
      推断规则：对象生成 interface，数组取首元素推断为元素类型，null 字段标记为可选，嵌套对象自动拆分为独立接口并去重。
    </p>
  </div>
</template>
