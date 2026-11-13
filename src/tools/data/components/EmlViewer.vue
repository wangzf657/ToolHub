<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Loader2, Mail, Printer, ExternalLink, ChevronDown, ChevronUp } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * .eml 邮件查看器：postal-mime 本地解析。
 * 头部（发件人/收件人/主题/本地化日期）+ HTML/纯文本双视图 + 原始头面板 + 附件批量下载 + 打印留档。
 * .msg（Outlook OLE 格式）不支持，会给出明确提示。
 */
const toast = useToast()
const loading = ref(false)
const mail = ref<Awaited<ReturnType<typeof parseEml>> | null>(null)
const htmlSanitized = ref('')
const fileName = ref('')
/** 正文视图：HTML / 纯文本 */
const viewMode = ref<'html' | 'text'>('html')
/** 原始头折叠区 */
const rawOpen = ref(false)

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** 日期本地化：YYYY-MM-DD HH:mm（中文口径，不再显示英文长串） */
const fmtDate = (d: unknown): string => {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/** postal-mime 解析（保留官方返回类型推断） */
const parseEml = async (buf: ArrayBuffer) => {
  const PM = (await import('postal-mime')).default
  return PM.parse(buf)
}

const addrText = (a: PostalMimeAddressMin | undefined | null): string =>
  a ? (a.name ? `${a.name} <${a.address ?? ''}>` : a.address ?? '') : '—'

const addrList = (list: PostalMimeAddressMin[] | undefined): string =>
  list?.length ? list.map(addrText).join('、') : '—'

/** 原始头全文（key: value 逐行，等宽可复制） */
const rawHeaders = computed(() => {
  const m = mail.value as { headers?: { key: string; value: string }[]; headerLines?: { line: string }[] } | null
  if (m?.headerLines?.length) return m.headerLines.map((h) => h.line).join('\n')
  return (m?.headers ?? []).map((h) => `${h.key}: ${h.value}`).join('\n')
})

/** 附件体积估算 */
const attSize = (a: PostalMimeAttachmentMin): number => {
  try {
    if (typeof a.content === 'string') return a.encoding === 'base64' ? Math.floor((a.content.length * 3) / 4) : a.content.length
    if (a.content instanceof Uint8Array) return a.content.length
    return (a.content as unknown as { byteLength: number }).byteLength ?? 0
  } catch {
    return 0
  }
}

/** 附件字节解码（下载/批量共用） */
const attBytes = (att: PostalMimeAttachmentMin): Uint8Array => {
  if (typeof att.content === 'string') {
    if (att.encoding === 'base64') {
      const bin = atob(att.content)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    }
    return new TextEncoder().encode(att.content)
  }
  return att.content instanceof Uint8Array ? att.content : new Uint8Array(att.content)
}

const saveAtt = (att: PostalMimeAttachmentMin) => {
  try {
    saveBlob(new Blob([attBytes(att) as BlobPart]), att.filename || '附件')
  } catch (e) {
    toast.err(`附件下载失败：${(e as Error).message}`)
  }
}

/** 全部附件一键下载 */
const saveAllAtt = () => {
  for (const a of mail.value?.attachments ?? []) saveAtt(a)
}

/** 新窗口打开正文（完整可滚动阅读） */
const openBodyInWindow = () => {
  if (!htmlSanitized.value) return
  const url = URL.createObjectURL(new Blob([htmlSanitized.value], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** 打印/另存 PDF：仅打印邮件卡片（头部+正文），站头侧栏不进打印 */
const printMail = () => {
  window.print()
}

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (/\.msg$/i.test(f.name)) {
    toast.err('不支持 Outlook 的 .msg 格式（OLE 复合文档），请先在 Outlook 中另存为 .eml 再来')
    return
  }
  loading.value = true
  mail.value = null
  htmlSanitized.value = ''
  fileName.value = f.name
  viewMode.value = 'html'
  rawOpen.value = false
  try {
    const parsed = await parseEml(await f.arrayBuffer())
    mail.value = parsed
    if (parsed.html) {
      const DOMPurify = (await import('dompurify')).default
      // iframe sandbox 已禁脚本，这里再过滤表单类元素防钓鱼提交
      htmlSanitized.value = DOMPurify.sanitize(parsed.html, { FORBID_TAGS: ['form', 'input'] })
    }
    if (!parsed.html && parsed.text) viewMode.value = 'text'
    toast.ok('邮件解析完成')
  } catch (e) {
    toast.err((e as Error).message || '邮件解析失败：请确认文件为 .eml 格式')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".eml,message/rfc822" :multiple="false" label="拖入 .eml 邮件文件" hint="本地解析，邮件内容不上传；不支持 .msg（Outlook 专有格式）" @files="open" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在解析邮件…</div>

    <div v-if="mail" class="mail-card mt-2">
      <div class="head">
        <div class="row1">
          <Mail :size="16" />
          <b class="subj">{{ mail.subject || '（无主题）' }}</b>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" @click="printMail"><Printer :size="13" /> 打印/另存 PDF</button>
        </div>
        <div class="kv"><span class="k">发件人</span><span>{{ addrText(mail.from) }}</span></div>
        <div class="kv"><span class="k">收件人</span><span>{{ addrList(mail.to) }}</span></div>
        <div v-if="mail.cc?.length" class="kv"><span class="k">抄送</span><span>{{ addrList(mail.cc) }}</span></div>
        <div class="kv"><span class="k">日期</span><span>{{ fmtDate(mail.date) }}</span></div>
        <div v-if="mail.attachments?.length" class="kv">
          <span class="k">附件（{{ mail.attachments.length }}）</span>
          <span class="atts">
            <button v-for="(a, i) in mail.attachments" :key="i" class="att" :title="a.filename ?? ''" @click="saveAtt(a)">
              <Download :size="12" /> {{ a.filename || '未命名' }}（{{ fmtSize(attSize(a)) }}）
            </button>
            <button class="att all" @click="saveAllAtt"><Download :size="12" /> 全部下载</button>
          </span>
        </div>
        <button class="raw-toggle small muted" @click="rawOpen = !rawOpen">
          <ChevronUp v-if="rawOpen" :size="13" style="vertical-align: -2px" />
          <ChevronDown v-else :size="13" style="vertical-align: -2px" />
          展开原始头（Message-ID / Received 等）
        </button>
        <pre v-if="rawOpen" class="raw mono">{{ rawHeaders || '（该邮件未暴露原始头）' }}</pre>
      </div>

      <div class="body mt-2">
        <div class="row row-wrap body-ops">
          <template v-if="htmlSanitized">
            <button class="chip" :class="{ on: viewMode === 'html' }" @click="viewMode = 'html'">HTML 视图</button>
            <button class="chip" :class="{ on: viewMode === 'text' }" :disabled="!mail.text" @click="viewMode = 'text'">纯文本视图</button>
          </template>
          <span class="grow"></span>
          <a v-if="htmlSanitized" class="small" href="javascript:void(0)" @click="openBodyInWindow"><ExternalLink :size="13" style="vertical-align: -2px" /> 新窗口打开全文</a>
        </div>
        <iframe v-if="viewMode === 'html' && htmlSanitized" class="frame" sandbox="" :srcdoc="htmlSanitized" title="邮件正文预览"></iframe>
        <pre v-else-if="mail.text" class="text">{{ mail.text }}</pre>
        <p v-else class="muted small" style="padding: 12px">该邮件没有可显示的正文内容。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.head {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  display: grid;
  gap: 6px;
}
.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subj {
  font-size: 15px;
}
.grow {
  flex: 1;
}
.kv {
  display: flex;
  gap: 10px;
  font-size: 13px;
  align-items: baseline;
}
.k {
  flex: none;
  width: 70px;
  color: var(--text-3);
  font-size: 12px;
}
.atts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.att {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  background: none;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.att:hover,
.att.all:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}
.att.all {
  border-style: dashed;
  color: var(--accent-text);
}
.raw-toggle {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  color: var(--text-3);
}
.raw-toggle:hover {
  color: var(--text);
}
.raw {
  max-height: 260px;
  overflow: auto;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  white-space: pre-wrap;
  margin: 0;
  user-select: text;
}
.body {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.body-ops {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
.frame {
  width: 100%;
  height: min(64vh, 640px);
  border: none;
  background: #fff;
}
.text {
  height: min(64vh, 640px);
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  font-size: 13px;
  margin: 0;
  user-select: text;
}
/* 打印留档：只打印邮件卡片 */
@media print {
  body * {
    visibility: hidden;
  }
  .mail-card,
  .mail-card :deep(*) {
    visibility: visible;
  }
  .mail-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    border: none;
  }
  .body-ops,
  .raw-toggle,
  .raw {
    display: none !important;
  }
  .frame {
    height: auto !important;
    overflow: visible;
  }
}
</style>
