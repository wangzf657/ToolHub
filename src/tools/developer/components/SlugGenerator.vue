<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Link, Copy, Check } from 'lucide-vue-next'
import { slugify } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('10 个提升效率的本地工具 ToolHub!')
const sep = ref<'-' | '_'>('-')
const upper = ref(false)
const copied = ref(false)
/** 中文转拼音（rx1，懒加载 pinyin-pro） */
const usePinyin = ref(false)
const pinyinLoading = ref(false)
/** 最多 N 词（0 = 不限）（rx2） */
const maxWords = ref(0)
/** 自定义预览前缀（rx4，记忆） */
const prefix = ref(localStorage.getItem('toolhub.slug-prefix') || 'https://example.com/blog/')
watch(prefix, (v) => localStorage.setItem('toolhub.slug-prefix', v))

const toPinyin = async (text: string): Promise<string> => {
  pinyinLoading.value = true
  try {
    const { pinyin } = await import('pinyin-pro')
    return pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join(' ')
  } finally {
    pinyinLoading.value = false
  }
}

/** 首次勾选拼音时提示词库加载 */
watch(usePinyin, async (on) => {
  if (on && !input.value.trim()) return
  if (on) {
    pinyinLoading.value = true
    try {
      await import('pinyin-pro')
      toast.ok('拼音词库已就绪')
    } finally {
      pinyinLoading.value = false
    }
  }
})

const slugOf = async (text: string): Promise<string> => {
  let src = text
  if (usePinyin.value && /[\u4e00-\u9fff]/.test(src)) src = await toPinyin(src)
  let s = slugify(src, sep.value)
  if (maxWords.value > 0) {
    const parts = s.split(sep.value).filter(Boolean).slice(0, maxWords.value)
    s = parts.join(sep.value)
  }
  return upper.value ? s.toUpperCase() : s
}

/** 批量模式：多行输入逐行生成（rx3） */
const batchMode = computed(() => input.value.trim().split('\n').filter((l) => l.trim()).length > 1)
const batchSlugs = ref<{ src: string; slug: string }[]>([])
const batchBusy = ref(false)
const runBatch = async () => {
  const lines = input.value.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    batchSlugs.value = []
    return
  }
  batchBusy.value = true
  try {
    batchSlugs.value = []
    for (const l of lines) batchSlugs.value.push({ src: l, slug: await slugOf(l) })
  } finally {
    batchBusy.value = false
  }
}
watch([input, sep, upper, usePinyin, maxWords], runBatch)
onMounted(runBatch)

const slug = computed(() => (batchMode.value ? '' : batchSlugs.value[0]?.slug ?? ''))

const doCopy = async (text?: string) => {
  const t = text ?? slug.value
  if (!t) return toast.warn('暂无可复制的结果')
  const okFlag = await copyText(t)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } else toast.err('复制失败')
}

const copyAll = async () => {
  const all = batchSlugs.value.map((r) => r.slug).join('\n')
  const okFlag = await copyText(all)
  okFlag ? toast.ok(`已复制 ${batchSlugs.value.length} 行 slug`) : toast.err('复制失败')
}

const copiedLine = ref(-1)
const copyLine = async (slugText: string, i: number) => {
  const okFlag = await copyText(slugText)
  if (okFlag) {
    copiedLine.value = i
    setTimeout(() => (copiedLine.value = -1), 1500)
  }
}

const examples = ['Vue 3 入门指南（2025 版）', 'Café & Restaurant Guide', '如何用好 CSS Grid？', '产品更新 v2.0：全新 UI']
</script>

<template>
  <div class="slug-gen">
    <span class="field-label">标题 / 原文（多行输入自动进入批量模式）</span>
    <textarea v-model="input" class="textarea" style="min-height: 90px" placeholder="粘贴文章标题…每行一条可批量生成"></textarea>

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">分隔符</span>
      <select v-model="sep" class="select" style="width: 110px">
        <option value="-">连字符 -</option>
        <option value="_">下划线 _</option>
      </select>
      <label class="check"><input v-model="upper" type="checkbox" /> 全部大写</label>
      <label class="check" title="中文段经拼音词库转为无声调拼音后再 slug 化"><input v-model="usePinyin" type="checkbox" /> 中文转拼音</label>
      <span v-if="pinyinLoading" class="muted small">拼音词库加载中…</span>
      <label class="check" style="gap: 6px">最多
        <input v-model.number="maxWords" type="number" class="input" min="0" max="30" style="width: 70px" />
        词（0 = 不限）
      </label>
      <span class="grow"></span>
      <button v-if="!batchMode" class="btn btn-primary btn-sm" @click="doCopy()">
        <Check v-if="copied" :size="14" color="#34d399" />
        <Copy v-else :size="14" /> 复制 slug
      </button>
      <button v-else class="btn btn-primary btn-sm" :disabled="batchBusy" @click="copyAll"><Copy :size="14" /> 复制全部</button>
    </div>

    <div v-if="upper" class="notice notice-warn mt-2 small">URL 惯例建议小写：部分服务器与比较逻辑会把大写路径判为不同地址，除非站点明确区分大小写。</div>

    <!-- 批量模式：逐行对照 -->
    <div v-if="batchMode" class="mt-3 result-card">
      <span class="field-label"><Link :size="14" style="vertical-align: -2px" /> 批量结果（{{ batchSlugs.length }} 行）</span>
      <div v-for="(r, i) in batchSlugs" :key="i" class="batch-row">
        <span class="b-src">{{ r.src }}</span>
        <code class="b-slug mono">{{ r.slug }}</code>
        <button class="mini-btn" :aria-label="`复制第 ${i + 1} 行 slug`" @click="copyLine(r.slug, i)">
          <Check v-if="copiedLine === i" :size="13" color="#34d399" /><Copy v-else :size="13" />
        </button>
      </div>
      <p class="small muted" style="margin: 8px 2px 0">「复制全部」为换行分隔纯文本，可直接粘贴进 CMS 批量导入。</p>
    </div>

    <!-- 单个模式 -->
    <div v-else class="mt-3 result-card">
      <span class="field-label"><Link :size="14" style="vertical-align: -2px" /> 生成结果</span>
      <code class="slug mono">{{ slug || '（输入后自动生成）' }}</code>
      <div class="row mt-2" style="gap: 8px; align-items: center">
        <span class="muted small">预览前缀</span>
        <input v-model="prefix" type="text" class="input mono grow" style="max-width: 420px" placeholder="https://example.com/blog/" />
      </div>
      <p class="small muted" style="margin: 8px 2px 0">{{ prefix }}<b>{{ slug }}</b></p>
    </div>

    <div class="mt-3">
      <span class="field-label">示例（点击填入）</span>
      <div class="row row-wrap" style="gap: 8px">
        <button v-for="e in examples" :key="e" class="chip" @click="input = e">{{ e }}</button>
      </div>
    </div>

    <div class="notice notice-warn mt-3 small">
      中文说明：默认中文字符按原样保留在 slug 中（现代浏览器支持中文 URL，会自动百分号编码）；勾选「中文转拼音」后经拼音词库转为无声调拼音（首次勾选需加载词库）。去重音与转小写只作用于拉丁字母。
    </div>
  </div>
</template>

<style scoped>
.result-card {
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--accent-soft);
}
.slug {
  display: block;
  font-size: 19px;
  font-weight: 700;
  color: var(--accent-text);
  overflow-wrap: anywhere;
}
.batch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--border);
}
.batch-row:last-of-type {
  border-bottom: none;
}
.b-src {
  flex: none;
  width: 34%;
  color: var(--text-2);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.b-slug {
  flex: 1;
  color: var(--accent-text);
  overflow-wrap: anywhere;
  font-size: 13px;
}
.mini-btn {
  flex: none;
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
.mini-btn:hover {
  border-color: var(--accent);
}
</style>
