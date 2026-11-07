<script setup lang="ts">
import { ref } from 'vue'
import { Terminal, Zap } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { curlToFetch } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const cmd = ref(`curl 'https://api.example.com/v1/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer TOKEN' \\
  --data-raw '{"name": "张三"}'`)
const error = ref('')
const summary = ref<{ method: string; url: string; headers: [string, string][]; body: string | null } | null>(null)
const code = ref('')

const convert = () => {
  error.value = ''
  summary.value = null
  code.value = ''
  if (!cmd.value.trim()) return toast.warn('请先粘贴 curl 命令')
  try {
    const r = curlToFetch(cmd.value)
    summary.value = { method: r.method, url: r.url, headers: r.headers, body: r.body }
    code.value = r.code
    toast.ok(`转换成功：${r.method} ${r.url.slice(0, 50)}`)
  } catch (e) {
    error.value = (e as Error).message
    toast.err('转换失败')
  }
}
</script>

<template>
  <div class="curl-f">
    <span class="field-label">cURL 命令（支持反斜杠续行）</span>
    <textarea v-model="cmd" class="textarea mono" style="min-height: 150px" spellcheck="false"></textarea>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="convert"><Zap :size="16" /> 转换为 fetch</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="summary">
      <div class="mt-3 grid-3" style="gap: 10px">
        <div class="stat"><span>方法</span><b class="mono">{{ summary.method }}</b></div>
        <div class="stat wide"><span>URL</span><b class="mono">{{ summary.url }}</b></div>
        <div class="stat"><span>请求头</span><b>{{ summary.headers.length }} 个</b></div>
      </div>

      <div v-if="summary.headers.length" class="mt-2 header-list">
        <div v-for="([k, v], i) in summary.headers" :key="i" class="h-row mono">
          <b>{{ k }}:</b> <span>{{ v }}</span>
        </div>
      </div>
      <div v-if="summary.body" class="notice notice-info mt-2 small mono">Body: {{ summary.body.slice(0, 200) }}</div>

      <ResultBox v-model="code" title="fetch 代码" download="js" min-height="230px" class="mt-3" />
    </template>

    <p class="notice notice-info mt-3 small"><Terminal :size="13" style="vertical-align: -2px" /> 支持 -X、-H、-d/--data-raw、--data-binary 等常用参数；令牌等敏感值请转换后自行替换。</p>
  </div>
</template>

<style scoped>
.stat {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  min-width: 0;
}
.stat span {
  display: block;
  color: var(--text-3);
  margin-bottom: 4px;
}
.stat b {
  overflow-wrap: anywhere;
  font-size: 12.5px;
}
.stat.wide {
  grid-column: span 1;
}
.header-list {
  display: grid;
  gap: 5px;
}
.h-row {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12.5px;
  overflow-wrap: anywhere;
}
.h-row b {
  color: var(--accent-text);
}
.h-row span {
  color: var(--text-2);
}
</style>
