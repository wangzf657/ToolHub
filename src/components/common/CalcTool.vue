<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CalcToolDef } from '@/types'
import CalcFieldInput from './CalcFieldInput.vue'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/download'
import { Copy, Check } from 'lucide-vue-next'

const props = defineProps<{ def: CalcToolDef; slug?: string }>()
const { err, ok } = useToast()

const values = ref<Record<string, string | number | boolean>>({})
const results = ref<{ label: string; value: string; primary?: boolean; hint?: string }[]>([])
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

const init = () => {
  const v: Record<string, string | number | boolean> = {}
  for (const f of props.def.fields) v[f.key] = f.default ?? (f.type === 'check' ? false : f.type === 'number' ? '' : '')
  values.value = v
  loadMem()
  recompute()
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
</script>

<template>
  <div class="calc-tool">
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
        :class="{ primary: r.primary }"
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
</style>
