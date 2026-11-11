<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { TextToolDef, TextOptionDef } from '@/types'
import { copyText, saveText } from '@/lib/download'
import { localizeJsonError } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { Trash2, Copy, ArrowLeftRight, Download, Loader2 } from 'lucide-vue-next'

const props = defineProps<{ def: TextToolDef }>()
const toast = useToast()

const input = ref('')
const output = ref('')
const opts = ref<Record<string, string | number | boolean>>({})
const pending = ref(false)
/** 慢转换提示：同步转换瞬时完成不闪 loading，仅异步（如词库下载）超过 120ms 才显示 */
const slowPending = ref(false)
let slowTimer = 0
/** 异步转换（首次加载词典）竞态守卫：只采纳最后一次调用的结果 */
let runId = 0

const inputEl = ref<HTMLTextAreaElement | null>(null)
const outputEl = ref<HTMLTextAreaElement | null>(null)
/** 双窗滚动联动（对照校对场景）：按比例同步，避免回环 */
let syncing = false
const syncScroll = (from: 'in' | 'out') => {
  if (syncing) return
  const a = from === 'in' ? inputEl.value : outputEl.value
  const b = from === 'in' ? outputEl.value : inputEl.value
  if (!a || !b) return
  const max = a.scrollHeight - a.clientHeight
  if (max <= 0) return
  syncing = true
  b.scrollTop = (a.scrollTop / max) * Math.max(0, b.scrollHeight - b.clientHeight)
  requestAnimationFrame(() => (syncing = false))
}

const initOpts = () => {
  const o: Record<string, string | number | boolean> = {}
  for (const od of props.def.options ?? []) o[od.key] = od.default ?? ''
  opts.value = o
}
watch(() => props.def, initOpts, { immediate: true })

const run = async () => {
  // 空输入直接清空结果，不弹错误（避免清空即报 toast）
  if (!input.value.trim()) {
    output.value = ''
    return
  }
  const id = ++runId
  pending.value = true
  clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => {
    if (pending.value && id === runId) slowPending.value = true
  }, 120)
  try {
    const r = props.def.transform(input.value, { ...opts.value })
    const out = r instanceof Promise ? await r : r
    if (id === runId) output.value = out
  } catch (e) {
    if (id === runId) output.value = ''
    const msg = (e as Error).message || '转换失败'
    toast.err(/JSON|Unexpected token/i.test(msg) ? localizeJsonError(msg, input.value) : msg)
  } finally {
    if (id === runId) {
      pending.value = false
      slowPending.value = false
      clearTimeout(slowTimer)
    }
  }
}

const auto = computed(() => !props.def.options?.some((o) => o.type === 'number'))
watch([input, opts], run, { deep: true })
onBeforeUnmount(() => clearTimeout(slowTimer))

const doCopy = async () => {
  if (!output.value) return
  const okFlag = await copyText(output.value)
  okFlag ? toast.ok('已复制到剪贴板') : toast.err('复制失败，请手动选择复制')
}

const doDownload = () => {
  if (!output.value) return
  saveText(output.value, '转换结果.txt')
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
          ref="inputEl"
          v-model="input"
          class="textarea mono io-flex"
          :class="{ 'single-line': def.singleLine }"
          :placeholder="def.placeholder ?? '在此输入或粘贴文本…'"
          @scroll="syncScroll('in')"
        ></textarea>
      </div>

      <div class="io-actions">
        <button class="btn btn-soft btn-sm" title="用输出替换输入" aria-label="用输出替换输入" @click="swap"><ArrowLeftRight :size="14" /></button>
        <button class="btn btn-ghost btn-sm" title="清空" aria-label="清空输入与输出" @click="clearAll"><Trash2 :size="14" /></button>
      </div>

      <div class="io-pane">
        <div class="io-head">
          <span class="io-title">
            输出
            <span v-if="slowPending" class="io-pending"><Loader2 :size="12" class="spin" /> 处理中…</span>
          </span>
          <span class="io-count">{{ output.length }} 字符</span>
        </div>
        <textarea
          ref="outputEl"
          v-model="output"
          class="textarea mono io-flex"
          :class="{ 'is-loading': slowPending }"
          readonly
          :placeholder="slowPending ? '正在处理（首次使用需加载词库/数据，稍候）…' : '结果将出现在这里…'"
          @scroll="syncScroll('out')"
        ></textarea>
      </div>
    </div>

    <div class="row mt-2">
      <button v-if="!auto" class="btn btn-primary" @click="run">立即转换</button>
      <button class="btn btn-ghost" :disabled="!output" @click="doCopy"><Copy :size="15" /> 复制结果</button>
      <button class="btn btn-ghost" :disabled="!output" @click="doDownload"><Download :size="15" /> 下载 TXT</button>
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.io-pending {
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-text);
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
/* 双窗弹性高度：内容撑开（Chromium 走 field-sizing），其余浏览器退回 min-height + 手动拉伸 */
.io-flex {
  min-height: 240px;
  max-height: 64vh;
  height: auto;
  field-sizing: content;
}
.textarea.single-line {
  min-height: 44px;
  height: 44px;
  max-height: none;
  resize: none;
  field-sizing: normal;
}
.is-loading {
  opacity: 0.65;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
