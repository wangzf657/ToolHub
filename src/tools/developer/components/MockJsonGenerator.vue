<script setup lang="ts">
/** Mock 数据生成器：未知 token 守卫、令牌分组速查、种子复现（同 seed 逐字符一致）、TS 类型反推模板。 */
import { computed, ref } from 'vue'
import { Dices, RefreshCw, Braces } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { generateMock } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { seededMock, tsFieldsToTemplate } from './mockSeeded'

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
/** 种子（留空 = 随机不可复现；填数字 = 同模板同 seed 产出一致） */
const seedInput = ref('')
/** 「从 TS 类型生成」Tab */
const tab = ref<'tpl' | 'ts'>('tpl')
const tsSource = ref('interface User {\n  name: string\n  age: number\n  vip: boolean\n}')

const generate = () => {
  if (!template.value.trim()) return toast.warn('请先编辑模板')
  // 未知 token 守卫：模板里不在支持列表的 token 阻断并逐个列出
  const bad = unknownTokens()
  if (bad.length) return toast.err(`模板含不支持的令牌：${bad.join('、')}；请从下方速查选择或修正拼写`)
  const n = Math.floor(count.value)
  if (!n || n < 1 || n > 500) return toast.err('数量需在 1-500 之间')
  const seed = seedInput.value.trim()
  if (seed !== '' && !/^\d+$/.test(seed)) return toast.err('种子需为非负整数（留空则随机）')
  if (seed !== '') {
    output.value = seededMock(template.value, n, Number(seed))
    toast.ok(`已按种子 ${seed} 生成 ${n} 条数据（同种子同模板可复现）`)
  } else {
    output.value = generateMock(template.value, n)
    toast.ok(`已生成 ${n} 条模拟数据`)
  }
}

/* ---------- 令牌分组速查 ---------- */
const TOKEN_GROUPS: { title: string; items: string[] }[] = [
  { title: '个人信息', items: ['{{fullName}}', '{{email}}', '{{phone}}', '{{city}}', '{{address}}', '{{company}}'] },
  { title: '网络', items: ['{{url}}', '{{ip}}', '{{color}}'] },
  { title: '日期', items: ['{{date}}', '{{datetime}}'] },
  { title: '系统', items: ['{{int:1-100}}', '{{uuid}}', '{{bool}}', '{{id}}'] },
]

/** 已知 token 内名集合（int:a-b 区间按 int 前缀放行） */
const KNOWN = new Set(TOKEN_GROUPS.flatMap((g) => g.items).map((t) => t.replace(/^\{\{|\}\}$/g, '')))
const unknownTokens = (): string[] => {
  const found = [...template.value.matchAll(/\{\{\s*([\w:.-]+)\s*\}\}/g)].map((m) => m[1])
  const seen = new Set<string>()
  const bad: string[] = []
  for (const f of found) {
    if (seen.has(f)) continue
    seen.add(f)
    if (KNOWN.has(f)) continue
    if (/^int:-?\d+-?\d+$/.test(f) && KNOWN.has('int:1-100')) continue
    bad.push(`{{${f}}}`)
  }
  return bad
}

const insert = (t: string) => {
  template.value += (template.value.endsWith('\n') || !template.value ? '' : ' ') + t
}

/* ---------- TS 类型反推 ---------- */
const applyTs = () => {
  if (!tsSource.value.trim()) return toast.warn('请先粘贴 TS interface 或 type 定义')
  const tpl = tsFieldsToTemplate(tsSource.value)
  if (!tpl) return toast.err('未解析出字段——支持 interface X { name: string; age: number } 形式的扁平字段')
  template.value = tpl
  tab.value = 'tpl'
  toast.ok('已按 TS 类型生成模板（string→姓名、number→区间整数、boolean→布尔、Date→日期时间）')
}

const previewTs = computed(() => tsFieldsToTemplate(tsSource.value))
</script>

<template>
  <div class="mock-gen">
    <div class="row row-wrap" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">生成数量</span>
        <input v-model.number="count" type="number" class="input mono" style="width: 100px" min="1" max="500" />
      </div>
      <div>
        <span class="field-label">种子（可选，复现用）</span>
        <input v-model="seedInput" type="text" class="input mono" style="width: 140px" placeholder="如 42" />
      </div>
      <button class="btn btn-primary" @click="generate"><Dices :size="16" /> 生成 Mock 数据</button>
      <span class="muted small">模板为合法 JSON 时生成对象数组；否则按行文本生成。</span>
    </div>

    <div class="row mt-2" style="gap: 6px; align-items: center">
      <button class="chip tab-chip" :class="{ on: tab === 'tpl' }" @click="tab = 'tpl'">模板</button>
      <button class="chip tab-chip" :class="{ on: tab === 'ts' }" @click="tab = 'ts'">从 TS 类型生成</button>
    </div>

    <div v-if="tab === 'tpl'" class="grid-2 mt-2" style="gap: 12px">
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

    <div v-else class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">TS interface / type 定义</span>
        <textarea v-model="tsSource" class="textarea mono" style="min-height: 240px" spellcheck="false"></textarea>
        <div class="row mt-2">
          <button class="btn btn-primary" @click="applyTs"><Braces :size="15" /> 生成模板并填入</button>
        </div>
      </div>
      <div>
        <span class="field-label">模板预览（自动映射令牌）</span>
        <pre class="mono ts-preview">{{ previewTs ?? '（未识别到字段）' }}</pre>
        <p class="muted small mt-1">string→姓名、number→区间整数、boolean→布尔、Date→日期时间；数组给两个示例元素；其余类型退化为 UUID，生成后可手改。</p>
      </div>
    </div>

    <div v-if="tab === 'tpl'" class="mt-3 token-groups">
      <div v-for="g in TOKEN_GROUPS" :key="g.title" class="token-group">
        <span class="field-label">{{ g.title }}</span>
        <div class="row row-wrap" style="gap: 7px">
          <button v-for="t in g.items" :key="t" class="chip mono" @click="insert(t)">{{ t }}</button>
        </div>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      数值令牌（<span v-pre>{{int:1-100}}</span>、<span v-pre>{{bool}}</span>）不加引号；字符串令牌需包在引号内。种子留空时随机不可复现；填入数字后同一模板 + 同一种子每次产出完全一致。全部数据本地生成，不含真实个人信息。
    </p>
  </div>
</template>

<style scoped>
.tab-chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
.token-groups {
  display: grid;
  gap: 8px;
}
.token-group .field-label {
  display: inline-block;
  margin-bottom: 4px;
}
.ts-preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  padding: 12px;
  font-size: 12.5px;
  min-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  margin: 0;
}
</style>
