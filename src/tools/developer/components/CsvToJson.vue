<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FileSpreadsheet, Braces, AlertTriangle } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { parseCsvAsync } from '@/lib/csvEngine'
import { useToast } from '@/composables/useToast'
import { installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()
const text = ref('')
const output = ref('')
const delim = ref('auto')
const toNumber = ref(true)
const headerRow = ref(true)
const nestedExpand = ref(false)
const autoRun = ref(true)
const fileName = ref('')
const rowCount = ref(0)
/** 行级解析告警（如引号未闭合），转换后展示 */
const warnings = ref<string[]>([])

const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null
onMounted(() => {
  unbindPaste = installPasteRun(inputEl.value, () => {
    if (autoRun.value && text.value.trim()) convert()
  })
})
onBeforeUnmount(() => unbindPaste?.())

/** 分隔符嗅探（与 csvEngine 同口径：取前 4000 字符中出现次数最多的候选分隔符） */
const sniffDelimiter = (t: string): string => {
  const sample = t.slice(0, 4000)
  const counts: [string, number][] = [
    [',', (sample.match(/,/g) ?? []).length],
    [';', (sample.match(/;/g) ?? []).length],
    ['\t', (sample.match(/\t/g) ?? []).length],
    ['|', (sample.match(/\|/g) ?? []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0]?.[1] > 0 ? counts[0][0] : ','
}

/** 引号未闭合行级预检：逐字符扫描，落在引号内跨行的起点记为告警行 */
const scanQuoteIssues = (t: string): string[] => {
  const issues: string[] = []
  let inQuote = false
  let openLine = 1
  let line = 1
  let fieldHasQuote = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '\n') line++
    if (ch === '"') {
      if (!inQuote) {
        inQuote = true
        fieldHasQuote = true
        openLine = line
      } else if (t[i + 1] === '"') {
        i++
      } else {
        inQuote = false
      }
    } else if (ch === ',' && !inQuote) {
      fieldHasQuote = false
    } else if ((ch === '\n' || ch === '\r') && inQuote) {
      // 引号内换行是合法的（多行字段），继续
    } else if (!inQuote && fieldHasQuote && ch !== ',' && ch !== '\n' && ch !== '\r') {
      // 引号闭合后又出现杂散字符，如 a"b → 记一次
      if (!issues.includes(`第 ${line} 行：引号后出现多余字符`)) issues.push(`第 ${line} 行：引号后出现多余字符`)
      fieldHasQuote = false
    }
  }
  if (inQuote) issues.push(`第 ${openLine} 行：引号未闭合`)
  return issues
}

/** 文件编码检测：BOM/UTF-8 严格解码失败时回退 GBK（Excel 中文版导出常见） */
const readFile = async (f: File): Promise<string> => {
  const buf = await f.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('gbk').decode(bytes)
  }
}

const onFiles = async (files: File[]) => {
  if (!files.length) return
  fileName.value = files[0].name
  text.value = await readFile(files[0])
  convert()
}

/** 列名 a.b.c 展开为嵌套对象 */
const setByPath = (o: Record<string, unknown>, path: string, v: unknown) => {
  const parts = path.split('.').filter(Boolean)
  let cur = o
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = v
}

const convert = async () => {
  if (!text.value.trim()) {
    toast.warn('请先粘贴 CSV 内容或拖入文件')
    return
  }
  try {
    const d = delim.value === 'auto' ? sniffDelimiter(text.value) : delim.value
    warnings.value = scanQuoteIssues(text.value)
    const { header, rows } = await parseCsvAsync(text.value, { delimiter: d, header: headerRow.value })
    const cast = (s: string): unknown => {
      if (!toNumber.value) return s
      if (s !== '' && !Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s.trim())) return Number(s)
      if (s === 'true' || s === 'false') return s === 'true'
      return s
    }
    const useNested = nestedExpand.value && header.some((h) => h.includes('.'))
    const objects = rows.map((r) => {
      const o: Record<string, unknown> = {}
      header.forEach((h, i) => {
        if (useNested && h.includes('.')) setByPath(o, h, cast(r[i] ?? ''))
        else o[h] = cast(r[i] ?? '')
      })
      return o
    })
    output.value = JSON.stringify(objects, null, 2)
    rowCount.value = objects.length
    toast.ok(`转换完成，共 ${objects.length} 行`)
  } catch (e) {
    toast.err(`解析失败：${(e as Error).message}`)
  }
}

const sample = () => {
  text.value = '姓名,年龄,城市\n张三,28,北京\n李四,35,上海'
  convert()
}
</script>

<template>
  <div class="c2j">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <span class="field-label" style="margin: 0">分隔符</span>
      <select v-model="delim" class="select" style="width: 110px">
        <option value="auto">自动嗅探</option>
        <option value=",">逗号 ,</option>
        <option value=";">分号 ;</option>
        <option :value="'\t'">制表符</option>
        <option value="|">竖线 |</option>
      </select>
      <label class="check"><input v-model="headerRow" type="checkbox" /> 首行为表头</label>
      <label class="check"><input v-model="toNumber" type="checkbox" /> 数字自动转为 number</label>
      <label class="check" title="列名含 a.b.c 时展开为嵌套对象"><input v-model="nestedExpand" type="checkbox" /> 嵌套键展开为对象</label>
      <label class="check" title="粘贴后自动转换"><input v-model="autoRun" type="checkbox" /> 粘贴即转换</label>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="sample">填入示例</button>
    </div>

    <FileDrop label="拖入 CSV 文件（自动识别 UTF-8/GBK 编码），或直接在下方粘贴" accept=".csv,.tsv,.txt" :multiple="false" @files="onFiles" />

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">CSV 输入{{ fileName ? `（${fileName}）` : '' }}</span>
        <textarea ref="inputEl" v-model="text" class="textarea mono" style="min-height: 240px" placeholder="姓名,年龄,城市&#10;张三,28,北京"></textarea>
      </div>
      <div class="out-col">
        <div v-if="warnings.length" class="notice notice-warn">
          <AlertTriangle :size="14" style="vertical-align: -2px" />
          <span v-for="w in warnings" :key="w" class="warn-line">{{ w }}</span>
          <span class="muted small">以上行存在格式问题，已尽力解析，请核对结果</span>
        </div>
        <ResultBox v-model="output" title="JSON 输出" download="json" min-height="240px" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="convert"><Braces :size="16" /> 转换为 JSON</button>
      <span v-if="rowCount" class="muted small">共 {{ rowCount }} 条记录</span>
      <FileSpreadsheet v-if="!text" :size="16" class="muted" />
    </div>
  </div>
</template>

<style scoped>
.c2j :deep(.select) {
  padding: 7px 32px 7px 12px;
  font-size: 13.5px;
}
.out-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.warn-line {
  display: block;
  font-weight: 600;
}
</style>
