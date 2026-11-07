<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageDown, Wifi as WifiIcon } from 'lucide-vue-next'
import { makeQrCanvas, wifiPayload } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const ssid = ref('')
const password = ref('')
const encryption = ref<'WPA' | 'WEP' | 'nopass'>('WPA')
const hidden = ref(false)

const stage = ref<HTMLDivElement | null>(null)
const ready = ref(false)

const buildPayload = () => {
  const s = ssid.value.trim()
  if (!s) return ''
  return wifiPayload({
    ssid: s,
    password: encryption.value === 'nopass' ? '' : password.value,
    encryption: encryption.value,
    hidden: hidden.value,
  })
}

let seq = 0
watch([ssid, password, encryption, hidden], async () => {
  const my = ++seq
  const payload = buildPayload()
  if (!payload) {
    ready.value = false
    return
  }
  try {
    const canvas = await makeQrCanvas(payload, { size: 320, errorCorrection: 'M' })
    if (my !== seq || !stage.value) return
    stage.value.replaceChildren(canvas)
    ready.value = true
  } catch (e) {
    if (my !== seq) return
    ready.value = false
    toast.err((e as Error).message || '生成失败')
  }
}, { immediate: true })

const download = async () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  try {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('导出失败')
    saveBlob(blob, `wifi-${ssid.value.trim() || 'qr'}.png`)
  } catch (e) {
    toast.err((e as Error).message || '下载失败')
  }
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <span class="field-label">WiFi 名称（SSID）</span>
        <input v-model="ssid" class="input mono" placeholder="例如 Home-5G" />
      </div>
      <div>
        <span class="field-label">加密方式</span>
        <select v-model="encryption" class="select">
          <option value="WPA">WPA / WPA2 / WPA3</option>
          <option value="WEP">WEP（旧设备）</option>
          <option value="nopass">无密码（开放网络）</option>
        </select>
      </div>
    </div>

    <div class="mt-2" v-if="encryption !== 'nopass'">
      <span class="field-label">WiFi 密码</span>
      <input v-model="password" class="input mono" placeholder="输入密码" />
    </div>

    <label class="check mt-2">
      <input v-model="hidden" type="checkbox" />
      <span>隐藏网络（不广播 SSID）</span>
    </label>

    <div class="preview-area mt-2">
      <div v-if="ready" ref="stage" class="qr-stage"></div>
      <div v-else class="qr-empty">
        <WifiIcon :size="44" />
        <p>填写 WiFi 信息后自动生成，客人扫码即可加入</p>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!ready" @click="download">
        <ImageDown :size="16" /> 下载 PNG
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview-area {
  display: grid;
  place-items: center;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  min-height: 220px;
}
.qr-stage {
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.qr-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--text-3);
  font-size: 13.5px;
  text-align: center;
}
</style>
