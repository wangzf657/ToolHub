<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, EyeOff, Loader2, Unlock } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, unlockPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 解密：输入已知密码（或零密码直接解除限制），另存为无密码版本 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pw = ref('')
const showPw = ref(false)
const busy = ref(false)
/** 加密状态分支：unknown 检测中 / plain 未加密 / encrypted 已加密（userOpenable=无需打开密码） */
const status = ref<'unknown' | 'plain' | 'encrypted'>('unknown')
const userOpenable = ref(false)

const onFiles = () => {
  status.value = 'unknown'
  userOpenable.value = false
  pw.value = ''
  void detect()
}

/** 加密状态检测：能不带密码直接 load = 未加密；能不带密码读出页面 = 仅权限密码 */
const detect = async () => {
  const file = base.value?.files[0]
  if (!file) return
  try {
    const { PDFDocument } = await loadPdfLib()
    await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
    status.value = 'plain'
    return
  } catch {
    /* 加密文件继续检测打开密码 */
  }
  try {
    const { pdfInfo } = await import('@/lib/pdfEngine')
    await pdfInfo(file)
    userOpenable.value = true
  } catch {
    userOpenable.value = false
  }
  status.value = 'encrypted'
}

watch(() => base.value?.files[0], onFiles, { immediate: true })

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (status.value === 'plain') {
    toast.warn('该文件未加密，无需解密')
    return
  }
  if (!pw.value && !userOpenable.value) {
    toast.warn('请输入该文件的打开密码')
    return
  }
  busy.value = true
  try {
    const blob = await unlockPdf(file, pw.value)
    saveBlob(blob, `${file.name.replace(/\.pdf$/i, '')}-解密.pdf`)
    toast.ok('已解除密码保护并下载')
  } catch {
    toast.err('解密失败：密码错误，或文件不是标准的加密 PDF。请确认密码后重试。')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="mt-2">
      <span class="field-label">文件打开密码{{ userOpenable ? '（可留空）' : '' }}</span>
      <span class="pw-row">
        <input
          v-model="pw"
          :type="showPw ? 'text' : 'password'"
          class="input"
          :placeholder="userOpenable ? '该文件无需打开密码，可直接解除限制' : '输入你已知的密码'"
          :disabled="status === 'plain'"
        />
        <button class="eye" type="button" :title="showPw ? '隐藏密码' : '显示密码'" :aria-label="showPw ? '隐藏密码' : '显示密码'" @click="showPw = !showPw">
          <Eye v-if="showPw" :size="15" />
          <EyeOff v-else :size="15" />
        </button>
      </span>
    </div>

    <p v-if="status === 'plain'" class="notice notice-info mt-2 small">该文件未加密，无需解密。</p>
    <p v-else-if="status === 'encrypted'" class="notice notice-info mt-2 small">
      {{ userOpenable ? '已受权限密码保护（可直接打开），无需输入打开密码即可解除限制。' : '已受打开密码保护，请输入密码后解除。' }}
    </p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || status === 'plain'" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Unlock v-else :size="16" /> 解密并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      仅用于解除你自己拥有权限的文件；解密后的副本不再需要密码即可打开。<b>本工具无法破解或找回未知密码。</b>
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pw-row {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 420px;
}
.pw-row .input {
  padding-right: 36px;
}
.eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
}
.eye:hover {
  color: var(--text);
}
</style>
