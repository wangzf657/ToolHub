<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, ChevronDown, ChevronRight, Copy, Check } from 'lucide-vue-next'
import { HTTP_STATUS } from '@/lib/jsEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 引擎库只读，RFC 全集补充在本组件内合并（rx1） */
const EXTRA_STATUS: { code: number; name: string; desc: string }[] = [
  { code: 102, name: 'Processing', desc: '处理中：服务器已收到请求正在处理（WebDAV）' },
  { code: 103, name: 'Early Hints', desc: '早期提示：预加载页面可能需要的资源' },
  { code: 203, name: 'Non-Authoritative Information', desc: '非权威信息：响应来自缓存或代理，可能与源服务器不同' },
  { code: 205, name: 'Reset Content', desc: '重置内容：让客户端重置表单等输入视图' },
  { code: 208, name: 'Already Reported', desc: '已报告：DAV 绑定的成员已在先前响应中列举（WebDAV）' },
  { code: 226, name: 'IM Used', desc: '增量传输已使用：服务器已对资源应用了 delta 编码' },
  { code: 303, name: 'See Other', desc: '查看其它位置：用 GET 访问另一个 URI（PRG 模式常用）' },
  { code: 305, name: 'Use Proxy', desc: '使用代理（已废弃）：必须通过指定代理访问' },
  { code: 300, name: 'Multiple Choices', desc: '多重选择：请求的资源有多个可选表示，让客户端挑选' },
  { code: 406, name: 'Not Acceptable', desc: '不可接受：无法按 Accept 头生成可接受的内容' },
  { code: 407, name: 'Proxy Authentication Required', desc: '需要代理认证：先向代理完成认证（Proxy-Authenticate）' },
  { code: 411, name: 'Length Required', desc: '需要 Content-Length：服务器拒绝无长度的请求体' },
  { code: 412, name: 'Precondition Failed', desc: '前置条件失败：If-Match/If-Unmodified-Since 等条件不满足' },
  { code: 414, name: 'URI Too Long', desc: 'URI 过长：请求 URL 超出服务器可处理长度' },
  { code: 416, name: 'Range Not Satisfiable', desc: '范围不可满足：请求的 Range 超出资源实际大小' },
  { code: 417, name: 'Expectation Failed', desc: '期望失败：Expect 头的要求无法满足' },
  { code: 418, name: "I'm a teapot", desc: '我是茶壶：愚人节彩蛋（RFC 2324），拒绝冲泡咖啡' },
  { code: 421, name: 'Misdirected Request', desc: '错误导向的请求：请求被发往无法产生响应的服务器' },
  { code: 423, name: 'Locked', desc: '已锁定：资源被锁定（WebDAV）' },
  { code: 424, name: 'Failed Dependency', desc: '依赖失败：因前序请求失败而失败（WebDAV）' },
  { code: 425, name: 'Too Early', desc: '过早：服务器不愿处理可能重放的数据' },
  { code: 426, name: 'Upgrade Required', desc: '需要升级：客户端应切换协议（如 TLS）' },
  { code: 428, name: 'Precondition Required', desc: '需要前置条件：要求请求携带条件头防并发丢失更新' },
  { code: 431, name: 'Request Header Fields Too Large', desc: '请求头过大：单个头或总头超服务器限制' },
  { code: 451, name: 'Unavailable For Legal Reasons', desc: '因法律原因不可用：被法律/监管要求封锁' },
  { code: 505, name: 'HTTP Version Not Supported', desc: '不支持的 HTTP 版本：服务器不支持请求所用协议版本' },
  { code: 506, name: 'Variant Also Negotiates', desc: '变体协商冲突：透明内容协商配置错误' },
  { code: 507, name: 'Insufficient Storage', desc: '存储不足：服务器无法完成请求（WebDAV）' },
  { code: 508, name: 'Loop Detected', desc: '检测到环路：处理请求时发现无限循环（WebDAV）' },
  { code: 510, name: 'Not Extended', desc: '未扩展：请求需要进一步的扩展策略' },
  { code: 511, name: 'Network Authentication Required', desc: '需要网络认证：需在 captive portal 登录后才能上网' },
]
const FULL_STATUS = [...HTTP_STATUS, ...EXTRA_STATUS.filter((e) => !HTTP_STATUS.some((s) => s.code === e.code))].sort((a, b) => a.code - b.code)

const query = ref('')
const openGroups = ref<Set<string>>(new Set(['2xx', '4xx']))
/** 场景化标签（rx5） */
const scene = ref('')
const SCENES: { label: string; codes: number[]; note: string }[] = [
  { label: '认证', codes: [401, 403, 407, 428], note: '口诀：401 没登录、403 登了没权限、407 要代理认证、428 要带条件头' },
  { label: '限流', codes: [429, 503], note: '429 配 Retry-After；503 多为过载/维护' },
  { label: '缓存', codes: [200, 203, 206, 304], note: '304 走协商缓存，206 支持断点/分片' },
  { label: '重定向', codes: [301, 302, 303, 307, 308], note: '301/308 永久可缓存；302/307 临时；303 改用 GET' },
  { label: '服务端故障', codes: [500, 502, 504, 507], note: '500 自身异常、502 网关拿到无效响应、504 网关超时' },
]
const activeScene = computed(() => SCENES.find((s) => s.label === scene.value))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const GROUPS = [
  { id: '1xx', label: '1xx 信息响应', color: '#818cf8' },
  { id: '2xx', label: '2xx 成功', color: '#34d399' },
  { id: '3xx', label: '3xx 重定向', color: '#fbbf24' },
  { id: '4xx', label: '4xx 客户端错误', color: '#fb923c' },
  { id: '5xx', label: '5xx 服务器错误', color: '#f87171' },
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const sceneCodes = activeScene.value?.codes
  const all = FULL_STATUS.map((s) => {
    const hit =
      (!q ||
        String(s.code).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q)) &&
      (!sceneCodes || sceneCodes.includes(s.code))
    let name = s.name
    let desc = s.desc
    let codeText = String(s.code)
    if (q && hit) {
      const wrap = (t: string) => escapeHtml(t).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`)
      name = wrap(s.name)
      desc = wrap(s.desc)
      codeText = wrap(codeText)
    } else {
      name = escapeHtml(name)
      desc = escapeHtml(desc)
    }
    return { ...s, hit, nameHtml: name, descHtml: desc, codeHtml: codeText }
  })
  return GROUPS.map((g) => ({ ...g, items: all.filter((s) => s.hit && String(s.code)[0] === g.id[0]) }))
})

const toggle = (id: string) => {
  const s = new Set(openGroups.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  openGroups.value = s
}

const expandAll = (open: boolean) => {
  openGroups.value = new Set(open ? GROUPS.map((g) => g.id) : [])
}

const total = computed(() => filtered.value.reduce((n, g) => n + g.items.length, 0))

/** 行内复制（rx4）：`429 Too Many Requests — 描述` */
const copiedCode = ref(0)
const copyRow = async (s: { code: number; name: string; desc: string }) => {
  const ok = await copyText(`${s.code} ${s.name} — ${s.desc}`)
  if (ok) {
    copiedCode.value = s.code
    setTimeout(() => (copiedCode.value = 0), 1500)
  } else toast.err('复制失败')
}

/** ?code=404 锚点直达（rx3）：展开组、滚动、高亮 2s */
const highlightCode = ref(0)
onMounted(() => {
  const q = new URLSearchParams(location.search).get('code')
  const code = Number(q)
  if (!code) return
  const item = FULL_STATUS.find((s) => s.code === code)
  if (!item) return
  query.value = String(code)
  const gid = `${String(code)[0]}xx`
  openGroups.value = new Set([...openGroups.value, gid])
  setTimeout(() => {
    document.querySelector(`[data-code="${code}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    highlightCode.value = code
    setTimeout(() => (highlightCode.value = 0), 2000)
  }, 120)
})
</script>

<template>
  <div class="http-codes">
    <div class="row" style="gap: 8px">
      <div class="grow" style="position: relative">
        <Search :size="15" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3)" />
        <input v-model="query" type="text" class="input" style="padding-left: 36px" placeholder="搜索状态码、英文名或场景说明（如 404、redirect、超时）" />
      </div>
      <button class="btn btn-ghost btn-sm" @click="expandAll(true)">全部展开</button>
      <button class="btn btn-ghost btn-sm" @click="expandAll(false)">全部折叠</button>
    </div>

    <p class="small muted mt-1" style="margin-left: 2px">共 {{ total }} 条匹配（总库 {{ FULL_STATUS.length }} 条）</p>

    <div class="row row-wrap mt-1" style="gap: 8px; align-items: center; margin-left: 2px">
      <span class="field-label" style="margin: 0">场景：</span>
      <button v-for="s in SCENES" :key="s.label" class="chip" :class="{ active: scene === s.label }" @click="scene = scene === s.label ? '' : s.label">{{ s.label }}</button>
      <span v-if="activeScene" class="muted small">{{ activeScene.note }}</span>
    </div>

    <div class="mt-2 groups">
      <section v-for="g in filtered" :key="g.id" class="group">
        <button class="g-head" :class="{ open: openGroups.has(g.id) }" @click="toggle(g.id)">
          <ChevronRight v-if="!openGroups.has(g.id)" :size="16" />
          <ChevronDown v-else :size="16" />
          <span class="g-dot" :style="{ background: g.color }"></span>
          <b>{{ g.label }}</b>
          <span class="muted small">{{ g.items.length }} 条</span>
        </button>
        <div v-if="openGroups.has(g.id)" class="g-body">
          <div v-for="s in g.items" :key="s.code" class="code-row" :class="{ hl: highlightCode === s.code }" :data-code="s.code">
            <code class="code-num mono" v-html="s.codeHtml"></code>
            <div class="code-main">
              <b class="code-name" v-html="s.nameHtml"></b>
              <p class="code-desc" v-html="s.descHtml"></p>
            </div>
            <button class="row-copy" :title="`复制 ${s.code} 条目`" :aria-label="`复制 ${s.code} ${s.name}`" @click="copyRow(s)">
              <Check v-if="copiedCode === s.code" :size="13" color="#34d399" />
              <Copy v-else :size="13" />
            </button>
          </div>
          <p v-if="!g.items.length" class="muted small" style="padding: 6px 12px 10px">无匹配项</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 10px;
}
.group {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.g-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: none;
  background: none;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.g-head:hover {
  background: var(--accent-soft);
}
.g-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}
.g-body {
  border-top: 1px solid var(--border);
  display: grid;
}
.code-row {
  display: flex;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  align-items: center;
}
.code-row.hl {
  background: rgba(251, 191, 36, 0.18);
  transition: background 0.6s ease;
}
.row-copy {
  margin-left: auto;
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.code-row:hover .row-copy {
  opacity: 1;
}
@media (hover: none) {
  .row-copy {
    opacity: 0.55;
  }
}
.code-row:last-child {
  border-bottom: none;
}
.code-num {
  flex: none;
  width: 48px;
  font-size: 15px;
  font-weight: 700;
  color: var(--accent-text);
}
.code-main {
  min-width: 0;
}
.code-name {
  font-size: 13.5px;
  display: block;
}
.code-desc {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}
.code-row :deep(mark),
.code-name :deep(mark) {
  background: rgba(251, 191, 36, 0.35);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
}
</style>
