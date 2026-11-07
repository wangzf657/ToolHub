<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

/** 经典拉丁占位句子片段 */
const LATIN = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
  'Nulla facilisi morbi tempus iaculis urna id volutpat lacus.',
  'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere.',
  'Curabitur blandit tempus porttitor, sed malesuada magna mollis.',
  'Praesent commodo cursus magna, vel scelerisque nisl consectetur.',
]

/** 中文占位句子模板 */
const CN = [
  '这是一段用于填充版面的中文占位文本，内容本身没有具体含义。',
  '在设计稿里放置真实长度的文字，有助于判断排版效果与阅读节奏。',
  '你可以稍后把这段文字替换为正式的标题与正文内容。',
  '占位段落应当足够长，才能真实反映多行文字的视觉密度。',
  '保持段落长度接近实际内容，是排版阶段的重要经验。',
  '这段文字由本工具在浏览器本地随机拼装，不会上传任何数据。',
  '不同的字号与行距会带来完全不同的阅读感受，占位文本可以帮你提前发现。',
  '页面完成后再统一替换文案，可以避免反复修改设计细节。',
]

const paragraphs = ref(3)
const sentences = ref(4)
const lang = ref<'latin' | 'cn'>('cn')

const rand = (n: number) => Math.floor(Math.random() * n)

const buildParagraph = () => {
  const src = lang.value === 'cn' ? CN : LATIN
  const parts: string[] = []
  const n = Math.max(1, Math.min(12, sentences.value))
  for (let i = 0; i < n; i++) parts.push(src[rand(src.length)])
  return parts.join(lang.value === 'cn' ? '' : ' ')
}

const output = ref('')

const generate = () => {
  const n = Math.max(1, Math.min(30, paragraphs.value))
  output.value = Array.from({ length: n }, buildParagraph).join('\n\n')
}
watch(lang, generate)
generate()

const regen = () => {
  generate()
}

const wordCount = computed(() => output.value.length)
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap" style="gap: 18px">
        <div>
          <span class="field-label">语言</span>
          <select v-model="lang" class="select" style="width: 160px">
            <option value="cn">中文占位</option>
            <option value="latin">Lorem Ipsum（拉丁）</option>
          </select>
        </div>
        <div>
          <span class="field-label">段落数（1–30）</span>
          <input v-model.number="paragraphs" type="number" class="input" style="width: 110px" min="1" max="30" />
        </div>
        <div>
          <span class="field-label">每段句数（1–12）</span>
          <input v-model.number="sentences" type="number" class="input" style="width: 110px" min="1" max="12" />
        </div>
        <button class="btn btn-primary self-end" @click="regen">
          <RefreshCw :size="16" /> 重新生成
        </button>
      </div>
    </div>

    <ResultBox v-model="output" :title="`占位文本（${wordCount} 字符）`" download="txt" class="mt-2" />
  </div>
</template>

<style scoped>
.opts-panel {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.self-end {
  align-self: flex-end;
}
</style>
