<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeftRight, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { tomlToJson, jsonToToml } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const output = ref('')
const busy = ref(false)

const toJson = async () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 TOML 内容')
  busy.value = true
  try {
    output.value = await tomlToJson(input.value)
    toast.ok('TOML 已转换为 JSON（首次需加载解析库）')
  } catch (e) {
    toast.err(`TOML 解析失败：${(e as Error).message.slice(0, 120)}`)
  } finally {
    busy.value = false
  }
}

const toToml = async () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON 内容')
  busy.value = true
  try {
    JSON.parse(input.value)
    output.value = await jsonToToml(input.value)
    toast.ok('JSON 已转换为 TOML')
  } catch (e) {
    toast.err(`转换失败：${(e as Error).message.slice(0, 120)}`)
  } finally {
    busy.value = false
  }
}

const swap = () => {
  if (!output.value) return
  input.value = output.value
  output.value = ''
  toast.ok('已把结果复制到输入框，可继续反向转换')
}
</script>

<template>
  <div class="toml-cvt">
    <div class="row row-wrap mb-2">
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="toJson">
        <Loader2 v-if="busy" :size="14" class="spin" /> TOML → JSON
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="toToml">
        <Loader2 v-if="busy" :size="14" class="spin" /> JSON → TOML
      </button>
      <button class="btn btn-soft btn-sm" @click="swap"><ArrowLeftRight :size="14" /> 交换输入输出</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入（TOML 或 JSON）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" placeholder="[server]&#10;host = &quot;0.0.0.0&quot;&#10;port = 8080&#10;debug = true"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="txt" min-height="300px" />
    </div>

    <p class="notice notice-info mt-2 small">
      支持表格 [section]、内联数组、字符串 / 数字 / 布尔 / 日期类型。重库首次转换时动态加载，请稍候。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: toml-spin 0.8s linear infinite;
}
@keyframes toml-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
