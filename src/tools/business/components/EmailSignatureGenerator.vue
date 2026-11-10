<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Mail } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const name = ref('王小明')
const title = ref('产品经理')
const company = ref('示例科技有限公司')
const phone = ref('138-0000-0000')
const email = ref('ming@example.com')
const website = ref('https://example.com')
const color = ref('#4f46e5')
const style = ref<'bar' | 'divider' | 'clean'>('bar')

/** 表格布局（Outlook 兼容靠 table + inline style） */
const html = computed(() => {
  const c = color.value
  const divider = style.value === 'bar'
    ? `<table cellpadding="0" cellspacing="0"><tr><td style="border-left:3px solid ${c};padding-left:12px;">`
    : ''
  const closer = style.value === 'bar' ? '</td></tr></table>' : ''
  const sep = style.value === 'divider' ? '<div style="border-top:1px solid #d1d5db;margin:8px 0;width:220px;"></div>' : '<div style="height:6px;"></div>'
  const link = (t: string, href: string) => `<a href="${href}" style="color:${c};text-decoration:none;font-size:12px;">${t}</a>`
  const row = (label: string, val: string) =>
    `<span style="color:#6b7280;font-size:12px;">${label}</span>&nbsp;&nbsp;<span style="color:#374151;font-size:12px;">${val}</span>`
  const rows = [
    phone.value ? row('电话', phone.value) : '',
    email.value ? row('邮箱', link(email.value, `mailto:${email.value}`)) : '',
    website.value ? row('网址', link(website.value, website.value)) : '',
  ].filter(Boolean).join('<br/>')
  const inner = `
<table cellpadding="0" cellspacing="0" style="font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <tr><td>
    <div style="font-size:16px;font-weight:700;color:#111827;">${name.value}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${title.value}${company.value ? ` · ${company.value}` : ''}</div>
    ${sep}
    ${rows}
  </td></tr>
</table>`
  return style.value === 'bar' ? `${divider}${inner}${closer}` : inner
})

const doCopy = async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html.value], { type: 'text/html' }), 'text/plain': new Blob([html.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()], { type: 'text/plain' }) })])
    toast.ok('已复制富文本签名，去邮箱粘贴即可')
  } catch {
    // ClipboardItem 不可用时降级纯文本
    const ok = await navigator.clipboard.writeText(html.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).then(() => true).catch(() => false)
    ok ? toast.warn('当前浏览器不支持富文本复制，已复制纯文本，可手动套用样式') : toast.err('复制失败')
  }
}
</script>

<template>
  <div>
    <div class="wrap">
      <div class="left">
        <div class="opts-panel">
          <div class="grid2">
            <div><span class="field-label">姓名</span><input v-model="name" class="input" /></div>
            <div><span class="field-label">职位</span><input v-model="title" class="input" /></div>
            <div><span class="field-label">公司</span><input v-model="company" class="input" /></div>
            <div><span class="field-label">主题色</span><input v-model="color" type="color" class="input" style="height: 38px; padding: 3px" /></div>
            <div><span class="field-label">电话</span><input v-model="phone" class="input" /></div>
            <div><span class="field-label">邮箱</span><input v-model="email" class="input" /></div>
          </div>
          <div class="mt-2"><span class="field-label">网址</span><input v-model="website" class="input" /></div>
          <div class="row gap mt-2">
            <span class="field-label">风格</span>
            <label class="seg" :class="{ active: style === 'bar' }"><input v-model="style" type="radio" value="bar" class="sr" /> 侧色条</label>
            <label class="seg" :class="{ active: style === 'divider' }"><input v-model="style" type="radio" value="divider" class="sr" /> 分隔线</label>
            <label class="seg" :class="{ active: style === 'clean' }"><input v-model="style" type="radio" value="clean" class="sr" /> 极简</label>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="preview-box" v-html="html"></div>
        <button class="btn btn-primary mt-2" @click="doCopy"><Copy :size="16" /> 复制签名（Outlook/Foxmail 可粘贴）</button>
        <p class="hint mt-1">表格布局 + 内联样式，Gmail、Outlook、Foxmail、网页版邮箱均兼容；头像建议在邮箱客户端内自行添加。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: flex; gap: 24px; flex-wrap: wrap; }
.left { flex: 1 1 320px; }
.right { flex: 1 1 320px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.gap { gap: 10px; align-items: center; }
.seg { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.preview-box { padding: 20px; border: 1px dashed var(--border); border-radius: 12px; min-height: 120px; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
