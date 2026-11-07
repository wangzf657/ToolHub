<script setup lang="ts">
import { ref } from 'vue'
import { Dices, RefreshCw } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { generateMock } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const template = ref(`{
  "id": "{{uuid}}",
  "name": "{{fullName}}",
  "email": "{{email}}",
  "age": {{int:18-60}},
  "city": "{{city}}",
  "joinedAt": "{{date}}",
  "vip": {{bool}},
  "homepage": "{{url}}"
}`)
const count = ref(5)
const output = ref('')

const generate = () => {
  if (!template.value.trim()) return toast.warn('请先编辑模板')
  const n = Math.floor(count.value)
  if (!n || n < 1 || n > 500) return toast.err('数量需在 1-500 之间')
  output.value = generateMock(template.value, n)
  toast.ok(`已生成 ${n} 条模拟数据`)
}

const TOKENS = ['{{fullName}}', '{{email}}', '{{phone}}', '{{int:1-100}}', '{{uuid}}', '{{date}}', '{{datetime}}', '{{city}}', '{{address}}', '{{company}}', '{{bool}}', '{{url}}', '{{ip}}', '{{color}}', '{{id}}']

const insert = (t: string) => {
  template.value += (template.value.endsWith('\n') || !template.value ? '' : ' ') + t
}
</script>

<template>
  <div class="mock-gen">
    <div class="row row-wrap" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">生成数量</span>
        <input v-model.number="count" type="number" class="input mono" style="width: 100px" min="1" max="500" />
      </div>
      <button class="btn btn-primary" @click="generate"><Dices :size="16" /> 生成 Mock 数据</button>
      <span class="muted small">模板为合法 JSON 时生成对象数组；否则按行文本生成。</span>
    </div>

    <div class="grid-2 mt-3" style="gap: 12px">
      <div>
        <div class="row" style="align-items: center; margin-bottom: 6px">
          <span class="field-label" style="margin: 0">模板</span>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" @click="generate"><RefreshCw :size="13" /> 重新生成</button>
        </div>
        <textarea v-model="template" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="生成结果" download="json" min-height="300px" />
    </div>

    <div class="mt-3">
      <span class="field-label">可用令牌（点击插入模板）</span>
      <div class="row row-wrap" style="gap: 7px">
        <button v-for="t in TOKENS" :key="t" class="chip mono" @click="insert(t)">{{ t }}</button>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      数值令牌（<span v-pre>{{int:1-100}}</span>、<span v-pre>{{bool}}</span>）不加引号；字符串令牌需包在引号内。全部数据本地随机生成，不含真实个人信息。
    </p>
  </div>
</template>
