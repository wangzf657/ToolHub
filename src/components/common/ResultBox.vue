<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Copy, Check, Trash2 } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    modelValue: string
    title?: string
    /** 提供下载扩展名后显示下载按钮 */
    download?: string
    mono?: boolean
    readonly?: boolean
    placeholder?: string
    minHeight?: string
  }>(),
  { title: '', mono: true, readonly: false, minHeight: '180px' },
)
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
const toast = useToast()
const copied = ref(false)

const doCopy = async () => {
  if (!props.modelValue) return
  const okFlag = await copyText(props.modelValue)
  if (okFlag) {
    copied.value = true
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const doDownload = () => {
  if (props.download) saveText(props.modelValue, `结果.${props.download}`)
}

const chars = computed(() => props.modelValue.length)
watch(
  () => props.modelValue,
  () => {},
)
</script>

<template>
  <div class="result-box">
    <div v-if="title || modelValue" class="rb-head">
      <span class="rb-title">{{ title }}</span>
      <span class="rb-meta">{{ chars }} 字符</span>
      <span class="rb-actions">
        <button class="mini-btn" title="复制" aria-label="复制" :disabled="!modelValue" @click="doCopy">
          <Check v-if="copied" :size="13" color="#34d399" />
          <Copy v-else :size="13" />
        </button>
        <button v-if="download" class="mini-btn" title="下载为文件" aria-label="下载为文件" :disabled="!modelValue" @click="doDownload">⬇</button>
        <button v-if="!readonly" class="mini-btn" title="清空" aria-label="清空" :disabled="!modelValue" @click="emit('update:modelValue', '')">
          <Trash2 :size="13" />
        </button>
      </span>
    </div>
    <textarea
      :value="modelValue"
      class="textarea mono"
      :class="{ ro: readonly }"
      :readonly="readonly"
      :placeholder="placeholder ?? '结果将显示在这里…'"
      :style="{ minHeight, height: minHeight }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
  </div>
</template>

<style scoped>
.result-box {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.rb-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.rb-meta {
  font-size: 12px;
  color: var(--text-3);
}
.rb-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.textarea.ro {
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
}
</style>
