<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Wand2, Minimize2, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { formatCode } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()

type Lang = 'javascript' | 'css' | 'html'
const LANGS: { id: Lang; label: string; sample: string }[] = [
  { id: 'javascript', label: 'JavaScript', sample: 'function hello(name){const msg=`你好, ${name}!`;console.log(msg)}' },
  { id: 'css', label: 'CSS', sample: '.card{padding:16px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)}' },
  { id: 'html', label: 'HTML', sample: '<div class="card"><h2>标题</h2><p>内容段落</p></div>' },
]

const slug = computed(() => String(route.params.slug ?? ''))
const lang = ref<Lang>('javascript')
const input = ref(LANGS[0]!.sample)
const output = ref('')
const busy = ref(false)

// 四个注册表入口共用本组件：按 slug 预选语言
watch(
  slug,
  (s) => {
    if (s === 'javascript-formatter') setLang('javascript')
    else if (s === 'css-formatter') setLang('css')
    else if (s === 'html-formatter' || s === 'html-minifier') setLang('html')
  },
  { immediate: true },
)

function setLang(l: Lang) {
  lang.value = l
  const def = LANGS.find((x) => x.id === l)!
  if (!input.value.trim()) input.value = def.sample
}

const currentLabel = computed(() => LANGS.find((x) => x.id === lang.value)!.label)

const run = async (minify: boolean) => {
  if (!input.value.trim()) return toast.warn('请先粘贴代码')
  busy.value = true
  try {
    output.value = await formatCode(lang.value, input.value, minify)
    toast.ok(minify ? `${currentLabel} 已压缩` : `${currentLabel} 已格式化`)
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message.slice(0, 120)}`)
  } finally {
    busy.value = false
  }
}

const ext = computed(() => (lang.value === 'javascript' ? 'js' : lang.value === 'css' ? 'css' : 'html'))
</script>

<template>
  <div class="code-fmt">
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <button
        v-for="l in LANGS"
        :key="l.id"
        class="chip"
        :class="{ active: lang === l.id }"
        @click="setLang(l.id)"
      >
        {{ l.label }}
      </button>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run(false)">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <Wand2 v-else :size="14" /> 格式化
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="run(true)">
        <Minimize2 :size="14" /> 压缩
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">{{ currentLabel }} 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 320px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="输出" :download="ext" min-height="320px" />
    </div>

    <p class="notice notice-info mt-2 small">
      格式化使用 Prettier 规则（首次加载解析插件）；压缩移除注释与多余空白。HTML 压缩入口与格式化入口为同一工具，切换按钮即可。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: cf-spin 0.8s linear infinite;
}
@keyframes cf-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
