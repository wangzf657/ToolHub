<script setup lang="ts">
import { ref } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/download'
import { ScanText, Loader2 } from 'lucide-vue-next'

/** 图片文字识别（OCR）：tesseract.js 端侧推理，首次使用下载语言包，之后浏览器缓存可离线 */
const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const running = ref(false)
const progressPct = ref(0)
const statusText = ref('')
const result = ref('')

const langs = [
  { value: 'chi_sim+eng', label: '简体中文 + 英文（推荐）' },
  { value: 'eng', label: '英文' },
  { value: 'chi_sim', label: '仅简体中文' },
  { value: 'chi_tra+eng', label: '繁体中文 + 英文' },
  { value: 'jpn', label: '日文' },
  { value: 'kor', label: '韩文' },
]
const lang = ref('chi_sim+eng')

const runOcr = async () => {
  const canvas = base.value?.source ?? base.value?.output
  if (!canvas) {
    toast.warn('请先上传要识别的图片')
    return
  }
  running.value = true
  progressPct.value = 0
  statusText.value = '准备加载识别引擎…'
  result.value = ''
  try {
    const Tesseract = await import('tesseract.js')
    const { data } = await Tesseract.recognize(canvas, lang.value, {
      logger: (m: { status: string; progress: number }) => {
        progressPct.value = Math.round((m.progress ?? 0) * 100)
        if (m.status === 'loading tesseract core') statusText.value = '加载识别核心…'
        else if (m.status === 'initializing tesseract') statusText.value = '初始化…'
        else if (m.status === 'loading language traineddata') statusText.value = '下载语言包（首次使用，之后缓存）…'
        else if (m.status === 'recognizing text') statusText.value = '正在识别文字…'
        else statusText.value = m.status
      },
    })
    result.value = (data.text ?? '').trim()
    if (!result.value) toast.warn('未识别到文字，请尝试更清晰的图片')
    else toast.ok('识别完成')
  } catch (e) {
    toast.err((e as Error).message || '识别失败（首次使用需要联网下载语言包）')
  } finally {
    running.value = false
  }
}

const doCopy = async () => {
  const okFlag = await copyText(result.value)
  okFlag ? toast.ok('已复制') : toast.err('复制失败')
}
const doDownload = () => saveText(result.value, '识别结果.txt')
</script>

<template>
  <div>
    <ImageToolBase
      ref="base"
      accept="image/*"
      :downloadable="false"
      label="拖放图片到此处，或点击选择"
      hint="支持照片、扫描件与截图 · 端侧识别，图片从不上传"
    />

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">识别语言</span>
        <select v-model="lang" class="select" style="width: 220px">
          <option v-for="l in langs" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="running || !base?.source" @click="runOcr">
        <Loader2 v-if="running" :size="16" class="spin" />
        <ScanText v-else :size="16" />
        开始识别
      </button>
    </div>

    <div v-if="running" class="ocr-progress mt-2">
      <div class="ocr-bar" :style="{ width: progressPct + '%' }"></div>
      <span class="muted small">{{ statusText }} {{ progressPct }}%</span>
    </div>

    <div v-if="running || result" class="mt-2">
      <div class="notice notice-info small mb-2">
        首次使用会从公共源下载识别模型（约 10–20MB），完成后浏览器缓存，之后可离线识别。
      </div>
      <div class="io-head">
        <span class="io-title">识别结果（{{ result.length }} 字符）</span>
        <span class="row" style="gap: 6px">
          <button class="btn btn-soft btn-sm" :disabled="!result" @click="doCopy">复制</button>
          <button class="btn btn-ghost btn-sm" :disabled="!result" @click="doDownload">下载 .txt</button>
        </span>
      </div>
      <textarea v-model="result" class="textarea mono" readonly placeholder="识别出的文字将显示在这里…"></textarea>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.ocr-progress {
  display: grid;
  gap: 6px;
}
.ocr-progress .ocr-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.25s ease;
}
.ocr-progress {
  position: relative;
}
.ocr-progress::before {
  content: '';
  position: absolute;
  top: 0;
  height: 6px;
  width: 100%;
  border-radius: 999px;
  background: var(--border);
}
.ocr-bar {
  position: relative;
  z-index: 1;
}
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
