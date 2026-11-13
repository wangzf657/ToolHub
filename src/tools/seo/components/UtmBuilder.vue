<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Download, QrCode, History, Trash2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { copyText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const baseUrl = ref('https://example.com/landing')
const source = ref('wechat')
const medium = ref('social')
const campaign = ref('spring-sale')
const term = ref('')
const content = ref('banner-top')

const MEDIUMS = [
  { v: 'cpc', label: 'cpc 付费点击' },
  { v: 'email', label: 'email 邮件' },
  { v: 'social', label: 'social 社交' },
  { v: 'banner', label: 'banner 横幅' },
]

// rx3 source 预设：常用流量来源（datalist）
const SOURCES = ['google', 'baidu', 'bing', 'wechat', 'weibo', 'xiaohongshu', 'douyin', 'zhihu', 'email', 'newsletter', 'direct']

const setMedium = (m: string) => (medium.value = m)

/** 用 URLSearchParams 保证中文与特殊字符正确编码 */
const builtUrl = computed(() => {
  const base = baseUrl.value.trim()
  if (!base) return ''
  try {
    const u = new URL(base)
    const sp = u.searchParams
    if (source.value.trim()) sp.set('utm_source', source.value.trim())
    if (medium.value.trim()) sp.set('utm_medium', medium.value.trim())
    if (campaign.value.trim()) sp.set('utm_campaign', campaign.value.trim())
    if (term.value.trim()) sp.set('utm_term', term.value.trim())
    if (content.value.trim()) sp.set('utm_content', content.value.trim())
    u.search = sp.toString()
    return u.toString()
  } catch {
    return ''
  }
})
const validBase = computed(() => !!builtUrl.value)

// rx1 覆盖警示：原 URL 已带 utm_* 参数时提示将被覆盖的键与现值
const overriddenKeys = computed(() => {
  try {
    const u = new URL(baseUrl.value.trim())
    return [...u.searchParams.keys()]
      .filter((k) => k.toLowerCase().startsWith('utm_'))
      .map((k) => `${k}=${u.searchParams.get(k)}`)
  } catch {
    return []
  }
})

// rx5 命名规范提示：utm 值含大写或空格时建议小写连字符
const badStyleFields = computed(() =>
  [
    { key: 'utm_source', v: source.value },
    { key: 'utm_medium', v: medium.value },
    { key: 'utm_campaign', v: campaign.value },
    { key: 'utm_term', v: term.value },
    { key: 'utm_content', v: content.value },
  ].filter((f) => /[A-Z\s]/.test(f.v.trim())),
)

/* ---------- rx2 历史记录（localStorage，最近 10 条） ---------- */
interface HistItem {
  baseUrl: string
  source: string
  medium: string
  campaign: string
  term: string
  content: string
  url: string
  ts: number
}
const HIST_KEY = 'toolhub.utm.history'
const history = ref<HistItem[]>([])
const loadHist = () => {
  try {
    history.value = JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]') as HistItem[]
  } catch {
    history.value = []
  }
}
const saveHist = () => {
  const snap: HistItem = {
    baseUrl: baseUrl.value,
    source: source.value,
    medium: medium.value,
    campaign: campaign.value,
    term: term.value,
    content: content.value,
    url: builtUrl.value,
    ts: Date.now(),
  }
  history.value = [snap, ...history.value.filter((h) => h.url !== snap.url)].slice(0, 10)
  localStorage.setItem(HIST_KEY, JSON.stringify(history.value))
}
const restore = (h: HistItem) => {
  baseUrl.value = h.baseUrl
  source.value = h.source
  medium.value = h.medium
  campaign.value = h.campaign
  term.value = h.term
  content.value = h.content
  toast.ok('已回填该条历史参数')
}
const clearHist = () => {
  history.value = []
  localStorage.removeItem(HIST_KEY)
}
onMounted(loadHist)

const copyUrl = async () => {
  if (!builtUrl.value) return
  const okFlag = await copyText(builtUrl.value)
  if (okFlag) {
    saveHist()
    toast.ok('已复制到剪贴板')
  } else {
    toast.err('复制失败')
  }
}

/* ---------- 二维码（动态导入 qrEngine） ---------- */
const qrBox = ref<HTMLDivElement | null>(null)
const qrBusy = ref(false)

const genQr = async () => {
  if (!builtUrl.value) {
    toast.warn('请先填写合法的基础 URL')
    return
  }
  qrBusy.value = true
  try {
    const { makeQrCanvas } = await import('@/lib/qrEngine')
    const canvas = await makeQrCanvas(builtUrl.value, { size: 240, margin: 2, dark: '#111827' })
    canvas.style.borderRadius = '10px'
    qrBox.value?.replaceChildren(canvas)
  } catch {
    toast.err('二维码生成失败')
  } finally {
    qrBusy.value = false
  }
}

// rx4 二维码自动刷新：参数变化 500ms 后自动重生成（保留手动按钮兜底）
let qrTimer: ReturnType<typeof setTimeout> | undefined
watch(builtUrl, (v) => {
  if (!v) return
  clearTimeout(qrTimer)
  qrTimer = setTimeout(() => void genQr(), 500)
})
onMounted(() => {
  if (builtUrl.value) void genQr()
})

const dlQr = () => {
  const canvas = qrBox.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先生成二维码')
    return
  }
  saveHist()
  canvas.toBlob((blob) => {
    if (blob) saveBlob(blob, 'utm-二维码.png')
  }, 'image/png')
}
</script>

<template>
  <div>
    <div class="form">
      <div>
        <label class="field-label">基础 URL *</label>
        <input v-model="baseUrl" class="input" :class="{ invalid: baseUrl && !validBase }" placeholder="https://example.com/landing" />
        <p v-if="baseUrl && !validBase" class="field-err">URL 无法解析，需以 http(s):// 开头并包含域名</p>
        <div v-if="overriddenKeys.length" class="notice notice-warn mt-1">
          原链接已含 {{ overriddenKeys.join('、') }}，将被本页参数覆盖。
        </div>
      </div>
      <div class="grid-2">
        <div>
          <label class="field-label">utm_source 流量来源</label>
          <input v-model="source" class="input" list="utm-sources" placeholder="如 google / wechat" />
          <datalist id="utm-sources">
            <option v-for="s in SOURCES" :key="s" :value="s" />
          </datalist>
        </div>
        <div><label class="field-label">utm_medium 流量媒介</label><input v-model="medium" class="input" placeholder="如 cpc / email" /></div>
        <div><label class="field-label">utm_campaign 活动名</label><input v-model="campaign" class="input" placeholder="如 spring-sale" /></div>
        <div><label class="field-label">utm_term 关键词（付费搜索可选）</label><input v-model="term" class="input" placeholder="如 在线工具" /></div>
      </div>
      <div><label class="field-label">utm_content 内容区分（A/B 测试可选）</label><input v-model="content" class="input" placeholder="如 banner-top" /></div>
    </div>

    <div v-if="badStyleFields.length" class="notice notice-warn mt-2">
      {{ badStyleFields.map((f) => f.key).join('、') }} 含大写或空格：utm 值建议统一小写连字符（如 Spring Sale → spring-sale），部分统计平台会对值做大小写区分。
    </div>

    <div class="row row-wrap mt-2">
      <span class="quick-label">常用 medium：</span>
      <button v-for="m in MEDIUMS" :key="m.v" class="chip" :class="{ active: medium === m.v }" @click="setMedium(m.v)">{{ m.label }}</button>
    </div>

    <ResultBox class="mt-2" :model-value="builtUrl" title="带 UTM 参数的完整链接" :min-height="'70px'" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!validBase" @click="copyUrl">复制链接并存入历史</button>
    </div>

    <!-- rx2 最近使用 -->
    <div v-if="history.length" class="hist mt-2">
      <div class="row">
        <span class="hist-title"><History :size="14" /> 最近使用（点击回填全部字段）</span>
        <button class="mini-clear" @click="clearHist"><Trash2 :size="13" /> 清空</button>
      </div>
      <div class="hist-list">
        <button v-for="h in history" :key="h.ts" class="hist-item" :title="h.url" @click="restore(h)">
          <span class="hist-main">{{ h.campaign || '(无活动名)' }} · {{ h.source || '?' }}/{{ h.medium || '?' }}</span>
          <span class="hist-url">{{ h.url }}</span>
        </button>
      </div>
    </div>

    <div class="qr-row mt-2">
      <div>
        <div class="row row-wrap">
          <button class="btn btn-primary" :disabled="qrBusy || !validBase" @click="genQr"><QrCode :size="16" /> 立即刷新二维码</button>
          <button class="btn btn-ghost" :disabled="!qrBox?.querySelector('canvas')" @click="dlQr"><Download :size="16" /> 下载二维码</button>
        </div>
        <p class="hint mt-1">二维码在本地生成，参数变化后 0.5 秒自动更新；扫码即打开带参数链接。</p>
      </div>
      <div ref="qrBox" class="qr-stage"></div>
    </div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 12px; }
.invalid { border-color: var(--err) !important; }
.field-err { margin: 4px 2px 0; font-size: 12px; color: var(--err); }
.quick-label { font-size: 13px; color: var(--text-3); }
.hist-title { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.mini-clear {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}
.hist-list { display: grid; gap: 6px; margin-top: 8px; }
.hist-item {
  display: grid;
  gap: 2px;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
.hist-item:hover { border-color: var(--accent); }
.hist-main { font-size: 13px; color: var(--text-1); font-weight: 600; }
.hist-url { font-size: 12px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); }
.qr-row {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.qr-stage {
  min-width: 244px;
  min-height: 244px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  margin-left: auto;
}
.hint { font-size: 12px; color: var(--text-3); }
</style>
