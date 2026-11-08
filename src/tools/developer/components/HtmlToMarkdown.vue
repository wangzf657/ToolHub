<script setup lang="ts">
/** HTML 转 Markdown：粘贴富文本（网页/飞书/语雀复制）或上传 .html，turndown + GFM 规则转换 */
import { ref } from 'vue'
import { ClipboardPaste, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { htmlToMd } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const output = ref('')
const busy = ref(false)
const pasteBox = ref<HTMLElement | null>(null)

/** convert(silent)：粘贴触发的自动转换不弹成功 toast（避免与「转换」按钮的提示叠成双 toast） */
const convert = async (html: string, silent = false) => {
  if (busy.value) return
  busy.value = true
  try {
    output.value = await htmlToMd(html)
    if (!silent) toast.ok('转换完成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

const onPaste = async (e: ClipboardEvent) => {
  // 粘贴富文本时优先取 text/html（浏览器自动把网页选区转成 HTML）
  const html = e.clipboardData?.getData('text/html')
  const text = e.clipboardData?.getData('text/plain')
  const src = html || text
  if (!src) return
  e.preventDefault()
  input.value = src.slice(0, 200000)
  await convert(src, true)
}

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const html = await files[0].text()
  input.value = html.slice(0, 500000)
  await convert(html)
}

const runFromBox = () => {
  if (!input.value.trim()) return toast.warn('请粘贴富文本或 HTML 代码')
  convert(input.value)
}

const onPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) onFiles([f])
}
</script>

<template>
  <div>
    <div class="hint-box" @paste="onPaste">
      <ClipboardPaste :size="18" />
      <span>点击此处后 <strong>Ctrl+V 粘贴</strong>网页/文档复制的富文本，自动转 Markdown（也可在下方粘贴 HTML 源码）</span>
    </div>
    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">HTML 输入（粘贴富文本或源码）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false" @paste="onPaste"></textarea>
        <div class="row mt-2">
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="runFromBox">
            <Loader2 v-if="busy" :size="14" class="spin" /> 转换
          </button>
          <label class="btn btn-ghost btn-sm file-btn">
            打开 .html 文件
            <input type="file" accept=".html,.htm" hidden @change="onPick" />
          </label>
        </div>
      </div>
      <ResultBox v-model="output" title="Markdown 输出" download="md" min-height="300px" />
    </div>
    <p class="notice notice-info mt-2 small">转换使用 turndown + GFM 规则（表格/删除线/任务列表），转换全程在本地进行。</p>
  </div>
</template>

<style scoped>
.hint-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1.5px dashed var(--accent);
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--text-2);
  font-size: 14px;
  cursor: pointer;
}
.file-btn {
  position: relative;
  cursor: pointer;
  text-decoration: none !important;
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
