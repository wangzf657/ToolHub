<script setup lang="ts">
import { ref } from 'vue'
import { Link2, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const url = ref('https://user:pass@example.com:8443/api/v2/search?q=vue3&lang=zh&page=2#results')
const error = ref('')

interface Parsed {
  protocol: string
  username: string
  password: string
  host: string
  hostname: string
  port: string
  pathname: string
  hash: string
  origin: string
  params: [string, string][]
}

const parsed = ref<Parsed | null>(null)
const copiedIdx = ref(-1)

const parse = () => {
  error.value = ''
  parsed.value = null
  const raw = url.value.trim()
  if (!raw) return toast.warn('请输入要解析的 URL')
  try {
    const u = new URL(raw)
    parsed.value = {
      protocol: u.protocol.replace(':', ''),
      username: u.username,
      password: u.password ? '••••（已隐藏）' : '',
      host: u.host,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? '443（默认）' : u.protocol === 'http:' ? '80（默认）' : ''),
      pathname: u.pathname,
      hash: u.hash,
      origin: u.origin,
      params: [...u.searchParams.entries()],
    }
    toast.ok(`解析成功：${parsed.value.params.length} 个查询参数`)
  } catch {
    error.value = 'URL 格式无效：请包含协议（如 https://），且主机名合法。示例：https://example.com/path?q=1'
  }
}

const copyParam = async (v: string, i: number) => {
  const okFlag = await copyText(v)
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="url-parser">
    <span class="field-label">输入 URL</span>
    <div class="row" style="gap: 8px">
      <input v-model="url" type="text" class="input mono grow" spellcheck="false" @keyup.enter="parse" />
      <button class="btn btn-primary" @click="parse"><Link2 :size="16" /> 解析</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="parsed">
      <div class="mt-3 res-list">
        <div class="res-row"><span>协议</span><b class="mono">{{ parsed.protocol }}</b></div>
        <div class="res-row"><span>主机</span><b class="mono">{{ parsed.hostname }}</b></div>
        <div class="res-row"><span>端口</span><b class="mono">{{ parsed.port }}</b></div>
        <div v-if="parsed.username" class="res-row"><span>用户名</span><b class="mono">{{ parsed.username }}</b></div>
        <div class="res-row"><span>路径</span><b class="mono">{{ parsed.pathname }}</b></div>
        <div class="res-row"><span>Origin</span><b class="mono">{{ parsed.origin }}</b></div>
        <div class="res-row"><span>哈希</span><b class="mono">{{ parsed.hash || '（无）' }}</b></div>
      </div>

      <div class="mt-3">
        <span class="field-label">查询参数（{{ parsed.params.length }} 个，点击复制值）</span>
        <div v-if="parsed.params.length" class="param-table">
          <div v-for="([k, v], i) in parsed.params" :key="i" class="param-row">
            <code class="p-key mono">{{ k }}</code>
            <code class="p-val mono">{{ v }}</code>
            <button class="mini-btn" title="复制值" @click="copyParam(v, i)">
              <Check v-if="copiedIdx === i" :size="13" color="#34d399" />
              <Copy v-else :size="13" />
            </button>
          </div>
        </div>
        <div v-else class="notice notice-info">该 URL 没有查询参数。</div>
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
  width: 70px;
  color: var(--text-3);
}
.res-row b {
  text-align: right;
  overflow-wrap: anywhere;
}
.param-table {
  display: grid;
  gap: 6px;
}
.param-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13px;
}
.p-key {
  flex: none;
  min-width: 90px;
  color: var(--accent-text);
}
.p-val {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-2);
}
.mini-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
}
</style>
