<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, Copy, Check } from 'lucide-vue-next'
import { slugify } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('10 个提升效率的本地工具 ToolHub!')
const sep = ref<'-' | '_'>('-')
const upper = ref(false)
const copied = ref(false)

const slug = computed(() => {
  const s = slugify(input.value, sep.value)
  return upper.value ? s.toUpperCase() : s
})

const doCopy = async () => {
  if (!slug.value) return toast.warn('暂无可复制的结果')
  const okFlag = await copyText(slug.value)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } else toast.err('复制失败')
}

const examples = ['Vue 3 入门指南（2025 版）', 'Café & Restaurant Guide', '如何用好 CSS Grid？', '产品更新 v2.0：全新 UI']
</script>

<template>
  <div class="slug-gen">
    <span class="field-label">标题 / 原文</span>
    <textarea v-model="input" class="textarea" style="min-height: 90px" placeholder="粘贴文章标题…"></textarea>

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">分隔符</span>
      <select v-model="sep" class="select" style="width: 110px">
        <option value="-">连字符 -</option>
        <option value="_">下划线 _</option>
      </select>
      <label class="check"><input v-model="upper" type="checkbox" /> 全部大写</label>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" @click="doCopy">
        <Check v-if="copied" :size="14" color="#34d399" />
        <Copy v-else :size="14" /> 复制 slug
      </button>
    </div>

    <div class="mt-3 result-card">
      <span class="field-label"><Link :size="14" style="vertical-align: -2px" /> 生成结果</span>
      <code class="slug mono">{{ slug || '（输入后自动生成）' }}</code>
      <p class="small muted" style="margin: 8px 2px 0">https://example.com/blog/<b>{{ slug }}</b></p>
    </div>

    <div class="mt-3">
      <span class="field-label">示例（点击填入）</span>
      <div class="row row-wrap" style="gap: 8px">
        <button v-for="e in examples" :key="e" class="chip" @click="input = e">{{ e }}</button>
      </div>
    </div>

    <div class="notice notice-warn mt-3 small">
      中文说明：本工具不做汉字转拼音。中文字符会按原样保留在 slug 中（现代浏览器与主流框架均支持中文 URL，会自动百分号编码）；如需拼音 slug，请先把标题翻译或转写为英文再粘贴。去重音与转小写只作用于拉丁字母。
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
</style>
