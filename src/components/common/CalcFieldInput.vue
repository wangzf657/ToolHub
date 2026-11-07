<script setup lang="ts">
import { computed } from 'vue'
import type { CalcFieldDef } from '@/types'

const props = defineProps<{ field: CalcFieldDef; modelValue: string | number | boolean }>()
const emit = defineEmits<{ update: [v: string | number | boolean] }>()

const isNumber = computed(() => props.field.type === 'number')
const inputType = computed(() =>
  props.field.type === 'date' ? 'date' : props.field.type === 'number' ? 'number' : 'text',
)
const onInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  emit('update', isNumber.value ? (v === '' ? '' : Number(v)) : v)
}
const onCheck = (e: Event) => emit('update', (e.target as HTMLInputElement).checked)
</script>

<template>
  <div class="calc-field">
    <label class="field-label">{{ field.label }}</label>

    <div v-if="field.type === 'check'" class="check">
      <input type="checkbox" :checked="!!modelValue" @change="onCheck" />
      <span>{{ field.hint ?? '启用' }}</span>
    </div>

    <div v-else-if="field.type === 'select'" class="select-wrap">
      <select
        class="select"
        :value="String(modelValue)"
        @change="emit('update', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="c in field.choices ?? []" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
    </div>

    <div v-else class="input-row">
      <input
        class="input"
        :type="inputType"
        :value="String(modelValue)"
        :placeholder="field.placeholder"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        @input="onInput"
      />
      <span v-if="field.suffix" class="suffix">{{ field.suffix }}</span>
    </div>

    <p v-if="field.hint && field.type !== 'check'" class="field-hint">{{ field.hint }}</p>
  </div>
</template>

<style scoped>
.calc-field {
  min-width: 0;
}
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.suffix {
  flex: none;
  font-size: 13px;
  color: var(--text-3);
}
.field-hint {
  margin: 5px 2px 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>
