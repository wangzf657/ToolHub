<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Wand2, Minimize2, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { formatCode } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'
import { installPasteRun, debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const route = useRoute()

type Lang = 'javascript' | 'css' | 'html'
const LANGS: { id: Lang; label: string; sample: string }[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    sample: 'function hello(name){const msg=`你好, ${name}!`;console.log(msg)}',
  },
  { id: 'css', label: 'CSS', sample: '.card{padding:16px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)}' },
  {
    id: 'html',
    label: 'HTML',
    sample:
      '<!DOCTYPE html>\n<html>\n<head>\n<style>.card{color:#333;margin:0 auto}\n.wrap{display:flex}</style>\n<script>console.log("ready")<\/script>\n</head>\n<body>\n<div class="card"><h2>标题</h2><p>内容段落</p></div>\n</body>\n</html>',
  },
]

const slug = computed(() => String(route.params.slug ?? ''))
const lang = ref<Lang>('javascript')
const input = ref(LANGS[0]!.sample)
const output = ref('')
const busy = ref(false)
/** 压缩统计（元信息，不混入产物） */
const stats = ref('')
/** 常驻错误条（带行列号，toast 消失后仍在） */
const errorInfo = ref('')
/** 粘贴即处理（默认开可关） */
const autoRun = ref(true)
/** 缩进 2/4（记忆） */
const indent = ref(Number(localStorage.getItem('toolhub.codefmt-indent') || 2))
watch(indent, (v) => localStorage.setItem('toolhub.codefmt-indent', String(v)))
/** JS 专属配置（记忆） */
const jsCfg = ref({
  printWidth: Number(localStorage.getItem('toolhub.codefmt-pw') || 80),
  semi: localStorage.getItem('toolhub.codefmt-semi') !== '0',
  singleQuote: localStorage.getItem('toolhub.codefmt-sq') === '1',
  trailingComma: (localStorage.getItem('toolhub.codefmt-tc') || 'all') as 'all' | 'es5' | 'none',
})
watch(jsCfg, (v) => {
  localStorage.setItem('toolhub.codefmt-pw', String(v.printWidth))
  localStorage.setItem('toolhub.codefmt-semi', v.semi ? '1' : '0')
  localStorage.setItem('toolhub.codefmt-sq', v.singleQuote ? '1' : '0')
  localStorage.setItem('toolhub.codefmt-tc', v.trailingComma)
}, { deep: true })

const inputEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null
onMounted(() => {
  const delay = lang.value === 'html' ? 1500 : 1000
  const deb = debounceRun(() => {
    if (autoRun.value && input.value.trim()) run(false)
  }, delay)
  unbindPaste = installPasteRun(inputEl.value, () => deb.call())
  watch(autoRun, (on) => !on && deb.cancel())
})
onBeforeUnmount(() => unbindPaste?.())

// 四个注册表入口共用本组件：按 slug 预选语言
watch(
  slug,
  (s) => {
    if (s === 'javascript-formatter') setLang('javascript')
    else if (s === 'css-formatter') setLang('css')
    else if (s === 'html-formatter') setLang('html')
  },
  { immediate: true },
)

function setLang(l: Lang) {
  lang.value = l
  const def = LANGS.find((x) => x.id === l)!
  if (!input.value.trim()) input.value = def.sample
  errorInfo.value = ''
  stats.value = ''
}

const currentLabel = computed(() => LANGS.find((x) => x.id === lang.value)!.label)

/** 压缩率统计行 */
const setStats = (before: string, after: string) => {
  const a = new Blob([before]).size
  const b = new Blob([after]).size
  const pct = a ? Math.round(((a - b) / a) * 100) : 0
  stats.value = `原始 ${a.toLocaleString()} B → 压缩后 ${b.toLocaleString()} B（- ${pct}%）`
}

const run = async (minify: boolean) => {
  if (!input.value.trim()) return toast.warn('请先粘贴代码')
  busy.value = true
  errorInfo.value = ''
  stats.value = ''
  const before = input.value
  try {
    if (minify && lang.value === 'javascript') {
      // 真引擎：terser（mangle + compress），与代码压缩工具同源
      const { minify } = await import('terser')
      const r = await minify(before, { compress: true, mangle: true, format: { comments: false } })
      output.value = r.code ?? ''
      setStats(before, output.value)
    } else if (minify && lang.value === 'css') {
      // 真引擎：csso（结构级压缩，content 字符串不受影响）
      const csso = await import('csso')
      output.value = csso.minify(before).css
      setStats(before, output.value)
    } else if (minify && lang.value === 'html') {
      // pre/textarea 内容逐字符保护（rx2）
      const vault: string[] = []
      const sealed = before.replace(/<(pre|textarea)(\s[^>]*)?>[\s\S]*?<\/\1\s*>/gi, (m) => `\u0000${vault.push(m) - 1}\u0000`)
      const mini = sealed.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim()
      output.value = mini.replace(/\u0000(\d+)\u0000/g, (_, i) => vault[Number(i)] ?? '')
      setStats(before, output.value)
    } else if (lang.value === 'javascript' && !minify) {
      // JS 格式化走组件级 prettier，暴露行宽/分号/单引号/尾逗号配置（rx3）
      const prettier = await import('prettier/standalone')
      output.value = await prettier.format(before, {
        parser: 'babel',
        plugins: [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] as never,
        tabWidth: indent.value,
        semi: jsCfg.value.semi,
        singleQuote: jsCfg.value.singleQuote,
        printWidth: jsCfg.value.printWidth,
        trailingComma: jsCfg.value.trailingComma,
      })
    } else {
      output.value = await formatCode(lang.value, before, false, indent.value)
    }
    toast.ok(minify ? `${currentLabel} 已压缩` : `${currentLabel} 已格式化`)
  } catch (e) {
    const msg = (e as Error).message || '处理失败'
    const m = msg.match(/line:\s*(\d+),\s*col:\s*(\d+)/)
    errorInfo.value = `语法错误${m ? `（第 ${m[1]} 行，第 ${m[2]} 列附近）` : ''}：${msg.split('\n')[0]?.slice(0, 160)}`
    toast.err('处理失败，详见下方错误提示')
  } finally {
    busy.value = false
  }
}

const ext = computed(() => (lang.value === 'javascript' ? 'js' : lang.value === 'css' ? 'css' : 'html'))
</script>

<template>
  <div class="code-fmt">
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <button v-for="l in LANGS" :key="l.id" class="chip" :class="{ active: lang === l.id }" @click="setLang(l.id)">
        {{ l.label }}
      </button>
      <label class="check" title="粘贴后自动格式化（防抖，可关）"><input v-model="autoRun" type="checkbox" /> 粘贴即处理</label>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run(false)">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <Wand2 v-else :size="14" /> 格式化
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="run(true)">
        <Minimize2 :size="14" /> 压缩
      </button>
    </div>

    <!-- 配置面板：缩进全语言；行宽/分号/单引号/尾逗号仅 JS（rx3/rx4/rx5） -->
    <div class="row row-wrap mb-2 opts" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">缩进</span>
      <select v-model.number="indent" class="select" style="width: 100px">
        <option :value="2">2 空格</option>
        <option :value="4">4 空格</option>
      </select>
      <template v-if="lang === 'javascript'">
        <label class="check" style="gap: 6px">行宽
          <input v-model.number="jsCfg.printWidth" type="number" min="40" max="200" step="10" style="width: 76px" class="input" />
        </label>
        <label class="check"><input v-model="jsCfg.semi" type="checkbox" /> 保留分号</label>
        <label class="check"><input v-model="jsCfg.singleQuote" type="checkbox" /> 单引号</label>
        <label class="check" style="gap: 6px">尾逗号
          <select v-model="jsCfg.trailingComma" class="select" style="width: 90px">
            <option value="all">all</option>
            <option value="es5">es5</option>
            <option value="none">none</option>
          </select>
        </label>
      </template>
      <template v-if="lang === 'html'">
        <span class="muted small">压缩时 &lt;pre&gt; 与 &lt;textarea&gt; 内容逐字符保留</span>
      </template>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">{{ currentLabel }} 输入</span>
        <textarea ref="inputEl" v-model="input" class="textarea mono fmt-input" spellcheck="false"></textarea>
      </div>
      <div class="out-col">
        <div v-if="stats" class="stat-line mono small">{{ stats }}</div>
        <ResultBox v-model="output" title="输出" :download="ext" min-height="480px" />
      </div>
    </div>

    <div v-if="errorInfo" class="notice notice-err mt-2">{{ errorInfo }}</div>

    <p class="notice notice-info mt-2 small">
      格式化使用 Prettier 规则（首次加载解析插件）；压缩用真实引擎——JS 走 terser（mangle 仅重命名标识符，非强混淆；会移除注释与多余空白），CSS 走 csso，字符串字面量原样保留。配置会自动记忆。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: cf-spin 0.8s linear infinite;
}
.opts {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
/* 输入区弹性高度，输出区下限 480px 保证高屏多看行 */
.fmt-input {
  min-height: min(480px, calc(100vh - 400px));
}
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
@keyframes cf-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
