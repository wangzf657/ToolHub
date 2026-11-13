<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye, EyeOff, ImageDown, ScanLine, Wifi as WifiIcon } from 'lucide-vue-next'
import { makeQrCanvas, scanQr, wifiPayload } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const ssid = ref('')
const password = ref('')
const encryption = ref<'WPA' | 'WEP' | 'nopass'>('WPA')
const hidden = ref(false)
const showPw = ref(false)

const stage = ref<HTMLDivElement | null>(null)
const ready = ref(false)
/** WPA 密码长度前置校验：不足 8 位不生成无效码 */
const pwTooShort = computed(() => encryption.value === 'WPA' && password.value.length > 0 && password.value.length < 8)
const pwEmpty = computed(() => encryption.value === 'WPA' && password.value.length === 0)

const selfCheck = ref<'' | 'ok' | 'fail'>('')

const buildPayload = () => {
  const s = ssid.value.trim()
  if (!s) return ''
  if (encryption.value === 'WPA' && password.value.length < 8) return ''
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
  selfCheck.value = ''
  if (!payload) {
    ready.value = false
    return
  }
  try {
    const canvas = await makeQrCanvas(payload, { size: 320, errorCorrection: 'M' })
    if (my !== seq || !stage.value) return
    stage.value.replaceChildren(canvas)
    ready.value = true
    // 生成后反扫自检：确认导出图可被识别（含 ; 等特殊字符转义正确性回归）
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (blob) {
        await scanQr(blob)
        if (my === seq) selfCheck.value = 'ok'
      }
    } catch {
      if (my === seq) selfCheck.value = 'fail'
    }
  } catch (e) {
    if (my !== seq) return
    ready.value = false
    toast.err((e as Error).message || '生成失败')
  }
}, { immediate: true })

const getBlob = async (): Promise<Blob | null> => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return null
  return new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
}

const download = async () => {
  const blob = await getBlob()
  if (!blob) return
  saveBlob(blob, `wifi-${ssid.value.trim() || 'qr'}.png`)
}

const copyImage = async () => {
  const blob = await getBlob()
  if (!blob) return
  try {
    // canvas.toBlob + Clipboard API：复制后可在微信/聊天框 Ctrl+V 直接粘贴
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.ok('二维码图片已复制，可直接粘贴（如微信 Ctrl+V）')
  } catch {
    toast.err('复制失败：当前浏览器不支持图片剪贴板写入，请改用下载')
  }
}

/* ---------- 宾客立牌卡导出：A6 比例，含 SSID/加密/密码明文 + 二维码 ---------- */
const downloadCard = async () => {
  const qr = stage.value?.querySelector('canvas')
  if (!qr || !ready.value) return
  const W = 744
  const H = 1048 // A6 纵向比例（105:148）
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111827'
  ctx.textAlign = 'center'
  ctx.font = '600 44px system-ui, sans-serif'
  ctx.fillText('扫码连接 Wi-Fi', W / 2, 110)
  ctx.font = '400 26px system-ui, sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('用手机相机扫描下方二维码', W / 2, 156)
  ctx.drawImage(qr, (W - 460) / 2, 200, 460, 460)
  ctx.textAlign = 'left'
  const rows: [string, string][] = [
    ['WiFi 名称', ssid.value.trim()],
    ['加密方式', encryption.value === 'nopass' ? '开放网络（无密码）' : encryption.value],
    ['密码', encryption.value === 'nopass' ? '—（无需密码）' : password.value],
  ]
  let y = 720
  for (const [k, v] of rows) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '400 26px system-ui, sans-serif'
    ctx.fillText(k, 90, y)
    ctx.fillStyle = '#111827'
    ctx.font = '600 30px ui-monospace, monospace'
    ctx.fillText(v.length > 24 ? `${v.slice(0, 23)}…` : v, 90, y + 42)
    y += 100
  }
  ctx.fillStyle = '#9ca3af'
  ctx.font = '400 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(hidden.value ? '该网络已隐藏，请在 WLAN 设置中选择「添加网络」' : '扫描后无需输入密码即可加入网络', W / 2, H - 60)
  cv.toBlob((blob) => {
    if (blob) saveBlob(blob, `wifi-card-${ssid.value.trim() || 'qr'}.png`)
  }, 'image/png')
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
      <div class="pw-line">
        <input
          v-model="password" class="input mono" :type="showPw ? 'text' : 'password'" placeholder="输入密码"
          autocomplete="off"
        />
        <button class="eye-btn" :title="showPw ? '隐藏密码' : '显示密码'" :aria-label="showPw ? '隐藏密码' : '显示密码'" @click="showPw = !showPw">
          <EyeOff v-if="showPw" :size="16" /><Eye v-else :size="16" />
        </button>
      </div>
      <p v-if="pwTooShort" class="pw-warn">WPA 密码至少 8 位（当前 {{ password.length }} 位），补足后才能生成有效二维码</p>
      <p v-else-if="pwEmpty" class="pw-warn soft">WPA 网络需要密码（至少 8 位）</p>
    </div>

    <label class="check mt-2">
      <input v-model="hidden" type="checkbox" />
      <span>隐藏网络（不广播 SSID）</span>
    </label>

    <div class="preview-area mt-2">
      <div v-if="ready" ref="stage" class="qr-stage"></div>
      <div v-else class="qr-empty">
        <WifiIcon :size="44" />
        <p>{{ pwTooShort ? '密码不足 8 位，无法生成有效码' : '填写 WiFi 信息后自动生成，客人扫码即可加入' }}</p>
      </div>
      <div v-if="selfCheck" class="self-check" :class="selfCheck">
        <ScanLine :size="15" />
        {{ selfCheck === 'ok' ? '已验证可识别（生成后自动反扫自检）' : '⚠ 自检未通过：请检查内容或缩短 SSID/密码后重试' }}
      </div>
      <div v-if="ready" class="preview-actions">
        <button class="btn btn-primary btn-sm" @click="download"><ImageDown :size="15" /> 下载 PNG</button>
        <button class="btn btn-soft btn-sm" @click="copyImage">复制图片</button>
        <button class="btn btn-ghost btn-sm" @click="downloadCard">导出宾客立牌卡</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pw-line {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pw-line .input {
  flex: 1;
}
.eye-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
}
.eye-btn:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}
.pw-warn {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: #d97706;
}
.pw-warn.soft {
  color: var(--text-3);
}
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
.self-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12.5px;
  padding: 4px 12px;
  border-radius: 999px;
}
.self-check.ok {
  color: var(--ok);
  background: rgba(52, 211, 153, 0.1);
}
.self-check.fail {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}
.preview-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 14px;
}
</style>
