<script setup lang="ts">
import { ref } from 'vue'
import { Braces, Minimize2, ShieldCheck } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { formatJson, minifyJson, validateJson } from '@/lib/jsEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const output = ref('')
const indent = ref('2')
const sortKeys = ref(false)
const error = ref<{ line?: number; col?: number; msg: string } | null>(null)
const valid = ref(false)

const run = (mode: 'format' | 'minify' | 'check') => {
  error.value = null
  valid.value = false
  if (!input.value.trim()) {
    toast.warn('请先粘贴 JSON 内容')
    return
  }
  const v = validateJson(input.value)
  if (!v.ok) {
    error.value = { line: v.line, col: v.col, msg: v.error ?? 'JSON 语法错误' }
    toast.err('JSON 校验未通过')
    return
  }
  valid.value = true
  if (mode === 'check') {
    output.value = formatJson(input.value, 2, sortKeys.value)
    toast.ok('JSON 校验通过 ✓')
    return
  }
  try {
    output.value = mode === 'minify' ? minifyJson(input.value) : formatJson(input.value, Number(indent.value), sortKeys.value)
    toast.ok(mode === 'minify' ? '已压缩' : '已格式化')
  } catch (e) {
    error.value = { msg: (e as Error).message }
  }
}
</script>

<template>
  <div class="jf">
    <div class="row row-wrap mt-1 mb-2" style="align-items: center; gap: 12px">
      <span class="field-label" style="margin: 0">缩进</span>
      <select v-model="indent" class="select" style="width: 110px">
        <option value="2">2 空格</option>
        <option value="4">4 空格</option>
      </select>
      <label class="check"><input v-model="sortKeys" type="checkbox" /> 按键名排序</label>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" @click="run('format')"><Braces :size="15" /> 格式化</button>
      <button class="btn btn-ghost btn-sm" @click="run('minify')"><Minimize2 :size="15" /> 压缩</button>
      <button class="btn btn-ghost btn-sm" @click="run('check')"><ShieldCheck :size="15" /> 校验</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入 JSON</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 320px" placeholder='粘贴 JSON，例如 {"name": "张三", "tags": ["dev", "ops"]}'></textarea>
      </div>
      <ResultBox v-model="output" title="输出结果" download="json" min-height="320px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2">
      校验失败：{{ error.msg }}
      <span v-if="error.line">（第 {{ error.line }} 行，第 {{ error.col }} 列附近）</span>
    </div>
    <div v-else-if="valid" class="notice notice-ok mt-2">JSON 校验通过，语法完全合法。</div>

    <button v-if="output" class="btn btn-ghost btn-sm mt-2" @click="saveText(output, 'formatted.json', 'application/json')">下载 formatted.json</button>
  </div>
</template>

<style scoped>
.jf :deep(.select) {
  padding: 7px 32px 7px 12px;
  font-size: 13.5px;
}
</style>
