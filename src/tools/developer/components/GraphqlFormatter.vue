<script setup lang="ts">
import { ref } from 'vue'
import { Share2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('query GetUser($id:ID!){user(id:$id){id name email posts{title createdAt}}} mutation like($postId:ID!){likePost(id:$postId)}')
const output = ref('')

/** 词法切分：字符串、"块描述"、注释、标点、词（字符串内容永不破坏） */
type Tok = { t: string; kind: 'str' | 'block' | 'comment' | 'punct' | 'word' }
function tokenize(q: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < q.length) {
    const ch = q[i]!
    if (ch === '"' && q.slice(i, i + 3) === '"""') {
      const end = q.indexOf('"""', i + 3)
      const stop = end === -1 ? q.length : end + 3
      out.push({ t: q.slice(i, stop), kind: 'block' })
      i = stop
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < q.length && q[j] !== '"') {
        if (q[j] === '\\') j++
        j++
      }
      out.push({ t: q.slice(i, Math.min(j + 1, q.length)), kind: 'str' })
      i = j + 1
      continue
    }
    if (ch === '#') {
      const end = q.indexOf('\n', i)
      const stop = end === -1 ? q.length : end
      out.push({ t: q.slice(i, stop), kind: 'comment' })
      i = stop
      continue
    }
    if (/[{}():,]/.test(ch)) {
      out.push({ t: ch, kind: 'punct' })
      i++
      continue
    }
    if (/\s/.test(ch)) {
      i++
      continue
    }
    let j = i
    while (j < q.length && !/[\s"{}():,#]/.test(q[j]!)) j++
    out.push({ t: q.slice(i, j), kind: 'word' })
    i = j
  }
  return out
}

/** 压缩：字符串与块描述内容原样保留（rx1） */
const localMinify = (q: string): string => {
  const toks = tokenize(q).filter((t) => t.kind !== 'comment')
  let out = ''
  toks.forEach((tok, i) => {
    const prev = toks[i - 1]
    const needSpace = !!prev && tok.kind !== 'punct' && prev.kind !== 'punct'
    out += (needSpace ? ' ' : '') + tok.t
  })
  return out
}

/** 美化：按大括号层级缩进；块描述独立成行且内部换行保留（rx2） */
const localPretty = (q: string): string => {
  const toks = tokenize(q).filter((t) => t.kind !== 'comment')
  let depth = 0
  const lines: string[] = []
  let cur = ''
  const push = () => {
    if (cur.trim()) lines.push('  '.repeat(depth) + cur.trim())
    cur = ''
  }
  for (const tok of toks) {
    if (tok.kind === 'punct' && tok.t === '{') {
      cur += ' {'
      push()
      depth++
      continue
    }
    if (tok.kind === 'punct' && tok.t === '}') {
      push()
      depth = Math.max(0, depth - 1)
      lines.push('  '.repeat(depth) + '}')
      continue
    }
    if (tok.kind === 'comment') {
      push()
      lines.push('  '.repeat(depth) + tok.t)
      continue
    }
    if (tok.kind === 'block') {
      // 块描述：独立成行，内部换行原样保留
      push()
      lines.push(tok.t)
      continue
    }
    cur += (cur ? ' ' : '') + tok.t
  }
  push()
  return lines.join('\n')
}

const pretty = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 GraphQL 内容')
  try {
    output.value = localPretty(input.value)
    toast.ok('已美化缩进')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  }
}

const minify = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 GraphQL 内容')
  try {
    output.value = localMinify(input.value)
    toast.ok('已压缩')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  }
}

const sample = () => {
  input.value = '# 查询示例\nquery {\n  repository(owner: "vuejs", name: "core") {\n    stargazerCount\n    issues(first: 2) { nodes { title state } }\n  }\n}'
}
</script>

<template>
  <div class="gql-fmt">
    <div class="row row-wrap mb-2">
      <button class="btn btn-primary btn-sm" @click="pretty"><Share2 :size="14" /> 美化缩进</button>
      <button class="btn btn-ghost btn-sm" @click="minify">压缩</button>
      <button class="btn btn-soft btn-sm" @click="sample">填入示例</button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">GraphQL 输入（query / mutation / SDL）</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <div class="out-col">
        <div v-if="output" class="notice notice-info small">按大括号层级近似缩进，未做语法校验；字符串与 """块描述""" 内容原样保留。</div>
        <ResultBox v-model="output" title="输出" download="graphql" min-height="300px" />
      </div>
    </div>

    <p class="notice notice-info mt-2 small">压缩时字符串字面量（含 # 字符）不被破坏，块描述内部换行保留；美化按大括号层级近似缩进。适合格式化客户端查询与 SDL schema。</p>
  </div>
</template>

<style scoped>
.out-col {
  display: grid;
  gap: 6px;
  min-width: 0;
}
</style>
