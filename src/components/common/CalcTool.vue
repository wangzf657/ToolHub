<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CalcToolDef } from '@/types'
import CalcFieldInput from './CalcFieldInput.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ def: CalcToolDef }>()
const { err } = useToast()

const values = ref<Record<string, string | number | boolean>>({})
const results = ref<{ label: string; value: string; primary?: boolean; hint?: string }[]>([])
const note = ref('')

const init = () => {
  const v: Record<string, string | number | boolean> = {}
  for (const f of props.def.fields) v[f.key] = f.default ?? (f.type === 'check' ? false : f.type === 'number' ? '' : '')
  values.value = v
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
watch(values, recompute, { deep: true })
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
        <span v-if="r.hint" class="cr-hint">{{ r.hint }}</span>
      </div>
    </div>
    <p v-if="note" class="calc-note muted small">{{ note }}</p>
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
.cr-hint {
  width: 100%;
  font-size: 12px;
  color: var(--text-3);
}
.calc-note {
  margin-top: 12px;
}
</style>
