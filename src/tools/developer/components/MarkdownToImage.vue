<script setup lang="ts">
/** Markdown 转长图卡片：主题渲染（复用公众号主题）→ html-to-image 导出 PNG 长图 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ImageDown, Loader2, ClipboardCopy } from 'lucide-vue-next'
import { mdToWechatHtml, WECHAT_THEMES, type WechatTheme } from '@/lib/mdEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('# 周报要点\n\n本周完成 **Markdown 全家桶** 上线：\n\n- Word↔MD 双向转换\n- 公众号排版复制\n- 格式化与目录生成\n\n> 数据全部本地处理，欢迎反馈。')
const theme = ref<WechatTheme>(WECHAT_THEMES[0])
const outWidth = ref(800)
const transparent = ref(false)
const busy = ref(false)
const renderBox = ref<HTMLElement | null>(null)
/** 卡片主题（rx4）：外层包装风格，与内容主题叠加 */
const cardStyle = ref<'plain' | 'grad-purple' | 'grad-sunset' | 'window'>('plain')
/** 密度（rx5） */
const density = ref(2)

const CARD_STYLES: Record<string, { label: string; wrap: (el: HTMLElement) => void }> = {
  plain: { label: '纯白卡片', wrap: () => {} },
  'grad-purple': {
    label: '渐变紫底',
    wrap: (el) => {
      el.style.background = 'linear-gradient(135deg, #6d5df6 0%, #9f7aea 50%, #d6b3ff 100%)'
      el.style.color = '#ffffff'
      el.style.borderRadius = '18px'
    },
  },
  'grad-sunset': {
    label: '渐变落日',
    wrap: (el) => {
      el.style.background = 'linear-gradient(160deg, #ff9966 0%, #ff5e62 55%, #ff2e63 100%)'
      el.style.color = '#ffffff'
      el.style.borderRadius = '18px'
    },
  },
  window: {
    label: '窗口框',
    wrap: (el) => {
      el.style.background = '#ffffff'
      el.style.border = '1px solid #d1d5db'
      el.style.borderRadius = '12px'
      el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)'
      el.style.paddingTop = '40px'
      el.style.position = 'relative'
      const bar = document.createElement('div')
      bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:28px;background:#e5e7eb;border-radius:12px 12px 0 0;display:flex;gap:6px;align-items:center;padding:0 12px'
      bar.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:#ff5f57"></span><span style="width:10px;height:10px;border-radius:50%;background:#febc2e"></span><span style="width:10px;height:10px;border-radius:50%;background:#28c840"></span>'
      el.prepend(bar)
    },
  },
}

/** 应用卡片包装（预览与导出共用）：先复位样式再套用风格 */
const applyCard = (el: HTMLElement) => {
  el.style.width = `${outWidth.value}px`
  el.style.background = 'transparent'
  el.style.color = ''
  el.style.border = 'none'
  el.style.borderRadius = '0'
  el.style.boxShadow = 'none'
  el.style.padding = '24px'
  el.style.paddingTop = '24px'
  el.style.position = 'relative'
  el.querySelectorAll('.win-bar').forEach((n) => n.remove())
}

/** 生成 PNG（渲染在屏外容器上） */
const render = async (): Promise<Blob> => {
  if (!input.value.trim()) throw new Error('请输入 Markdown 内容')
  const html = await mdToWechatHtml(input.value, theme.value)
  await nextTick()
  if (!renderBox.value) throw new Error('渲染容器未就绪')
  const { toBlob } = await import('html-to-image')
  const el = renderBox.value
  applyCard(el)
  el.innerHTML = html
  CARD_STYLES[cardStyle.value]!.wrap(el)
  el.style.background = transparent.value ? 'transparent' : el.style.background || '#ffffff'
  const blob = await toBlob(el, {
    width: outWidth.value,
    // 高度按内容自适应（跳过固定高度裁切）
    height: el.scrollHeight,
    pixelRatio: density.value,
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

/** 复制图片（rx3）：写剪贴板 image/png，聊天输入框可直接粘贴 */
const copyImage = async () => {
  busy.value = true
  try {
    const blob = await render()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.ok('图片已复制，可在聊天输入框 Ctrl+V 粘贴')
  } catch (e) {
    toast.err(`复制失败：${(e as Error).message}（可改用导出）`)
  } finally {
    busy.value = false
  }
}

/** 挂载即预览（rx1）：输入/主题/宽度/卡片风格变化 300ms 防抖刷新预览 */
let deb: { call: () => void; cancel: () => void } | null = null
const refreshPreview = async () => {
  if (!renderBox.value || !input.value.trim()) return
  const html = await mdToWechatHtml(input.value, theme.value)
  const el = renderBox.value
  applyCard(el)
  el.innerHTML = html
  CARD_STYLES[cardStyle.value]!.wrap(el)
}
onMounted(() => {
  deb = debounceRun(() => void refreshPreview(), 300)
  void refreshPreview()
})
onBeforeUnmount(() => deb?.cancel())
watch([input, theme, outWidth, cardStyle], () => deb?.call())
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
      <label class="opt">
        <span class="field-label">卡片风格</span>
        <select v-model="cardStyle" class="select" style="width: 130px">
          <option v-for="(v, k) in CARD_STYLES" :key="k" :value="k">{{ v.label }}</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">导出密度</span>
        <select v-model.number="density" class="select" style="width: 90px">
          <option :value="1">1x</option>
          <option :value="2">2x</option>
          <option :value="3">3x</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <ImageDown v-else :size="16" /> 导出长图
      </button>
      <button class="btn btn-ghost" :disabled="busy" @click="copyImage">
        <ClipboardCopy :size="16" /> 复制图片
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
  /* 弹性高度（rx2） */
  height: calc(100vh - 330px);
  min-height: 480px;
  max-height: 780px;
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
