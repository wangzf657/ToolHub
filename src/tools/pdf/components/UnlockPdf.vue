<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Unlock } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { unlockPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 解密：输入已知密码，另存为无密码版本 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pw = ref('')
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!pw.value) {
    toast.warn('请输入该文件的打开密码')
    return
  }
  busy.value = true
  try {
    const blob = await unlockPdf(file, pw.value)
    saveBlob(blob, '解密后.pdf')
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
      <span class="field-label">文件打开密码</span>
      <input v-model="pw" type="password" class="input" placeholder="输入你已知的密码" />
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Unlock v-else :size="16" /> 解密并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      仅用于解除你自己拥有权限的文件；解密后的副本不再需要密码即可打开。
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
