<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FileKey, Braces } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'
import { installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('')
const output = ref('')
/** 当前方向（高亮按钮）：env 或 json */
const dir = ref<'env' | 'json'>('env')
/** 嵌套展平：{"a":{"b":1}} → A_B=1 */
const flattenNested = ref(false)
/** 被跳过的行（行号 + 原因），转换后黄条列出 */
const skipped = ref<{ line: number; text: string; reason: string }[]>([])

const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null

/** 粘贴即处理 + 自动方向：按首字符特征判定并高亮方向按钮（可手动覆盖） */
onMounted(() => {
  // 跨工具转料读取（toml-to-json「转 ENV」入口）
  const t = sessionStorage.getItem('toolhub.transfer.env-to-json')
  if (t) {
    input.value = t
    sessionStorage.removeItem('toolhub.transfer.env-to-json')
  }
  unbindPaste = installPasteRun(inputEl.value, autoRun)
})
onBeforeUnmount(() => unbindPaste?.())

const autoRun = () => {
  const t = input.value.trim()
  if (!t) return
  if (t.startsWith('{') || t.startsWith('[')) {
    dir.value = 'json'
    jsonToEnv()
  } else {
    dir.value = 'env'
    envToJson()
  }
}

/** 解析 .env 文本：KEY=VALUE、# 注释、export 前缀、引号值；引号未闭合时吞行至闭合 */
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  skipped.value = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]
    const line = raw.trim()
    const lineNo = li + 1
    if (!line) continue
    if (line.startsWith('#')) {
      skipped.value.push({ line: lineNo, text: line.slice(0, 40), reason: '注释行' })
      continue
    }
    const noExport = line.replace(/^export\s+/, '')
    const idx = noExport.indexOf('=')
    if (idx <= 0) {
      skipped.value.push({ line: lineNo, text: line.slice(0, 40), reason: '缺少 = 或键名不合法' })
      continue
    }
    const key = noExport.slice(0, idx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) {
      skipped.value.push({ line: lineNo, text: line.slice(0, 40), reason: '键名不合法' })
      continue
    }
    let val = noExport.slice(idx + 1).trim()
    const q = val[0]
    const quoted = q === '"' || q === "'"
    /** 闭合判定：最后一个引号之后只允许空白或行内注释；返回引号内内容或 null */
    const quotedContent = (s: string): string | null => {
      const last = s.lastIndexOf(q)
      if (last < 1) return null
      const tail = s.slice(last + 1)
      if (!/^\s*(#.*)?$/.test(tail)) return null
      return s.slice(1, last)
    }
    if (quoted && quotedContent(val) === null) {
      // 引号未闭合：继续吞行直到闭合（跨行值，如 PEM 证书）
      let merged = val
      let closed = false
      let j = li + 1
      while (j < lines.length) {
        merged += '\n' + lines[j]
        const inner = quotedContent(merged)
        if (inner !== null) {
          li = j
          val = inner
          closed = true
          break
        }
        j++
      }
      if (!closed) {
        skipped.value.push({ line: lineNo, text: line.slice(0, 40), reason: '引号未闭合' })
        continue
      }
      if (q === '"' && val.includes('\\n')) val = val.replace(/\\n/g, '\n')
    } else if (quoted) {
      val = quotedContent(val) ?? val
      if (q === '"' && val.includes('\\n')) val = val.replace(/\\n/g, '\n')
    } else {
      const hash = val.indexOf(' #')
      if (hash > -1) val = val.slice(0, hash).trim()
    }
    out[key] = val
  }
  return out
}

/** 嵌套对象展平为 A_B 键 */
function flattenObj(obj: Record<string, unknown>, out: Record<string, unknown> = {}, prefix = ''): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}_${k}` : k
    if (flattenNested.value && v && typeof v === 'object' && !Array.isArray(v)) flattenObj(v as Record<string, unknown>, out, key)
    else out[key] = v
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
  dir.value = 'env'
  const obj = parseEnv(input.value)
  if (!Object.keys(obj).length) return toast.err('未解析到有效变量（检查 KEY=VALUE 格式）')
  output.value = JSON.stringify(obj, null, 2)
  toast.ok(`解析出 ${Object.keys(obj).length} 个变量${skipped.value.length ? `，跳过 ${skipped.value.length} 行` : ''}`)
}

const jsonToEnv = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON 内容')
  dir.value = 'json'
  try {
    const data = JSON.parse(input.value)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('需要顶层 JSON 对象')
    output.value = rowsToEnv(flattenObj(data as Record<string, unknown>))
    toast.ok('已生成 .env 行')
  } catch (e) {
    toast.err(`JSON 解析失败：${(e as Error).message.slice(0, 100)}`)
  }
}
</script>

<template>
  <div class="env-cvt">
    <div class="row row-wrap mb-2" style="align-items: center; gap: 10px">
      <button class="btn btn-sm" :class="dir === 'env' ? 'btn-primary' : 'btn-ghost'" @click="envToJson"><Braces :size="14" /> .env → JSON</button>
      <button class="btn btn-sm" :class="dir === 'json' ? 'btn-primary' : 'btn-ghost'" @click="jsonToEnv"><FileKey :size="14" /> JSON → .env</button>
      <label class="check" title='嵌套对象展开为 A_B 键，如 {"a":{"b":1}} → A_B=1'><input v-model="flattenNested" type="checkbox" /> 嵌套展平（A_B=1）</label>
      <span class="muted small">粘贴后自动判定方向</span>
    </div>

    <div v-if="skipped.length" class="notice notice-warn mb-2">
      <span v-for="s in skipped" :key="s.line" class="skip-line">第 {{ s.line }} 行「{{ s.text }}」已跳过（{{ s.reason }}）</span>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入（.env 或 JSON）</span>
        <textarea ref="inputEl" v-model="input" class="textarea mono" style="min-height: 280px" placeholder="# 应用配置&#10;APP_NAME=百宝工具箱&#10;export DEBUG=false&#10;DB_HOST=&quot;127.0.0.1&quot;&#10;DB_PORT=5432"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="txt" min-height="280px" />
    </div>

    <p class="notice notice-info mt-2 small">
      支持 <code class="mono"># 注释</code>、<code class="mono">export KEY=VALUE</code>、单双引号与行内注释；引号未闭合的值会跨行吞并（适合粘贴 PEM 证书）；反向生成时键会自动对齐，含空格的值加双引号。
    </p>
  </div>
</template>

<style scoped>
.skip-line {
  display: block;
}
</style>
