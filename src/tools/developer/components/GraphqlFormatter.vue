<script setup lang="ts">
import { ref } from 'vue'
import { Share2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { prettyGraphql, minifyGraphql } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('query GetUser($id:ID!){user(id:$id){id name email posts{title createdAt}}} mutation like($postId:ID!){likePost(id:$postId)}')
const output = ref('')

const pretty = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 GraphQL 内容')
  try {
    output.value = prettyGraphql(input.value)
    toast.ok('已美化缩进')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  }
}

const minify = () => {
  if (!input.value.trim()) return toast.warn('请先粘贴 GraphQL 内容')
  try {
    output.value = minifyGraphql(input.value)
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
      <ResultBox v-model="output" title="输出" download="graphql" min-height="300px" />
    </div>

    <p class="notice notice-info mt-2 small">按大括号层级缩进，压缩时移除注释与多余空白。适合格式化客户端查询与 SDL schema。</p>
  </div>
</template>
