<script setup lang="ts">
/** 图片转 Base64（UX1.0）：输出区弹性高度可全屏（rx1）、>100KB 阈值告警跳压缩（rx4）、精确字符数徽章（rx5） */
import { ref, computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { decodeToCanvas } from '@/lib/imageEngine'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'

const toast = useToast()
const file = ref<File | null>(null)
const dataUri = ref('')
const usePng = ref(false)
const tab = ref<'img' | 'css' | 'raw'>('img')
const origSize = ref(0)
const loading = ref(false)

const out = computed(() => {
  if (!dataUri.value) return ''
  if (tab.value === 'img') return `<img src="${dataUri.value}" alt="" />`
  if (tab.value === 'css') return `background-image: url("${dataUri.value}");`
  return dataUri.value
})

const b64Size = computed(() => dataUri.value.length)
/** rx4：原始 >100KB 时红色告警 */
const overThreshold = computed(() => origSize.value > 100 * 1024)

async function load(files: File[]) {
  if (!files.length) {
    file.value = null
    dataUri.value = ''
    return
  }
  file.value = files[0]
  origSize.value = files[0].size
  await encode()
}

async function encode() {
  if (!file.value) return
  loading.value = true
  try {
    if (usePng.value) {
      const canvas = await decodeToCanvas(file.value)
      dataUri.value = canvas.toDataURL('image/png')
    } else {
      dataUri.value = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(new Error('文件读取失败'))
        fr.readAsDataURL(file.value!)
      })
    }
  } catch (e) {
    toast.err((e as Error).message || '编码失败')
  } finally {
    loading.value = false
  }
}

const fmt = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="生成可直接粘贴进 HTML / CSS 的 data URI"
      @files="load"
    />

    <div class="row row-wrap mt-2" style="gap: 14px">
      <label class="check"><input v-model="usePng" type="checkbox" @change="encode" /> 强制重编码为 PNG（原格式含 SVG 时建议开启）</label>
      <div class="tabs">
        <button class="chip" :class="{ active: tab === 'img' }" @click="tab = 'img'">img 标签</button>
        <button class="chip" :class="{ active: tab === 'css' }" @click="tab = 'css'">CSS background</button>
        <button class="chip" :class="{ active: tab === 'raw' }" @click="tab = 'raw'">纯 dataURI</button>
      </div>
    </div>

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="15" class="spin" /> 正在编码…</div>

    <!-- rx1：下限 480px + ResultBox 弹性高度 + 全屏按钮 -->
    <ResultBox v-if="dataUri" v-model="out" title="输出结果" class="mt-2" min-height="480px" readonly />

    <div v-if="dataUri" class="row row-wrap mt-2" style="gap: 14px">
      <span class="badge badge-plain">原始：{{ fmt(origSize) }}</span>
      <span class="badge badge-plain">Base64：{{ fmt(b64Size) }}</span>
      <!-- rx5 精确字符数 -->
      <span class="badge badge-plain">字符数：{{ b64Size.toLocaleString('en-US') }}（≈原始字节 ×1.37）</span>
      <span class="badge">膨胀 ≈ +{{ Math.round(((b64Size - origSize) / Math.max(1, origSize)) * 100) }}%</span>
      <!-- rx4 阈值告警 -->
      <span v-if="overThreshold" class="badge over">内联成本高，建议先压缩 ——
        <RouterLink to="/t/compress-image-to-size" class="link">压缩图片到指定大小</RouterLink>
      </span>
      <span class="muted small">Base64 编码约比原始二进制大 33%，小图标内联划算，大图不划算</span>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.over {
  background: color-mix(in srgb, var(--err, #e5484d) 12%, transparent);
  color: var(--err, #e5484d);
  border: 1px solid color-mix(in srgb, var(--err, #e5484d) 45%, transparent);
}
.link {
  color: inherit;
  text-decoration: underline;
  font-weight: 600;
}
</style>
