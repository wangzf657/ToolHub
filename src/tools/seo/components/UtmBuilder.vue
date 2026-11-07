<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, QrCode } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const baseUrl = ref('https://example.com/landing')
const source = ref('wechat')
const medium = ref('social')
const campaign = ref('spring-sale')
const term = ref('')
const content = ref('banner-top')

const MEDIUMS = [
  { v: 'cpc', label: 'cpc 付费点击' },
  { v: 'email', label: 'email 邮件' },
  { v: 'social', label: 'social 社交' },
  { v: 'banner', label: 'banner 横幅' },
]

const setMedium = (m: string) => (medium.value = m)

/** 用 URLSearchParams 保证中文与特殊字符正确编码 */
const builtUrl = computed(() => {
  const base = baseUrl.value.trim()
  if (!base) return ''
  try {
    const u = new URL(base)
    const sp = u.searchParams
    if (source.value.trim()) sp.set('utm_source', source.value.trim())
    if (medium.value.trim()) sp.set('utm_medium', medium.value.trim())
    if (campaign.value.trim()) sp.set('utm_campaign', campaign.value.trim())
    if (term.value.trim()) sp.set('utm_term', term.value.trim())
    if (content.value.trim()) sp.set('utm_content', content.value.trim())
    u.search = sp.toString()
    return u.toString()
  } catch {
    return ''
  }
})
const validBase = computed(() => !!builtUrl.value)

/* ---------- 二维码（动态导入 qrEngine） ---------- */
const qrBox = ref<HTMLDivElement | null>(null)
const qrBusy = ref(false)

const genQr = async () => {
  if (!builtUrl.value) {
    toast.warn('请先填写合法的基础 URL')
    return
  }
  qrBusy.value = true
  try {
    const { makeQrCanvas } = await import('@/lib/qrEngine')
    const canvas = await makeQrCanvas(builtUrl.value, { size: 240, margin: 2, dark: '#111827' })
    canvas.style.borderRadius = '10px'
    qrBox.value?.replaceChildren(canvas)
    toast.ok('二维码已生成')
  } catch {
    toast.err('二维码生成失败')
  } finally {
    qrBusy.value = false
  }
}

const dlQr = () => {
  const canvas = qrBox.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先生成二维码')
    return
  }
  canvas.toBlob((blob) => {
    if (blob) saveBlob(blob, 'utm-二维码.png')
  }, 'image/png')
}
</script>

<template>
  <div>
    <div class="form">
      <div>
        <label class="field-label">基础 URL *</label>
        <input v-model="baseUrl" class="input" :class="{ invalid: baseUrl && !validBase }" placeholder="https://example.com/landing" />
        <p v-if="baseUrl && !validBase" class="field-err">URL 无法解析，需以 http(s):// 开头并包含域名</p>
      </div>
      <div class="grid-2">
        <div><label class="field-label">utm_source 流量来源</label><input v-model="source" class="input" placeholder="如 google / wechat" /></div>
        <div><label class="field-label">utm_medium 流量媒介</label><input v-model="medium" class="input" placeholder="如 cpc / email" /></div>
        <div><label class="field-label">utm_campaign 活动名</label><input v-model="campaign" class="input" placeholder="如 spring-sale" /></div>
        <div><label class="field-label">utm_term 关键词（付费搜索可选）</label><input v-model="term" class="input" placeholder="如 在线工具" /></div>
      </div>
      <div><label class="field-label">utm_content 内容区分（A/B 测试可选）</label><input v-model="content" class="input" placeholder="如 banner-top" /></div>
    </div>

    <div class="row row-wrap mt-2">
      <span class="quick-label">常用 medium：</span>
      <button v-for="m in MEDIUMS" :key="m.v" class="chip" :class="{ active: medium === m.v }" @click="setMedium(m.v)">{{ m.label }}</button>
    </div>

    <ResultBox class="mt-2" :model-value="builtUrl" title="带 UTM 参数的完整链接" :min-height="'70px'" />

    <div class="qr-row mt-2">
      <div>
        <div class="row row-wrap">
          <button class="btn btn-primary" :disabled="qrBusy || !validBase" @click="genQr"><QrCode :size="16" /> 生成二维码</button>
          <button class="btn btn-ghost" :disabled="!qrBox?.querySelector('canvas')" @click="dlQr"><Download :size="16" /> 下载二维码</button>
        </div>
        <p class="hint mt-1">二维码在本地生成，扫码即打开带参数链接。</p>
      </div>
      <div ref="qrBox" class="qr-stage"></div>
    </div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 12px; }
.invalid { border-color: var(--err) !important; }
.field-err { margin: 4px 2px 0; font-size: 12px; color: var(--err); }
.quick-label { font-size: 13px; color: var(--text-3); }
.qr-row {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.qr-stage {
  min-width: 244px;
  min-height: 244px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  margin-left: auto;
}
.hint { font-size: 12px; color: var(--text-3); }
</style>
