<script setup lang="ts">
import { ref } from 'vue'
import { Download, ScanSearch } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadImage, imageToCanvas } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')
const stage = ref<HTMLDivElement | null>(null)

interface Box {
  x: number
  y: number
  w: number
  h: number
  pos: string
}

const boxes = ref<Box[]>([])
let baseCanvas: HTMLCanvasElement | null = null

/** 位置描述：以框中心相对整图的位置命名 */
const posName = (cx: number, cy: number) => {
  const h = cx < 0.33 ? '左' : cx > 0.67 ? '右' : ''
  const v = cy < 0.33 ? '上' : cy > 0.67 ? '下' : ''
  if (!h && !v) return '中央'
  return `${h}${v}部`
}

/** 16×16 网格显著性：每格计算边缘强度 + 色差能量，再对高分格做连通域合并 */
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

  // 每格能量：采样亮度梯度与通道方差
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
      const samples: [number, number][] = []
      for (let y = y0 + step / 2; y < y0 + ch; y += step) {
        for (let x = x0 + step / 2; x < x0 + cw; x += step) {
          const l = luma(x, y)
          grad += Math.abs(l - luma(x + step, y)) + Math.abs(l - luma(x, y + step))
          const i = (Math.round(y) * W + Math.round(x)) * 4
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]
          sr2 += d[i] ** 2; sg2 += d[i + 1] ** 2; sb2 += d[i + 2] ** 2
          cnt++
          samples.push([x, y])
        }
      }
      cnt = Math.max(1, cnt)
      const mean = (sr + sg + sb) / (3 * cnt)
      const varc = (sr2 + sg2 + sb2) / (3 * cnt) - mean ** 2
      energy.push(grad / cnt / 8 + Math.sqrt(Math.max(0, varc)) / 12)
      void samples
    }
  }

  // 阈值：均值 + 0.55 倍标准差
  const em = energy.reduce((a, b) => a + b, 0) / energy.length
  const es = Math.sqrt(energy.reduce((a, b) => a + (b - em) ** 2, 0) / energy.length)
  const th = em + 0.55 * es
  const mask = energy.map((e) => e >= th)

  // 连通域（4 邻接 BFS）→ 包围盒
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
    while (queue.length) {
      const cur = queue.pop()!
      const cx = cur % N
      const cy = Math.floor(cur / N)
      cells++
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
    if (cells < 3) continue // 过滤孤立噪声格
    const pad = 4
    out.push({
      x: Math.max(0, Math.round(minX * cw - pad)),
      y: Math.max(0, Math.round(minY * ch - pad)),
      w: Math.min(W, Math.round((maxX + 1) * cw + pad)) - Math.max(0, Math.round(minX * cw - pad)),
      h: Math.min(H, Math.round((maxY + 1) * ch + pad)) - Math.max(0, Math.round(minY * ch - pad)),
      pos: posName((minX + maxX + 1) / 2 / N, (minY + maxY + 1) / 2 / N),
    })
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 8)
}

/** 绘制标注图 */
const renderOverlay = (list: Box[]) => {
  if (!baseCanvas || !stage.value) return
  const out = document.createElement('canvas')
  out.width = baseCanvas.width
  out.height = baseCanvas.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(baseCanvas, 0, 0)
  ctx.font = 'bold 13px sans-serif'
  ctx.textBaseline = 'top'
  list.forEach((b, i) => {
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = Math.max(2, Math.round(out.width / 400))
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    const label = `#${i + 1}`
    const tw = ctx.measureText(label).width + 8
    ctx.fillStyle = '#22d3ee'
    ctx.fillRect(b.x, Math.max(0, b.y - 18), tw, 16)
    ctx.fillStyle = '#06232b'
    ctx.fillText(label, b.x + 4, Math.max(2, b.y - 16))
  })
  out.className = 'annotated'
  stage.value.replaceChildren(out)
}

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  try {
    const img = await loadImage(file)
    baseCanvas = imageToCanvas(img)
    boxes.value = detect(baseCanvas)
    renderOverlay(boxes.value)
    toast.ok(`检测到 ${boxes.value.length} 个显著区域`)
  } catch (e) {
    toast.err((e as Error).message || '图片解析失败')
  } finally {
    busy.value = false
  }
}

const dl = () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先上传图片并检测')
    return
  }
  canvas.toBlob((blob) => {
    if (blob) {
      saveBlob(blob, '显著区域标注.png')
      toast.ok('标注图已开始下载')
    }
  }, 'image/png')
}
</script>

<template>
  <div>
    <div class="notice notice-warn">
      <b>诚实说明：</b>完整 DETR 检测模型需下载约 100MB；本页提供<b>即时可用的显著区域检测</b>（网格显著性 + 连通域分析），
      框出画面中最「抓眼球」的区域，<b>并非语义物体识别</b>，不知道框里是猫还是汽车。
    </div>

    <FileDrop class="mt-2" accept="image/*" :multiple="false" label="拖放一张图片到此处，或点击选择" hint="本地分析，图片从不上传" @files="onFiles" />

    <div v-if="busy" class="notice notice-info mt-2">正在分析…</div>

    <template v-if="boxes.length">
      <div class="list mt-2">
        <div v-for="(b, i) in boxes" :key="i" class="box-item">
          <span class="b-no">#{{ i + 1 }}</span>
          <span>显著区域 {{ i + 1 }}（约 {{ b.w }}×{{ b.h }} px，位于{{ b.pos }}）</span>
        </div>
      </div>

      <div ref="stage" class="stage mt-2"></div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="dl"><Download :size="16" /> 下载标注图</button>
      </div>
    </template>
    <div v-else-if="fileName && !busy" class="notice notice-warn mt-2">
      「{{ fileName }}」未检测到明显显著区域（画面可能过于均匀）。
    </div>

    <div v-if="fileName" class="row mt-2">
      <span class="chip"><ScanSearch :size="13" /> {{ fileName }}</span>
    </div>
  </div>
</template>

<style scoped>
.list { display: grid; gap: 6px; }
.box-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13.5px;
}
.b-no {
  flex: none;
  font-weight: 700;
  color: #0891b2;
  font-family: var(--font-mono);
}
.stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  display: grid;
  place-items: center;
  background:
    repeating-conic-gradient(color-mix(in srgb, var(--text-3) 8%, transparent) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
}
.annotated {
  max-width: 100%;
  max-height: 460px;
  border-radius: 8px;
}
</style>
