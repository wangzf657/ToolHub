<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Link2, Copy, Check, Trash2, Wand2 } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const url = ref('https://user:pass@example.com:8443/api/v2/search?q=vue3&lang=zh&page=2#results')
const error = ref('')
/** raw/decoded 参数视图（rx3） */
const paramView = ref<'decoded' | 'raw'>('decoded')
/** 可编辑参数（rx2） */
const editable = ref<{ key: string; val: string; raw?: string }[]>([])

interface Parsed {
  protocol: string
  username: string
  password: string
  host: string
  hostname: string
  hostPort: string
  port: string
  pathname: string
  hash: string
  origin: string
  params: [string, string][]
  rawParams: [string, string][]
}

const parsed = ref<Parsed | null>(null)
const copiedIdx = ref(-1)

/** raw 参数：手动拆 query 串保留编码原样 */
const rawParamsOf = (search: string): [string, string][] =>
  search
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf('=')
      return i === -1 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)]
    })

const parse = (silent = false) => {
  const raw = url.value.trim()
  if (!raw) return
  try {
    const u = new URL(raw)
    parsed.value = {
      protocol: u.protocol.replace(':', ''),
      username: u.username,
      password: u.password ? '••••（已隐藏）' : '',
      host: u.host,
      hostname: u.hostname,
      hostPort: u.host,
      port: u.port || (u.protocol === 'https:' ? '443（默认）' : u.protocol === 'http:' ? '80（默认）' : ''),
      pathname: u.pathname,
      hash: u.hash,
      origin: u.origin,
      params: [...u.searchParams.entries()],
      rawParams: rawParamsOf(u.search),
    }
    // 编辑区随解析刷新（未被用户改动时）
    if (!dirty.value) editable.value = parsed.value.params.map(([k, v]) => ({ key: k, val: v }))
    error.value = ''
    if (!silent) toast.ok(`解析成功：${parsed.value.params.length} 个查询参数`)
  } catch {
    // 无「清空闪屏」：非法输入保留上次结果 + 错误条（rx5）
    error.value = 'URL 格式无效：请包含协议（如 https://），且主机名合法。示例：https://example.com/path?q=1'
  }
}

/** 实时解析（rx5）：400ms 防抖 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(() => parse(true), 400)
  parse(true)
})
onBeforeUnmount(() => deb?.cancel())
watch(url, () => deb?.call())

/* ---- 参数编辑与重组（rx2） ---- */
const dirty = ref(false)
watch(editable, () => (dirty.value = true), { deep: true })
const removeParam = (i: number) => editable.value.splice(i, 1)
const addParam = () => editable.value.push({ key: 'new', val: '' })
const newUrl = ref('')
const buildUrl = () => {
  if (!parsed.value) return
  try {
    const u = new URL(url.value.trim())
    u.search = ''
    for (const { key, val } of editable.value) {
      if (!key) continue
      u.searchParams.append(key, val)
    }
    newUrl.value = u.toString()
    toast.ok('已生成新 URL')
  } catch {
    toast.err('基础 URL 无效，无法重组')
  }
}

const copyParam = async (v: string, i: number) => {
  const okFlag = await copyText(v)
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}

/** raw 视图的宽容解码 */
const decodeParam = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
</script>

<template>
  <div class="url-parser">
    <span class="field-label">输入 URL（粘贴后自动解析）</span>
    <div class="row" style="gap: 8px">
      <input v-model="url" type="text" class="input mono grow" spellcheck="false" @keyup.enter="parse()" />
      <button class="btn btn-primary" @click="parse()"><Link2 :size="16" /> 解析</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="parsed">
      <div class="mt-3 res-list">
        <div class="res-row"><span>协议</span><b class="mono">{{ parsed.protocol }}</b></div>
        <div class="res-row"><span>主机</span><b class="mono">{{ parsed.hostname }}</b></div>
        <div class="res-row"><span>主机:端口</span><b class="mono">{{ parsed.hostPort }}</b></div>
        <div class="res-row"><span>端口</span><b class="mono">{{ parsed.port }}</b></div>
        <div v-if="parsed.username" class="res-row"><span>用户名</span><b class="mono">{{ parsed.username }}</b></div>
        <div class="res-row"><span>路径</span><b class="mono">{{ parsed.pathname }}</b></div>
        <div class="res-row"><span>Origin</span><b class="mono">{{ parsed.origin }}</b></div>
        <div class="res-row"><span>哈希</span><b class="mono">{{ parsed.hash || '（无）' }}</b></div>
      </div>

      <div class="mt-3">
        <div class="row row-wrap" style="gap: 8px; align-items: center">
          <span class="field-label" style="margin: 0">查询参数（{{ parsed.params.length }} 个）</span>
          <span class="vt" :class="{ on: paramView === 'decoded' }" @click="paramView = 'decoded'">decoded</span>
          <span class="vt" :class="{ on: paramView === 'raw' }" @click="paramView = 'raw'">raw</span>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" @click="addParam"><Copy :size="13" /> 加参数</button>
          <button class="btn btn-soft btn-sm" @click="buildUrl"><Wand2 :size="13" /> 生成新 URL</button>
        </div>

        <div v-if="paramView === 'decoded' && editable.length" class="param-table">
          <div v-for="(p, i) in editable" :key="i" class="param-row">
            <input v-model="p.key" type="text" class="input mono" style="width: 150px" spellcheck="false" />
            <input v-model="p.val" type="text" class="input mono grow" spellcheck="false" />
            <button class="mini-btn" title="复制 k=v（可直接拼入 curl query）" :aria-label="`复制 ${p.key}=${p.val}`" @click="copyParam(`${p.key}=${p.val}`, i)">
              <Check v-if="copiedIdx === i" :size="13" color="#34d399" />
              <Copy v-else :size="13" />
            </button>
            <button class="mini-btn danger" title="删除该参数" :aria-label="`删除 ${p.key}`" @click="removeParam(i)">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
        <div v-else-if="paramView === 'raw' && parsed.rawParams.length" class="param-table">
          <div v-for="([k, v], i) in parsed.rawParams" :key="i" class="param-row">
            <code class="p-key mono">{{ decodeParam(k) }}</code>
            <code class="p-val mono">{{ v }}<template v-if="decodeParam(v) !== v"> （解码：{{ decodeParam(v) }}）</template></code>
            <button class="mini-btn" title="复制 k=v 原文" :aria-label="`复制 ${k}=${v}`" @click="copyParam(`${k}=${v}`, i)">
              <Check v-if="copiedIdx === i" :size="13" color="#34d399" />
              <Copy v-else :size="13" />
            </button>
          </div>
        </div>
        <div v-else class="notice notice-info mt-1">该 URL 没有查询参数。</div>

        <div v-if="newUrl" class="notice notice-ok mt-2" style="display: flex; align-items: center; gap: 10px">
          <code class="mono grow" style="overflow-wrap: anywhere">{{ newUrl }}</code>
          <button class="btn btn-soft btn-sm" @click="copyParam(newUrl, -1)"><Copy :size="13" /> 复制新 URL</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.res-list {
  display: grid;
  gap: 7px;
}
.res-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.res-row span {
  flex: none;
  width: 86px;
  color: var(--text-3);
}
.vt {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-2);
}
.param-table {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
.param-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.p-key {
  color: var(--accent-text);
  min-width: 120px;
  overflow-wrap: anywhere;
}
.p-val {
  flex: 1;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
.vt.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
</style>
