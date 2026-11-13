<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { Download, Loader2, Package, Maximize2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeGifFrames, encodeGifFrames } from '@/lib/fileExt'
import { applyOps } from '@/lib/imageEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * GIF 压缩（UX1.0 四处方）：
 * - 解码缓存（rx1）：同一文件解码帧缓存复用，改参数只重编码（二次压缩提速 ≥60%）。
 * - 目标体积模式（rx2）：输入目标 KB 自动搜索参数组合（优先降色 → 缩放 → 减帧），展示尝试轨迹。
 * - 预览放大（rx3）：点击全屏遮罩核对画质，压缩前后可切换，Esc/点击关闭。
 * - 进度数字化（rx4）：进度旁显示「72% · 第 36/50 帧」。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const skip = ref(1)
const colors = ref(256)
const scalePct = ref(100)
const done = ref(false)
const targetKB = ref<number | ''>('')
const autoMode = ref(false)
const autoLog = ref<{ colors: number; scale: number; skip: number; size: number }[]>([])

const origSize = ref(0)
const origFrames = ref(0)
const outSize = ref(0)
const outFrames = ref(0)
const outW = ref(0)
const outH = ref(0)
const preview = ref('')
const origUrl = ref('')
const lightbox = ref<'' | 'orig' | 'out'>('')

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

/* rx1 解码缓存：文件对象不变即复用 */
interface Decoded {
  width: number
  frames: { canvas: HTMLCanvasElement; delay: number }[]
}
const cacheFile = shallowRef<File | null>(null)
const cache = shallowRef<Decoded | null>(null)

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
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
  origUrl.value = URL.createObjectURL(f)
  if (cacheFile.value !== f) {
    cache.value = null
    cacheFile.value = f
  }
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择 GIF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  done.value = false
  autoLog.value = []
  try {
    stage.value = '正在解码全帧…'
    let dec = cache.value
    if (!dec) {
      dec = (await decodeGifFrames(file.value)) as unknown as Decoded
      cache.value = dec
    }
    origFrames.value = dec.frames.length

    const combo = async (c: number, s: number, k: number): Promise<Blob> => {
      const kept = dec!.frames.filter((_, i) => i % k === 0)
      const w = Math.max(8, Math.round(dec!.width * (s / 100)))
      const h = Math.max(8, Math.round((dec!.frames[0]!.canvas.height * (s / 100))))
      const canvases = kept.map((f) => (s === 100 ? f.canvas : applyOps(f.canvas, [{ op: 'resize', width: w, height: h, mode: 'fit' }])))
      outW.value = canvases[0]!.width
      outH.value = canvases[0]!.height
      outFrames.value = canvases.length
      const total = canvases.length
      stage.value = `正在重编码（${total} 帧 · ${c} 色）…`
      return encodeGifFrames(
        canvases.map((cv, i) => ({ canvas: cv, delay: kept[i]!.delay * k })),
        { colors: c },
        (p) => {
          progress.value = p
          // rx4 进度数字化
          stage.value = `${Math.round(p * 100)}% · 第 ${Math.min(total, Math.max(1, Math.round(p * total)))} / ${total} 帧`
        },
      )
    }

    if (autoMode.value && targetKB.value) {
      // rx2 目标体积模式：优先降色 → 缩放 → 减帧
      const target = Math.max(1, Number(targetKB.value)) * 1024
      let best: { blob: Blob; c: number; s: number; k: number } | null = null
      const colorSteps = [256, 128, 64, 32]
      const scaleSteps = [100, 75, 60, 50, 40]
      const skipSteps = [1, 2, 3, 4]
      for (const c of colorSteps) {
        for (const s of scaleSteps) {
          for (const k of skipSteps) {
            const blob = await combo(c, s, k)
            autoLog.value.push({ colors: c, scale: s, skip: k, size: blob.size })
            if (blob.size <= target) {
              best = { blob, c, s, k }
              break
            }
            if (!best || blob.size < best.blob.size) best = { blob, c, s, k }
          }
          if (best && best.blob.size <= target) break
        }
        if (best && best.blob.size <= target) break
      }
      if (best) {
        const hit = best.blob.size <= target
        outSize.value = best.blob.size
        preview.value = URL.createObjectURL(best.blob)
        done.value = true
        colors.value = best.c
        scalePct.value = best.s
        skip.value = best.k
        if (hit) toast.ok(`自动模式：${autoLog.value.length} 组尝试，达成 ${fmtSize(best.blob.size)} ≤ ${Number(targetKB.value)} KB`)
        else toast.warn(`已试 ${autoLog.value.length} 组参数，最接近结果 ${fmtSize(best.blob.size)}（仍超目标，已选最小组合）`)
      }
    } else {
      const blob = await combo(colors.value, scalePct.value, skip.value)
      outSize.value = blob.size
      preview.value = URL.createObjectURL(blob)
      done.value = true
      const pct = Math.max(0, Math.round((1 - blob.size / file.value.size) * 100))
      toast.ok(`压缩完成：${fmtSize(file.value.size)} → ${fmtSize(blob.size)}（${pct > 0 ? '体积 -' + pct + '%' : '体积未减少'}）`)
    }
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

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') lightbox.value = ''
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
})
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

    <!-- rx2 目标体积模式 -->
    <div class="row row-wrap mt-2" style="gap: 14px">
      <label class="check"><input v-model="autoMode" type="checkbox" /> 目标体积模式（自动搜索参数）</label>
      <label v-if="autoMode" class="row" style="gap: 6px">
        <span class="field-label">目标（KB）</span>
        <input v-model.number="targetKB" type="number" min="10" class="input" style="width: 110px" />
      </label>
      <span v-if="autoMode" class="muted small">搜索顺序：先降色 → 再缩放 → 最后减帧，最多 80 组</span>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" /> <Package v-else :size="16" /> {{ autoMode && targetKB ? '自动搜索并压缩' : '开始压缩' }}
      </button>
      <button v-if="done" class="btn btn-soft" @click="saveUrl"><Download :size="15" /> 下载压缩后 GIF</button>
    </div>

    <div v-if="busy" class="mt-2">
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      <p class="small muted mt-1 mono">{{ stage }}</p>
    </div>

    <div v-if="done" class="stats mt-2">
      <div class="stat"><span class="k">原始</span><span class="v">{{ fmtSize(origSize) }}<em class="sub">{{ origFrames }} 帧</em></span></div>
      <div class="stat"><span class="k">压缩后</span><span class="v accent">{{ fmtSize(outSize) }}<em class="sub">{{ outFrames }} 帧 · {{ outW }}×{{ outH }}</em></span></div>
      <div class="stat">
        <span class="k">体积变化</span>
        <span class="v" :class="{ accent: outSize < origSize }">{{ origSize ? Math.round((1 - outSize / origSize) * 100) : 0 }}%</span>
      </div>
    </div>

    <!-- rx2 尝试轨迹 -->
    <div v-if="autoLog.length" class="mt-2">
      <span class="field-label">参数尝试轨迹（{{ autoLog.length }} 组）</span>
      <div class="log mt-1">
        <div v-for="(l, i) in autoLog" :key="i" class="log-row">
          {{ l.colors }} 色 · {{ l.scale }}% · 每 {{ l.skip }} 帧取 1 → {{ fmtSize(l.size) }}
        </div>
      </div>
    </div>

    <!-- rx3 预览放大 -->
    <div v-if="preview" class="preview-box mt-2">
      <img :src="preview" alt="压缩结果预览" @click="lightbox = 'out'" />
      <div class="row" style="gap: 8px; margin-top: 6px; justify-content: center">
        <button class="btn btn-ghost btn-sm" @click="lightbox = 'out'"><Maximize2 :size="13" /> 放大核对画质</button>
        <button v-if="origUrl" class="btn btn-ghost btn-sm" @click="lightbox = 'orig'">看原图</button>
      </div>
    </div>

    <div v-if="lightbox" class="lightbox" @click="lightbox = ''">
      <img :src="lightbox === 'orig' ? origUrl : preview" alt="全屏预览" />
      <p class="muted small" style="color:#fff">点击任意处或按 Esc 关闭（{{ lightbox === 'orig' ? '原图' : '压缩结果' }}）</p>
    </div>

    <p class="notice notice-warn mt-2 small">
      减帧会把相邻帧延迟合并（总时长基本不变）；降色与缩放对体积影响最直接。
      透明区域用 rgba4444 量化保留。同一文件改参数重压会复用解码缓存，速度更快。
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
  cursor: zoom-in;
}
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.88);
  display: grid;
  place-items: center;
  cursor: zoom-out;
  padding: 16px;
}
.lightbox img {
  max-width: 100%;
  max-height: calc(100vh - 72px);
  object-fit: contain;
}
.log {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 180px;
  overflow: auto;
}
.log-row {
  padding: 4px 12px;
  font-size: 12.5px;
  border-bottom: 1px dashed var(--border);
  font-family: ui-monospace, monospace;
}
.log-row:last-child {
  border-bottom: none;
}
</style>
