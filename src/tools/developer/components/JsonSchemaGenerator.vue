<script setup lang="ts">
import { ref } from 'vue'
import { ScrollText } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { jsonSchemaFrom } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('{\n  "productId": "SKU-001",\n  "price": 199.9,\n  "stock": 42,\n  "active": true,\n  "tags": ["新品", "热卖"],\n  "vendor": { "name": "青石互联", "rating": 4.8 }\n}')
const title = ref('商品 Schema')
const output = ref('')
const error = ref('')

const generate = () => {
  error.value = ''
  output.value = ''
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON')
  try {
    output.value = jsonSchemaFrom(input.value, title.value.trim() || 'Generated schema')
    toast.ok('JSON Schema（draft-07）已生成')
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 120)}`
  }
}
</script>

<template>
  <div class="json-schema">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">Schema 标题</span>
        <input v-model="title" type="text" class="input" style="width: 200px" />
      </div>
      <button class="btn btn-primary" @click="generate"><ScrollText :size="16" /> 生成 Schema</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">示例 JSON 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="JSON Schema 输出" download="json" min-height="300px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <p class="notice notice-info mt-2 small">
      推断规则：类型按示例值判定（整数/小数区分），对象收集 properties 与 required，数组取首元素推断 items，null 字段生成 type: null。
    </p>
  </div>
</template>
