<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'

const title = ref('ToolHub 在线工具箱 - 100+ 免费本地工具，无需上传')
const desc = ref('ToolHub 提供图片、PDF、音视频、开发与 AI 等一百多个免费在线工具，全部在你的浏览器本地运行，文件永不上传，安全又快速。')
const url = ref('https://example.com/tools/toolhub')
const device = ref<'desktop' | 'mobile'>('desktop')

/** 中日韩全角字符按 2 个「英文字符当量」计 */
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff01-\uff60\u2018\u2019\u201c\u201d·—…]/g
const stats = (s: string) => {
  const cn = (s.match(CJK) ?? []).length
  const other = [...s].length - cn
  return { cn, other, effLen: cn * 2 + other, px: cn * 12 + other * 6.2 }
}

const titleStat = computed(() => stats(title.value))
const descStat = computed(() => stats(desc.value))

const titleOk = computed(() => titleStat.value.effLen <= 60 && titleStat.value.effLen >= 10)
const descOk = computed(() => descStat.value.effLen <= 155 && descStat.value.effLen >= 50)

/** URL 面包屑化：域名 › 一级目录 › 二级目录 */
const crumbs = computed(() => {
  try {
    const u = new URL(url.value)
    const parts = u.pathname.split('/').filter(Boolean)
    const labels = parts.map((p) => decodeURIComponent(p).replace(/[-_]+/g, ' '))
    return [u.hostname.replace(/^www\./, ''), ...labels]
  } catch {
    return [url.value.trim() || 'example.com']
  }
})
</script>

<template>
  <div>
    <div class="form">
      <div>
        <label class="field-label">页面标题（Title）</label>
        <input v-model="title" class="input" maxlength="200" />
        <p class="stat" :class="{ bad: !titleOk, warn: !titleOk }">
          {{ title.length }} 字符 / 有效长度 {{ titleStat.effLen }}/60 · 估算像素 {{ Math.round(titleStat.px) }}px
          <span v-if="titleStat.effLen > 60">（超长，Google 会截断）</span>
          <span v-else-if="titleStat.effLen < 10">（太短，浪费展示空间）</span>
          <span v-else>✓ 合适</span>
        </p>
      </div>
      <div>
        <label class="field-label">页面描述（Meta Description）</label>
        <textarea v-model="desc" class="textarea" rows="3"></textarea>
        <p class="stat" :class="{ warn: !descOk }">
          {{ desc.length }} 字符 / 有效长度 {{ descStat.effLen }}/155 · 估算像素 {{ Math.round(descStat.px) }}px
          <span v-if="descStat.effLen > 155">（超长，会被省略号截断）</span>
          <span v-else-if="descStat.effLen < 50">（偏短，建议补足卖点）</span>
          <span v-else>✓ 合适</span>
        </p>
      </div>
      <div>
        <label class="field-label">页面 URL</label>
        <input v-model="url" class="input" placeholder="https://example.com/path" />
      </div>
    </div>

    <div class="row row-wrap mt-2 mb-2">
      <button class="chip" :class="{ active: device === 'desktop' }" @click="device = 'desktop'">桌面端预览</button>
      <button class="chip" :class="{ active: device === 'mobile' }" @click="device = 'mobile'">移动端预览</button>
    </div>

    <!-- 桌面端 -->
    <div v-if="device === 'desktop'" class="serp desktop">
      <div class="serp-inner">
        <div class="site-row">
          <span class="favicon"><Search :size="14" /></span>
          <div class="site-col">
            <span class="site-name">网站名称</span>
            <span class="crumbs">{{ crumbs.join(' › ') }}</span>
          </div>
        </div>
        <h3 class="d-title">{{ title || '（请填写标题）' }}</h3>
        <p class="d-desc">{{ desc || '（请填写描述）' }}</p>
      </div>
    </div>

    <!-- 移动端 -->
    <div v-else class="serp mobile">
      <div class="serp-inner">
        <div class="m-site">
          <span class="favicon"><Search :size="12" /></span>
          <span class="site-name">{{ crumbs[0] }}</span>
        </div>
        <h3 class="m-title">{{ title || '（请填写标题）' }}</h3>
        <p class="m-desc">{{ desc || '（请填写描述）' }}</p>
      </div>
    </div>

    <p class="hint mt-2">
      估算口径：中文/全角字符按 12px 宽、英文半角按 6.2px 宽近似；有效长度按「中文 = 2 英文」折算
      （标题上限约 30 个中文字符，描述约 78 个）。真实截断以 Google 实际渲染为准。
    </p>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 12px; }
.stat { margin: 5px 2px 0; font-size: 12px; color: var(--text-3); }
.stat.warn { color: #d97706; }
.stat.bad { color: var(--err); }

/* ---------- 桌面端搜索结果卡 ---------- */
.serp {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.serp.desktop { background: #ffffff; }
.serp.desktop .serp-inner { padding: 22px 28px; }
.favicon {
  width: 26px; height: 26px; border-radius: 999px; background: #e8eaed;
  display: grid; place-items: center; color: #5f6368; flex: none;
}
.site-row { display: flex; align-items: center; gap: 10px; }
.site-col { display: flex; flex-direction: column; line-height: 1.3; }
.site-name { font-size: 14px; color: #202124; }
.crumbs { font-size: 12.5px; color: #4d5156; }
.d-title {
  margin: 8px 0 4px;
  font-size: 20px;
  line-height: 1.3;
  color: #1a0dab;
  font-weight: 400;
  word-break: break-all;
}
.d-title:hover { text-decoration: underline; cursor: pointer; }
.d-desc { margin: 0; font-size: 14px; line-height: 1.58; color: #4d5156; word-break: break-all; }

/* ---------- 移动端 ---------- */
.serp.mobile { background: #ffffff; }
.serp.mobile .serp-inner { padding: 14px 16px; }
.m-site { display: flex; align-items: center; gap: 8px; }
.m-site .favicon { width: 22px; height: 22px; }
.m-site .site-name { font-size: 13px; color: #202124; }
.m-title { margin: 8px 0 4px; font-size: 17px; line-height: 1.35; color: #1a0dab; font-weight: 500; word-break: break-all; }
.m-desc { margin: 0; font-size: 13px; line-height: 1.5; color: #4d5156; word-break: break-all; }

.hint { font-size: 12px; color: var(--text-3); }
</style>
