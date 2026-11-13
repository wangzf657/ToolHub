<script setup lang="ts">
/** HTML 转 Markdown：粘贴富文本（网页/飞书/语雀复制）或上传 .html，turndown + GFM 规则转换 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ClipboardPaste, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { htmlToMd } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const output = ref('')
const busy = ref(false)
const pasteBox = ref<HTMLElement | null>(null)
/** 选项面板（rx3） */
const headingStyle = ref<'atx' | 'setext'>('atx')
const bullet = ref<'-' | '*' | '+'>('-')
const fence = ref<'```' | '~~~'>('```')
/** 忽略图片（rx4） */
const dropImages = ref(false)

/** 组件本地 turndown 实例：暴露标题/列表/围栏选项（引擎实例不可配，rx3） */
const localConvert = async (html: string): Promise<string> => {
  const TurndownService = (await import('turndown')).default
  const { gfm } = await import('turndown-plugin-gfm')
  const td = new TurndownService({ headingStyle: headingStyle.value, bulletListMarker: bullet.value, codeBlockStyle: 'fenced' })
  td.use(gfm)
  let src = html
  if (dropImages.value) src = src.replace(/<img[^>]*>/gi, '')
  return td.turndown(src)
}

// 围栏符号：turndown 无该选项，转换后轻量替换代码块围栏
const applyFence = (md: string) => (fence.value === '~~~' ? md.replace(/(^|\n)```/g, '$1~~~') : md)

/** convert(silent)：粘贴触发的自动转换不弹成功 toast（避免与「转换」按钮的提示叠成双 toast） */
const convert = async (html: string, silent = false) => {
  if (busy.value) return
  busy.value = true
  try {
    output.value = applyFence(await localConvert(html))
    if (!silent) toast.ok('转换完成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

/** 截断提示（rx1）：达到上限时告知实际保留长度 */
const CAP = 300000
const capNote = ref('')
const truncate = (src: string): string => {
  if (src.length <= CAP) {
    capNote.value = ''
    return src
  }
  capNote.value = `内容超过 30 万字符，已截断至前 ${CAP.toLocaleString()} 字符（原文 ${src.length.toLocaleString()} 字符）`
  return src.slice(0, CAP)
}

const onPaste = async (e: ClipboardEvent) => {
  // 粘贴富文本时优先取 text/html（浏览器自动把网页选区转成 HTML）
  const html = e.clipboardData?.getData('text/html')
  const text = e.clipboardData?.getData('text/plain')
  const src = html || text
  if (!src) return
  e.preventDefault()
  input.value = truncate(src)
  await convert(input.value, true)
}

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const html = await files[0].text()
  input.value = truncate(html)
  await convert(input.value)
}

const runFromBox = () => {
  if (!input.value.trim()) return toast.warn('请粘贴富文本或 HTML 代码')
  convert(input.value)
}

const onPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) onFiles([f])
}

/** window 级粘贴（rx2）：进入页面无需聚焦，Ctrl+V 即转换 */
const onWindowPaste = async (e: ClipboardEvent) => {
  const target = e.target as HTMLElement | null
  // 焦点在输入框/提示框时不重复处理（各自的 onPaste 已覆盖）
  if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('.hint-box'))) return
  const html = e.clipboardData?.getData('text/html')
  const text = e.clipboardData?.getData('text/plain')
  const src = html || text
  if (!src) return
  e.preventDefault()
  input.value = truncate(src)
  await convert(input.value, true)
  toast.ok('已在页面级捕获粘贴并转换')
}
onMounted(() => document.addEventListener('paste', onWindowPaste))
onBeforeUnmount(() => document.removeEventListener('paste', onWindowPaste))
</script>

<template>
  <div>
    <div class="hint-box" @paste="onPaste">
      <ClipboardPaste :size="18" />
      <span>点击此处后 <strong>Ctrl+V 粘贴</strong>网页/文档复制的富文本，自动转 Markdown（页面任意位置 Ctrl+V 也可捕获；也可在下方粘贴 HTML 源码）</span>
    </div>
    <div v-if="capNote" class="notice notice-warn mt-2 small">{{ capNote }}</div>
    <div class="row row-wrap mt-2" style="gap: 14px; align-items: center">
      <label class="opt">
        <span class="field-label">标题风格</span>
        <select v-model="headingStyle" class="select" style="width: 120px">
          <option value="atx">ATX（# ）</option>
          <option value="setext">Setext（===）</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">项目符号</span>
        <select v-model="bullet" class="select" style="width: 100px">
          <option value="-">-</option>
          <option value="*">*</option>
          <option value="+">+</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">代码围栏</span>
        <select v-model="fence" class="select" style="width: 100px">
          <option value="```">```</option>
          <option value="~~~">~~~</option>
        </select>
      </label>
      <label class="check"><input v-model="dropImages" type="checkbox" /> 忽略图片（输出无 ![]() 行）</label>
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
