<script setup lang="ts">
import { computed, ref } from 'vue'
import { Share2, MessageCircle, Send } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const ogTitle = ref('百宝工具箱：纯本地在线工具')
const ogDesc = ref('图片、PDF、开发者工具一站搞定，数据不出浏览器。')
const ogUrl = ref('https://example.com/')
const ogImage = ref('https://example.com/cover.png')
const ogType = ref('website')
const twitterCard = ref('summary_large_image')
const siteName = ref('ToolHub')

const lines = computed(() => {
  const esc = (s: string) => s.replace(/"/g, '&quot;')
  const out: string[] = ['<!-- Open Graph -->']
  if (ogTitle.value.trim()) out.push(`<meta property="og:title" content="${esc(ogTitle.value.trim())}">`)
  if (ogDesc.value.trim()) out.push(`<meta property="og:description" content="${esc(ogDesc.value.trim())}">`)
  if (ogUrl.value.trim()) out.push(`<meta property="og:url" content="${esc(ogUrl.value.trim())}">`)
  if (ogImage.value.trim()) out.push(`<meta property="og:image" content="${esc(ogImage.value.trim())}">`)
  out.push(`<meta property="og:type" content="${ogType.value}">`)
  if (siteName.value.trim()) out.push(`<meta property="og:site_name" content="${esc(siteName.value.trim())}">`)
  out.push('', '<!-- Twitter Card -->')
  out.push(`<meta name="twitter:card" content="${twitterCard.value}">`)
  if (ogTitle.value.trim()) out.push(`<meta name="twitter:title" content="${esc(ogTitle.value.trim())}">`)
  if (ogDesc.value.trim()) out.push(`<meta name="twitter:description" content="${esc(ogDesc.value.trim())}">`)
  if (ogImage.value.trim()) out.push(`<meta name="twitter:image" content="${esc(ogImage.value.trim())}">`)
  return out
})

const html = computed(() => lines.value.join('\n'))
</script>

<template>
  <div class="og-gen">
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">og:title 分享标题</span>
        <input v-model="ogTitle" type="text" class="input" />
      </div>
      <div>
        <span class="field-label">og:site_name 站点名</span>
        <input v-model="siteName" type="text" class="input" />
      </div>
      <div>
        <span class="field-label">og:description 分享描述</span>
        <input v-model="ogDesc" type="text" class="input" />
      </div>
      <div>
        <span class="field-label">og:url 页面地址</span>
        <input v-model="ogUrl" type="text" class="input mono" />
      </div>
      <div>
        <span class="field-label">og:image 分享封面图（建议 1200×630）</span>
        <input v-model="ogImage" type="text" class="input mono" />
      </div>
      <div>
        <span class="field-label">og:type 类型</span>
        <select v-model="ogType" class="select">
          <option value="website">website 网站</option>
          <option value="article">article 文章</option>
          <option value="product">product 商品</option>
          <option value="video.other">video 视频</option>
        </select>
      </div>
      <div>
        <span class="field-label">twitter:card 卡片样式</span>
        <select v-model="twitterCard" class="select">
          <option value="summary_large_image">大图卡片</option>
          <option value="summary">小图摘要</option>
        </select>
      </div>
    </div>

    <ResultBox v-model="html" title="OG / Twitter 标签代码" download="html" min-height="230px" class="mt-3" />

    <div class="mt-3 tips">
      <div class="tip-card">
        <b><MessageCircle :size="15" /> 微信分享</b>
        <p>微信主要读取 og:title、og:description 与 og:image（部分场景使用 JSSDK 配置）。封面图建议小于 300KB 的正方形或 5:4 比例，过大图会被忽略。</p>
      </div>
      <div class="tip-card">
        <b><Send :size="15" /> Telegram / X（Twitter）</b>
        <p>Telegram 完整支持 og: 标签，抓取后展示大图卡片；X 读取 twitter:card，summary_large_image 显示 2:1 大图，若缺失会回退 og: 标签。</p>
      </div>
      <div class="tip-card">
        <b><Share2 :size="15" /> 调试建议</b>
        <p>发布后可用各平台官方调试器强制重新抓取；og:image 必须是绝对地址且可公开访问（不能要求登录）。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.tip-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
}
.tip-card b {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  margin-bottom: 6px;
  font-size: 13.5px;
}
.tip-card p {
  margin: 0;
}
@media (max-width: 860px) {
  .tips {
    grid-template-columns: 1fr;
  }
}
</style>
