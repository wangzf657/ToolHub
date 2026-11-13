<script setup lang="ts">
/** JS/CSS 压缩混淆：terser/csso 真引擎；压缩率统计独立展示（产物纯净，复制不含统计） */
import { computed, ref } from 'vue'
import { Minimize2, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'
import { installCtrlEnter } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('function hello(name){/* 注释会被移除 */ const msg=`你好, ${name}!`;console.log(msg)}')
const lang = ref<'auto' | 'js' | 'css'>('auto')
/** mangle 档位（rx4）：激进档压缩模块代码时顶层变量也被重命名 */
const mangleTop = ref(false)
const output = ref('')
const busy = ref(false)
const stats = ref('')
const detected = ref('')
const rootEl = ref<HTMLElement | null>(null)
let unbindKey: (() => void) | null = null
const run = async () => {
  if (!input.value.trim()) return toast.warn('请粘贴 JS 或 CSS 代码')
  busy.value = true
  stats.value = ''
  detected.value = ''
  try {
    const t = input.value
    const cssHits = (t.match(/[{;]\s*[-\w]+\s*:\s*[^;{}]+;/g) ?? []).length + (t.match(/@(media|import|charset|font-face|keyframes|supports)\b/g) ?? []).length
    const jsHits = (t.match(/\b(function|const|let|var|return|import|export|class)\b|=>/g) ?? []).length
    const isCss = lang.value === 'css' || (lang.value === 'auto' && cssHits > jsHits)
    detected.value = isCss ? 'CSS（csso）' : 'JavaScript（terser）'
    let out: string
    if (isCss) {
      const csso = await import('csso')
      out = csso.minify(t).css
    } else {
      const { minify } = await import('terser')
      const r = await minify(t, {
        module: mangleTop.value, // 激进档：toplevel mangle 重命名顶层变量
        compress: true,
        mangle: mangleTop.value ? { toplevel: true } : true,
        format: { comments: false },
      })
      out = r.code ?? ''
    }
    output.value = out
    const a = new Blob([t]).size
    const b = new Blob([out]).size
    const pct = a > 0 ? Math.round((1 - b / a) * 1000) / 10 : 0
    stats.value = `原始 ${a.toLocaleString()} B → ${b.toLocaleString()} B（- ${pct}%）`
    toast.ok('压缩完成')
  } catch (e) {
    toast.err(`压缩失败：${(e as Error).message}（请确认代码语法正确，或手动指定语言）`)
  } finally {
    busy.value = false
  }
}

try {
  unbindKey = installCtrlEnter(rootEl.value, run)
} catch {
  /* 忽略 */
}
</script>

<template>
  <div ref="rootEl" class="minifier">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <span class="field-label" style="margin: 0">语言</span>
      <select v-model="lang" class="select" style="width: 170px">
        <option value="auto">自动识别</option>
        <option value="js">JavaScript（terser）</option>
        <option value="css">CSS（csso）</option>
      </select>
      <span class="field-label" style="margin: 0">mangle 档位</span>
      <select v-model="mangleTop" class="select" style="width: 150px">
        <option :value="false">常规（保留顶层名）</option>
        <option :value="true">激进（toplevel，模块代码用）</option>
      </select>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run" title="快捷键 Ctrl+Enter">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <Minimize2 v-else :size="14" /> 压缩
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入（JS 或 CSS）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 380px" spellcheck="false"></textarea>
      </div>
      <div class="out-col">
        <div v-if="stats" class="stat-line mono small">{{ stats }} · {{ detected }}</div>
        <ResultBox v-model="output" title="压缩结果（纯净产物，复制不含统计）" min-height="380px" />
      </div>
    </div>

    <p class="notice notice-info mt-2 small">
      mangle 仅重命名标识符，非强混淆——字符串与属性名（常规档）保持原样；激进档会重命名顶层变量，适合打包前的模块代码，浏览器全局脚本请用常规档。压缩率统计独立展示于结果区头部，产物本体纯净。
    </p>
  </div>
</template>

<style scoped>
.out-col {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.stat-line {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 8px;
  padding: 5px 10px;
}
.spin {
  animation: min-spin 0.8s linear infinite;
}
@keyframes min-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
