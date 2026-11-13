<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FileCode2, Loader2, Crosshair } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { formatXml } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { installPasteRun, debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('<?xml version="1.0" encoding="UTF-8"?>\n<catalog><book id="1"><title>本地优先</title><price>0</price></book><book id="2"><title>离线可用</title><price>0</price></book></catalog>')
const output = ref('')
const error = ref('')
/** 解析错误行号（从 DOMParser 错误消息中提取） */
const errorLine = ref(0)
const busy = ref(false)
/** 缩进 2/4（记忆，rx4） */
const indent = ref(Number(localStorage.getItem('toolhub.xml-indent') || 2))
watch(indent, (v) => localStorage.setItem('toolhub.xml-indent', String(v)))
/** 粘贴即美化（rx5，800ms 防抖可关） */
const autoRun = ref(true)

const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null
onMounted(() => {
  const deb = debounceRun(() => {
    if (autoRun.value && input.value.trim()) run(false)
  }, 800)
  unbindPaste = installPasteRun(inputEl.value, () => deb.call())
})
onBeforeUnmount(() => unbindPaste?.())

/** DOMParser 捕获解析错误，并提取行号 */
function checkXml(text: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    const err = doc.querySelector('parsererror')
    if (err) {
      const msg = (err.textContent ?? '').replace(/\s+/g, ' ').trim()
      const m = msg.match(/line[: ]+(\d+)/i)
      errorLine.value = m ? Number(m[1]) : 0
      return msg.slice(0, 160)
    }
    return null
  } catch (e) {
    errorLine.value = 0
    return (e as Error).message
  }
}

/** 错误行内跳转（rx2）：点击滚动输入区使错误行可见 */
const jumpToError = () => {
  const ta = inputEl.value
  if (!ta || !errorLine.value) return
  const lines = input.value.split('\n').length
  if (lines < 1) return
  const lineHeight = ta.scrollHeight / lines
  ta.scrollTop = Math.max(0, (errorLine.value - 1) * lineHeight - ta.clientHeight / 3)
  ta.focus()
  toast.ok(`已定位到第 ${errorLine.value} 行`)
}

const run = async (minify: boolean) => {
  error.value = ''
  errorLine.value = 0
  if (!input.value.trim()) return toast.warn('请先粘贴 XML')
  const parseErr = checkXml(input.value)
  if (parseErr) {
    error.value = parseErr
    toast.err('XML 解析失败，请检查标签闭合与转义')
    return
  }
  busy.value = true
  try {
    output.value = formatXml(input.value, indent.value, minify)
    toast.ok(minify ? 'XML 已压缩' : 'XML 已美化')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="xml-fmt">
    <div class="row row-wrap mb-2" style="align-items: center; gap: 10px">
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run(false)">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <FileCode2 v-else :size="14" /> 美化缩进
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="run(true)">压缩为一行</button>
      <span class="field-label" style="margin: 0 0 0 10px">缩进</span>
      <select v-model="indent" class="select" style="width: 100px">
        <option :value="2">2 空格</option>
        <option :value="4">4 空格</option>
      </select>
      <label class="check" title="粘贴后 800ms 自动美化，可关"><input v-model="autoRun" type="checkbox" /> 粘贴即美化</label>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">XML 输入</span>
        <textarea ref="inputEl" v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" download="xml" min-height="300px" />
    </div>

    <div v-if="error" class="notice notice-err mt-2 err-jump" role="button" tabindex="0" title="点击定位到输入区错误行" @click="jumpToError" @keydown.enter="jumpToError">
      解析错误：{{ error }}
      <span v-if="errorLine" class="jump-link"><Crosshair :size="13" /> 定位到第 {{ errorLine }} 行</span>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: xml-spin 0.8s linear infinite;
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
@keyframes xml-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
