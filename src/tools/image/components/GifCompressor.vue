<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Package } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeGifFrames, encodeGifFrames } from '@/lib/fileExt'
import { applyOps } from '@/lib/imageEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * GIF 压缩：gifuct 解码全帧（disposal 合成）→ 减帧 / 降色 / 缩尺寸 → gifenc 重编码。
 * 显示前后体积与帧数对比；全部本地完成。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const skip = ref(1) // 每 N 帧取 1 帧（减帧间隔）
const colors = ref(256)
const scalePct = ref(100)
const done = ref(false)

const origSize = ref(0)
const origFrames = ref(0)
const outSize = ref(0)
const outFrames = ref(0)
const outW = ref(0)
const outH = ref(0)
const preview = ref('')

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.gif$/i.test(f.name) && f.type !== 'image/gif') {
    toast.err('请选择 GIF 文件')
    return
  }
  file.value = f
  done.value = false
  origSize.value = f.size
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择 GIF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  done.value = false
  try {
    stage.value = '正在解码全帧…'
    const { width, frames } = await decodeGifFrames(file.value)
    origFrames.value = frames.length

    // 减帧
    const kept = frames.filter((_, i) => i % skip.value === 0)
    // 缩尺寸（等比 fit）
    const w = Math.max(8, Math.round(width * (scalePct.value / 100)))
    const h = Math.max(8, Math.round((frames[0].canvas.height * (scalePct.value / 100))))
    const canvases = kept.map((f) => (scalePct.value === 100 ? f.canvas : applyOps(f.canvas, [{ op: 'resize', width: w, height: h, mode: 'fit' }])))
    outW.value = canvases[0].width
    outH.value = canvases[0].height
    outFrames.value = canvases.length

    stage.value = `正在重编码（${canvases.length} 帧 · ${colors} 色）…`
    const blob = await encodeGifFrames(
      canvases.map((c, i) => ({ canvas: c, delay: kept[i].delay * skip.value })),
      { colors: colors.value },
      (p) => (progress.value = p),
    )
    outSize.value = blob.size
    preview.value = URL.createObjectURL(blob)
    done.value = true
    const pct = Math.max(0, Math.round((1 - blob.size / file.value.size) * 100))
    toast.ok(`压缩完成：${fmtSize(file.value.size)} → ${fmtSize(blob.size)}（${pct > 0 ? '体积 -' + pct + '%' : '体积未减少'}）`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 处理失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const saveUrl = () => {
  if (!preview.value || !file.value) return
  const a = document.createElement('a')
  a.href = preview.value
  a.download = `${baseName(file.value.name)}-压缩.gif`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
</script>

<template>
  <div>
    <FileDrop accept="image/gif" :multiple="false" label="拖入 GIF 动图" hint="解码 → 减帧/降色/缩尺寸 → 重编码，全部本地完成" @files="open" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">减帧（每 {{ skip }} 帧取 1 帧）</span>
        <select v-model.number="skip" class="select">
          <option :value="1">不减帧（保留全部）</option>
          <option :value="2">2（减半，时长不变）</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
          <option :value="5">5</option>
        </select>
      </div>
      <div>
        <span class="field-label">颜色数（量化）</span>
        <select v-model.number="colors" class="select">
          <option :value="256">256 色</option>
          <option :value="128">128 色</option>
          <option :value="64">64 色</option>
          <option :value="32">32 色</option>
        </select>
      </div>
      <div>
        <span class="field-label">缩放（{{ scalePct }}%）</span>
        <input v-model.number="scalePct" type="range" class="range" min="25" max="100" step="5" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" /> <Package v-else :size="16" /> 开始压缩
      </button>
      <button v-if="done" class="btn btn-soft" @click="saveUrl"><Download :size="15" /> 下载压缩后 GIF</button>
    </div>

    <div v-if="busy" class="mt-2">
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      <p class="small muted mt-1">{{ stage }}</p>
    </div>

    <div v-if="done" class="stats mt-2">
      <div class="stat"><span class="k">原始</span><span class="v">{{ fmtSize(origSize) }}<em class="sub">{{ origFrames }} 帧</em></span></div>
      <div class="stat"><span class="k">压缩后</span><span class="v accent">{{ fmtSize(outSize) }}<em class="sub">{{ outFrames }} 帧 · {{ outW }}×{{ outH }}</em></span></div>
      <div class="stat">
        <span class="k">体积变化</span>
        <span class="v" :class="{ accent: outSize < origSize }">{{ origSize ? Math.round((1 - outSize / origSize) * 100) : 0 }}%</span>
      </div>
    </div>

    <div v-if="preview" class="preview-box mt-2"><img :src="preview" alt="压缩结果预览" /></div>

    <p class="notice notice-warn mt-2 small">
      减帧会把相邻帧延迟合并（总时长基本不变）；降色与缩放对体积影响最直接。
      透明区域用 rgba4444 量化保留。想压到指定 KB 可多次调整参数（先降色，再缩放，最后减帧）。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 130px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 16px;
  font-weight: 700;
}
.v.accent {
  color: var(--accent-text);
}
.v .sub {
  font-style: normal;
  font-size: 11.5px;
  color: var(--text-3);
  margin-left: 6px;
  font-weight: 400;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.1) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}
.preview-box img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 380px;
}
</style>
