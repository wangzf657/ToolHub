<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Monitor, Chrome, Cpu, Smartphone, Copy, Check } from 'lucide-vue-next'
import { uaParse, type UaInfo } from '@/lib/jsEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const ua = ref('')
const result = ref<UaInfo | null>(null)
const error = ref('')
/** 复制反馈 */
const copiedKey = ref(-2)
/** UA-CH 融合信息（rx4） */
const chNote = ref('')

/** 国产浏览器特征库（rx1）：在通用解析之上做二次覆盖 */
const CN_BROWSERS: [RegExp, string][] = [
  [/MicroMessenger\/([\d.]+)/i, '微信内嵌浏览器'],
  [/QQBrowser\/([\d.]+)/i, 'QQ 浏览器'],
  [/UCBrowser\/([\d.]+)/i, 'UC 浏览器'],
  [/Quark\/([\d.]+)/i, '夸克浏览器'],
  [/HuaweiBrowser\/([\d.]+)/i, '华为浏览器'],
  [/HeyTapBrowser\/([\d.]+)/i, 'OPPO 浏览器'],
  [/Vivobrowser\/([\d.]+)/i, 'vivo 浏览器'],
  [/BaiduHD\/([\d.]+)/i, '百度浏览器'],
]
const overrideBrowser = (s: string): string | null => {
  for (const [re, name] of CN_BROWSERS) {
    const m = s.match(re)
    if (m) return `${name} ${m[1] ?? ''}`.trim()
  }
  return null
}

const parse = (silent = false) => {
  error.value = ''
  result.value = null
  chNote.value = ''
  if (!ua.value.trim()) {
    error.value = '请输入 User-Agent 字符串'
    return
  }
  const r = uaParse(ua.value)
  const cn = overrideBrowser(ua.value)
  result.value = cn ? { ...r, browser: cn } : r
  if (!silent) toast.ok('解析完成')
}

/** 实时解析（rx3）：400ms 防抖 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  ua.value = navigator.userAgent
  parse(true)
  deb = debounceRun(() => {
    if (ua.value.trim()) parse(true)
  }, 400)
  // UA-CH 融合（rx4）：可用时请求高熵值并覆盖 OS 展示
  const uad = (navigator as unknown as { userAgentData?: { getHighEntropyValues(a: string[]): Promise<{ platformVersion?: string; uaFullVersion?: string }>; platform: string } }).userAgentData
  if (uad) {
    uad
      .getHighEntropyValues(['platformVersion', 'uaFullVersion'])
      .then((v) => {
        const major = Number((v.platformVersion ?? '0').split('.')[0])
        if (uad.platform === 'Windows' && major >= 13 && result.value) {
          result.value = { ...result.value, os: 'Windows 11（来自 Client Hints）' }
          chNote.value = 'OS 版本由 UA-CH Client Hints 提供'
        } else if (v.uaFullVersion && result.value) {
          chNote.value = `完整版本（Client Hints）：${v.uaFullVersion}`
        }
      })
      .catch(() => {})
  }
})
onBeforeUnmount(() => deb?.cancel())
watch(ua, () => deb?.call())

const reset = () => {
  ua.value = navigator.userAgent
  parse()
}

/** 预设样例条（rx5） */
const SAMPLES: [string, string][] = [
  ['微信', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.49.2600'],
  ['iPadOS', 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['Googlebot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/124.0.6367.207 Safari/537.36'],
  ['curl', 'curl/8.7.1'],
  ['iOS Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['Android WebView', 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36'],
]
const fillSample = (s: string) => {
  ua.value = s
  parse()
}

const copyValue = async (v: string, idx: number) => {
  const ok = await copyText(v)
  if (ok) {
    copiedKey.value = idx
    setTimeout(() => (copiedKey.value = -2), 1500)
  } else toast.err('复制失败')
}
const copyJson = async () => {
  if (!result.value) return
  const obj = Object.fromEntries(CARDS.map((c) => [c.key, result.value![c.key]]))
  const ok = await copyText(JSON.stringify(obj))
  ok ? toast.ok('已复制 JSON') : toast.err('复制失败')
}

const CARDS = [
  { key: 'browser', label: '浏览器', icon: Chrome },
  { key: 'engine', label: '渲染引擎', icon: Cpu },
  { key: 'os', label: '操作系统', icon: Monitor },
  { key: 'device', label: '设备类型', icon: Smartphone },
] as const
</script>

<template>
  <div class="ua-parser">
    <span class="field-label">User-Agent 字符串（粘贴后自动解析）</span>
    <textarea v-model="ua" class="textarea mono" style="min-height: 100px" spellcheck="false" placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) …"></textarea>

    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <button class="btn btn-primary" @click="parse()">解析 UA</button>
      <button class="btn btn-ghost" @click="reset">重新填入当前浏览器 UA</button>
      <span class="grow"></span>
      <button v-if="result" class="btn btn-ghost btn-sm" @click="copyJson"><Copy :size="13" /> 复制 JSON</button>
    </div>

    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">样例：</span>
      <button v-for="[name, s] in SAMPLES" :key="name" class="chip" @click="fillSample(s)">{{ name }}</button>
    </div>

    <div v-if="result" class="mt-3 cards">
      <div v-for="(c, idx) in CARDS" :key="c.key" class="ua-card">
        <component :is="c.icon" :size="20" class="card-icon" />
        <span class="card-label">{{ c.label }}</span>
        <b class="card-value">{{ result[c.key] }}</b>
        <button class="card-copy" title="复制" :aria-label="`复制${c.label}`" @click="copyValue(result[c.key], idx)">
          <Check v-if="copiedKey === idx" :size="12" color="#34d399" /><Copy v-else :size="12" />
        </button>
      </div>
    </div>
    <div v-else-if="error" class="notice notice-warn mt-2">{{ error }}</div>
    <p v-if="chNote" class="muted small mt-1">{{ chNote }}</p>

    <div class="mt-3">
      <span class="field-label">原始字符串</span>
      <div class="raw mono">{{ ua }}</div>
    </div>

    <p class="notice notice-info mt-3 small">
      解析基于规则匹配（正则特征库，含 MicroMessenger/QQ/UC/夸克/华为等国产浏览器特征），UA Client Hints 时代部分浏览器会冻结或简化 UA，结果仅供参考；本机 UA-CH 可用时自动融合更精确的 OS 版本。
    </p>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.ua-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 6px;
  justify-items: start;
}
.card-icon {
  color: var(--accent-text);
}
.card-label {
  font-size: 12.5px;
  color: var(--text-3);
}
.card-value {
  font-size: 14.5px;
  overflow-wrap: anywhere;
}
.raw {
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 12.5px;
  overflow-wrap: anywhere;
  max-height: 120px;
  overflow: auto;
}
@media (max-width: 860px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
