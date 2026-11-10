<script setup lang="ts">
import { computed, ref } from 'vue'
import { ContactRound, Download } from 'lucide-vue-next'
import { makeQrCanvas } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const name = ref('')
const org = ref('')
const title = ref('')
const phone = ref('')
const email = ref('')
const website = ref('')
const address = ref('')
const version = ref<'3.0' | '4.0'>('3.0')

/** vCard 文本（3.0 兼容性最好，iOS/安卓/微信均识别） */
const vcard = computed(() => {
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const lines = ['BEGIN:VCARD', `VERSION:${version.value}`]
  if (name.value) {
    // FN 必填；N 姓;名（中文习惯「姓 名」顺序输入时拆开）
    const parts = name.value.trim().split(/\s+/)
    const family = parts.length === 2 ? parts[0] : ''
    const given = parts.length === 2 ? parts[1] : name.value.trim()
    lines.push(`N:${esc(family)};${esc(given)};;;`)
    lines.push(`FN:${esc(name.value.trim())}`)
  }
  if (org.value) lines.push(`ORG:${esc(org.value)}`)
  if (title.value) lines.push(`TITLE:${esc(title.value)}`)
  if (phone.value) lines.push(`TEL;TYPE=CELL:${esc(phone.value)}`)
  if (email.value) lines.push(`EMAIL;TYPE=INTERNET:${esc(email.value)}`)
  if (website.value) lines.push(`URL:${esc(website.value)}`)
  if (address.value) lines.push(`ADR;TYPE=WORK:;;${esc(address.value)};;;;`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
})

const qrRef = ref<HTMLCanvasElement | null>(null)

const renderQr = async () => {
  const cv = qrRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')!
  if (!name.value && !phone.value && !email.value) {
    ctx.clearRect(0, 0, cv.width, cv.height)
    return
  }
  const gen = await makeQrCanvas(vcard.value, { size: 260, margin: 2 })
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.drawImage(gen, 0, 0, cv.width, cv.height)
}

const exportVcf = () => {
  if (!name.value && !phone.value && !email.value) return toast.warn('请至少填写姓名或联系方式')
  saveBlob(new Blob([vcard.value], { type: 'text/vcard;charset=utf-8' }), `${name.value || '名片'}.vcf`)
  toast.ok('已下载 .vcf，微信/QQ/通讯录可直接导入')
}
</script>

<template>
  <div class="wrap">
    <div class="left">
      <div class="opts-panel">
        <div class="grid2">
          <div><span class="field-label">姓名 *</span><input v-model="name" class="input" placeholder="如 张三" /></div>
          <div><span class="field-label">手机号</span><input v-model="phone" class="input" placeholder="如 13800138000" /></div>
          <div><span class="field-label">公司</span><input v-model="org" class="input" /></div>
          <div><span class="field-label">职位</span><input v-model="title" class="input" /></div>
          <div><span class="field-label">邮箱</span><input v-model="email" class="input" /></div>
          <div><span class="field-label">网址</span><input v-model="website" class="input" placeholder="https://" /></div>
        </div>
        <div class="mt-2"><span class="field-label">地址</span><input v-model="address" class="input" /></div>
        <div class="row gap mt-2">
          <span class="field-label">版本</span>
          <label class="check"><input v-model="version" type="radio" value="3.0" /> 3.0（推荐，兼容性最好）</label>
          <label class="check"><input v-model="version" type="radio" value="4.0" /> 4.0</label>
        </div>
      </div>
    </div>
    <div class="right">
      <div class="qr-box">
        <canvas ref="qrRef" width="260" height="260" class="qr"></canvas>
        <ContactRound v-if="!name && !phone && !email" :size="48" class="placeholder" />
      </div>
      <p class="hint">扫码直接保存到通讯录</p>
      <div class="row gap mt-2">
        <button class="btn btn-primary btn-sm" @click="renderQr"><ContactRound :size="15" /> 生成二维码</button>
        <button class="btn btn-sm" @click="exportVcf"><Download :size="15" /> 下载 .vcf</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: flex; gap: 24px; flex-wrap: wrap; }
.left { flex: 1 1 320px; }
.right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.qr-box { position: relative; width: 260px; height: 260px; padding: 8px; border: 1px solid var(--border); border-radius: 12px; display: grid; place-items: center; }
.qr { width: 100%; height: 100%; }
.placeholder { position: absolute; color: var(--muted); }
.gap { gap: 10px; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
