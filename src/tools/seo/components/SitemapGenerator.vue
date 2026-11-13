<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, ExternalLink } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const urlText = ref(`https://example.com/
https://example.com/about
https://example.com/blog/post-1 0.8
https://example.com/products 0.9`)

const changefreq = ref('weekly')
const priority = ref('0.5')
const lastmod = ref('')

/** 每行一条：URL [priority] [YYYY-MM-DD]（行内空格分隔，可覆盖全局默认值） */
interface Entry {
  url: string
  priority: string
  lastmod: string
  valid: boolean
}

const FREQS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

// rx5 防抖：粘贴大列表时 200ms 合并解析，避免逐键全量重算
const parsedText = ref(urlText.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(urlText, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (parsedText.value = v), 200)
})

const parseDate = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '')

const entries = computed<Entry[]>(() =>
  parsedText.value
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/)
      let url = parts[0]
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      let p = priority.value
      let lm = lastmod.value
      // 行内可选参数：数字视为 priority，日期视为 lastmod，均覆盖全局值
      for (const part of parts.slice(1)) {
        if (/^\d(\.\d+)?$/.test(part)) p = part
        else {
          const d = parseDate(part)
          if (d) lm = d
        }
      }
      let valid = false
      try {
        const u = new URL(url)
        valid = (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname
      } catch {
        valid = false
      }
      return { url, priority: p, lastmod: lm, valid }
    }),
)

const validCount = computed(() => entries.value.filter((e) => e.valid).length)
const invalidCount = computed(() => entries.value.length - validCount.value)

// rx2 去重警示：同一 URL 出现多次时计数提示，XML 中仅输出一次
const dupCount = computed(() => {
  const seen = new Set<string>()
  let dup = 0
  for (const e of entries.value) {
    if (!e.valid) continue
    if (seen.has(e.url)) dup++
    else seen.add(e.url)
  }
  return dup
})

const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const xml = computed(() => {
  if (!validCount.value) return ''
  // rx2：重复 URL 仅输出第一次出现，符合 sitemap 协议唯一性要求
  const seen = new Set<string>()
  const urls = entries.value
    .filter((e) => e.valid && (seen.has(e.url) ? false : (seen.add(e.url), true)))
    .map((e) => {
      const inner = [`<loc>${escXml(e.url)}</loc>`]
      // rx4：行内日期优先，未提供时回退全局 lastmod
      if (e.lastmod) inner.push(`<lastmod>${e.lastmod}</lastmod>`)
      inner.push(`<changefreq>${changefreq.value}</changefreq>`)
      inner.push(`<priority>${e.priority}</priority>`)
      return `  <url>\n    ${inner.join('\n    ')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
})

// rx3 家族互链：取第一个有效 URL 的域名，带入 robots.txt 生成页
const firstDomain = computed(() => {
  const first = entries.value.find((e) => e.valid)
  if (!first) return ''
  try {
    return new URL(first.url).origin
  } catch {
    return ''
  }
})
const robotsLink = computed(() => {
  if (!firstDomain.value) return '/t/robots-txt-generator'
  return `/t/robots-txt-generator?sitemap=${encodeURIComponent(firstDomain.value + '/sitemap.xml')}`
})

const download = () => {
  if (!xml.value) {
    toast.warn('没有可用的 URL')
    return
  }
  saveText(xml.value, 'sitemap.xml', 'application/xml;charset=utf-8')
  toast.ok('sitemap.xml 已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      每行一个 URL；行内可加可选参数覆盖全局默认：<code>https://example.com 0.8</code>（priority）、<code>https://a.com 2026-01-01</code>（lastmod）。
      <br />
      本工具是「URL 列表 → sitemap」编译器，不会爬站；超过 5 万条 URL 需自行分片并用 sitemap index 汇总。
    </div>
    <div class="notice notice-warn mt-1">
      口径披露：Google 已声明忽略 <code>changefreq</code> 与 <code>priority</code>；<code>lastmod</code> 持续准确才有价值，请勿把全站标成同一天。
    </div>

    <textarea v-model="urlText" class="textarea mono mt-2" style="min-height: 160px" placeholder="https://example.com/&#10;https://example.com/about 0.8&#10;https://a.com/post 2026-01-01"></textarea>

    <div class="opts mt-2">
      <div>
        <label class="field-label">默认更新频率 changefreq <span class="ignored">（Google 已忽略）</span></label>
        <select v-model="changefreq" class="select">
          <option v-for="f in FREQS" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <div>
        <label class="field-label">默认优先级 priority（0–1）<span class="ignored">（Google 已忽略）</span></label>
        <input v-model="priority" class="input" placeholder="0.5" />
      </div>
      <div>
        <label class="field-label">全局 lastmod（可选，行内日期优先）</label>
        <input v-model="lastmod" type="date" class="input" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <span class="chip">共 {{ entries.length }} 条</span>
      <span class="chip">有效 {{ validCount }}</span>
      <span class="chip" :class="{ 'chip-bad': invalidCount > 0 }">无效 {{ invalidCount }}</span>
      <span v-if="dupCount > 0" class="chip chip-bad">重复 {{ dupCount }} 条</span>
    </div>
    <div v-if="invalidCount > 0" class="notice notice-warn mt-1">
      有 {{ invalidCount }} 条 URL 无法解析为合法地址（需含主机名），已自动跳过。
    </div>
    <div v-if="dupCount > 0" class="notice notice-warn mt-1">
      检测到 {{ dupCount }} 条重复 URL：sitemap 协议要求每个 URL 仅出现一次，输出时已自动去重（保留首次出现）。
    </div>

    <div v-if="firstDomain" class="family-link mt-2">
      <router-link :to="robotsLink" class="mini-link"><ExternalLink :size="13" /> 去 robots.txt 生成器登记本站 Sitemap（{{ firstDomain }}）</router-link>
    </div>

    <ResultBox class="mt-2" :model-value="xml" title="sitemap.xml 预览" :min-height="'220px'" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!xml" @click="download"><Download :size="16" /> 下载 sitemap.xml</button>
    </div>
    <p class="hint">生成后把文件上传到站点根目录（example.com/sitemap.xml），并在搜索控制台提交。</p>
  </div>
</template>

<style scoped>
.opts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 720px) {
  .opts { grid-template-columns: 1fr; }
}
.chip-bad { border-color: var(--err); color: var(--err); }
.ignored { font-size: 11px; color: var(--text-3); font-weight: 400; }
code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 4px;
}
.hint { font-size: 12px; color: var(--text-3); }
.family-link { display: flex; }
.mini-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--accent);
}
.mini-link:hover { text-decoration: underline; }
</style>
