<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download } from 'lucide-vue-next'
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

/** 每行一条：URL [priority]（可选行内 priority，空格分隔） */
interface Entry {
  url: string
  priority: string
  valid: boolean
}

const FREQS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

const entries = computed<Entry[]>(() =>
  urlText.value
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/)
      let url = parts[0]
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      const p = parts[1] && /^\d(\.\d+)?$/.test(parts[1]) ? parts[1] : priority.value
      let valid = false
      try {
        const u = new URL(url)
        valid = (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname
      } catch {
        valid = false
      }
      return { url, priority: p, valid }
    }),
)

const validCount = computed(() => entries.value.filter((e) => e.valid).length)
const invalidCount = computed(() => entries.value.length - validCount.value)

const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const xml = computed(() => {
  if (!validCount.value) return ''
  const urls = entries.value
    .filter((e) => e.valid)
    .map((e) => {
      const inner = [`<loc>${escXml(e.url)}</loc>`]
      if (lastmod.value) inner.push(`<lastmod>${lastmod.value}</lastmod>`)
      inner.push(`<changefreq>${changefreq.value}</changefreq>`)
      inner.push(`<priority>${e.priority}</priority>`)
      return `  <url>\n    ${inner.join('\n    ')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
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
      每行一个 URL；可在 URL 后加空格跟一个 0–1 的 priority 单独覆盖默认值（如
      <code>https://example.com 0.8</code>）。
    </div>

    <textarea v-model="urlText" class="textarea mono mt-2" style="min-height: 160px" placeholder="https://example.com/&#10;https://example.com/about 0.8"></textarea>

    <div class="opts mt-2">
      <div>
        <label class="field-label">默认更新频率 changefreq</label>
        <select v-model="changefreq" class="select">
          <option v-for="f in FREQS" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <div>
        <label class="field-label">默认优先级 priority（0–1）</label>
        <input v-model="priority" class="input" placeholder="0.5" />
      </div>
      <div>
        <label class="field-label">最后修改时间 lastmod（可选）</label>
        <input v-model="lastmod" type="date" class="input" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <span class="chip">共 {{ entries.length }} 条</span>
      <span class="chip">有效 {{ validCount }}</span>
      <span class="chip" :class="{ 'chip-bad': invalidCount > 0 }">无效 {{ invalidCount }}</span>
    </div>
    <div v-if="invalidCount > 0" class="notice notice-warn mt-1">
      有 {{ invalidCount }} 条 URL 无法解析为合法地址（需含主机名），已自动跳过。
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
code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 4px;
}
.hint { font-size: 12px; color: var(--text-3); }
</style>
