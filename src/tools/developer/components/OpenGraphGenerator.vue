<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Share2, MessageCircle, Send, ExternalLink } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

const router = useRouter()
const ogTitle = ref('百宝工具箱：纯本地在线工具')
const ogDesc = ref('图片、PDF、开发者工具一站搞定，数据不出浏览器。')
const ogUrl = ref('https://example.com/')
const ogImage = ref('https://example.com/cover.png')
const ogType = ref('website')
const twitterCard = ref('summary_large_image')
const siteName = ref('ToolHub')
/** 补全字段（rx3）：留空不输出 */
const twSite = ref('')
const ogImageAlt = ref('')
const twImageAlt = ref('')
/** article 附加字段（rx4） */
const articleTime = ref('')
const articleAuthor = ref('')

/* 家族字段共享（rx6）：与 meta-tag-generator 双向同步 */
onMounted(() => {
  try {
    const shared = JSON.parse(localStorage.getItem('toolhub.seo-share') || 'null') as { title?: string; description?: string; from?: string } | null
    if (shared && shared.from !== 'og') {
      if (shared.title !== undefined) ogTitle.value = shared.title
      if (shared.description !== undefined) ogDesc.value = shared.description
    }
  } catch {
    /* 忽略损坏数据 */
  }
})
watch([ogTitle, ogDesc], () => {
  localStorage.setItem('toolhub.seo-share', JSON.stringify({ title: ogTitle.value, description: ogDesc.value, from: 'og' }))
})

/** og:image 校验（rx2）：非 http(s) 绝对地址黄条 */
const imageWarn = computed(() => !!ogImage.value.trim() && !/^https?:\/\//i.test(ogImage.value.trim()))

const lines = computed(() => {
  const esc = (s: string) => s.replace(/"/g, '&quot;')
  const out: string[] = ['<!-- Open Graph -->']
  if (ogTitle.value.trim()) out.push(`<meta property="og:title" content="${esc(ogTitle.value.trim())}">`)
  if (ogDesc.value.trim()) out.push(`<meta property="og:description" content="${esc(ogDesc.value.trim())}">`)
  if (ogUrl.value.trim()) out.push(`<meta property="og:url" content="${esc(ogUrl.value.trim())}">`)
  if (ogImage.value.trim()) out.push(`<meta property="og:image" content="${esc(ogImage.value.trim())}">`)
  if (ogImageAlt.value.trim()) out.push(`<meta property="og:image:alt" content="${esc(ogImageAlt.value.trim())}">`)
  out.push(`<meta property="og:type" content="${ogType.value}">`)
  if (ogType.value === 'article') {
    if (articleTime.value.trim()) out.push(`<meta property="og:article:published_time" content="${esc(articleTime.value.trim())}">`)
    if (articleAuthor.value.trim()) out.push(`<meta property="og:article:author" content="${esc(articleAuthor.value.trim())}">`)
  }
  if (siteName.value.trim()) out.push(`<meta property="og:site_name" content="${esc(siteName.value.trim())}">`)
  out.push('', '<!-- Twitter Card -->')
  out.push(`<meta name="twitter:card" content="${twitterCard.value}">`)
  if (ogTitle.value.trim()) out.push(`<meta name="twitter:title" content="${esc(ogTitle.value.trim())}">`)
  if (ogDesc.value.trim()) out.push(`<meta name="twitter:description" content="${esc(ogDesc.value.trim())}">`)
  if (ogImage.value.trim()) out.push(`<meta name="twitter:image" content="${esc(ogImage.value.trim())}">`)
  if (twImageAlt.value.trim()) out.push(`<meta name="twitter:image:alt" content="${esc(twImageAlt.value.trim())}">`)
  if (twSite.value.trim()) out.push(`<meta name="twitter:site" content="${esc(twSite.value.trim())}">`)
  return out
})

const html = computed(() => lines.value.join('\n'))

/** X 卡片模拟预览（rx1）：标题超长省略号截断；summary 切方形小图 */
const previewTitle = computed(() => ogTitle.value || '页面标题（未填写 og:title）')
const previewDesc = computed(() => ogDesc.value || '')
</script>

<template>
  <div class="og-gen">
    <div class="row row-wrap mb-2" style="gap: 10px">
      <button class="btn btn-ghost btn-sm" @click="router.push('/t/meta-tag-generator')">Meta 标签生成 →</button>
    </div>

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
        <p v-if="imageWarn" class="notice notice-warn small" style="margin: 6px 0 0">og:image 须为 http(s) 绝对地址且公开可访问（相对路径 / 非协议地址抓取器无法识别）。</p>
      </div>
      <div>
        <span class="field-label">og:image:alt 图片替代文本（可留空）</span>
        <input v-model="ogImageAlt" type="text" class="input" />
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
      <div>
        <span class="field-label">twitter:site（如 @toolhub，可留空）</span>
        <input v-model="twSite" type="text" class="input mono" />
      </div>
      <div>
        <span class="field-label">twitter:image:alt（可留空）</span>
        <input v-model="twImageAlt" type="text" class="input" />
      </div>
      <template v-if="ogType === 'article'">
        <div>
          <span class="field-label">发布时间（og:article:published_time）</span>
          <input v-model="articleTime" type="text" class="input mono" placeholder="2026-11-14T08:00:00+08:00" />
        </div>
        <div>
          <span class="field-label">作者（og:article:author）</span>
          <input v-model="articleAuthor" type="text" class="input" />
        </div>
      </template>
    </div>

    <!-- X 卡片模拟预览（rx1） -->
    <div class="mt-3">
      <span class="field-label">分享卡片模拟（{{ twitterCard === 'summary' ? '小图摘要' : '大图卡片' }}）</span>
      <div class="xcard" :class="twitterCard">
        <img v-if="ogImage.trim()" :src="ogImage" alt="分享封面预览" @error="($event.target as HTMLImageElement).style.display = 'none'" />
        <div class="xcard-body">
          <p class="xc-domain">{{ ogUrl.replace(/^https?:\/\//, '').split('/')[0] || 'example.com' }}</p>
          <p class="xc-title">{{ previewTitle }}</p>
          <p class="xc-desc">{{ previewDesc }}</p>
        </div>
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
        <b><Share2 :size="15" /> 调试器直达</b>
        <p>
          <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener noreferrer"><ExternalLink :size="12" style="vertical-align: -1px" /> Facebook Sharing Debugger</a>
          ｜
          <a href="https://cards-dev.twitter.com/validator" target="_blank" rel="noopener noreferrer"><ExternalLink :size="12" style="vertical-align: -1px" /> X Card Validator</a>
          <br />发布后用官方调试器强制重新抓取；og:image 必须是绝对地址且可公开访问（不能要求登录）。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* X 卡片模拟视图 */
.xcard {
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  max-width: 520px;
  background: var(--panel-solid);
  margin-top: 6px;
}
.xcard img {
  width: 100%;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  display: block;
  background: color-mix(in srgb, var(--border) 40%, transparent);
}
.xcard.summary {
  display: flex;
}
.xcard.summary img {
  width: 130px;
  height: 130px;
  aspect-ratio: 1 / 1;
  flex: none;
}
.xcard-body {
  padding: 10px 12px;
  min-width: 0;
}
.xc-domain {
  font-size: 12px;
  color: var(--text-3);
  margin: 0;
}
.xc-title {
  font-size: 14.5px;
  font-weight: 700;
  margin: 3px 0;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.xc-desc {
  font-size: 12.5px;
  color: var(--text-2);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
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
.tip-card a {
  color: var(--accent-text);
}
@media (max-width: 860px) {
  .tips {
    grid-template-columns: 1fr;
  }
}
</style>
