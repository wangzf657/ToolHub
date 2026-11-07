<script setup lang="ts">
/** 小型滑杆行：label + range + 数值显示 */
const props = withDefaults(
  defineProps<{
    label: string
    min: number
    max: number
    step?: number
    modelValue: number
    unit?: string
    width?: string
  }>(),
  { step: 1, unit: '', width: '200px' },
)
const emit = defineEmits<{ 'update:modelValue': [v: number] }>()

const onInput = (e: Event) => emit('update:modelValue', Number((e.target as HTMLInputElement).value))
</script>

<template>
  <label class="slider-row">
    <span class="field-label">{{ label }}</span>
    <span class="slider-line">
      <input type="range" :min="min" :max="max" :step="step" :value="modelValue" @input="onInput" />
      <span class="slider-val">{{ modelValue }}{{ unit }}</span>
    </span>
  </label>
</template>

<style scoped>
.slider-row {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.slider-line {
  display: flex;
  align-items: center;
  gap: 10px;
}
.slider-line input[type='range'] {
  width: v-bind('props.width');
}
.slider-val {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-text);
  min-width: 44px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
