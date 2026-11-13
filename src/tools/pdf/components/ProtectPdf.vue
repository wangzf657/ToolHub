<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2, Lock } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { protectPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 加密：打开密码 + 强度反馈 + 权限位/独立权限密码（rx1/rx2） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pw = ref('')
const pw2 = ref('')
const ownerPw = ref('')
const allowPrint = ref(false)
const allowCopy = ref(false)
const allowModify = ref(false)
const allowAnnotate = ref(false)
const busy = ref(false)
const resultName = ref('')

/* ---------- 强度条：长度 + 字符种类 ---------- */
const strength = computed(() => {
  const s = pw.value
  if (!s) return 0
  const classes = [/[a-z]/.test(s), /[A-Z]/.test(s), /\d/.test(s), /[^a-zA-Z0-9]/.test(s)].filter(Boolean).length
  if (s.length >= 10 && classes >= 3) return 3
  if (s.length >= 8 && classes >= 2) return 2
  return 1
})
const strengthLabel = ['', '弱', '中', '强']

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
    const blob = await protectPdf(file, pw.value, {
      ownerPassword: ownerPw.value || undefined,
      permissions: { printing: allowPrint.value, copying: allowCopy.value, modifying: allowModify.value, annotating: allowAnnotate.value },
    })
    resultName.value = `${file.name.replace(/\.pdf$/i, '')}-加密.pdf`
    saveBlob(blob, resultName.value)
    toast.ok(`已加密并下载：${resultName.value} · 请重新打开验证密码生效`)
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
        <div v-if="pw" class="strength mt-1">
          <span class="seg" :class="{ on: strength >= 1, s1: strength === 1 }" />
          <span class="seg" :class="{ on: strength >= 2, s2: strength === 2 }" />
          <span class="seg" :class="{ on: strength >= 3, s3: strength === 3 }" />
          <span class="small" :class="{ warn: strength === 1 }">{{ strengthLabel[strength] }}</span>
          <span v-if="strength === 1" class="small muted">建议 10 位以上并混合大小写/数字/符号</span>
        </div>
      </div>
      <div>
        <span class="field-label">确认密码</span>
        <input v-model="pw2" type="password" class="input" placeholder="再次输入" autocomplete="new-password" />
      </div>
    </div>

    <!-- rx1/rx2 权限位与独立权限密码 -->
    <div class="mt-2">
      <span class="field-label">允许的操作（默认全部禁止 = 仅限阅读）</span>
      <div class="row row-wrap perm-row">
        <label class="check"><input v-model="allowPrint" type="checkbox" /> 打印</label>
        <label class="check"><input v-model="allowCopy" type="checkbox" /> 复制文字</label>
        <label class="check"><input v-model="allowModify" type="checkbox" /> 修改内容</label>
        <label class="check"><input v-model="allowAnnotate" type="checkbox" /> 批注</label>
      </div>
      <input v-model="ownerPw" type="password" class="input mt-1" style="max-width: 320px" placeholder="权限密码（可选，用于后续改权限；留空与打开密码相同）" autocomplete="new-password" />
    </div>

    <p v-if="strength === 1" class="notice notice-warn mt-2 small">当前密码强度较弱：仍可加密，但弱密码易被暴力破解，建议加强后再操作。</p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Lock v-else :size="16" /> 加密并下载
      </button>
    </div>

    <p v-if="resultName" class="notice notice-ok mt-2 small">
      已加密：<b>{{ resultName }}</b> · 请重新打开该文件验证密码已生效（打开时应提示输入密码）。
    </p>

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
.strength {
  display: flex;
  align-items: center;
  gap: 6px;
}
.seg {
  width: 34px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
}
.seg.on {
  background: var(--ok);
}
.seg.s1.on {
  background: var(--err);
}
.seg.s2.on {
  background: var(--warn);
}
.seg.s3.on {
  background: var(--ok);
}
.warn {
  color: var(--err);
}
.perm-row {
  align-items: center;
  gap: 14px;
}
</style>
