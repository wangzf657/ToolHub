<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Copy, Download, Code2 } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 邮件签名生成器：白底预览+底色模拟、社交图标行、下载/复制源码、字段持久化、纯文本降级净化 */
const MEM_KEY = 'toolhub.business.emailsig'
const toast = useToast()

const name = ref('王小明')
const title = ref('产品经理')
const company = ref('示例科技有限公司')
const phone = ref('138-0000-0000')
const email = ref('ming@example.com')
const website = ref('https://example.com')
const color = ref('#4f46e5')
const style = ref<'bar' | 'divider' | 'clean'>('bar')
const previewBg = ref<'white' | 'dark'>('white')
const social = ref({ linkedin: false, x: false, wechat: false, custom: false })
const socialUrls = ref({ linkedin: '', x: '', wechat: '', custom: '' })
const customLabel = ref('公众号')

const MEM = () => ({
  name: name.value, title: title.value, company: company.value, phone: phone.value, email: email.value,
  website: website.value, color: color.value, style: style.value, social: social.value, socialUrls: socialUrls.value, customLabel: customLabel.value,
})
const loadMem = () => {
  try {
    const s = JSON.parse(localStorage.getItem(MEM_KEY) ?? 'null')
    if (!s) return
    name.value = s.name ?? name.value
    title.value = s.title ?? title.value
    company.value = s.company ?? company.value
    phone.value = s.phone ?? phone.value
    email.value = s.email ?? email.value
    website.value = s.website ?? website.value
    color.value = s.color ?? color.value
    style.value = s.style ?? style.value
    if (s.social) social.value = s.social
    if (s.socialUrls) socialUrls.value = s.socialUrls
    if (s.customLabel) customLabel.value = s.customLabel
  } catch {
    /* 记忆损坏忽略 */
  }
}
onMounted(loadMem)
watch(MEM, () => {
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(MEM()))
  } catch {
    /* 静默放弃 */
  }
}, { deep: true })

/* 社交图标（内联 SVG，16px；邮件客户端兼容性以实际测试为准） */
const ICONS: Record<string, string> = {
  linkedin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2" xmlns="http://www.w3.org/2000/svg"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#0f1419" xmlns="http://www.w3.org/2000/svg"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.23l-4.88-6.38L6.5 22H3.37l7.24-8.28L2.4 2h6.39l4.41 5.83L18.9 2zm-1.1 18.1h1.72L7.98 3.8H6.13L17.8 20.1z"/></svg>',
  wechat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#07c160" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 4C5.36 4 2 6.79 2 10.22c0 1.96 1.07 3.71 2.74 4.86l-.69 2.31 2.66-1.33c.86.24 1.79.38 2.79.38.35 0 .7-.02 1.04-.06a5.4 5.4 0 0 1-.24-1.6c0-3.23 3.05-5.85 6.8-5.85.25 0 .5.01.74.03C16.96 6.05 13.62 4 9.5 4zM7.1 8.3a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm4.9 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zM22 14.8c0-2.9-2.87-5.24-6.4-5.24s-6.4 2.34-6.4 5.24 2.87 5.24 6.4 5.24c.8 0 1.57-.12 2.28-.33l2.35 1.17-.6-2.03A5.06 5.06 0 0 0 22 14.8zm-8.6-1.1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm4.4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>',
  custom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
}

const socialList = computed(() => {
  const out: { label: string; icon: string; url: string }[] = []
  if (social.value.linkedin && socialUrls.value.linkedin) out.push({ label: 'LinkedIn', icon: ICONS.linkedin!, url: socialUrls.value.linkedin })
  if (social.value.x && socialUrls.value.x) out.push({ label: 'X', icon: ICONS.x!, url: socialUrls.value.x })
  if (social.value.wechat && socialUrls.value.wechat) out.push({ label: '微信', icon: ICONS.wechat!, url: socialUrls.value.wechat })
  if (social.value.custom && socialUrls.value.custom) out.push({ label: customLabel.value || '链接', icon: ICONS.custom!, url: socialUrls.value.custom })
  return out
})

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
  const socialRow = socialList.value.length
    ? `<div style="margin-top:6px;">${socialList.value
        .map((s) => `<a href="${s.url}" style="text-decoration:none;margin-right:10px;" title="${s.label}"><span style="display:inline-block;vertical-align:middle;">${s.icon}</span></a>`)
        .join('')}</div>`
    : ''
  const inner = `
<table cellpadding="0" cellspacing="0" style="font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <tr><td>
    <div style="font-size:16px;font-weight:700;color:#111827;">${name.value}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${title.value}${company.value ? ` · ${company.value}` : ''}</div>
    ${sep}
    ${rows}
    ${socialRow}
  </td></tr>
</table>`
  return style.value === 'bar' ? `${divider}${inner}${closer}` : inner
})

/** 实体解码后再剥标签（纯文本降级净化：无 &nbsp;/&amp; 残留） */
const toPlainText = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const doCopy = async () => {
  const text = toPlainText(html.value)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html.value], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
    toast.ok('已复制富文本签名，去邮箱粘贴即可')
  } catch {
    // ClipboardItem 不可用时降级纯文本（实体已净化）
    const ok = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    ok ? toast.warn('当前浏览器不支持富文本复制，已复制纯文本，可手动套用样式') : toast.err('复制失败')
  }
}

const copySource = async () => {
  const ok = await navigator.clipboard.writeText(html.value).then(() => true).catch(() => false)
  ok ? toast.ok('已复制完整 HTML 源码') : toast.err('复制失败')
}

const downloadHtml = () => {
  saveBlob(new Blob([`<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>邮件签名</title></head><body style="background:#fff;">${html.value}</body></html>`], { type: 'text/html;charset=utf-8' }), '邮件签名.html')
  toast.ok('已下载 .html，浏览器打开与预览一致')
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
          <div class="social mt-2">
            <span class="field-label">社交链接（可选，勾选后填链接）</span>
            <label class="check"><input v-model="social.linkedin" type="checkbox" /> LinkedIn
              <input v-if="social.linkedin" v-model="socialUrls.linkedin" class="input" placeholder="https://linkedin.com/in/…" />
            </label>
            <label class="check"><input v-model="social.x" type="checkbox" /> X（Twitter）
              <input v-if="social.x" v-model="socialUrls.x" class="input" placeholder="https://x.com/…" />
            </label>
            <label class="check"><input v-model="social.wechat" type="checkbox" /> 微信
              <input v-if="social.wechat" v-model="socialUrls.wechat" class="input" placeholder="微信资料/公众号链接" />
            </label>
            <label class="check"><input v-model="social.custom" type="checkbox" /> 自定义
              <input v-if="social.custom" v-model="customLabel" class="input" style="width: 100px" placeholder="名称" />
              <input v-if="social.custom" v-model="socialUrls.custom" class="input" placeholder="https://…" />
            </label>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="row row-wrap mb-1" style="align-items: center">
          <span class="small muted">预览底色模拟：</span>
          <label class="check"><input v-model="previewBg" type="radio" value="white" /> 白底</label>
          <label class="check"><input v-model="previewBg" type="radio" value="dark" /> 深底</label>
          <span v-if="previewBg === 'dark'" class="small muted">提示：邮件客户端多为白底渲染，深底仅供检查对比度</span>
        </div>
        <div class="preview-box" :class="{ dark: previewBg === 'dark' }" v-html="html"></div>
        <div class="row row-wrap mt-2">
          <button class="btn btn-primary" @click="doCopy"><Copy :size="16" /> 复制签名</button>
          <button class="btn btn-soft" @click="downloadHtml"><Download :size="16" /> 下载 .html</button>
          <button class="btn btn-ghost" @click="copySource"><Code2 :size="16" /> 复制 HTML 源码</button>
        </div>
        <p class="hint mt-1">表格布局 + 内联样式，Gmail、Outlook、Foxmail、网页版邮箱均兼容；社交图标为内联 SVG（部分客户端可能不渲染）；字段自动保存在本机浏览器。</p>
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
/* 预览默认白底（邮件客户端多为白底），深底为对比度检查模式 */
.preview-box { padding: 20px; border: 1px dashed var(--border); border-radius: 12px; min-height: 120px; background: #ffffff; color: #111827; }
.preview-box.dark { background: #1f2430; }
.social { display: grid; gap: 6px; font-size: 13px; }
.social .input { width: 260px; max-width: 100%; margin-left: 8px; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
