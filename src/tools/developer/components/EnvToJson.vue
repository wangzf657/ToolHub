<script setup lang="ts">
import { ref } from 'vue'
import { FileKey, Braces } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const output = ref('')

/** 解析 .env 文本：KEY=VALUE、# 注释、export 前缀、引号值 */
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const noExport = line.replace(/^export\s+/, '')
    const idx = noExport.indexOf('=')
    if (idx <= 0) continue
    const key = noExport.slice(0, idx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) continue
    let val = noExport.slice(idx + 1).trim()
    // 去掉值后面的行内注释（未加引号时）
    if ((val.startsWith('"') && val.endsWith('"') && val.length >= 2) || (val.startsWith("'") && val.endsWith("'") && val.length >= 2)) {
      val = val.slice(1, -1)
      if (val.includes('\\n')) val = val.replace(/\\n/g, '\n')
    } else {
      const hash = val.indexOf(' #')
      if (hash > -1) val = val.slice(0, hash).trim()
    }
    out[key] = val
  }
  return out
}

/** 生成对齐的 .env 行 */
function rowsToEnv(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).filter(([k]) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(k))
  const width = Math.max(...entries.map(([k]) => k.length), 0)
  return entries
    .map(([k, v]) => {
      let val = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
      if (/[\s#"']/.test(val) || val === '') val = `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      return `${k.padEnd(width)}=${val}`
    })
    .join('\n')
}

const envToJson = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 .env 内容')
  const obj = parseEnv(input.value)
  if (!Object.keys(obj).length) return toast.err('未解析到有效变量（检查 KEY=VALUE 格式）')
  output.value = JSON.stringify(obj, null, 2)
  toast.ok(`解析出 ${Object.keys(obj).length} 个变量`)
}

const jsonToEnv = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON 内容')
  try {
    const data = JSON.parse(input.value)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('需要顶层 JSON 对象')
    output.value = rowsToEnv(data as Record<string, unknown>)
    toast.ok('已生成 .env 行')
  } catch (e) {
    toast.err(`JSON 解析失败：${(e as Error).message.slice(0, 100)}`)
  }
}
</script>

<template>
  <div class="env-cvt">
    <div class="row row-wrap mb-2">
      <button class="btn btn-primary btn-sm" @click="envToJson"><Braces :size="14" /> .env → JSON</button>
      <button class="btn btn-ghost btn-sm" @click="jsonToEnv"><FileKey :size="14" /> JSON → .env</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入（.env 或 JSON）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 280px" placeholder="# 应用配置&#10;APP_NAME=百宝工具箱&#10;export DEBUG=false&#10;DB_HOST=&quot;127.0.0.1&quot;&#10;DB_PORT=5432"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="txt" min-height="280px" />
    </div>

    <p class="notice notice-info mt-2 small">
      支持 <code class="mono"># 注释</code>、<code class="mono">export KEY=VALUE</code>、单双引号与行内注释；反向生成时键会自动对齐，含空格的值加双引号。
    </p>
  </div>
</template>
