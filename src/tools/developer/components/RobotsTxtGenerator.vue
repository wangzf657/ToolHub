<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bot, Download, Plus, X } from 'lucide-vue-next'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const route = useRoute()
const policy = ref<'allow-all' | 'deny-all'>('allow-all')
const crawlDelay = ref('0')
/** Crawl-delay 挂到哪个 UA 组（rx4） */
const crawlDelayUa = ref('*')
const sitemap = ref('')
const rules = ref<{ ua: string; kind: 'allow' | 'disallow'; path: string }[]>([
  { ua: '*', kind: 'disallow', path: '/admin/' },
  { ua: '*', kind: 'disallow', path: '/private/' },
])

const addRule = () => rules.value.push({ ua: '*', kind: 'disallow', path: '/' })
const removeRule = (i: number) => rules.value.splice(i, 1)

/** 组段合并（rx2）：同 UA 规则并成一个组段；* 策略组与具名组分开呈现 */
const groups = computed(() => {
  const map = new Map<string, { kind: 'allow' | 'disallow'; path: string }[]>()
  const ensure = (ua: string) => {
    let g = map.get(ua)
    if (!g) {
      g = []
      map.set(ua, g)
    }
    return g
  }
  ensure('*').push({ kind: policy.value === 'deny-all' ? 'disallow' : 'allow', path: policy.value === 'deny-all' ? '/' : '' })
  for (const r of rules.value) {
    const ua = r.ua.trim() || '*'
    ensure(ua).push({ kind: r.kind, path: r.path.trim() || '/' })
  }
  return [...map.entries()]
})

/** 爬虫预设库（rx1）：UA datalist 候选 + 一键注入 AI 爬虫组段 */
const UA_PRESETS = ['*', 'Googlebot', 'Baiduspider', 'Bingbot', 'YandexBot', 'GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'Google-Extended']
const BLOCK_AI = ['GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'Google-Extended']
const blockAi = () => {
  for (const ua of BLOCK_AI) {
    const exists = rules.value.some((r) => r.ua.trim() === ua && r.kind === 'disallow' && r.path.trim() === '/')
    if (!exists) rules.value.push({ ua, kind: 'disallow', path: '/' })
  }
  toast.ok('已注入 5 组 AI 爬虫屏蔽规则')
}

/** 路径语法提示（rx3）：含空格或非 ASCII 时建议 URL 编码 */
const badPaths = computed(() =>
  rules.value
    .filter((r) => /[\s\u0080-\uffff]/.test(r.path) && r.path.trim())
    .map((r) => `${r.ua || '*'}: ${r.path}`),
)

/** 全部 UA（供 Crawl-delay 挂载选择） */
const allUas = computed(() => groups.value.map(([ua]) => ua))

const text = computed(() => {
  const out: string[] = []
  for (const [ua, rs] of groups.value) {
    out.push(`User-agent: ${ua}`)
    for (const r of rs) out.push(`${r.kind === 'allow' ? 'Allow' : 'Disallow'}: ${r.path}`)
    if (ua === crawlDelayUa.value && Number(crawlDelay.value) > 0) out.push(`Crawl-delay: ${Number(crawlDelay.value)}`)
  }
  // 挂载的 UA 不在组内（自定义输入）：单独成组
  if (Number(crawlDelay.value) > 0 && !allUas.value.includes(crawlDelayUa.value)) {
    out.push('', `User-agent: ${crawlDelayUa.value}`, `Crawl-delay: ${Number(crawlDelay.value)}`)
  }
  for (const s of sitemap.value.split('\n').map((l) => l.trim()).filter(Boolean)) {
    out.push('', `Sitemap: ${s}`)
  }
  return out.join('\n')
})

const addPreset = (kind: 'block-dir' | 'allow-dir') => {
  rules.value.push({ ua: '*', kind: kind === 'block-dir' ? 'disallow' : 'allow', path: kind === 'block-dir' ? '/目录/' : '/公开目录/' })
}

/** 家族互链（rx6）：站点域名转给 sitemap 生成器 */
const goSitemap = () => {
  const domain = sitemap.value.trim().match(/^https?:\/\/([^/]+)/i)?.[1] ?? ''
  if (domain) sessionStorage.setItem('toolhub.transfer.sitemap-generator', JSON.stringify({ domain }))
  router.push('/t/sitemap-generator')
}

/** 互链契约接收端：SitemapGenerator 跳转带 ?sitemap=<url>（vue-router 已自动解码），预填并提示来源 */
const sitemapFromQuery = ref('')
onMounted(() => {
  const q = route.query.sitemap
  if (typeof q !== 'string' || !q.trim()) return
  const url = q.trim()
  const lines = sitemap.value.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.includes(url)) sitemap.value = [...lines, url].join('\n')
  sitemapFromQuery.value = url
  toast.ok('已带入 Sitemap 生成器传入的地址')
})
</script>

<template>
  <div class="robots-gen">
    <div class="row row-wrap" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">默认策略</span>
      <select v-model="policy" class="select" style="width: 190px">
        <option value="allow-all">允许全部抓取</option>
        <option value="deny-all">禁止全部抓取</option>
      </select>
      <span class="field-label" style="margin: 0">Crawl-delay（秒，0 为不设置）</span>
      <input v-model="crawlDelay" type="number" min="0" max="60" class="input mono" style="width: 90px" />
      <span class="field-label" style="margin: 0">挂载 UA</span>
      <select v-model="crawlDelayUa" class="select" style="width: 170px">
        <option v-for="ua in allUas" :key="ua" :value="ua">{{ ua }}</option>
        <option v-if="!allUas.includes(crawlDelayUa)" :value="crawlDelayUa">{{ crawlDelayUa }}（自定义）</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="blockAi"><Bot :size="14" /> 屏蔽 AI 爬虫</button>
    </div>

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 8px">
        <span class="field-label" style="margin: 0"><Bot :size="14" style="vertical-align: -2px" /> 自定义规则（同 UA 自动合并为一个组段）</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="addPreset('block-dir')"><Plus :size="13" /> 禁止目录</button>
        <button class="btn btn-ghost btn-sm" @click="addPreset('allow-dir')"><Plus :size="13" /> 允许目录</button>
      </div>

      <div v-for="(r, i) in rules" :key="i" class="rule-row">
        <input v-model="r.ua" type="text" class="input mono" style="width: 160px" placeholder="User-agent" title="User-agent" list="ua-presets" />
        <select v-model="r.kind" class="select" style="width: 120px">
          <option value="disallow">Disallow</option>
          <option value="allow">Allow</option>
        </select>
        <input v-model="r.path" type="text" class="input mono grow" placeholder="/路径/" spellcheck="false" />
        <button class="del-btn" title="删除" aria-label="删除" @click="removeRule(i)"><X :size="14" /></button>
      </div>
      <datalist id="ua-presets">
        <option v-for="ua in UA_PRESETS" :key="ua" :value="ua"></option>
      </datalist>
      <button class="btn btn-soft btn-sm mt-1" @click="addRule"><Plus :size="13" /> 添加规则行</button>
    </div>

    <div v-if="badPaths.length" class="notice notice-warn mt-2 small">
      <span v-for="p in badPaths" :key="p" style="display: block">路径「{{ p }}」含空格或非 ASCII 字符，建议先做 URL 编码（如 <code class="mono">/目录/</code> → <code class="mono">/%E7%9B%AE%E5%BD%95/</code>）。</span>
    </div>

    <div class="mt-2">
      <span class="field-label">Sitemap 地址（每行一条，可多条）</span>
      <textarea v-model="sitemap" class="textarea mono" style="min-height: 56px" placeholder="https://example.com/sitemap.xml"></textarea>
      <p v-if="sitemapFromQuery" class="notice notice-info small" style="margin-top: 6px">
        已带入 Sitemap 生成器传入的地址：{{ sitemapFromQuery }}（可继续编辑或删除）。
      </p>
    </div>

    <ResultBox v-model="text" title="robots.txt 预览" min-height="220px" class="mt-3" />

    <div class="row mt-2 row-wrap">
      <button class="btn btn-primary btn-sm" @click="saveText(text + '\n', 'robots.txt'); toast.ok('已下载 robots.txt')">
        <Download :size="14" /> 下载 robots.txt
      </button>
      <button class="btn btn-ghost btn-sm" @click="goSitemap">去生成 sitemap.xml →</button>
    </div>

    <p class="notice notice-info mt-2 small">
      提示：Disallow 只对遵守协议的爬虫生效，敏感目录请配合鉴权；Crawl-delay 部分引擎（如 Google）已忽略。「屏蔽 AI 爬虫」注入 GPTBot / ClaudeBot / CCBot / Bytespider / Google-Extended 五组 Disallow 规则。
    </p>
  </div>
</template>

<style scoped>
.rule-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.del-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 8px;
  width: 34px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.del-btn:hover {
  color: var(--err);
  border-color: var(--err);
}
</style>
