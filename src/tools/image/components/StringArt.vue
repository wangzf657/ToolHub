<script setup lang="ts">
/** 弦线艺术生成器：圆周钉板 + 贪心连线（残差最大优先），输出 SVG 预览与钉位顺序 */
import { ref, shallowRef } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas } from '@/lib/imageEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'

const toast = useToast()
const src = shallowRef<HTMLCanvasElement | null>(null)
const pins = ref(180)
const lineCount = ref(1200)
const running = ref(false)
const progress = ref(0)
const svg = ref('')
const orderText = ref('')
let runId = 0

const S = 200 // 采样边长
const CENTER = S / 2
const R = S / 2 - 2

async function onFiles(files: File[]) {
  if (!files.length) {
    src.value = null
    svg.value = ''
    orderText.value = ''
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

async function generate() {
  const c = src.value
  if (!c) return
  running.value = true
  progress.value = 0
  const myRun = ++runId
  try {
    // 1. 中心方裁 → 200×200 灰度残差
    const side = Math.min(c.width, c.height)
    const t = document.createElement('canvas')
    t.width = S
    t.height = S
    const tctx = t.getContext('2d')!
    tctx.drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, S, S)
    const d = tctx.getImageData(0, 0, S, S).data
    const residual = new Float32Array(S * S)
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      residual[p] = (255 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])) / 255
    }
    // 2. 钉位（圆周均布）
    const N = pins.value
    const px = new Float64Array(N)
    const py = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2
      px[i] = CENTER + R * Math.cos(a)
      py[i] = CENTER + R * Math.sin(a)
    }
    // 3. 贪心连线：每次选与当前残差和最大的对角
    const minSep = Math.max(2, Math.floor(N / 40))
    const linesOut: [number, number][] = []
    let current = 0
    const total = Math.min(lineCount.value, 3000)
    for (let step = 0; step < total; step++) {
      let best = -1
      let bestScore = -1
      for (let j = 0; j < N; j++) {
        const dist = Math.abs(j - current)
        if (dist < minSep || N - dist < minSep) continue
        const dx = px[j] - px[current]
        const dy = py[j] - py[current]
        const len = Math.hypot(dx, dy)
        const steps = Math.max(4, Math.floor(len / 2))
        let score = 0
        for (let k = 1; k < steps; k++) {
          const x = Math.round(px[current] + (dx * k) / steps)
          const y = Math.round(py[current] + (dy * k) / steps)
          score += residual[y * S + x]
        }
        if (score > bestScore) {
          bestScore = score
          best = j
        }
      }
      if (best < 0) break
      // 沿线削减残差
      const dx = px[best] - px[current]
      const dy = py[best] - py[current]
      const len = Math.hypot(dx, dy)
      const steps = Math.max(4, Math.floor(len / 2))
      for (let k = 1; k < steps; k++) {
        const x = Math.round(px[current] + (dx * k) / steps)
        const y = Math.round(py[current] + (dy * k) / steps)
        const idx = y * S + x
        residual[idx] = Math.max(0, residual[idx] - 0.25)
      }
      linesOut.push([current, best])
      current = best
      // 分片让出主线程
      if (step % 24 === 23) {
        progress.value = Math.round(((step + 1) / total) * 100)
        await new Promise((r) => setTimeout(r, 0))
        if (myRun !== runId) return
      }
    }
    // 4. 输出 SVG 与钉位顺序
    const parts: string[] = []
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">`)
    parts.push(`<rect width="${S}" height="${S}" fill="#ffffff"/>`)
    parts.push(`<circle cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke="#dddddd" stroke-width="0.5"/>`)
    for (const [a, b] of linesOut) {
      parts.push(`<line x1="${px[a].toFixed(1)}" y1="${py[a].toFixed(1)}" x2="${px[b].toFixed(1)}" y2="${py[b].toFixed(1)}" stroke="#1a1a1a" stroke-width="0.4" stroke-opacity="0.45"/>`)
    }
    for (let i = 0; i < N; i++) {
      parts.push(`<circle cx="${px[i].toFixed(1)}" cy="${py[i].toFixed(1)}" r="1.1" fill="#1a1a1a"/>`)
    }
    parts.push('</svg>')
    svg.value = parts.join('\n')
    orderText.value = linesOut.map(([a, b]) => `${a + 1} → ${b + 1}`).join('，')
    progress.value = 100
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  } finally {
    running.value = false
  }
}

function downloadSvg() {
  if (svg.value) saveText(svg.value, 'string-art.svg', 'image/svg+xml')
}
function downloadOrder() {
  if (orderText.value) saveText(orderText.value, 'string-art-order.txt')
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放一张轮廓清晰的图片到此处"
      hint="人像 / 剪影效果最好；全部计算在本地完成"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 18px">
        <div class="chips">
          <span class="field-label">钉子数：</span>
          <button v-for="n in [120, 180, 240]" :key="n" class="chip" :class="{ active: pins === n }" @click="pins = n">{{ n }}</button>
        </div>
        <div style="min-width: 220px">
          <span class="field-label">线数：{{ lineCount }}</span>
          <input v-model.number="lineCount" type="range" min="500" max="3000" step="100" />
        </div>
        <button class="btn btn-primary" :disabled="running" @click="generate">
          <Loader2 v-if="running" :size="16" class="spin" /><Download v-else :size="16" /> 生成弦线画
        </button>
        <button class="btn btn-ghost btn-sm" @click="((src = null), (svg = ''))">换一张</button>
      </div>

      <div v-if="running" class="progress mt-2"><div class="progress-bar" :style="{ width: progress + '%' }"></div></div>

      <div v-if="svg" class="mt-3">
        <div class="grid-2">
          <div class="svg-box" v-html="svg"></div>
          <div>
            <p class="muted small">
              钉位顺序从顶部钉子按顺时针编号 1..{{ pins }}。实物制作：选 {{ pins }} 颗钉围成圆框，按顺序用细线（0.15mm 左右）在钉间往返缠绕即可。
            </p>
            <ResultBox v-model="orderText" title="钉位顺序" class="mt-1" min-height="150px" readonly />
            <div class="row row-wrap mt-2">
              <button class="btn btn-ghost btn-sm" @click="downloadSvg"><Download :size="14" /> 下载 SVG</button>
              <button class="btn btn-ghost btn-sm" @click="downloadOrder"><Download :size="14" /> 下载顺序 TXT</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
}
.svg-box {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px;
  background: #ffffff;
}
.svg-box :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.15s ease;
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
