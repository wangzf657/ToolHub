<script setup lang="ts">
import { computed, ref } from 'vue'
import { Code2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const title = ref('百宝工具箱 - 在线本地工具集合')
const description = ref('无需注册、数据不出浏览器的在线工具箱：图片、PDF、开发者、效率工具一站搞定。')
const keywords = ref('在线工具,开发者工具,本地处理')
const author = ref('ToolHub')
const robots = ref('index, follow')
const viewport = ref(true)
const charset = ref(true)
const canonical = ref('https://example.com/tools')

const lines = computed(() => {
  const out: string[] = []
  if (charset.value) out.push(`<meta charset="UTF-8">`)
  if (viewport.value) out.push(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
  if (title.value.trim()) out.push(`<title>${title.value.trim()}</title>`)
  if (description.value.trim()) out.push(`<meta name="description" content="${description.value.trim()}">`)
  if (keywords.value.trim()) out.push(`<meta name="keywords" content="${keywords.value.trim()}">`)
  if (author.value.trim()) out.push(`<meta name="author" content="${author.value.trim()}">`)
  if (robots.value.trim()) out.push(`<meta name="robots" content="${robots.value.trim()}">`)
  if (canonical.value.trim()) out.push(`<link rel="canonical" href="${canonical.value.trim()}">`)
  return out
})

const html = computed(() => lines.value.join('\n'))

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
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">页面标题 title（建议 ≤ 30 个汉字）</span>
        <input v-model="title" type="text" class="input" />
        <p class="small muted" style="margin: 4px 2px 0">当前 {{ title.length }} 字符</p>
      </div>
      <div>
        <span class="field-label">描述 description（建议 70-160 字符）</span>
        <input v-model="description" type="text" class="input" />
        <p class="small muted" style="margin: 4px 2px 0">当前 {{ description.length }} 字符</p>
      </div>
    </div>

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">关键词 keywords（逗号分隔）</span>
        <input v-model="keywords" type="text" class="input" />
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

    <p class="notice notice-info mt-2 small">引号等特殊字符请自行避免直接写入，输出为原始 HTML 不做转义，方便直接粘贴使用。</p>
  </div>
</template>
