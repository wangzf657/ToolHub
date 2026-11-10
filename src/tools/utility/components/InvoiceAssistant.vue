<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Copy, Download, Save, Trash2 } from 'lucide-vue-next'
import { makeQrCanvas } from '@/lib/qrEngine'
import { copyText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface InvoiceTitle { name: string; taxId: string; addrTel: string; bank: string }
const form = ref<InvoiceTitle>({ name: '', taxId: '', addrTel: '', bank: '' })
const saved = ref<InvoiceTitle[]>(loadSaved())
const active = ref(-1)

const STORE = 'toolhub-invoice'

function loadSaved(): InvoiceTitle[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]') as InvoiceTitle[]
  } catch {
    return []
  }
}

const save = () => {
  if (!form.value.name) return toast.warn('请至少填写公司名称')
  saved.value = [form.value, ...saved.value.filter((x) => x.name !== form.value.name)].slice(0, 8)
  localStorage.setItem(STORE, JSON.stringify(saved.value))
  active.value = 0
  toast.ok('已保存到本机，下次直接选用')
}

const apply = (i: number) => {
  form.value = { ...saved.value[i]! }
  active.value = i
  void renderQr()
}

const remove = (i: number) => {
  saved.value.splice(i, 1)
  localStorage.setItem(STORE, JSON.stringify(saved.value))
}

/** 抬头二维码 payload：扫码枪/录入 App 可识别的纯文本格式 */
const payload = (): string =>
  [`名称：${form.value.name}`, form.value.taxId ? `税号：${form.value.taxId}` : '', form.value.addrTel ? `地址电话：${form.value.addrTel}` : '', form.value.bank ? `开户行及账号：${form.value.bank}` : ''].filter(Boolean).join('\n')

const qrBox = ref<HTMLDivElement | null>(null)

const renderQr = async () => {
  const box = qrBox.value
  if (!box) return
  box.innerHTML = ''
  if (!form.value.name) return
  const cv = await makeQrCanvas(payload(), { size: 220, margin: 2, errorCorrection: 'M' })
  cv.style.maxWidth = '220px'
  box.appendChild(cv)
}

const doCopy = async () => {
  const ok = await copyText(payload())
  ok ? toast.ok('已复制抬头信息') : toast.err('复制失败')
}

const download = () => {
  const cv = qrBox.value?.querySelector('canvas')
  if (!cv) return toast.warn('请先填写公司名称生成二维码')
  cv.toBlob((b) => {
    if (b) {
      saveBlob(b, '发票抬头二维码.png')
      toast.ok('已下载')
    }
  }, 'image/png')
}

onMounted(() => {
  if (saved.value.length) apply(0)
})
</script>

<template>
  <div class="wrap">
    <div class="left">
      <div class="opts-panel">
        <div class="grid2">
          <div class="full"><span class="field-label">公司名称 *</span><input v-model="form.name" class="input" placeholder="如 XX科技有限公司" @change="renderQr" /></div>
          <div><span class="field-label">纳税人识别号</span><input v-model="form.taxId" class="input mono" placeholder="18 位统一社会信用代码" @change="renderQr" /></div>
          <div><span class="field-label">地址、电话</span><input v-model="form.addrTel" class="input" @change="renderQr" /></div>
          <div class="full"><span class="field-label">开户行及账号</span><input v-model="form.bank" class="input" @change="renderQr" /></div>
        </div>
        <div class="row wrap gap mt-2">
          <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> 复制抬头</button>
          <button class="btn btn-sm" @click="save"><Save :size="14" /> 保存到本机</button>
        </div>
        <div v-if="saved.length" class="mt-2">
          <span class="field-label">已保存抬头</span>
          <div class="chips mt-1">
            <span v-for="(t, i) in saved" :key="t.name" class="chip-h" :class="{ on: active === i }" @click="apply(i)">
              {{ t.name }}
              <button class="x" title="删除" @click.stop="remove(i)"><Trash2 :size="11" /></button>
            </span>
          </div>
        </div>
        <p class="hint mt-2">抬头数据仅存浏览器本地（localStorage），不上传。开票时向店员出示右侧二维码或复制文本即可。</p>
      </div>
    </div>
    <div class="right">
      <div ref="qrBox" class="qr"></div>
      <p v-if="!form.name" class="hint">填写公司名称后生成</p>
      <button class="btn btn-sm mt-2" :disabled="!form.name" @click="download"><Download :size="14" /> 下载二维码</button>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: flex; gap: 24px; flex-wrap: wrap; }
.left { flex: 1 1 340px; }
.right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.full { grid-column: 1 / -1; }
.gap { gap: 10px; align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-h { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; cursor: pointer; }
.chip-h.on { outline: 2px solid var(--accent); }
.x { border: none; background: none; color: var(--muted); cursor: pointer; padding: 0; }
.qr { width: 240px; height: 240px; border: 1px solid var(--border); border-radius: 12px; display: grid; place-items: center; padding: 10px; }
.sr-icon { display: none; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
