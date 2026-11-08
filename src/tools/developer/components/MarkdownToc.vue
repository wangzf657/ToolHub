<script setup lang="ts">
/** Markdown 目录生成：提取标题树 → GitHub / VuePress 风格锚点目录（Markdown 列表或 HTML nav） */
import { ref } from 'vue'
import { ListTree, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 快速开始\n\n## 安装\n\n### 环境要求\n\n## 使用\n\n## 使用\n\n重复标题的锚点会自动加 -1。')
const output = ref('')
const busy = ref(false)
const maxDepth = ref(4)
const linkStyle = ref('github')
const outFmt = ref('md')

interface Heading {
  depth: number
  text: string
  slug: string
}

/** GitHub 锚点规则：小写、去标点、空格转连字符、中文保留、重复加 -1 */
function slugify(text: string, seen: Map<string, number>): string {
  let slug = text
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '') // 去变音符
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // 保留字母/数字/空格/连字符（中文保留）
    .replace(/\s+/g, '-')
  const n = seen.get(slug) ?? 0
  seen.set(slug, n + 1)
  return n === 0 ? slug : `${slug}-${n}`
}

const extract = async (): Promise<Heading[]> => {
  const { marked } = await import('marked')
  const tokens = marked.lexer(input.value)
  const seen = new Map<string, number>()
  const out: Heading[] = []
  const walk = (list: TokenLike[]) => {
    for (const t of list) {
      const depth = Number(t.depth ?? 0)
      if (t.type === 'heading' && depth >= 1 && depth <= maxDepth.value) {
        const text = String(t.text ?? '').trim()
        out.push({ depth, text, slug: slugify(text, seen) })
      }
    }
  }
  walk(tokens as unknown as TokenLike[])
  return out
}
interface TokenLike {
  type: string
  depth?: number
  text?: string
}

const run = async () => {
  if (!input.value.trim()) return toast.warn('请输入 Markdown 内容')
  busy.value = true
  try {
    const hs = await extract()
    if (!hs.length) {
      output.value = ''
      toast.warn('未找到标题（h1~h4）')
      return
    }
    if (outFmt.value === 'md') {
      const lines = hs.map((h) => `${'  '.repeat(h.depth - 1)}- [${h.text}](#${h.slug})`)
      output.value = lines.join('\n')
    } else {
      // 嵌套 <nav> HTML：按深度闭合 <ul>
      let html = '<nav class="md-toc">\n'
      let prev = 0
      for (const h of hs) {
        if (h.depth > prev) {
          for (let i = prev; i < h.depth; i++) html += '<ul>\n'
        } else if (h.depth < prev) {
          for (let i = h.depth; i < prev; i++) html += '</ul>\n'
          html += '</li>\n'
        } else if (prev > 0) {
          html += '</li>\n'
        }
        html += `<li><a href="#${h.slug}">${escapeHtml(h.text)}</a>`
        prev = h.depth
      }
      for (let i = 0; i < prev; i++) html += '</li>\n</ul>\n'
      html += '</nav>'
      output.value = html
    }
    toast.ok(`已提取 ${hs.length} 个标题`)
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  } finally {
    busy.value = false
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">标题层级</span>
        <select v-model.number="maxDepth" class="select" style="width: 120px">
          <option :value="2">h1~h2</option>
          <option :value="3">h1~h3</option>
          <option :value="4">h1~h4</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">锚点规则</span>
        <select v-model="linkStyle" class="select" style="width: 170px">
          <option value="github">GitHub（中文保留）</option>
          <option value="vuepress">VuePress 风格</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="outFmt" class="select" style="width: 150px">
          <option value="md">Markdown 列表</option>
          <option value="html">HTML nav</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="15" class="spin" />
        <ListTree v-else :size="15" /> 生成目录
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">Markdown 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 280px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="目录输出" min-height="280px" />
    </div>

    <p class="notice notice-info mt-2 small">锚点规则对齐 GitHub 渲染行为（中文保留、空格转连字符、重复标题加 -1 后缀）；VuePress 场景下 GitHub 规则同样适用。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
