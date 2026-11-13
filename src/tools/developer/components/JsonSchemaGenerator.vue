<script setup lang="ts">
/** JSON Schema 生成器：required 策略（严格=并集 / 宽松=交集）、format 推断、Draft 版本切换、回验 Tab。 */
import { ref } from 'vue'
import { ScrollText, ShieldCheck } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { jsonSchemaFrom } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('{\n  "productId": "SKU-001",\n  "price": 199.9,\n  "stock": 42,\n  "active": true,\n  "tags": ["新品", "热卖"],\n  "vendor": { "name": "青石互联", "rating": 4.8 }\n}')
const title = ref('商品 Schema')
const output = ref('')
const error = ref('')
/** required 策略：严格=出现过的键全部必填（并集）；宽松=仅所有元素都存在的键必填（交集） */
const requiredMode = ref<'strict' | 'loose'>('strict')
/** Draft 版本 */
const draft = ref<'draft-07' | '2020-12'>('draft-07')
/** 回验 Tab */
const tab = ref<'gen' | 'check'>('gen')
const instance = ref('')
const checkErrors = ref<string[]>([])
const checkDone = ref(false)

type SchemaNode = Record<string, unknown> & { type?: string; required?: string[]; properties?: Record<string, SchemaNode>; items?: SchemaNode; format?: string }

/* ---------- 后处理：required 策略与 format 推断（与数据并行递归） ---------- */

const FORMAT_RES: [string, RegExp][] = [
  ['uuid', /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/],
  ['email', /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/],
  ['uri', /^https?:\/\/\S+$/],
  ['date-time', /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/],
  ['date', /^\d{4}-\d{2}-\d{2}$/],
]

/** schema 节点与其实例集合并行下钻：对象按 required 策略收敛，字符串叶按首例值推 format */
function refine(schema: SchemaNode, values: unknown[]): void {
  if (schema.type === 'object' && schema.properties) {
    const objs = values.filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v))
    const allKeys = new Set<string>()
    objs.forEach((o) => Object.keys(o).forEach((k) => allKeys.add(k)))
    const has = (o: Record<string, unknown>, k: string) => k in o && o[k] !== null && o[k] !== undefined
    schema.required =
      requiredMode.value === 'loose'
        ? [...allKeys].filter((k) => objs.length > 0 && objs.every((o) => has(o, k)))
        : [...allKeys].filter((k) => objs.some((o) => has(o, k)))
    for (const [k, sub] of Object.entries(schema.properties)) {
      refine(sub, objs.map((o) => o[k]).filter((v) => v !== undefined))
    }
  } else if (schema.type === 'array' && schema.items) {
    refine(schema.items, values.filter(Array.isArray).flat())
  } else if (schema.type === 'string' && values.length) {
    const s = String(values.find((v) => v !== null && v !== undefined) ?? '')
    for (const [f, re] of FORMAT_RES) {
      if (re.test(s)) {
        schema.format = f
        break
      }
    }
  }
}

const generate = () => {
  error.value = ''
  output.value = ''
  checkDone.value = false
  checkErrors.value = []
  if (!input.value.trim()) return toast.warn('请先粘贴 JSON')
  try {
    // 生成基础 schema（lib，draft-07 口径），再按数据并行后处理
    const data: unknown = JSON.parse(input.value)
    const schema: SchemaNode = JSON.parse(jsonSchemaFrom(input.value, title.value.trim() || 'Generated schema'))
    refine(schema, [data])
    schema.$schema = draft.value === '2020-12' ? 'https://json-schema.org/draft/2020-12/schema' : 'http://json-schema.org/draft-07/schema#'
    output.value = JSON.stringify(schema, null, 2)
    toast.ok(`JSON Schema（${draft.value === '2020-12' ? '2020-12' : 'draft-07'}）已生成`)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 120)}`
  }
}

/* ---------- 回验：按生成的 schema 校验粘贴的 JSON 实例（自实现子集校验器） ---------- */

const zhType = (t: string) => ({ string: '字符串', number: '数字', integer: '整数', boolean: '布尔值', object: '对象', array: '数组', null: 'null' })[t] ?? t

function validate(inst: unknown, schema: SchemaNode, path: string, errs: string[]): void {
  const t = schema.type
  const actual: string = inst === null ? 'null' : Array.isArray(inst) ? 'array' : typeof inst
  if (t === 'integer' && actual === 'number' && !Number.isInteger(inst)) {
    errs.push(`${path}：类型应为整数，实际为小数（${inst}）`)
    return
  }
  if (t && t !== 'null' && t !== actual && !(t === 'number' && actual === 'integer')) {
    errs.push(`${path}：类型应为 ${zhType(t)}，实际为 ${zhType(actual)}`)
    return
  }
  if (t === 'object' && schema.properties && inst && typeof inst === 'object' && !Array.isArray(inst)) {
    const obj = inst as Record<string, unknown>
    for (const k of schema.required ?? []) {
      if (!(k in obj) || obj[k] === undefined) errs.push(`${path ? `${path}.${k}` : `$.${k}`}：缺少必填字段「${k}」`)
    }
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (k in obj && obj[k] !== undefined) validate(obj[k], sub, path ? `${path}.${k}` : `$.${k}`, errs)
    }
  }
  if (t === 'array' && schema.items && Array.isArray(inst)) {
    inst.forEach((el, i) => validate(el, schema.items as SchemaNode, `${path}[${i}]`, errs))
  }
}

const runCheck = () => {
  checkErrors.value = []
  checkDone.value = false
  if (!output.value) return toast.warn('请先生成 Schema，再进行回验')
  if (!instance.value.trim()) return toast.warn('请粘贴要校验的 JSON 实例')
  try {
    const inst: unknown = JSON.parse(instance.value)
    const errs: string[] = []
    validate(inst, JSON.parse(output.value) as SchemaNode, '$', errs)
    checkErrors.value = errs.slice(0, 50)
    checkDone.value = true
    toast.ok(errs.length ? `校验完成：发现 ${errs.length} 处不符` : '校验通过：实例符合生成的 Schema')
  } catch (e) {
    checkDone.value = true
    checkErrors.value = [`实例 JSON 解析失败：${(e as Error).message.slice(0, 120)}`]
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
      <div>
        <span class="field-label">Draft 版本</span>
        <select v-model="draft" class="select">
          <option value="draft-07">draft-07（经典）</option>
          <option value="2020-12">2020-12（最新）</option>
        </select>
      </div>
      <div>
        <span class="field-label">required 策略</span>
        <select v-model="requiredMode" class="select">
          <option value="strict">严格（出现过的键全部必填）</option>
          <option value="loose">宽松（仅所有元素共有的键必填）</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="generate"><ScrollText :size="16" /> 生成 Schema</button>
    </div>

    <div class="row" style="gap: 6px; align-items: center">
      <button class="chip tab-chip" :class="{ on: tab === 'gen' }" @click="tab = 'gen'">生成</button>
      <button class="chip tab-chip" :class="{ on: tab === 'check' }" @click="tab = 'check'">校验</button>
      <span class="muted small">校验页签：粘贴 JSON 实例，按当前生成的 Schema 回验</span>
    </div>

    <div v-if="tab === 'gen'" class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">示例 JSON 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="JSON Schema 输出" download="json" min-height="300px" />
    </div>

    <div v-else class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON 实例（按上方 Schema 校验）</span>
        <textarea v-model="instance" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
        <div class="row mt-2">
          <button class="btn btn-primary" :disabled="!output" @click="runCheck"><ShieldCheck :size="15" /> 校验实例</button>
        </div>
      </div>
      <div class="check-panel">
        <span class="field-label">校验结果</span>
        <div v-if="checkDone && checkErrors.length" class="notice notice-err small">
          <p class="mb-1"><b>发现 {{ checkErrors.length }} 处不符：</b></p>
          <div v-for="(e, i) in checkErrors" :key="i" class="err-line mono">{{ e }}</div>
        </div>
        <div v-else-if="checkDone" class="notice notice-ok">校验通过：实例符合生成的 Schema（类型、必填字段均一致）。</div>
        <p v-else class="muted small">生成 Schema 后，在这里粘贴要校验的 JSON（如接口返回值、另一份示例），点「校验实例」查看逐条中文报错。</p>
      </div>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <p class="notice notice-info mt-2 small">
      推断规则：类型按示例值判定（整数/小数区分），对象收集 properties 与 required，数组取首元素推断 items，null 字段生成 type: null；字符串值命中邮箱/URL/UUID/日期时附加 format。required 策略对数组元素生效——严格=并集，宽松=交集。
    </p>
  </div>
</template>

<style scoped>
.tab-chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
.check-panel {
  display: grid;
  gap: 4px;
  align-content: start;
}
.err-line {
  font-size: 12.5px;
  padding: 3px 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--err) 25%, transparent);
  overflow-wrap: anywhere;
}
</style>
