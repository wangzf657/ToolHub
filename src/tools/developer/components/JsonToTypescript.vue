<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FileType2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun, installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('{\n  "id": 1,\n  "name": "张三",\n  "email": "zhang@example.com",\n  "tags": ["vip", "beta"],\n  "profile": {\n    "age": 28,\n    "city": "北京",\n    "vip": true\n  },\n  "orders": [\n    { "orderId": "A001", "amount": 99.5, "paid": true }\n  ]\n}')
const rootName = ref('Order')
const output = ref('')
const error = ref('')
/** 字面量 union：字符串字段值域 2~5 个且重复出现时生成联合类型 */
const literalUnion = ref(true)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null

const pascal = (s: string) =>
  s.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Item'

/** 多样本推断：数组取全部元素归并，字段缺失或为 null 标可选（?） */
function inferTs(data: unknown, rootStr: string, useUnion: boolean): string {
  const lines: string[] = []
  const seen = new Set<string>()

  /** 合并一组对象样本为一个 interface；同名同键组去重 */
  const walkMerged = (samples: Record<string, unknown>[], name: string): string => {
    const ifaceName = pascal(name)
    const keys = [...new Set(samples.flatMap((s) => Object.keys(s)))]
    const ifaceKey = ifaceName + JSON.stringify(keys)
    if (seen.has(ifaceKey)) return ifaceName
    seen.add(ifaceKey)
    const props = keys.map((k) => {
      const present = samples.filter((s) => k in s && s[k] !== null && s[k] !== undefined).map((s) => (s as Record<string, unknown>)[k])
      const optional = present.length === samples.length ? '' : '?'
      const type = present.length ? typeUnion(present, k) : 'unknown'
      const safeKey = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
      return `  ${safeKey}${optional}: ${type}`
    })
    lines.push(`export interface ${ifaceName} {\n${props.join('\n')}\n}`)
    return ifaceName
  }

  const typeUnion = (vals: unknown[], name: string): string => {
    // 字符串字面量 union：值域 2~5 个且观测次数多于值域数（即存在重复）
    if (useUnion && vals.every((v) => typeof v === 'string')) {
      const distinct = [...new Set(vals as string[])]
      if (distinct.length >= 2 && distinct.length <= 5 && vals.length > distinct.length) {
        return distinct.map((s) => JSON.stringify(s)).join(' | ')
      }
    }
    const types = [...new Set(vals.map((v) => typeOf(v, name)))]
    return types.join(' | ')
  }

  const typeOf = (v: unknown, name: string): string => {
    if (v === null || v === undefined) return 'null'
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]'
      const objs = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[]
      // 对象数组且全部元素为对象：递归多样本合并
      if (objs.length > 1 && objs.length === v.length) return `${walkMerged(objs, name)}[]`
      return `${typeUnion(v, name)}[]`
    }
    if (typeof v === 'object') return walkMerged([v as Record<string, unknown>], name)
    return typeof v
  }

  let rootType: string
  const isObjArr = Array.isArray(data) && data.length > 0 && data.every((x) => x && typeof x === 'object' && !Array.isArray(x))
  if (isObjArr) rootType = `${walkMerged(data as Record<string, unknown>[], rootStr)}[]`
  else rootType = typeOf(data, rootStr)
  lines.push(`\nexport type ${pascal(rootStr)}Data = ${rootType}`)
  return lines.join('\n\n')
}

const generate = () => {
  error.value = ''
  output.value = ''
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON')
  try {
    JSON.parse(input.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 120)}`
    return
  }
  try {
    output.value = inferTs(JSON.parse(input.value), rootName.value.trim() || 'Root', literalUnion.value)
    toast.ok('TypeScript 接口已生成')
  } catch (e) {
    error.value = `生成失败：${(e as Error).message.slice(0, 120)}`
  }
}

/* 根类名/开关变更 300ms 防抖自动重新生成（rx3） */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(() => {
    if (input.value.trim() && (output.value || error.value)) generate()
  }, 300)
  unbindPaste = installPasteRun(inputEl.value, generate)
})
onBeforeUnmount(() => {
  deb?.cancel()
  unbindPaste?.()
})
watch([rootName, literalUnion], () => deb?.call())

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
        <span class="field-label">根类型名（修改后自动重新生成）</span>
        <input v-model="rootName" type="text" class="input mono" style="width: 150px" placeholder="Order" />
      </div>
      <label class="check" title="字符串字段值域 2~5 个且重复出现时生成联合类型"><input v-model="literalUnion" type="checkbox" /> 字面量联合类型</label>
      <button class="btn btn-primary" @click="generate"><FileType2 :size="16" /> 生成接口</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON 输入（数组取全部元素归并类型，缺失字段标 ?）</span>
        <textarea ref="inputEl" v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="TypeScript 接口" download="ts" min-height="300px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <div class="row mt-2">
      <button class="btn btn-ghost btn-sm" :disabled="!output" @click="download">下载 .ts 文件</button>
    </div>

    <p class="notice notice-info mt-2 small">
      推断规则：对象生成 interface；数组取<b>全部元素</b>归并类型，字段在任一元素缺失或为 null 时标记可选（?）；嵌套对象自动拆分为独立接口并去重；开启「字面量联合类型」后，值域 2~5 个且重复出现的字符串字段生成 union。
    </p>
  </div>
</template>
