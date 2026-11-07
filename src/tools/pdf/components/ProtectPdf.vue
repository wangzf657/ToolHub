<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Lock } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { protectPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 加密：设置打开密码 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pw = ref('')
const pw2 = ref('')
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!pw.value) {
    toast.warn('请输入密码')
    return
  }
  if (pw.value.length < 4) {
    toast.warn('密码至少 4 位')
    return
  }
  if (pw.value !== pw2.value) {
    toast.warn('两次输入的密码不一致')
    return
  }
  busy.value = true
  try {
    const blob = await protectPdf(file, pw.value)
    saveBlob(blob, '加密后.pdf')
    toast.ok('已加密并下载，请牢记密码')
    pw.value = ''
    pw2.value = ''
  } catch (e) {
    toast.err((e as Error).message || '加密失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-2 mt-2">
      <div>
        <span class="field-label">打开密码</span>
        <input v-model="pw" type="password" class="input" placeholder="至少 4 位" autocomplete="new-password" />
      </div>
      <div>
        <span class="field-label">确认密码</span>
        <input v-model="pw2" type="password" class="input" placeholder="再次输入" autocomplete="new-password" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Lock v-else :size="16" /> 加密并下载
      </button>
    </div>

    <p class="notice notice-warn mt-2 small">
      密码只保存在你生成的文件里，本站不留存。忘记密码将无法打开文件，请务必牢记。
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
</style>
