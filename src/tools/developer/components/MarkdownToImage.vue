<script setup lang="ts">
/** Markdown 转长图卡片：主题渲染（复用公众号主题）→ html-to-image 导出 PNG 长图 */
import { nextTick, ref } from 'vue'
import { ImageDown, Loader2 } from 'lucide-vue-next'
import { mdToWechatHtml, WECHAT_THEMES, type WechatTheme } from '@/lib/mdEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 周报要点\n\n本周完成 **Markdown 全家桶** 上线：\n\n- Word↔MD 双向转换\n- 公众号排版复制\n- 格式化与目录生成\n\n> 数据全部本地处理，欢迎反馈。')
const theme = ref<WechatTheme>(WECHAT_THEMES[0])
const outWidth = ref(800)
const transparent = ref(false)
const busy = ref(false)
const renderBox = ref<HTMLElement | null>(null)

/** 生成 PNG（渲染在屏外容器上） */
const render = async (): Promise<Blob> => {
  if (!input.value.trim()) throw new Error('请输入 Markdown 内容')
  const html = await mdToWechatHtml(input.value, theme.value)
  await nextTick()
  if (!renderBox.value) throw new Error('渲染容器未就绪')
  const { toBlob } = await import('html-to-image')
  const el = renderBox.value
  el.style.width = `${outWidth.value}px`
  el.innerHTML = html
  el.style.background = transparent.value ? 'transparent' : '#ffffff'
  const blob = await toBlob(el, {
    width: outWidth.value,
    // 高度按内容自适应（跳过固定高度裁切）
    height: el.scrollHeight,
    pixelRatio: 2,
    backgroundColor: transparent.value ? undefined : '#ffffff',
  })
  if (!blob) throw new Error('导出失败，请重试')
  return blob
}

const run = async () => {
  busy.value = true
  try {
    const blob = await render()
    saveBlob(blob, `markdown-card-${theme.value.id}.png`)
    toast.ok('长图已下载')
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">主题</span>
        <select v-model="theme" class="select" style="width: 130px">
          <option v-for="t in WECHAT_THEMES" :key="t.id" :value="t">{{ t.name }}</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">画布宽度</span>
        <select v-model.number="outWidth" class="select" style="width: 120px">
          <option :value="640">640px</option>
          <option :value="800">800px</option>
          <option :value="1080">1080px</option>
        </select>
      </label>
      <label class="opt check"><input v-model="transparent" type="checkbox" /><span>透明背景</span></label>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <ImageDown v-else :size="16" /> 导出长图
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">Markdown 输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <div>
        <span class="field-label">预览</span>
        <div class="preview-wrap" :style="{ background: transparent ? 'repeating-conic-gradient(#0002 0% 25%, transparent 0% 50%) 0 0 / 16px 16px' : 'transparent' }">
          <div ref="renderBox" class="md-card"></div>
        </div>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">复用公众号排版主题体系渲染后转 PNG（html-to-image，2 倍像素密度）；文字用系统字体保证导出不丢字。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt.check {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.preview-wrap {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
  max-height: 420px;
}
.md-card {
  padding: 24px;
  background: #fff;
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  overflow-wrap: anywhere;
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
