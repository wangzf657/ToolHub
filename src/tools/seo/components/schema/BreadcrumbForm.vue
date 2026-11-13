<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { Plus, Trash2, Link2 } from 'lucide-vue-next'
import { S } from './shared'

const crumbRows = ref([{ name: '', url: '' }])
const addCrumb = () => crumbRows.value.push({ name: '', url: '' })

// rx2 粘贴 URL 自动分层：按路径段拆层，首层为域名
const pasteUrl = ref('')
const deriveFromUrl = () => {
  const raw = pasteUrl.value.trim()
  if (!raw) return
  try {
    const u = new URL(raw)
    const segs = u.pathname.split('/').filter(Boolean)
    const rows: { name: string; url: string }[] = [{ name: u.hostname.replace(/^www\./, ''), url: u.origin + '/' }]
    let acc = u.origin
    for (const seg of segs) {
      acc += '/' + seg
      rows.push({ name: decodeURIComponent(seg).replace(/[-_]+/g, ' ').trim() || seg, url: acc })
    }
    if (rows.length) crumbRows.value = rows
  } catch {
    /* 非法 URL 忽略，交给行内校验提示 */
  }
}

const urlValid = (u: string) => /^https?:\/\/.+/i.test(u.trim())

// rx3 非法 URL 行；rx5 中间层（非末层）留空提示
const urlWarn = computed(() =>
  crumbRows.value
    .map((r, i) => {
      const isLast = i === crumbRows.value.length - 1
      if (!r.url.trim()) {
        return isLast ? null : { row: i + 1, msg: `第 ${i + 1} 层 URL 留空：该层将输出无 item 的 ListItem（Google 允许但建议补充链接）` }
      }
      if (!urlValid(r.url)) return { row: i + 1, msg: `第 ${i + 1} 层 URL 需以 http(s):// 开头` }
      return null
    })
    .filter((x): x is { row: number; msg: string } => x !== null),
)

const json = defineModel<Record<string, unknown> | null>({ required: true })

const buildJson = computed<Record<string, unknown> | null>(() => {
  const rows = crumbRows.value.filter((r) => r.name.trim())
  if (!rows.length) return null
  return {
    '@context': S,
    '@type': 'BreadcrumbList',
    itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, ...(r.url.trim() ? { item: r.url.trim() } : {}) })),
  }
})
watchEffect(() => {
  json.value = buildJson.value
})
</script>

<template>
  <div class="form">
    <div class="paste-box">
      <label class="field-label">粘贴页面 URL 自动分层</label>
      <div class="row mt-1">
        <input v-model="pasteUrl" class="input grow" placeholder="https://a.com/blog/2026/post" @keyup.enter="deriveFromUrl" />
        <button class="btn btn-ghost" @click="deriveFromUrl"><Link2 :size="15" /> 自动分层</button>
      </div>
    </div>

    <div v-for="(r, i) in crumbRows" :key="i" class="row mb-1">
      <span class="row-no">{{ i + 1 }}</span>
      <input v-model="r.name" class="input grow" :placeholder="`层级 ${i + 1} 名称，如 首页`" />
      <input v-model="r.url" class="input grow" :class="{ invalid: r.url.trim() && !urlValid(r.url) }" placeholder="https://…（末级可留空）" />
      <button class="icon-btn danger" title="删除" aria-label="删除" @click="crumbRows.splice(i, 1)"><Trash2 :size="14" /></button>
    </div>
    <button class="btn btn-ghost btn-sm" @click="addCrumb"><Plus :size="14" /> 添加层级</button>

    <div v-for="(w, i) in urlWarn" :key="i" class="notice notice-warn">{{ w.msg }}</div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 8px; }
.row { display: flex; gap: 8px; }
.paste-box { border: 1px dashed var(--border); border-radius: 10px; padding: 10px 12px; }
.row-no {
  flex: none;
  min-width: 30px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.icon-btn {
  width: 30px; height: 30px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.invalid { border-color: var(--err) !important; }
</style>
