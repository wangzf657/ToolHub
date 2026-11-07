<script setup lang="ts">
import { ref } from 'vue'
import { Lock, Unlock, ShieldCheck, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { encryptFile, decryptFile, isEncryptedFile } from '@/lib/cryptoFile'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const files = ref<File[]>([])
const password = ref('')
const busy = ref<'' | 'enc' | 'dec'>('')

const onFiles = (list: File[]) => {
  files.value = list
}

const outputNameFor = (name: string, mode: 'enc' | 'dec') => {
  if (mode === 'enc') return name.toLowerCase().endsWith('.wzf') ? name : `${name}.wzf`
  return name.toLowerCase().endsWith('.wzf') ? name.replace(/\.wzf$/i, '') : `${name}.dec`
}

const run = async (mode: 'enc' | 'dec') => {
  const file = files.value[0]
  if (!file) {
    toast.warn('请先选择要处理的文件')
    return
  }
  if (!password.value) {
    toast.warn('请输入密码')
    return
  }
  busy.value = mode
  try {
    let blob: Blob
    let name: string
    if (mode === 'enc') {
      blob = await encryptFile(file, password.value)
      name = outputNameFor(file.name, 'enc')
      toast.ok(`已加密 ${file.name}`)
    } else {
      if (!(await isEncryptedFile(file))) {
        toast.warn('该文件不是本工具生成的加密文件，请确认选择「加密」或检查文件')
        return
      }
      blob = await decryptFile(file, password.value)
      name = outputNameFor(file.name, 'dec')
      toast.ok(`已解密 ${file.name}`)
    }
    saveBlob(blob, name)
  } catch (e) {
    toast.err((e as Error).message || '处理失败')
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="*"
      :multiple="false"
      label="拖入或点击选择任意文件"
      hint="AES-256-GCM + PBKDF2，密钥从不出设备"
      @files="onFiles"
    />

    <div class="mt-2">
      <span class="field-label">密码</span>
      <input
        v-model="password"
        type="password"
        class="input mono"
        placeholder="设置加密密码 / 输入解密密码"
      />
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="!!busy || !files.length" @click="run('enc')">
        <Loader2 v-if="busy === 'enc'" :size="16" class="spinner" />
        <Lock v-else :size="16" /> 加密并下载（.wzf）
      </button>
      <button class="btn btn-ghost" :disabled="!!busy || !files.length" @click="run('dec')">
        <Loader2 v-if="busy === 'dec'" :size="16" class="spinner" />
        <Unlock v-else :size="16" /> 解密并下载
      </button>
    </div>

    <div class="notice notice-info mt-2 small">
      <ShieldCheck :size="16" />
      加密后文件自动加 <code>.wzf</code> 扩展名；解密时自动识别加密文件并去掉该扩展名。算法为 Web Crypto 的 AES-256-GCM，密钥由密码经 PBKDF2（31 万次迭代）派生，全程在浏览器内完成。忘记密码将无法恢复文件。
    </div>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.notice {
  align-items: center;
}
</style>
