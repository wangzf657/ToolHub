<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Mail } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * .eml 邮件查看器：postal-mime 本地解析。
 * 头部（发件人/收件人/主题/日期）+ HTML 正文（DOMPurify 消毒后经 sandbox iframe 渲染）+ 附件下载。
 * .msg（Outlook OLE 格式）不支持，会给出明确提示。
 */
const toast = useToast()
const loading = ref(false)
const mail = ref<Awaited<ReturnType<typeof parseEml>> | null>(null)
const htmlSanitized = ref('')
const fileName = ref('')

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** postal-mime 解析（保留官方返回类型推断） */
const parseEml = async (buf: ArrayBuffer) => {
  const PM = (await import('postal-mime')).default
  return PM.parse(buf)
}

const addrText = (a: PostalMimeAddressMin | undefined | null): string =>
  a ? (a.name ? `${a.name} <${a.address ?? ''}>` : a.address ?? '') : '—'

const addrList = (list: PostalMimeAddressMin[] | undefined): string =>
  list?.length ? list.map(addrText).join('、') : '—'

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
  try {
    const parsed = await parseEml(await f.arrayBuffer())
    mail.value = parsed
    if (parsed.html) {
      const DOMPurify = (await import('dompurify')).default
      // iframe sandbox 已禁脚本，这里再过滤表单类元素防钓鱼提交
      htmlSanitized.value = DOMPurify.sanitize(parsed.html, { FORBID_TAGS: ['form', 'input'] })
    }
    toast.ok('邮件解析完成')
  } catch (e) {
    toast.err((e as Error).message || '邮件解析失败：请确认文件为 .eml 格式')
  } finally {
    loading.value = false
  }
}

const saveAtt = (att: PostalMimeAttachmentMin) => {
  try {
    let bytes: Uint8Array
    if (typeof att.content === 'string') {
      // base64 / utf8 编码的附件
      if (att.encoding === 'base64') {
        const bin = atob(att.content)
        bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      } else {
        bytes = new TextEncoder().encode(att.content)
      }
    } else {
      bytes = att.content instanceof Uint8Array ? att.content : new Uint8Array(att.content)
    }
    saveBlob(new Blob([bytes as BlobPart]), att.filename || '附件')
  } catch (e) {
    toast.err(`附件下载失败：${(e as Error).message}`)
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".eml,message/rfc822" :multiple="false" label="拖入 .eml 邮件文件" hint="本地解析，邮件内容不上传；不支持 .msg（Outlook 专有格式）" @files="open" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在解析邮件…</div>

    <div v-if="mail" class="mt-2">
      <div class="head">
        <div class="row1">
          <Mail :size="16" />
          <b class="subj">{{ mail.subject || '（无主题）' }}</b>
        </div>
        <div class="kv"><span class="k">发件人</span><span>{{ addrText(mail.from) }}</span></div>
        <div class="kv"><span class="k">收件人</span><span>{{ addrList(mail.to) }}</span></div>
        <div v-if="mail.cc?.length" class="kv"><span class="k">抄送</span><span>{{ addrList(mail.cc) }}</span></div>
        <div class="kv"><span class="k">日期</span><span>{{ mail.date || '—' }}</span></div>
        <div v-if="mail.attachments?.length" class="kv">
          <span class="k">附件（{{ mail.attachments.length }}）</span>
          <span class="atts">
            <button v-for="(a, i) in mail.attachments" :key="i" class="att" :title="a.filename ?? ''" @click="saveAtt(a)">
              <Download :size="12" /> {{ a.filename || '未命名' }}
            </button>
          </span>
        </div>
      </div>

      <div v-if="htmlSanitized" class="body mt-2">
        <iframe class="frame" sandbox="" :srcdoc="htmlSanitized" title="邮件正文预览"></iframe>
      </div>
      <pre v-else-if="mail.text" class="text mt-2">{{ mail.text }}</pre>
      <p v-else class="muted small mt-2">该邮件没有可显示的正文内容。</p>
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
.att:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}
.body {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.frame {
  width: 100%;
  height: 480px;
  border: none;
  background: #fff;
}
.text {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  white-space: pre-wrap;
  font-size: 13px;
  max-height: 480px;
  overflow: auto;
}
</style>
