<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { CalcToolDef, CalcResultRow } from '@/types'
import CalcFieldInput from './CalcFieldInput.vue'
import { useToast } from '@/composables/useToast'
import { installCtrlEnter } from '@/composables/usePasteRun'
import { copyText, saveText } from '@/lib/download'
import { Copy, Check, Download, Sparkles } from 'lucide-vue-next'

const props = defineProps<{ def: CalcToolDef; slug?: string }>()
const { err, ok } = useToast()
const route = useRoute()

const values = ref<Record<string, string | number | boolean>>({})
const results = ref<CalcResultRow[]>([])
const note = ref('')
/** 最近一次单值复制的结果行（用于行内 ✓ 反馈） */
const copiedIndex = ref(-1)

/** 输入记忆 key：toolhub.calc.<slug>；无 slug（引擎级直调）时不持久化 */
const memKey = () => (props.slug ? `toolhub.calc.${props.slug}` : '')

const loadMem = () => {
  const key = memKey()
  if (!key) return
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (saved && typeof saved === 'object') {
      // 只回填注册表里仍然存在的字段，防止旧记忆带入已下线字段
      for (const f of props.def.fields) {
        if (f.key in (saved as Record<string, unknown>)) {
          values.value[f.key] = (saved as Record<string, string | number | boolean>)[f.key]!
        }
      }
    }
  } catch {
    /* 记忆损坏则忽略，回到默认值 */
  }
}

const saveMem = () => {
  const key = memKey()
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify(values.value))
  } catch {
    /* 隐私模式/超限时静默放弃 */
  }
}

/** URL query 预填（互链透传的另一半：对端字段名匹配即填，优先级高于本地记忆） */
const applyQuery = () => {
  const q = route.query
  if (!q || !Object.keys(q).length) return
  for (const f of props.def.fields) {
    const raw = q[f.key]
    if (typeof raw !== 'string' || raw === '') continue
    if (f.type === 'check') {
      if (raw === '1' || raw === 'true') values.value[f.key] = true
      else if (raw === '0' || raw === 'false') values.value[f.key] = false
    } else if (f.type === 'number') {
      const n = Number(raw.replace(/,/g, ''))
      if (Number.isFinite(n)) values.value[f.key] = n
    } else if (f.type === 'select') {
      // 仅接受该字段合法选项值，防止脏参数
      const okVal = (f as { choices?: { value: string }[] }).choices?.some((c) => c.value === raw)
      if (okVal) values.value[f.key] = raw
    } else {
      values.value[f.key] = raw
    }
  }
}

const init = () => {
  const v: Record<string, string | number | boolean> = {}
  for (const f of props.def.fields) v[f.key] = f.default ?? (f.type === 'check' ? false : f.type === 'number' ? '' : '')
  values.value = v
  loadMem()
  applyQuery()
  recompute()
}

/** 示例一键填入：合并填入注册表声明的字段并重算 */
const applySample = (s: { label: string; values: Record<string, string | number | boolean> }) => {
  for (const f of props.def.fields) {
    if (f.key in s.values) values.value[f.key] = s.values[f.key]!
  }
  recompute()
  saveMem()
  ok(`已填入示例：${s.label}`)
}

const recompute = () => {
  try {
    const rows = props.def.compute({ ...values.value })
    // 结果出现 NaN/Infinity 时给引导文案而非展示无效数值（如必填项为空）
    if (rows.some((r) => /NaN|Infinity/.test(r.value))) {
      results.value = [
        { label: '请先完整填写上方数值', value: '—', hint: '部分结果暂时无法计算，补全后自动更新' },
      ]
    } else {
      results.value = rows
    }
    note.value = props.def.note ?? ''
  } catch (e) {
    results.value = []
    if ((e as Error).message) err((e as Error).message)
  }
}

watch(() => props.def, init, { immediate: true, deep: true })
watch(values, () => {
  recompute()
  saveMem()
}, { deep: true })

/** 结果行单值复制：提取首个数字（去 ¥/%/千分位/单位文字），无数字则原样复制 */
const copyRow = async (r: { value: string }, i: number) => {
  const m = String(r.value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  const text = m?.[0] ?? String(r.value)
  const okFlag = await copyText(text)
  if (okFlag) {
    copiedIndex.value = i
    setTimeout(() => {
      if (copiedIndex.value === i) copiedIndex.value = -1
    }, 1500)
    ok(`已复制 ${text}`)
  } else {
    err('复制失败，请手动选择复制')
  }
}

/** Ctrl/Cmd+Enter 立即重算（数值输入多为 change 触发，快捷键兜底） */
const rootEl = ref<HTMLElement | null>(null)
let unbindKey: (() => void) | null = null
onMounted(() => {
  unbindKey = installCtrlEnter(rootEl.value, recompute)
})
onBeforeUnmount(() => unbindKey?.())

/** 结果下载 TXT：一行一条「标签：值」，无结果时禁用 */
const downloadResults = () => {
  if (!results.value.length) return
  const lines = results.value.map((r) => `${r.label}：${r.value}${r.hint ? `（${r.hint}）` : ''}`)
  saveText(lines.join('\n') + '\n', `toolhub-${props.slug ?? 'calc'}.txt`)
}
</script>

<template>
  <div ref="rootEl" class="calc-tool">
    <div v-if="def.samples?.length" class="calc-samples row row-wrap">
      <span class="field-label" style="margin: 0"><Sparkles :size="13" style="vertical-align: -2px" /> 示例：</span>
      <button v-for="s in def.samples" :key="s.label" class="chip" @click="applySample(s)">{{ s.label }}</button>
    </div>
    <div class="calc-form" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }">
      <CalcFieldInput
        v-for="f in def.fields"
        :key="f.key"
        :field="f"
        :model-value="values[f.key]"
        @update="(v) => (values[f.key] = v)"
      />
    </div>

    <div v-if="results.length" class="calc-results">
      <div
        v-for="(r, i) in results"
        :key="i"
        class="calc-result-row"
        :class="{ primary: r.primary, [`tone-${r.tone}`]: !!r.tone }"
      >
        <span class="cr-label">{{ r.label }}</span>
        <strong class="cr-value">{{ r.value }}</strong>
        <button
          class="cr-copy"
          :title="`复制「${r.label}」数值`"
          :aria-label="`复制「${r.label}」数值`"
          @click="copyRow(r, i)"
        >
          <Check v-if="copiedIndex === i" :size="13" color="#34d399" />
          <Copy v-else :size="13" />
        </button>
        <span v-if="r.hint" class="cr-hint">{{ r.hint }}</span>
      </div>
    </div>
    <p v-if="note" class="calc-note muted small">{{ note }}</p>
    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost btn-sm" :disabled="!results.length" @click="downloadResults">
        <Download :size="15" /> 下载结果 TXT
      </button>
    </div>
    <div v-if="def.links?.length" class="calc-links row row-wrap">
      <RouterLink
        v-for="lk in def.links"
        :key="lk.to"
        class="btn btn-ghost btn-sm"
        :to="{ path: lk.to, query: lk.query ? lk.query({ ...values }) : undefined }"
      >
        {{ lk.label }} →
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.calc-form {
  display: grid;
  gap: 14px;
}
.calc-results {
  margin-top: 18px;
  display: grid;
  gap: 8px;
}
.calc-result-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  flex-wrap: wrap;
}
.calc-result-row.primary {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: var(--accent-soft);
}
/* 行级语义着色（tone）：判定行一眼可读（健康/关注/危险） */
.calc-result-row.tone-ok {
  border-color: color-mix(in srgb, #34d399 45%, transparent);
}
.calc-result-row.tone-ok .cr-value {
  color: #34d399;
}
.calc-result-row.tone-warn {
  border-color: color-mix(in srgb, #d97706 45%, transparent);
}
.calc-result-row.tone-warn .cr-value {
  color: #d97706;
}
.calc-result-row.tone-err {
  border-color: color-mix(in srgb, #ef4444 45%, transparent);
}
.calc-result-row.tone-err .cr-value {
  color: #ef4444;
}
.calc-samples {
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.calc-samples .chip {
  cursor: pointer;
}
.cr-label {
  font-size: 13px;
  color: var(--text-2);
}
.cr-value {
  font-size: 19px;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}
.calc-result-row.primary .cr-value {
  font-size: 26px;
  color: var(--accent-text);
}
/* 单值复制按钮：hover 行时浮现，触屏常显低透明度 */
.cr-copy {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  align-self: center;
}
.calc-result-row:hover .cr-copy,
.cr-copy:focus-visible {
  opacity: 1;
}
.cr-copy:hover {
  border-color: var(--accent);
  color: var(--text);
}
@media (hover: none) {
  .cr-copy {
    opacity: 0.55;
  }
}
.cr-hint {
  width: 100%;
  font-size: 12px;
  color: var(--text-3);
}
.calc-note {
  margin-top: 12px;
}
.calc-links {
  margin-top: 4px;
}
/* 移动端(R5-c):字段网格单列、按钮全宽,触屏不需要两列小字段 */
@media (max-width: 480px) {
  .calc-form {
    grid-template-columns: 1fr !important;
  }
  .calc-tool .btn {
    width: 100%;
    justify-content: center;
  }
  .calc-samples {
    justify-content: flex-start;
  }
}
</style>
