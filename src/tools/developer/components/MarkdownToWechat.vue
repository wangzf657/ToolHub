<script setup lang="ts">
/** Markdown 转公众号排版：主题渲染 → CSS 逐元素内联 → 复制富文本直接粘贴公众号后台 */
import {ref, watch} from 'vue'
import { Check, ClipboardCopy, FileText } from 'lucide-vue-next'
import { mdToWechatHtml, WECHAT_THEMES, type WechatTheme } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 你好，公众号\n\n这是一段通过 **ToolHub 本地排版** 的 Markdown，复制后直接粘贴到公众号后台即可。\n\n## 为什么要内联样式\n\n公众号编辑器会剥离 `<style>` 标签，所以必须把规则写成每个元素的 style 属性。\n\n- 无需图床\n- 无需登录授权\n- 全程本地处理\n')
const theme = ref<WechatTheme>(WECHAT_THEMES[0])
const html = ref('')
const busy = ref(false)
const copied = ref(false)

// 输入或换主题即时重排（400ms 防抖，正文排版场景节流）
let debTimer = 0
watch([input, theme], () => {
  window.clearTimeout(debTimer)
  debTimer = window.setTimeout(() => {
    if (input.value.trim()) void render()
  }, 400)
})

const render = async () => {
  if (!input.value.trim()) return toast.warn('请输入 Markdown 内容')
  busy.value = true
  try {
    html.value = await mdToWechatHtml(input.value, theme.value)
    copied.value = false
  } catch (e) {
    toast.err((e as Error).message || '渲染失败')
  } finally {
    busy.value = false
  }
}

const copyRich = async () => {
  if (!html.value) return toast.warn('请先生成排版')
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html.value], { type: 'text/html' }), 'text/plain': new Blob([input.value], { type: 'text/plain' }) })])
    copied.value = true
    toast.ok('已复制富文本，去公众号后台 Ctrl+V 粘贴即可')
  } catch {
    // ClipboardItem 不支持时降级复制纯 HTML 源码
    const okFlag = await navigator.clipboard.writeText(html.value).then(() => true).catch(() => false)
    okFlag ? toast.warn('已复制 HTML 源码，可在公众号「HTML 源码」模式粘贴') : toast.err('复制失败，请重试')
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <button
        v-for="t in WECHAT_THEMES"
        :key="t.id"
        class="chip"
        :class="{ active: theme.id === t.id }"
        :style="theme.id === t.id ? { borderColor: t.accent, color: t.accent } : {}"
        @click="theme = t"
      >
        {{ t.name }}
      </button>
      <span class="grow"></span>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="render"><FileText :size="14" /> 生成排版</button>
      <button class="btn btn-ghost btn-sm" :disabled="!html" @click="copyRich">
        <Check v-if="copied" :size="14" />
        <ClipboardCopy v-else :size="14" /> {{ copied ? '已复制' : '复制到公众号' }}
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">Markdown 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 400px" spellcheck="false"></textarea>
      </div>
      <div>
        <span class="field-label">公众号预览（{{ theme.name }} · 模拟手机宽度）</span>
        <div class="phone">
          <div class="phone-body prose" v-html="html"></div>
        </div>
      </div>
    </div>
    <p class="notice notice-info mt-2 small">样式已逐元素内联，粘贴后不会丢失排版；代码块为深色底。不支持一键发布与图床上传（涉及第三方授权，本站不做）。</p>
  </div>
</template>

<style scoped>
.phone {
  width: 375px;
  max-width: 100%;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #ffffff;
  padding: 18px 16px;
  min-height: 400px;
  max-height: 560px;
  overflow: auto;
  color: #333;
}
.phone-body {
  font-size: 15px;
  overflow-wrap: anywhere;
}
.phone-body :deep(img) {
  max-width: 100%;
}
</style>
