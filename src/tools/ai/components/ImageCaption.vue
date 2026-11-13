<script setup lang="ts">
import { ref } from 'vue'
import { Copy, ImageIcon, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadImage, imageToCanvas, paletteFrom } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')
const previewUrl = ref('')

const engine = ref<'rule' | 'model'>('rule') // rx5 双引擎：启发式 | 端侧模型
const model = useModel('image-caption')
const confirmOpen = ref(false)
const modelCaption = ref('')
const capBusy = ref(false)

interface Analysis {
  w: number
  h: number
  main: string
  tone: string
  brightLabel: string
  detailLabel: string
  palette: { hex: string; ratio: number }[]
  description: string
  alt: string
}

const analysis = ref<Analysis | null>(null)
// rx3 alt 可编辑
const altDraft = ref('')

/** 把图像缩到小尺寸做像素统计 */
const analyze = (canvas: HTMLCanvasElement) => {
  const s = 160
  const scale = Math.min(1, s / Math.max(canvas.width, canvas.height))
  const t = document.createElement('canvas')
  t.width = Math.max(1, Math.round(canvas.width * scale))
  t.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = t.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, t.width, t.height)
  const d = ctx.getImageData(0, 0, t.width, t.height).data

  const lumas: number[] = []
  for (let i = 0; i < d.length; i += 4) {
    lumas.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
  }
  const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length
  const std = Math.sqrt(lumas.reduce((a, b) => a + (b - mean) ** 2, 0) / lumas.length)
  void std

  let edges = 0
  let pairs = 0
  const TH = 24
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width - 1; x++) {
      const i = y * t.width + x
      if (Math.abs(lumas[i] - lumas[i + 1]) > TH) edges++
      pairs++
      if (y < t.height - 1 && Math.abs(lumas[i] - lumas[i + t.width]) > TH) edges++
      pairs++
    }
  }
  const edgeDensity = edges / Math.max(1, pairs)

  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
  }
  const n = d.length / 4
  r /= n
  g /= n
  b /= n
  const tone = r - b > 18 ? '暖' : b - r > 18 ? '冷' : '中性'

  const main = paletteFrom(canvas, 3)[0]?.hex ?? '#888888'
  const brightLabel = mean > 165 ? '偏亮' : mean < 85 ? '偏暗' : '适中'
  const detailLabel = edgeDensity > 0.18 ? '包含较多细节' : edgeDensity > 0.08 ? '细节适中' : '画面简洁、细节较少'
  const toneName = tone === '中性' ? '中性' : `${tone}色调`

  return {
    w: canvas.width,
    h: canvas.height,
    main,
    tone: toneName,
    brightLabel,
    detailLabel,
    palette: paletteFrom(canvas, 5),
    description: `一张 ${canvas.width}×${canvas.height} 的图像，整体色调偏${toneName === '中性' ? '中性' : tone}（主色 ${main}），亮度${brightLabel}，${detailLabel}。`,
    alt: `${toneName}、亮度${brightLabel}的图像，${canvas.width}×${canvas.height}`,
  } satisfies Analysis
}

// rx5 端侧模型引擎（vit-gpt2 图像描述，首次下载约 90MB，下载预告 + 进度条）
const DL_FLAG = 'toolhub.imageCaption.modelOk'
let capPipeline: ((img: HTMLCanvasElement) => Promise<{ generated_text: string }[]>) | null = null

const loadCaptioner = async () => {
  if (capPipeline) return capPipeline
  model.begin()
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    ;(env as unknown as { remoteHost: string; remotePathTemplate: string }).remoteHost = 'https://hf-mirror.com'
    capPipeline = (await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') model.setProgress({ status: p.status, progress: p.progress ?? 0, file: p.file })
        else if (p.status === 'ready' || p.status === 'done') model.setProgress({ status: 'ready', progress: 100 })
      },
    })) as unknown as (img: HTMLCanvasElement) => Promise<{ generated_text: string }[]>
    model.done()
    localStorage.setItem(DL_FLAG, '1')
    return capPipeline
  } catch (e) {
    capPipeline = null
    model.fail(`模型加载失败：${(e as Error).message}（可切换网络后重试，或改用启发式引擎）`)
    throw e
  }
}

const runModelCaption = async (canvas: HTMLCanvasElement) => {
  capBusy.value = true
  modelCaption.value = ''
  try {
    const fn = capPipeline ?? (await loadCaptioner())
    const out = await fn(canvas)
    modelCaption.value = out[0]?.generated_text?.trim() ?? ''
    if (modelCaption.value) toast.ok('端侧模型描述已生成')
  } catch {
    /* 错误已写入 model.error，UI 呈现 */
  } finally {
    capBusy.value = false
  }
}

let lastCanvas: HTMLCanvasElement | null = null

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  modelCaption.value = ''
  try {
    const img = await loadImage(file)
    const canvas = imageToCanvas(img)
    lastCanvas = canvas
    // rx2 预览回显：结果卡左侧缩略
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    analysis.value = analyze(canvas)
    altDraft.value = analysis.value.alt
    if (engine.value === 'model') {
      if (capPipeline || localStorage.getItem(DL_FLAG)) void runModelCaption(canvas)
      else confirmOpen.value = true
    }
    toast.ok('描述已生成')
  } catch (e) {
    toast.err((e as Error).message || '图片解析失败')
  } finally {
    busy.value = false
  }
}

const switchEngine = (e: 'rule' | 'model') => {
  engine.value = e
  if (e === 'model' && lastCanvas) {
    if (capPipeline || localStorage.getItem(DL_FLAG)) void runModelCaption(lastCanvas)
    else confirmOpen.value = true
  }
}
const confirmYes = () => {
  confirmOpen.value = false
  if (lastCanvas) void runModelCaption(lastCanvas)
}
const confirmNo = () => {
  confirmOpen.value = false
  engine.value = 'rule'
  toast.warn('已取消模型下载，继续使用启发式引擎')
}

const doCopy = async (s: string, what: string) => {
  const okFlag = await copyText(s)
  if (okFlag) toast.ok(`${what}已复制`)
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="notice notice-warn">
      <b>诚实说明：</b>本页提供两种引擎——<b>启发式分析</b>（颜色统计 + 边缘密度，即时可用，不能识别具体物体）与
      <b>端侧模型</b>（vit-gpt2 图像描述，首次下载约 90MB，可产出含具体物体的英文描述）。均为本地运行，图片不上传。
    </div>

    <div class="row row-wrap mt-2">
      <span class="opt-label">引擎：</span>
      <button class="chip" :class="{ active: engine === 'rule' }" @click="switchEngine('rule')">启发式（即时）</button>
      <button class="chip" :class="{ active: engine === 'model' }" @click="switchEngine('model')">端侧模型（下载约 90MB）</button>
    </div>

    <FileDrop class="mt-2" accept="image/*" :multiple="false" label="拖放一张图片到此处，或点击选择" hint="仅在本地分析像素，图片从不上传" @files="onFiles" />

    <div v-if="model.state.value === 'loading'" class="notice notice-info mt-2">
      <Loader2 :size="14" class="spin" /> 模型下载中 {{ (model.progress.value.progress ?? 0).toFixed(0) }}%（约 90MB，视网速 2~5 分钟；完成后离线可用）
      <div class="progress mt-1"><div class="fill" :style="{ width: (model.progress.value.progress ?? 0) + '%' }"></div></div>
    </div>
    <div v-if="model.error" class="notice notice-err mt-2">{{ model.error }}</div>
    <div v-if="confirmOpen" class="notice notice-warn mt-2">
      端侧模型首次使用需下载约 90MB（vit-gpt2 图像描述）。
      <div class="row mt-1">
        <button class="btn btn-primary btn-sm" @click="confirmYes">同意下载</button>
        <button class="btn btn-ghost btn-sm" @click="confirmNo">取消</button>
      </div>
    </div>

    <div v-if="busy" class="notice notice-info mt-2">正在分析图像…</div>

    <template v-if="analysis">
      <div class="result mt-2">
        <!-- rx2 左图右文 -->
        <div class="r-grid">
          <img v-if="previewUrl" :src="previewUrl" class="thumb" alt="上传图片预览" />
          <div class="r-info">
            <div class="r-head">
              <ImageIcon :size="16" />
              <span>{{ fileName }}</span>
              <span class="r-dim">{{ analysis.w }} × {{ analysis.h }}</span>
            </div>
            <div class="r-palette">
              <span v-for="p in analysis.palette" :key="p.hex" class="sw" :style="{ background: p.hex }" :title="`${p.hex}（占比 ${(p.ratio * 100).toFixed(0)}%）`"></span>
              <span class="main-hex">主色 {{ analysis.main }}</span>
            </div>
          </div>
        </div>

        <div class="r-block">
          <div class="r-label">中文描述（启发式：色彩与构图统计，不含物体识别）</div>
          <p class="r-text">{{ analysis.description }}</p>
          <button class="btn btn-ghost btn-sm" @click="doCopy(analysis.description, '描述')"><Copy :size="14" /> 复制描述</button>
        </div>

        <div v-if="engine === 'model'" class="r-block">
          <div class="r-label">端侧模型描述（vit-gpt2，英文，含具体物体名词）</div>
          <p v-if="capBusy" class="r-text dim"><Loader2 :size="13" class="spin" /> 模型推理中…</p>
          <p v-else-if="modelCaption" class="r-text">{{ modelCaption }}</p>
          <p v-else class="r-text dim">（暂无模型描述）</p>
          <button v-if="modelCaption" class="btn btn-ghost btn-sm" @click="doCopy(modelCaption, '模型描述')"><Copy :size="14" /> 复制模型描述</button>
        </div>

        <div class="r-block">
          <div class="r-label">alt 无障碍文本（可编辑，建议 ≤125 字符）</div>
          <textarea v-model="altDraft" class="textarea" rows="2"></textarea>
          <div class="row">
            <span class="char-count" :class="{ over: altDraft.length > 125 }">{{ altDraft.length }} / 125 字符{{ altDraft.length > 125 ? '（超出，屏幕阅读器可能截断）' : '' }}</span>
            <button class="btn btn-ghost btn-sm ml-auto" @click="doCopy(altDraft, 'alt 文本')"><Copy :size="14" /> 复制 alt</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.spin { animation: spin 0.9s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes spin { to { transform: rotate(360deg); } }
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.opt-label { font-size: 13px; color: var(--text-3); }
.ml-auto { margin-left: auto; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.progress { height: 6px; border-radius: 3px; background: var(--surface-2, rgba(127,127,127,.15)); overflow: hidden; max-width: 420px; }
.fill { height: 100%; background: var(--accent); }
.result { border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: grid; gap: 12px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); }
.r-grid { display: flex; gap: 14px; align-items: flex-start; }
.thumb { width: 200px; height: auto; max-height: 200px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); flex: none; }
.r-info { flex: 1; min-width: 0; display: grid; gap: 10px; align-content: start; }
.r-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); }
.r-dim { margin-left: auto; color: var(--text-3); font-family: var(--font-mono); font-size: 12px; }
.r-palette { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sw { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); }
.main-hex { margin-left: 8px; font-size: 12.5px; color: var(--text-3); font-family: var(--font-mono); }
.r-block { display: grid; gap: 6px; }
.r-label { font-size: 12px; color: var(--text-3); }
.r-text { margin: 0; font-size: 14.5px; line-height: 1.7; }
.r-text.dim { color: var(--text-3); }
.char-count { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.char-count.over { color: var(--err); font-weight: 700; }
@media (max-width: 680px) { .r-grid { flex-direction: column; } }
</style>
