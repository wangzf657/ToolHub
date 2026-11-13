<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Copy, Check, ExternalLink } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const title = ref('ToolHub 在线工具箱 - 100+ 免费本地工具，无需上传')
const desc = ref('ToolHub 提供图片、PDF、音视频、开发与 AI 等一百多个免费在线工具，全部在你的浏览器本地运行，文件永不上传，安全又快速。')
const url = ref('https://example.com/tools/toolhub')
const device = ref<'desktop' | 'mobile' | 'baidu'>('desktop')
const copied = ref<'t' | 'd' | ''>('')

/** 中日韩全角字符按 2 个「英文字符当量」计 */
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff01-\uff60\u2018\u2019\u201c\u201d·—…]/g
const effStats = (s: string) => {
  const cn = (s.match(CJK) ?? []).length
  const other = [...s].length - cn
  return { cn, other, effLen: cn * 2 + other }
}

// rx2 像素口径：canvas measureText 按卡片实际字号测量（替代常数估算）
const measureEl = document.createElement('canvas').getContext('2d')
const measurePx = (s: string, fontSize: number, weight = '400') => {
  if (!measureEl) return 0
  measureEl.font = `${weight} ${fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif`
  return measureEl.measureText(s).width
}

const GOOGLE_TITLE_LIMIT = 60 // 有效长度（中文按 2 计）
const BAIDU_CN_TITLE_LIMIT = 30 // 百度移动端标题按 30 汉字判级

const titleStat = computed(() => {
  const eff = effStats(title.value)
  // 桌面 20px、移动 17px 单行宽度
  const px = device.value === 'desktop' ? measurePx(title.value, 20) : measurePx(title.value, 17, '500')
  return { ...eff, px }
})
const descStat = computed(() => {
  const eff = effStats(desc.value)
  const px = device.value === 'desktop' ? measurePx(desc.value, 14) : measurePx(desc.value, 13)
  return { ...eff, px }
})

const baiduCnCount = computed(() => (title.value.match(/[\u4e00-\u9fff]/g) ?? []).length)

// 各视图独立判级：Google 按 60 有效长度；百度移动按 30 汉字
const googleTitleState = computed(() => (titleStat.value.effLen > GOOGLE_TITLE_LIMIT ? 'over' : titleStat.value.effLen < 10 ? 'short' : 'ok'))
const baiduTitleState = computed(() => (baiduCnCount.value > BAIDU_CN_TITLE_LIMIT ? 'over' : 'ok'))
const descOk = computed(() => descStat.value.effLen <= 155 && descStat.value.effLen >= 50)

// rx4 站点名可编辑：默认取 URL hostname 去 www，用户手改后不再自动覆盖
const siteName = ref('')
const siteNameTouched = ref(false)
watch(url, (v) => {
  if (siteNameTouched.value) return
  try {
    siteName.value = new URL(v).hostname.replace(/^www\./, '')
  } catch {
    siteName.value = ''
  }
})
onMounted(() => {
  try {
    siteName.value = new URL(url.value).hostname.replace(/^www\./, '')
  } catch {
    siteName.value = ''
  }
  // rx5 字段共享：挂载时读取 meta-tag-generator 侧的最新 title/description
  try {
    const shared = JSON.parse(localStorage.getItem(SHARE_KEY) ?? 'null') as { title: string; desc: string; ts: number } | null
    if (shared && Date.now() - shared.ts < 1000 * 60 * 60 * 24) {
      if (shared.title) title.value = shared.title
      if (shared.desc) desc.value = shared.desc
    }
  } catch {
    /* 忽略损坏数据 */
  }
})

// rx5 字段共享：与 meta-tag-generator 双向同步（localStorage 广播，双方读写同键）
const SHARE_KEY = 'toolhub.seo.meta-sync'
watch([title, desc], ([t, d]) => {
  try {
    localStorage.setItem(SHARE_KEY, JSON.stringify({ title: t, desc: d, ts: Date.now() }))
  } catch {
    /* 隐私模式等场景写失败可忽略 */
  }
})

const doCopy = async (which: 't' | 'd') => {
  const text = which === 't' ? title.value : desc.value
  if (!text) return
  if (await copyText(text)) {
    copied.value = which
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copied.value = ''), 1500)
  } else {
    toast.err('复制失败')
  }
}

// rx6 清空示例：恢复空表单
const resetAll = () => {
  title.value = ''
  desc.value = ''
  url.value = ''
  siteName.value = ''
  siteNameTouched.value = false
}

/** URL 面包屑化：域名 › 一级目录 › 二级目录 */
const crumbs = computed(() => {
  if (!url.value.trim()) return ['示例站点 › 当前页面']
  try {
    const u = new URL(url.value)
    const parts = u.pathname.split('/').filter(Boolean)
    const labels = parts.map((p) => decodeURIComponent(p).replace(/[-_]+/g, ' '))
    return [siteName.value || u.hostname.replace(/^www\./, ''), ...labels]
  } catch {
    return [url.value.trim() || 'example.com']
  }
})
</script>

<template>
  <div>
    <div class="row row-wrap sync-bar">
      <router-link class="mini-link" to="/t/meta-tag-generator"><ExternalLink :size="13" /> 去 Meta 标签生成器同步编辑（title/description 双向共享）</router-link>
      <button class="btn btn-ghost btn-sm" @click="resetAll">清空示例</button>
    </div>

    <div class="form mt-2">
      <div>
        <div class="row">
          <label class="field-label">页面标题（Title）</label>
          <button class="mini-copy" title="复制标题" @click="doCopy('t')"><Check v-if="copied === 't'" :size="13" color="#34d399" /><Copy v-else :size="13" /></button>
        </div>
        <input v-model="title" class="input" maxlength="200" />
        <p class="stat" :class="{ warn: googleTitleState !== 'ok', bad: googleTitleState === 'over' }">
          {{ title.length }} 字符 / 有效长度 {{ titleStat.effLen }}/60 · 实测像素 {{ Math.round(titleStat.px) }}px
          <span v-if="googleTitleState === 'over'">（Google 口径超长，会截断）</span>
          <span v-else-if="googleTitleState === 'short'">（太短，浪费展示空间）</span>
          <span v-else>✓ 合适</span>
        </p>
        <p class="stat" :class="{ bad: baiduTitleState === 'over' }">
          百度移动口径：{{ baiduCnCount }} 汉字/30
          <span v-if="baiduTitleState === 'over'">（超长，百度会截断）</span>
          <span v-else>✓ 合适</span>
        </p>
      </div>
      <div>
        <div class="row">
          <label class="field-label">页面描述（Meta Description）</label>
          <button class="mini-copy" title="复制描述" @click="doCopy('d')"><Check v-if="copied === 'd'" :size="13" color="#34d399" /><Copy v-else :size="13" /></button>
        </div>
        <textarea v-model="desc" class="textarea" rows="3"></textarea>
        <p class="stat" :class="{ warn: !descOk }">
          {{ desc.length }} 字符 / 有效长度 {{ descStat.effLen }}/155 · 实测像素 {{ Math.round(descStat.px) }}px
          <span v-if="descStat.effLen > 155">（超长，会被省略号截断）</span>
          <span v-else-if="descStat.effLen < 50">（偏短，建议补足卖点）</span>
          <span v-else>✓ 合适</span>
        </p>
      </div>
      <div class="grid-2">
        <div>
          <label class="field-label">页面 URL</label>
          <input v-model="url" class="input" placeholder="https://example.com/path" />
        </div>
        <div>
          <label class="field-label">站点名（默认取 URL 域名）</label>
          <input v-model="siteName" class="input" placeholder="如 百宝工具箱" @input="siteNameTouched = true" />
        </div>
      </div>
    </div>

    <div class="row row-wrap mt-2 mb-2">
      <button class="chip" :class="{ active: device === 'desktop' }" @click="device = 'desktop'">Google 桌面</button>
      <button class="chip" :class="{ active: device === 'mobile' }" @click="device = 'mobile'">Google 移动</button>
      <button class="chip" :class="{ active: device === 'baidu' }" @click="device = 'baidu'">百度移动</button>
    </div>

    <!-- Google 桌面端 -->
    <div v-if="device === 'desktop'" class="serp desktop">
      <div class="serp-inner">
        <div class="site-row">
          <span class="favicon"><Search :size="14" /></span>
          <div class="site-col">
            <span class="site-name">{{ siteName || '网站名称' }}</span>
            <span class="crumbs">{{ crumbs.join(' › ') }}</span>
          </div>
        </div>
        <h3 class="d-title" :class="{ 'over-cut': googleTitleState === 'over' }">{{ title || '（请填写标题）' }}</h3>
        <p class="d-desc">{{ desc || '（请填写描述）' }}</p>
      </div>
    </div>

    <!-- Google 移动端 -->
    <div v-else-if="device === 'mobile'" class="serp mobile">
      <div class="serp-inner">
        <div class="m-site">
          <span class="favicon"><Search :size="12" /></span>
          <span class="site-name">{{ siteName || crumbs[0] }}</span>
        </div>
        <h3 class="m-title" :class="{ 'over-cut': googleTitleState === 'over' }">{{ title || '（请填写标题）' }}</h3>
        <p class="m-desc">{{ desc || '（请填写描述）' }}</p>
      </div>
    </div>

    <!-- 百度移动端：标题 20px 蓝色不加粗、描述 13px、来源行右侧 -->
    <div v-else class="serp baidu">
      <div class="serp-inner">
        <h3 class="b-title" :class="{ 'over-cut': baiduTitleState === 'over' }">{{ title || '（请填写标题）' }}</h3>
        <p class="b-desc">{{ desc || '（请填写描述）' }}</p>
        <div class="b-site">
          <span class="b-fav"><Search :size="11" /></span>
          <span>{{ siteName || crumbs[0] }}</span>
          <span class="b-crumbs">{{ crumbs.slice(1).join('/') }}</span>
        </div>
      </div>
    </div>

    <p class="hint mt-2">
      估算口径：标题/描述像素用 canvas measureText 按卡片实际字号（桌面标题 20px、移动 17px）测量；
      Google 标题上限按有效长度 60（中文=2 英文），百度移动标题按 30 汉字，两套口径独立判级。
      真实截断以搜索引擎实际渲染为准。
    </p>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 12px; }
.sync-bar { justify-content: space-between; align-items: center; }
.mini-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--accent); }
.mini-link:hover { text-decoration: underline; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { display: flex; flex-wrap: wrap; }
.mini-copy {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-copy:hover { border-color: var(--accent); color: var(--text-1); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.stat { margin: 5px 2px 0; font-size: 12px; color: var(--text-3); }
.stat.warn { color: #d97706; }
.stat.bad { color: var(--err); }

/* ---------- 搜索结果卡 ---------- */
.serp { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
.serp.desktop, .serp.mobile, .serp.baidu { background: #ffffff; }
.serp.desktop .serp-inner { padding: 22px 28px; }
.serp.mobile .serp-inner { padding: 14px 16px; }
.serp.baidu .serp-inner { padding: 14px 16px; background: #ffffff; }
.favicon { width: 26px; height: 26px; border-radius: 999px; background: #e8eaed; display: grid; place-items: center; color: #5f6368; flex: none; }
.site-row { display: flex; align-items: center; gap: 10px; }
.site-col { display: flex; flex-direction: column; line-height: 1.3; }
.site-name { font-size: 14px; color: #202124; }
.crumbs { font-size: 12.5px; color: #4d5156; }
.d-title { margin: 8px 0 4px; font-size: 20px; line-height: 1.3; color: #1a0dab; font-weight: 400; word-break: break-all; }
.d-title:hover { text-decoration: underline; cursor: pointer; }
.d-desc { margin: 0; font-size: 14px; line-height: 1.58; color: #4d5156; word-break: break-all; }
.m-site { display: flex; align-items: center; gap: 8px; }
.m-site .favicon { width: 22px; height: 22px; }
.m-site .site-name { font-size: 13px; color: #202124; }
.m-title { margin: 8px 0 4px; font-size: 17px; line-height: 1.35; color: #1a0dab; font-weight: 500; word-break: break-all; }
.m-desc { margin: 0; font-size: 13px; line-height: 1.5; color: #4d5156; word-break: break-all; }
.over-cut { text-decoration: line-through rgba(234, 67, 53, 0.75); text-decoration-thickness: 2px; }
/* 百度移动样式 */
.b-title { margin: 0 0 6px; font-size: 20px; line-height: 1.35; color: #2440b3; font-weight: 400; word-break: break-all; }
.b-desc { margin: 0 0 10px; font-size: 13px; line-height: 1.55; color: #333; word-break: break-all; }
.b-site { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #626a93; }
.b-fav { width: 16px; height: 16px; border-radius: 4px; background: #f1f3fa; display: grid; place-items: center; color: #626a93; }
.b-crumbs { color: #9ba0b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
