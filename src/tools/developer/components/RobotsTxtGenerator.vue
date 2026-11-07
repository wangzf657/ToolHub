<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bot, Download, Plus, X } from 'lucide-vue-next'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const policy = ref<'allow-all' | 'deny-all'>('allow-all')
const crawlDelay = ref('0')
const sitemap = ref('')
const rules = ref<{ ua: string; kind: 'allow' | 'disallow'; path: string }[]>([
  { ua: '*', kind: 'disallow', path: '/admin/' },
  { ua: '*', kind: 'disallow', path: '/private/' },
])

const addRule = () => rules.value.push({ ua: '*', kind: 'disallow', path: '/' })
const removeRule = (i: number) => rules.value.splice(i, 1)

const text = computed(() => {
  const out: string[] = []
  if (policy.value === 'deny-all') {
    out.push('User-agent: *', 'Disallow: /')
  } else {
    out.push('User-agent: *', 'Disallow:')
  }
  if (rules.value.length) {
    out.push('')
    for (const r of rules.value) {
      const ua = r.ua.trim() || '*'
      out.push(`User-agent: ${ua}`, `${r.kind === 'allow' ? 'Allow' : 'Disallow'}: ${r.path.trim() || '/'}`)
    }
  }
  const delay = Number(crawlDelay.value)
  if (delay > 0) {
    out.push('', 'User-agent: *', `Crawl-delay: ${delay}`)
  }
  if (sitemap.value.trim()) {
    out.push('', `Sitemap: ${sitemap.value.trim()}`)
  }
  return out.join('\n')
})

const addPreset = (kind: 'block-dir' | 'allow-dir') => {
  rules.value.push({ ua: '*', kind: kind === 'block-dir' ? 'disallow' : 'allow', path: kind === 'block-dir' ? '/目录/' : '/公开目录/' })
}
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
    </div>

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 8px">
        <span class="field-label" style="margin: 0"><Bot :size="14" style="vertical-align: -2px" /> 自定义规则</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="addPreset('block-dir')"><Plus :size="13" /> 禁止目录</button>
        <button class="btn btn-ghost btn-sm" @click="addPreset('allow-dir')"><Plus :size="13" /> 允许目录</button>
      </div>

      <div v-for="(r, i) in rules" :key="i" class="rule-row">
        <input v-model="r.ua" type="text" class="input mono" style="width: 120px" placeholder="User-agent" title="User-agent" />
        <select v-model="r.kind" class="select" style="width: 120px">
          <option value="disallow">Disallow</option>
          <option value="allow">Allow</option>
        </select>
        <input v-model="r.path" type="text" class="input mono grow" placeholder="/路径/" spellcheck="false" />
        <button class="del-btn" title="删除" aria-label="删除" @click="removeRule(i)"><X :size="14" /></button>
      </div>
      <button class="btn btn-soft btn-sm mt-1" @click="addRule"><Plus :size="13" /> 添加规则行</button>
    </div>

    <div class="mt-2">
      <span class="field-label">Sitemap 地址</span>
      <input v-model="sitemap" type="text" class="input mono" placeholder="https://example.com/sitemap.xml" />
    </div>

    <ResultBox v-model="text" title="robots.txt 预览" min-height="220px" class="mt-3" />

    <div class="row mt-2">
      <button class="btn btn-primary btn-sm" @click="saveText(text + '\n', 'robots.txt'); toast.ok('已下载 robots.txt')">
        <Download :size="14" /> 下载 robots.txt
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      提示：Disallow 只对遵守协议的爬虫生效，敏感目录请配合鉴权；Crawl-delay 部分引擎（如 Google）已忽略。
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
