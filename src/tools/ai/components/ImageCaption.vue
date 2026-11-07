<script setup lang="ts">
import { ref } from 'vue'
import { Copy, ImageIcon } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadImage, imageToCanvas, paletteFrom } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')

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

  // 亮度均值与标准差（对比度）
  const lumas: number[] = []
  for (let i = 0; i < d.length; i += 4) {
    lumas.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
  }
  const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length
  const std = Math.sqrt(lumas.reduce((a, b) => a + (b - mean) ** 2, 0) / lumas.length)

  // 边缘密度：相邻像素亮度差超过阈值视为边缘
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

  // 平均色 → 色调
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

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  try {
    const img = await loadImage(file)
    const canvas = imageToCanvas(img)
    analysis.value = analyze(canvas)
    toast.ok('描述已生成')
  } catch (e) {
    toast.err((e as Error).message || '图片解析失败')
  } finally {
    busy.value = false
  }
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
      <b>诚实说明：</b>本页使用<b>本地启发式分析</b>（颜色统计 + 边缘密度）生成中文描述，并非神经网络模型，不能识别图中具体物体。
      完整图像描述模型（如 BLIP）可通过 transformers.js 端侧部署（本站已预留，需首次下载约数十 MB 模型）。
    </div>

    <FileDrop class="mt-2" accept="image/*" :multiple="false" label="拖放一张图片到此处，或点击选择" hint="仅在本地分析像素，图片从不上传" @files="onFiles" />

    <div v-if="busy" class="notice notice-info mt-2">正在分析图像…</div>

    <template v-if="analysis">
      <div class="result mt-2">
        <div class="r-head">
          <ImageIcon :size="16" />
          <span>{{ fileName }}</span>
          <span class="r-dim">{{ analysis.w }} × {{ analysis.h }}</span>
        </div>

        <div class="r-palette">
          <span
            v-for="p in analysis.palette"
            :key="p.hex"
            class="sw"
            :style="{ background: p.hex }"
            :title="`${p.hex}（占比 ${(p.ratio * 100).toFixed(0)}%）`"
          ></span>
          <span class="main-hex">主色 {{ analysis.main }}</span>
        </div>

        <div class="r-block">
          <div class="r-label">中文描述</div>
          <p class="r-text">{{ analysis.description }}</p>
          <button class="btn btn-ghost btn-sm" @click="doCopy(analysis.description, '描述')"><Copy :size="14" /> 复制描述</button>
        </div>

        <div class="r-block">
          <div class="r-label">alt 无障碍文本</div>
          <p class="r-text mono">{{ analysis.alt }}</p>
          <button class="btn btn-ghost btn-sm" @click="doCopy(analysis.alt, 'alt 文本')"><Copy :size="14" /> 复制 alt</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.result {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: grid;
  gap: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.r-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}
.r-dim { margin-left: auto; color: var(--text-3); font-family: var(--font-mono); font-size: 12px; }
.r-palette { display: flex; align-items: center; gap: 6px; }
.sw {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.main-hex { margin-left: 8px; font-size: 12.5px; color: var(--text-3); font-family: var(--font-mono); }
.r-block { display: grid; gap: 6px; }
.r-label { font-size: 12px; color: var(--text-3); }
.r-text { margin: 0; font-size: 14.5px; line-height: 1.7; }
</style>
