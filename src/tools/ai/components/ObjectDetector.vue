<script setup lang="ts">
import { ref } from 'vue'
import { Download, ScanSearch, Loader2, X } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ZoomOverlay from './ZoomOverlay.vue'
import { loadImage, imageToCanvas } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')
const stage = ref<HTMLDivElement | null>(null)
const engine = ref<'rule' | 'model'>('rule')
const model = useModel('object-detector')
const confirmOpen = ref(false)

interface Box {
  x: number
  y: number
  w: number
  h: number
  pos: string
  /** 连通域原始能量（启发式内部量） */
  energy: number
  /** rx4 显著强度 0-100（启发式）或置信度 0-100（模型） */
  score: number
  label?: string
}

const boxes = ref<Box[]>([])
const zoomOpen = ref(false)
const zoomSrc = ref('')
let baseCanvas: HTMLCanvasElement | null = null

/** 位置描述：以框中心相对整图的位置命名 */
const posName = (cx: number, cy: number) => {
  const h = cx < 0.33 ? '左' : cx > 0.67 ? '右' : ''
  const v = cy < 0.33 ? '上' : cy > 0.67 ? '下' : ''
  if (!h && !v) return '中央'
  return `${h}${v}部`
}

/** 16×16 网格显著性：每格计算边缘强度 + 色差能量，连通域合并，按显著强度排序 */
const detect = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')!
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const W = canvas.width
  const H = canvas.height
  const N = 16
  const cw = W / N
  const ch = H / N
  const luma = (x: number, y: number) => {
    const i = (Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * 4
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }

  const energy: number[] = []
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x0 = gx * cw
      const y0 = gy * ch
      const step = Math.max(2, Math.round(Math.min(cw, ch) / 8))
      let grad = 0
      let cnt = 0
      let sr = 0
      let sg = 0
      let sb = 0
      let sr2 = 0
      let sg2 = 0
      let sb2 = 0
      for (let y = y0 + step / 2; y < y0 + ch; y += step) {
        for (let x = x0 + step / 2; x < x0 + cw; x += step) {
          const l = luma(x, y)
          grad += Math.abs(l - luma(x + step, y)) + Math.abs(l - luma(x, y + step))
          const i = (Math.round(y) * W + Math.round(x)) * 4
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]
          sr2 += d[i] ** 2; sg2 += d[i + 1] ** 2; sb2 += d[i + 2] ** 2
          cnt++
        }
      }
      cnt = Math.max(1, cnt)
      const mean = (sr + sg + sb) / (3 * cnt)
      const varc = (sr2 + sg2 + sb2) / (3 * cnt) - mean ** 2
      energy.push(grad / cnt / 8 + Math.sqrt(Math.max(0, varc)) / 12)
    }
  }

  const em = energy.reduce((a, b) => a + b, 0) / energy.length
  const es = Math.sqrt(energy.reduce((a, b) => a + (b - em) ** 2, 0) / energy.length)
  const th = em + 0.55 * es
  const mask = energy.map((e) => e >= th)

  const seen = new Array<boolean>(N * N).fill(false)
  const out: Box[] = []
  for (let i = 0; i < N * N; i++) {
    if (!mask[i] || seen[i]) continue
    const queue = [i]
    seen[i] = true
    let minX = N
    let maxX = -1
    let minY = N
    let maxY = -1
    let cells = 0
    let eSum = 0
    while (queue.length) {
      const cur = queue.pop()!
      const cx = cur % N
      const cy = Math.floor(cur / N)
      cells++
      eSum += energy[cur]
      minX = Math.min(minX, cx)
      maxX = Math.max(maxX, cx)
      minY = Math.min(minY, cy)
      maxY = Math.max(maxY, cy)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue
        const ni = ny * N + nx
        if (mask[ni] && !seen[ni]) {
          seen[ni] = true
          queue.push(ni)
        }
      }
    }
    if (cells < 3) continue
    const pad = 4
    const x0 = Math.max(0, Math.round(minX * cw - pad))
    const y0 = Math.max(0, Math.round(minY * ch - pad))
    out.push({
      x: x0,
      y: y0,
      w: Math.min(W, Math.round((maxX + 1) * cw + pad)) - x0,
      h: Math.min(H, Math.round((maxY + 1) * ch + pad)) - y0,
      pos: posName((minX + maxX + 1) / 2 / N, (minY + maxY + 1) / 2 / N),
      energy: eSum / cells,
      score: 0,
    })
  }
  // rx4 显著强度归一化 0-100 并按强度排序
  const maxE = Math.max(...out.map((o) => o.energy), 0.0001)
  for (const o of out) o.score = Math.round((o.energy / maxE) * 100)
  return out.sort((a, b) => b.score - a.score).slice(0, 8)
}

/** 绘制标注图 */
const renderOverlay = () => {
  if (!baseCanvas || !stage.value) return
  const out = document.createElement('canvas')
  out.width = baseCanvas.width
  out.height = baseCanvas.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(baseCanvas, 0, 0)
  ctx.font = 'bold 13px sans-serif'
  ctx.textBaseline = 'top'
  boxes.value.forEach((b, i) => {
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = Math.max(2, Math.round(out.width / 400))
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    const label = b.label ? `#${i + 1} ${b.label} ${(b.score / 100).toFixed(2)}` : `#${i + 1} ${b.score}`
    const tw = ctx.measureText(label).width + 8
    ctx.fillStyle = '#22d3ee'
    ctx.fillRect(b.x, Math.max(0, b.y - 18), tw, 16)
    ctx.fillStyle = '#06232b'
    ctx.fillText(label, b.x + 4, Math.max(2, b.y - 16))
  })
  out.className = 'annotated'
  stage.value.replaceChildren(out)
}

// rx3 移除框并同步重绘重排
const removeBox = (i: number) => {
  boxes.value.splice(i, 1)
  renderOverlay()
}

// rx5 YOLOS 端侧引擎（首次下载约 25MB，预告 + 进度条）
const DL_FLAG = 'toolhub.objectDetector.modelOk'
let detPipeline: ((img: HTMLCanvasElement) => Promise<{ score: number; label: string; box: { xmin: number; ymin: number; xmax: number; ymax: number } }[]>) | null = null

const loadDetector = async () => {
  if (detPipeline) return detPipeline
  model.begin()
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    ;(env as unknown as { remoteHost: string; remotePathTemplate: string }).remoteHost = 'https://hf-mirror.com'
    detPipeline = (await pipeline('object-detection', 'Xenova/yolos-tiny', {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') model.setProgress({ status: p.status, progress: p.progress ?? 0, file: p.file })
        else if (p.status === 'ready' || p.status === 'done') model.setProgress({ status: 'ready', progress: 100 })
      },
    })) as unknown as (img: HTMLCanvasElement) => Promise<{ score: number; label: string; box: { xmin: number; ymin: number; xmax: number; ymax: number } }[]>
    model.done()
    localStorage.setItem(DL_FLAG, '1')
    return detPipeline
  } catch (e) {
    detPipeline = null
    model.fail(`模型加载失败：${(e as Error).message}（可切换网络重试，或改用显著区域引擎）`)
    throw e
  }
}

const runModel = async (canvas: HTMLCanvasElement) => {
  busy.value = true
  try {
    const fn = detPipeline ?? (await loadDetector())
    const out = await fn(canvas)
    boxes.value = out
      .filter((o) => o.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((o) => ({
        x: Math.round(o.box.xmin),
        y: Math.round(o.box.ymin),
        w: Math.round(o.box.xmax - o.box.xmin),
        h: Math.round(o.box.ymax - o.box.ymin),
        pos: posName((o.box.xmin + o.box.xmax) / 2 / canvas.width, (o.box.ymin + o.box.ymax) / 2 / canvas.height),
        energy: 0,
        score: Math.round(o.score * 100),
        label: o.label,
      }))
    renderOverlay()
    toast.ok(boxes.value.length ? `检测到 ${boxes.value.length} 个物体` : '未检测到置信度 >0.5 的物体')
  } catch {
    /* 错误已写入 model.error */
  } finally {
    busy.value = false
  }
}

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  try {
    const img = await loadImage(file)
    baseCanvas = imageToCanvas(img)
    if (engine.value === 'model') {
      if (detPipeline || localStorage.getItem(DL_FLAG)) await runModel(baseCanvas)
      else confirmOpen.value = true
    } else {
      boxes.value = detect(baseCanvas)
      renderOverlay()
      toast.ok(boxes.value.length ? `检测到 ${boxes.value.length} 个显著区域` : '未检测到明显显著区域')
    }
  } catch (e) {
    if (!model.error.value) toast.err((e as Error).message || '图片解析失败')
  } finally {
    busy.value = false
  }
}

const switchEngine = async (e: 'rule' | 'model') => {
  engine.value = e
  if (baseCanvas) {
    if (e === 'model') {
      if (detPipeline || localStorage.getItem(DL_FLAG)) await runModel(baseCanvas)
      else confirmOpen.value = true
    } else {
      model.error.value = ''
      boxes.value = detect(baseCanvas)
      renderOverlay()
    }
  }
}
const confirmYes = () => {
  confirmOpen.value = false
  if (baseCanvas) void runModel(baseCanvas)
}
const confirmNo = () => {
  confirmOpen.value = false
  engine.value = 'rule'
  toast.warn('已取消模型下载，继续使用显著区域引擎')
}

/** rx2 点击标注图打开 1:1 大图查看层 */
const openZoom = () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  zoomSrc.value = canvas.toDataURL('image/png')
  zoomOpen.value = true
}

const dl = () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先上传图片并检测')
    return
  }
  canvas.toBlob((blob) => {
    if (blob) {
      saveBlob(blob, '物体标注.png')
      toast.ok('标注图已开始下载')
    }
  }, 'image/png')
}
</script>

<template>
  <div>
    <div class="notice notice-warn">
      <b>诚实说明：</b>本页提供两种引擎——<b>显著区域检测</b>（网格显著性 + 连通域，即时可用，非语义识别，不知道框里是猫还是汽车）与
      <b>YOLOS 端侧模型</b>（首次下载约 25MB，可输出类别名 + 置信度）。均为本地推理，图片不上传。
    </div>

    <div class="row row-wrap mt-2">
      <span class="opt-label">引擎：</span>
      <button class="chip" :class="{ active: engine === 'rule' }" @click="switchEngine('rule')">显著区域（即时）</button>
      <button class="chip" :class="{ active: engine === 'model' }" @click="switchEngine('model')">YOLOS 模型（下载约 25MB）</button>
    </div>

    <FileDrop class="mt-2" accept="image/*" :multiple="false" label="拖放一张图片到此处，或点击选择" hint="本地分析，图片从不上传" @files="onFiles" />

    <div v-if="model.state.value === 'loading'" class="notice notice-info mt-2">
      <Loader2 :size="14" class="spin" /> 模型下载中 {{ (model.progress.value.progress ?? 0).toFixed(0) }}%（约 25MB，完成后离线可用）
      <div class="progress mt-1"><div class="fill" :style="{ width: (model.progress.value.progress ?? 0) + '%' }"></div></div>
    </div>
    <div v-if="model.error" class="notice notice-err mt-2">{{ model.error }}</div>
    <div v-if="confirmOpen" class="notice notice-warn mt-2">
      端侧检测模型首次使用需下载约 25MB（YOLOS-Tiny）。
      <div class="row mt-1">
        <button class="btn btn-primary btn-sm" @click="confirmYes">同意下载</button>
        <button class="btn btn-ghost btn-sm" @click="confirmNo">取消</button>
      </div>
    </div>

    <div v-if="busy" class="notice notice-info mt-2"><Loader2 :size="14" class="spin" /> 正在分析…</div>

    <template v-if="boxes.length">
      <div class="list mt-2">
        <div v-for="(b, i) in boxes" :key="i" class="box-item">
          <span class="b-no">#{{ i + 1 }}</span>
          <span class="b-main">
            <template v-if="b.label">{{ b.label }}（置信度 {{ b.score }}%，约 {{ b.w }}×{{ b.h }} px，位于{{ b.pos }}）</template>
            <template v-else>显著区域 {{ i + 1 }}（显著强度 {{ b.score }}/100，约 {{ b.w }}×{{ b.h }} px，位于{{ b.pos }}）</template>
          </span>
          <button class="rm-btn" title="移除该框并重绘" @click="removeBox(i)"><X :size="13" /> 移除</button>
        </div>
      </div>

      <div ref="stage" class="stage mt-2" title="点击查看 1:1 大图" @click="openZoom"></div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="dl"><Download :size="16" /> 下载标注图</button>
        <button class="btn btn-ghost" @click="openZoom">1:1 放大核对框边缘</button>
      </div>
    </template>
    <div v-else-if="fileName && !busy" class="notice notice-warn mt-2">
      「{{ fileName }}」未检测到明显目标（画面可能过于均匀或模型置信度不足）。
    </div>

    <div v-if="fileName" class="row mt-2">
      <span class="chip"><ScanSearch :size="13" /> {{ fileName }}</span>
    </div>

    <ZoomOverlay v-if="zoomOpen" :src="zoomSrc" :title="`1:1 标注图 · ${fileName}`" @close="zoomOpen = false" />
  </div>
</template>

<style scoped>
.spin { animation: spin 0.9s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes spin { to { transform: rotate(360deg); } }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.opt-label { font-size: 13px; color: var(--text-3); }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.progress { height: 6px; border-radius: 3px; background: var(--surface-2, rgba(127,127,127,.15)); overflow: hidden; max-width: 420px; }
.fill { height: 100%; background: var(--accent); }
.list { display: grid; gap: 6px; }
.box-item { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 13.5px; }
.b-no { flex: none; font-weight: 700; color: #0891b2; font-family: var(--font-mono); }
.b-main { flex: 1; min-width: 0; }
.rm-btn { flex: none; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: none; border-radius: 7px; padding: 3px 9px; font-size: 12px; color: var(--text-3); cursor: pointer; }
.rm-btn:hover { border-color: var(--err); color: var(--err); }
.stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  display: grid;
  place-items: center;
  cursor: zoom-in;
  background: repeating-conic-gradient(color-mix(in srgb, var(--text-3) 8%, transparent) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
}
.annotated { max-width: 100%; max-height: 460px; border-radius: 8px; }
</style>
