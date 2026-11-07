<script setup lang="ts">
import { ref } from 'vue'
import { FileCode2, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { formatXml } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('<?xml version="1.0" encoding="UTF-8"?>\n<catalog><book id="1"><title>本地优先</title><price>0</price></book><book id="2"><title>离线可用</title><price>0</price></book></catalog>')
const output = ref('')
const error = ref('')
const busy = ref(false)

/** DOMParser 捕获解析错误 */
function checkXml(text: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    const err = doc.querySelector('parsererror')
    if (err) {
      const msg = (err.textContent ?? '').replace(/\s+/g, ' ').trim()
      return msg.slice(0, 160)
    }
    return null
  } catch (e) {
    return (e as Error).message
  }
}

const run = async (minify: boolean) => {
  error.value = ''
  if (!input.value.trim()) return toast.warn('请先粘贴 XML')
  const parseErr = checkXml(input.value)
  if (parseErr) {
    error.value = parseErr
    toast.err('XML 解析失败，请检查标签闭合与转义')
    return
  }
  busy.value = true
  try {
    output.value = formatXml(input.value, 2, minify)
    toast.ok(minify ? 'XML 已压缩' : 'XML 已美化')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="xml-fmt">
    <div class="row row-wrap mb-2">
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run(false)">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <FileCode2 v-else :size="14" /> 美化缩进
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="run(true)">压缩为一行</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">XML 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="xml" min-height="300px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2">解析错误：{{ error }}</div>
  </div>
</template>

<style scoped>
.spin {
  animation: xml-spin 0.8s linear infinite;
}
@keyframes xml-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
