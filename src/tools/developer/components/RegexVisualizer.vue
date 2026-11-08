<script setup lang="ts">
/** 正则可视化：交互面板；布局与解析全部在 lib/regexDiagram（regjsparser AST → SVG 铁路图） */
import { ref } from 'vue'
import { Workflow, Download } from 'lucide-vue-next'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('^https?://[\\w.-]+(?:\\?[\\w=&%-]*)?$')
const flags = ref('')
const svg = ref('')
const size = ref({ w: 0, h: 0 })
const error = ref('')
const busy = ref(false)

const run = async () => {
  const src = input.value.trim()
  if (!src) return toast.warn('请输入正则表达式')
  busy.value = true
  error.value = ''
  try {
    // 布局引擎重依赖 regjsparser，懒加载进异步 chunk
    const { regexDiagramSvg } = await import('@/lib/regexDiagram')
    const r = await regexDiagramSvg(src, flags.value.trim())
    svg.value = r.svg
    size.value = { w: r.width, h: r.height }
    toast.ok('已生成结构图')
  } catch (e) {
    svg.value = ''
    error.value = `正则解析失败：${(e as Error).message || '未知错误'}`
    toast.err('正则语法有误，请检查')
  } finally {
    busy.value = false
  }
}

const downloadSvg = () => {
  if (!svg.value) return toast.warn('请先生成结构图')
  saveText(svg.value, '正则结构.svg', 'image/svg+xml;charset=utf-8')
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 8px">
      <input v-model="input" class="input mono grow" style="min-width: 260px" spellcheck="false" placeholder="输入正则，如 ^\\d{4}-\\d{2}$" @keydown.enter="run" />
      <input v-model="flags" class="input mono" style="width: 66px" spellcheck="false" placeholder="flags" title="正则标志，如 g i m u" @keydown.enter="run" />
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="run"><Workflow :size="14" /> 可视化</button>
      <button v-if="svg" class="btn btn-ghost btn-sm" @click="downloadSvg"><Download :size="14" /> 下载 SVG</button>
    </div>

    <div v-if="error" class="notice notice-err">{{ error }}</div>
    <div v-else-if="svg" class="svg-stage" v-html="svg"></div>
    <div v-else class="muted small">点击「可视化」生成铁路结构图：序列从左到右、分支纵向展开、量词以虚线框 + 角标标注、捕获组标「第 N 组」、虚线盒为元字符/断言。</div>

    <p class="notice notice-info mt-2 small">解析使用 regjsparser（支持命名分组、后顾断言、\p{…} 与 u/v 标志）；flags 栏填 g i m u 等标志；下载的 SVG 可直接贴进文档。</p>
  </div>
</template>

<style scoped>
.svg-stage {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  overflow: auto;
}
.grow {
  flex: 1;
}
</style>
