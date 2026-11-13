<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Code2, Eraser } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const title = ref('百宝工具箱 - 在线本地工具集合')
const description = ref('无需注册、数据不出浏览器的在线工具箱：图片、PDF、开发者、效率工具一站搞定。')
const keywords = ref('在线工具,开发者工具,本地处理')
const author = ref('ToolHub')
const robots = ref('index, follow')
const viewport = ref(true)
const charset = ref(true)
const canonical = ref('https://example.com/tools')

/* 家族字段共享（rx4）：title/description 与 Open Graph 生成器双向同步 */
onMounted(() => {
  try {
    const shared = JSON.parse(localStorage.getItem('toolhub.seo-share') || 'null') as { title?: string; description?: string; from?: string } | null
    if (shared && shared.from !== 'meta') {
      if (shared.title !== undefined) title.value = shared.title
      if (shared.description !== undefined) description.value = shared.description
    }
  } catch {
    /* 同步数据损坏则忽略 */
  }
})
const pushShare = () => {
  localStorage.setItem('toolhub.seo-share', JSON.stringify({ title: title.value, description: description.value, from: 'meta' }))
}
watch([title, description], pushShare)

/** 长度判级（rx1）：title >60 / description >155 红（会截断），description <50 黄（偏短） */
const titleLevel = computed<'ok' | 'long'>(() => (title.value.length > 60 ? 'long' : 'ok'))
const descLevel = computed<'ok' | 'long' | 'short'>(() => (description.value.length > 155 ? 'long' : description.value.length > 0 && description.value.length < 50 ? 'short' : 'ok'))

/** 引号转义（rx2）：attr 内容里的 " → &quot; */
const esc = (s: string) => s.trim().replace(/"/g, '&quot;')

const lines = computed(() => {
  const out: string[] = []
  if (charset.value) out.push(`<meta charset="UTF-8">`)
  if (viewport.value) out.push(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
  if (title.value.trim()) out.push(`<title>${esc(title.value)}</title>`)
  if (description.value.trim()) out.push(`<meta name="description" content="${esc(description.value)}">`)
  if (keywords.value.trim()) out.push(`<meta name="keywords" content="${esc(keywords.value)}">`)
  if (author.value.trim()) out.push(`<meta name="author" content="${esc(author.value)}">`)
  if (robots.value.trim()) out.push(`<meta name="robots" content="${esc(robots.value)}">`)
  if (canonical.value.trim()) out.push(`<link rel="canonical" href="${esc(canonical.value)}">`)
  return out
})

const html = computed(() => lines.value.join('\n'))

/** 清空示例（rx6）：8 字段全空，输出仅剩 charset/viewport */
const resetBlank = () => {
  title.value = ''
  description.value = ''
  keywords.value = ''
  author.value = ''
  canonical.value = ''
  charset.value = true
  viewport.value = true
  toast.ok('已清空全部示例字段')
}

const download = () => {
  if (!html.value) return
  const blob = new Blob([html.value + '\n'], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'meta-tags.html'
  a.click()
  URL.revokeObjectURL(url)
  toast.ok('已下载 meta-tags.html')
}
</script>

<template>
  <div class="meta-gen">
    <div class="row row-wrap mb-2" style="gap: 10px">
      <button class="btn btn-ghost btn-sm" @click="router.push('/t/open-graph-generator')">Open Graph / Twitter Card 生成 →</button>
      <button class="btn btn-ghost btn-sm" @click="resetBlank"><Eraser :size="14" /> 清空示例</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">页面标题 title（建议 ≤ 30 个汉字 / 60 字符）</span>
        <input v-model="title" type="text" class="input" />
        <p class="small" :style="{ margin: '4px 2px 0', color: titleLevel === 'long' ? 'var(--err)' : 'var(--muted)' }">
          当前 {{ title.length }} 字符<template v-if="titleLevel === 'long'">，超过 60 字符，搜索引擎会截断显示</template>
        </p>
      </div>
      <div>
        <span class="field-label">描述 description（建议 70-155 字符）</span>
        <input v-model="description" type="text" class="input" />
        <p class="small" :style="{ margin: '4px 2px 0', color: descLevel === 'long' ? 'var(--err)' : descLevel === 'short' ? '#fbbf24' : 'var(--muted)' }">
          当前 {{ description.length }} 字符<template v-if="descLevel === 'long'">，超过 155 字符，搜索引擎会截断显示</template><template v-else-if="descLevel === 'short'">，偏短，可再补充卖点</template>
        </p>
      </div>
    </div>

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">关键词 keywords（逗号分隔）</span>
        <input v-model="keywords" type="text" class="input" />
        <p class="small muted" style="margin: 4px 2px 0">Google 已忽略 keywords，仅部分中文引擎参考。</p>
      </div>
      <div>
        <span class="field-label">作者 author</span>
        <input v-model="author" type="text" class="input" />
      </div>
      <div>
        <span class="field-label">robots 指令</span>
        <select v-model="robots" class="select">
          <option value="index, follow">index, follow（默认）</option>
          <option value="noindex, follow">noindex, follow</option>
          <option value="index, nofollow">index, nofollow</option>
          <option value="noindex, nofollow">noindex, nofollow</option>
          <option value="index, follow, max-image-preview:large, max-snippet:-1">index, follow, max-image-preview:large, max-snippet:-1（现代推荐）</option>
        </select>
      </div>
      <div>
        <span class="field-label">Canonical 链接</span>
        <input v-model="canonical" type="text" class="input mono" placeholder="https://…" />
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 14px">
      <label class="check"><input v-model="charset" type="checkbox" /> 包含 charset</label>
      <label class="check"><input v-model="viewport" type="checkbox" /> 包含 viewport</label>
    </div>

    <ResultBox v-model="html" title="Meta 标签代码（粘贴到 <head> 内）" download="html" min-height="200px" class="mt-3" />

    <div class="row mt-2">
      <button class="btn btn-ghost btn-sm" @click="download"><Code2 :size="14" /> 下载 .html</button>
    </div>

    <p class="notice notice-info mt-2 small">属性值中的双引号会自动转义为 &amp;quot;，其余字符原样输出（输出为原始 HTML 方便直接粘贴）。title/description 与 Open Graph 生成器双向同步。</p>
  </div>
</template>
