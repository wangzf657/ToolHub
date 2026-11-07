<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TextToolDef, TextOptionDef } from '@/types'
import { copyText } from '@/lib/download'
import { localizeJsonError } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { Trash2, Copy, ArrowLeftRight } from 'lucide-vue-next'

const props = defineProps<{ def: TextToolDef }>()
const toast = useToast()

const input = ref('')
const output = ref('')
const opts = ref<Record<string, string | number | boolean>>({})

const initOpts = () => {
  const o: Record<string, string | number | boolean> = {}
  for (const od of props.def.options ?? []) o[od.key] = od.default ?? ''
  opts.value = o
}
watch(() => props.def, initOpts, { immediate: true })

const run = () => {
  // 空输入直接清空结果，不弹错误（避免清空即报 toast）
  if (!input.value.trim()) {
    output.value = ''
    return
  }
  try {
    output.value = props.def.transform(input.value, { ...opts.value })
  } catch (e) {
    output.value = ''
    const msg = (e as Error).message || '转换失败'
    toast.err(/JSON|Unexpected token/i.test(msg) ? localizeJsonError(msg, input.value) : msg)
  }
}

const auto = computed(() => !props.def.options?.some((o) => o.type === 'number'))
watch([input, opts], run, { deep: true })

const doCopy = async () => {
  if (!output.value) return
  const okFlag = await copyText(output.value)
  okFlag ? toast.ok('已复制到剪贴板') : toast.err('复制失败，请手动选择复制')
}

const swap = () => {
  input.value = output.value
}
const clearAll = () => {
  input.value = ''
  output.value = ''
}
</script>

<template>
  <div class="text-tool">
    <div v-if="def.options?.length" class="text-opts row row-wrap">
      <label v-for="o in def.options as TextOptionDef[]" :key="o.key" class="opt-item">
        <span v-if="o.type !== 'toggle'" class="field-label">{{ o.label }}</span>
        <select
          v-if="o.type === 'select'"
          class="select"
          :value="String(opts[o.key])"
          @change="opts[o.key] = ($event.target as HTMLSelectElement).value"
        >
          <option v-for="c in o.choices ?? []" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <input
          v-else-if="o.type === 'number'"
          type="number"
          class="input"
          style="width: 130px"
          :value="String(opts[o.key])"
          @input="opts[o.key] = Number(($event.target as HTMLInputElement).value)"
        />
        <input
          v-else-if="o.type === 'text'"
          type="text"
          class="input"
          style="width: 200px"
          :placeholder="o.placeholder"
          :value="String(opts[o.key])"
          @input="opts[o.key] = ($event.target as HTMLInputElement).value"
        />
        <label v-else class="check">
          <input type="checkbox" :checked="!!opts[o.key]" @change="opts[o.key] = ($event.target as HTMLInputElement).checked" />
          <span>{{ o.label }}</span>
        </label>
      </label>
    </div>

    <div class="text-io">
      <div class="io-pane">
        <div class="io-head">
          <span class="io-title">输入</span>
          <span class="io-count">{{ input.length }} 字符</span>
        </div>
        <textarea
          v-model="input"
          class="textarea mono"
          :class="{ 'single-line': def.singleLine }"
          :placeholder="def.placeholder ?? '在此输入或粘贴文本…'"
        ></textarea>
      </div>

      <div class="io-actions">
        <button class="btn btn-soft btn-sm" title="用输出替换输入" aria-label="用输出替换输入" @click="swap"><ArrowLeftRight :size="14" /></button>
        <button class="btn btn-ghost btn-sm" title="清空" aria-label="清空输入与输出" @click="clearAll"><Trash2 :size="14" /></button>
      </div>

      <div class="io-pane">
        <div class="io-head">
          <span class="io-title">输出</span>
          <span class="io-count">{{ output.length }} 字符</span>
        </div>
        <textarea v-model="output" class="textarea mono" readonly placeholder="结果将出现在这里…"></textarea>
      </div>
    </div>

    <div class="row mt-2">
      <button v-if="!auto" class="btn btn-primary" @click="run">立即转换</button>
      <button class="btn btn-ghost" :disabled="!output" @click="doCopy"><Copy :size="15" /> 复制结果</button>
    </div>
  </div>
</template>

<style scoped>
.text-opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  gap: 14px;
  align-items: flex-end;
}
.opt-item {
  display: grid;
  gap: 4px;
}
.text-io {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  margin-top: 14px;
}
@media (max-width: 760px) {
  .text-io {
    grid-template-columns: 1fr;
  }
  .io-actions {
    justify-content: center;
    flex-direction: row;
  }
}
.io-pane {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.io-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.io-count {
  font-size: 12px;
  color: var(--text-3);
}
.io-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
}
.textarea.single-line {
  min-height: 44px;
  height: 44px;
  resize: none;
}
</style>
