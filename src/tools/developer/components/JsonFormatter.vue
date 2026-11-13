<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { Braces, Minimize2, ShieldCheck, Crosshair } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import JsonTreeNode from './JsonTreeNode.vue'
import { formatJson, minifyJson, validateJson } from '@/lib/jsEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { installPasteRun } from '@/composables/usePasteRun'

type Mode = 'format' | 'minify' | 'check'

const toast = useToast()
const input = ref('')
const output = ref('')
const indent = ref('2')
const sortKeys = ref(false)
const error = ref<{ line?: number; col?: number; msg: string } | null>(null)
const valid = ref(false)
/** 粘贴即处理（默认开） */
const autoRun = ref(true)
/** 同步滚动（默认开） */
const syncScroll = ref(true)
/** 输出视图：文本 | 树 */
const outView = ref<'text' | 'tree'>('text')
/** 最近一次动作：粘贴后自动重放 */
let lastMode: Mode = 'format'
let runId = 0

const inputEl = ref<HTMLTextAreaElement | null>(null)
const outWrapEl = ref<HTMLElement | null>(null)

const run = (mode: Mode) => {
  lastMode = mode
  error.value = null
  valid.value = false
  if (!input.value.trim()) {
    toast.warn('请先粘贴 JSON 内容')
    return
  }
  const v = validateJson(input.value)
  if (!v.ok) {
    error.value = { line: v.line, col: v.col, msg: v.error ?? 'JSON 语法错误' }
    toast.err('JSON 校验未通过')
    return
  }
  valid.value = true
  if (mode === 'check') {
    output.value = formatJson(input.value, 2, sortKeys.value)
    toast.ok('JSON 校验通过 ✓')
    return
  }
  try {
    output.value = mode === 'minify' ? minifyJson(input.value) : formatJson(input.value, Number(indent.value), sortKeys.value)
    toast.ok(mode === 'minify' ? '已压缩' : '已格式化')
  } catch (e) {
    error.value = { msg: (e as Error).message }
  }
}

/** 粘贴即处理：粘贴落地后自动重放当前动作 */
let unbindPaste: (() => void) | null = null
onMounted(() => {
  unbindPaste = installPasteRun(inputEl.value, () => {
    if (autoRun.value && input.value.trim()) run(lastMode)
  })
})
onBeforeUnmount(() => unbindPaste?.())

/** 错误行内跳转：点击错误条滚动输入区使错误行可见 */
const jumpToError = () => {
  const ta = inputEl.value
  if (!ta || !error.value?.line) return
  const lines = input.value.split('\n').length
  if (lines < 1) return
  const lineHeight = ta.scrollHeight / lines
  ta.scrollTop = Math.max(0, (error.value.line - 1) * lineHeight - ta.clientHeight / 3)
  ta.focus()
  toast.ok(`已定位到第 ${error.value.line} 行`)
}

/* ---- 树视图：展开状态由本组件统一管理，默认展开前两层 ---- */
const expanded = reactive(new Set<string>())
provide('jsonTreeExp', {
  has: (p: string) => expanded.has(p),
  toggle: (p: string) => (expanded.has(p) ? expanded.delete(p) : expanded.add(p)),
})
let parsedTree: unknown = null

watch([output, outView], async () => {
  parsedTree = null
  expanded.clear()
  if (!output.value || outView.value !== 'tree') return
  try {
    parsedTree = JSON.parse(output.value)
  } catch {
    parsedTree = null
  }
  // 默认展开前两层
  const mark = (v: unknown, path: string, depth: number) => {
    if (depth > 2 || v === null || typeof v !== 'object') return
    expanded.add(path)
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const child = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? (path ? `${path}.${k}` : k) : `${path}[${JSON.stringify(k)}]`
      mark(x, child, depth + 1)
    }
  }
  mark(parsedTree, '', 1)
  await nextTick()
})

/* ---- 同步滚动：输入区滚动按行号比例带动输出区（格式化结果行数一致时校准最准） ---- */
let syncingOut = false
const onInputScroll = () => {
  if (!syncScroll.value || syncingOut) return
  const out = outWrapEl.value?.querySelector('textarea')
  const ta = inputEl.value
  if (!out || !ta) return
  const maxIn = ta.scrollHeight - ta.clientHeight
  if (maxIn <= 0) return
  syncingOut = true
  out.scrollTop = (ta.scrollTop / maxIn) * Math.max(0, out.scrollHeight - out.clientHeight)
  requestAnimationFrame(() => (syncingOut = false))
}
</script>

<template>
  <div class="jf">
    <div class="row row-wrap mt-1 mb-2" style="align-items: center; gap: 12px">
      <span class="field-label" style="margin: 0">缩进</span>
      <select v-model="indent" class="select" style="width: 110px">
        <option value="2">2 空格</option>
        <option value="4">4 空格</option>
      </select>
      <label class="check"><input v-model="sortKeys" type="checkbox" /> 按键名排序</label>
      <label class="check" title="粘贴 JSON 后自动执行上一次的动作"><input v-model="autoRun" type="checkbox" /> 粘贴即处理</label>
      <label class="check" title="滚动输入区时输出区按行号比例跟随"><input v-model="syncScroll" type="checkbox" /> 同步滚动</label>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" @click="run('format')"><Braces :size="15" /> 格式化</button>
      <button class="btn btn-ghost btn-sm" @click="run('minify')"><Minimize2 :size="15" /> 压缩</button>
      <button class="btn btn-ghost btn-sm" @click="run('check')"><ShieldCheck :size="15" /> 校验</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入 JSON</span>
        <textarea
          ref="inputEl"
          v-model="input"
          class="textarea mono"
          style="min-height: 320px"
          placeholder='粘贴 JSON，例如 {"name": "张三", "tags": ["dev", "ops"]}'
          @scroll="onInputScroll"
        ></textarea>
      </div>
      <div ref="outWrapEl" class="out-col">
        <div class="view-tabs row" role="tablist">
          <button class="vt" :class="{ on: outView === 'text' }" role="tab" :aria-selected="outView === 'text'" @click="outView = 'text'">文本</button>
          <button class="vt" :class="{ on: outView === 'tree' }" role="tab" :aria-selected="outView === 'tree'" @click="outView = 'tree'">树</button>
          <span class="muted small" style="margin-left: auto">树视图点击键名复制路径</span>
        </div>
        <ResultBox v-show="outView === 'text'" v-model="output" title="输出结果" download="json" min-height="320px" />
        <div v-show="outView === 'tree'" class="tree-box textarea mono">
          <JsonTreeNode v-if="parsedTree !== null" :value="parsedTree" path="" keyword="" is-root />
          <span v-else class="muted small">暂无结果：先在左侧输入并格式化，树视图在此展示。</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="notice notice-err mt-2 err-jump" role="button" tabindex="0" title="点击定位到输入区错误行" @click="jumpToError" @keydown.enter="jumpToError">
      校验失败：{{ error.msg }}
      <span v-if="error.line">（第 {{ error.line }} 行，第 {{ error.col }} 列附近）</span>
      <span v-if="error.line" class="jump-link"><Crosshair :size="13" /> 定位到第 {{ error.line }} 行</span>
    </div>
    <div v-else-if="valid" class="notice notice-ok mt-2">JSON 校验通过，语法完全合法。</div>

    <button v-if="output" class="btn btn-ghost btn-sm mt-2" @click="saveText(output, 'formatted.json', 'application/json')">下载 formatted.json</button>
  </div>
</template>

<style scoped>
.jf :deep(.select) {
  padding: 7px 32px 7px 12px;
  font-size: 13.5px;
}
.out-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.view-tabs {
  gap: 4px;
  align-items: center;
}
.vt {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  padding: 3px 12px;
  font-size: 12.5px;
  cursor: pointer;
}
.vt.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.tree-box {
  min-height: 320px;
  max-height: 64vh;
  overflow: auto;
  padding: 10px 12px;
}
.err-jump {
  cursor: pointer;
}
.jump-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  color: var(--accent-text);
  font-weight: 600;
}
</style>
