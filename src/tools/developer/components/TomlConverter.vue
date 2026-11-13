<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftRight, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { tomlToJson, jsonToToml } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()
const router = useRouter()
const input = ref('')
const output = ref('')
const busy = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null

onMounted(() => {
  unbindPaste = installPasteRun(inputEl.value, () => {
    // 粘贴后按首字符特征自动判定方向（rx2 粘贴即处理）
    const t = input.value.trim()
    if (!t) return
    if (t.startsWith('{') || t.startsWith('[')) toToml()
    else toJson()
  })
})
onBeforeUnmount(() => unbindPaste?.())

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
  // 架构边界披露：JSON 无注释语义，输入含 # 时原注释无法保留（rx1）
  if (input.value.includes('#')) toast.warn('JSON 无注释语义，原注释已丢失')
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

/** 跨工具转料：结果写入 sessionStorage，目标工具挂载时读取（约定 key：toolhub.transfer.<slug>） */
const goWith = (slug: string) => {
  if (output.value) sessionStorage.setItem(`toolhub.transfer.${slug}`, output.value)
  router.push(`/t/${slug}`)
}

/* 空态示例：输出区空态展示与输入 placeholder 对应的示例 JSON 结果（rx4） */
const EXAMPLE_JSON = `{
  "server": { "host": "0.0.0.0", "port": 8080, "debug": true }
}`
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
      <template v-if="output">
        <button class="btn btn-ghost btn-sm" @click="goWith('env-to-json')">转 ENV →</button>
        <button class="btn btn-ghost btn-sm" @click="goWith('json-to-yaml')">转 YAML →</button>
      </template>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入（TOML 或 JSON）</span>
        <textarea ref="inputEl" v-model="input" class="textarea mono" style="min-height: 300px" placeholder="[server]&#10;host = &quot;0.0.0.0&quot;&#10;port = 8080&#10;debug = true"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="txt" min-height="300px" :placeholder="`示例结果对照（对应左侧示例 TOML）：\n${EXAMPLE_JSON}`" />
    </div>

    <p class="notice notice-info mt-2 small">
      支持表格 [section]、内联数组、字符串 / 数字 / 布尔 / 日期类型。重库首次转换时动态加载，请稍候。粘贴后按内容自动判定转换方向；JSON 无注释语义，含 # 的输入转 TOML 时原注释无法保留。
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
