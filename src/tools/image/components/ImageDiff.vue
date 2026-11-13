<script setup lang="ts">
/**
 * 图片对比找不同（UX1.0 四处方）：
 * - 偏移微调（rx1）：B 图上/下/左/右 ±1px、±10px 对齐按钮，对齐后重算。
 * - 重算防抖 + 分片（rx3）：阈值防抖 150ms，逐行分片让渡主线程，大图拖阈值不冻结。
 * - 差异区域框（rx4）：32px 网格聚合 ≥ 阈值密度区块，红框标注 + 列表点击定位。
 * - 宽高比警告（rx5）：比例不一致黄条提示，改用等比居中缩放（不再整幅形变）。
 */
import { ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const fileA = shallowRef<HTMLCanvasElement | null>(null)
const fileB = shallowRef<HTMLCanvasElement | null>(null)
const nameA = ref('')
const nameB = ref('')
const threshold = ref(30)
const diffRatio = ref(0)
const offX = ref(0)
const offY = ref(0)
const aspectWarn = ref(false)
const boxes = ref<{ x: number; y: number; w: number; h: number; ratio: number }[]>([])
const views = shallowRef<{ a: HTMLCanvasElement; b: HTMLCanvasElement; diff: HTMLCanvasElement } | null>(null)
const tab = ref<'a' | 'b' | 'diff'>('diff')
const stage = ref<HTMLElement | null>(null)
const computing = ref(false)

let mounted: HTMLCanvasElement | null = null

async function load(files: File[], which: 'a' | 'b') {
  if (!files.length) return
  try {
    const c = await decodeToCanvas(files[0])
    if (which === 'a') {
      fileA.value = c
      nameA.value = files[0].name
    } else {
      fileB.value = c
      nameB.value = files[0].name
    }
    void compute()
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

/** 让渡主线程（rx3 分片） */
const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0))

async function compute() {
  const a = fileA.value
  const b = fileB.value
  if (!a || !b) return
  computing.value = true
  await yieldFrame()
  try {
    // rx5 宽高比检查：不一致时黄条提示并等比居中缩放
    const ra = a.width / a.height
    const rb = b.width / b.height
    aspectWarn.value = Math.abs(ra - rb) / Math.max(ra, rb) > 0.02
    const w = Math.min(a.width, b.width)
    const h = Math.min(a.height, b.height)
    const norm = (c: HTMLCanvasElement, dx: number, dy: number) => {
      const t = document.createElement('canvas')
      t.width = w
      t.height = h
      const ctx = t.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      if (aspectWarn.value) {
        // 等比居中缩放（不形变）
        const s = Math.min(w / c.width, h / c.height)
        const dw = c.width * s
        const dh = c.height * s
        ctx.drawImage(c, (w - dw) / 2, (h - dh) / 2, dw, dh)
      } else {
        ctx.drawImage(c, dx, dy, w, h)
      }
      return ctx.getImageData(0, 0, w, h)
    }
    const da = norm(a, 0, 0)
    const db = norm(b, offX.value, offY.value)
    const heat = new ImageData(w, h)
    // 32px 网格差异密度（rx4）
    const gw = Math.ceil(w / 32)
    const gh = Math.ceil(h / 32)
    const grid = new Float32Array(gw * gh)
    let diffCount = 0
    const thr = threshold.value
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const dr = Math.abs(da.data[i]! - db.data[i]!)
        const dg = Math.abs(da.data[i + 1]! - db.data[i + 1]!)
        const dbl = Math.abs(da.data[i + 2]! - db.data[i + 2]!)
        const sum = dr + dg + dbl
        if (sum > thr * 3) {
          diffCount++
          grid[Math.floor(y / 32) * gw + Math.floor(x / 32)]!++
          const k = Math.min(1, sum / 384)
          heat.data[i] = 255
          heat.data[i + 1] = Math.round(60 * (1 - k))
          heat.data[i + 2] = Math.round(60 * (1 - k))
          heat.data[i + 3] = 255
        } else {
          heat.data[i] = da.data[i]! * 0.35
          heat.data[i + 1] = da.data[i + 1]! * 0.35
          heat.data[i + 2] = da.data[i + 2]! * 0.35
          heat.data[i + 3] = 255
        }
      }
      if (y % 240 === 0) await yieldFrame() // 分片让渡
    }
    diffRatio.value = diffCount / (w * h)
    // rx4：聚合差异区块（密度 > 3% 的 32px 格，相邻合并为外接矩形）
    const cellThresh = 32 * 32 * 0.03
    const mark = Array.from(grid, (n) => n >= cellThresh)
    const used = new Set<number>()
    const list: { x: number; y: number; w: number; h: number; ratio: number }[] = []
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const gi = gy * gw + gx
        if (!mark[gi] || used.has(gi)) continue
        // BFS 合并相邻格
        let minX = gx
        let maxX = gx
        let minY = gy
        let maxY = gy
        let cells = 0
        const stack = [gi]
        used.add(gi)
        while (stack.length) {
          const cur = stack.pop()!
          const cy = Math.floor(cur / gw)
          const cx = cur % gw
          cells++
          for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
            const ni = ny * gw + nx
            if (mark[ni] && !used.has(ni)) {
              used.add(ni)
              stack.push(ni)
              minX = Math.min(minX, nx)
              maxX = Math.max(maxX, nx)
              minY = Math.min(minY, ny)
              maxY = Math.max(maxY, ny)
            }
          }
        }
        let diffPx = 0
        for (let y2 = minY; y2 <= maxY; y2++) for (let x2 = minX; x2 <= maxX; x2++) diffPx += grid[y2 * gw + x2]!
        list.push({
          x: minX * 32,
          y: minY * 32,
          w: (maxX - minX + 1) * 32,
          h: (maxY - minY + 1) * 32,
          ratio: diffPx / ((maxX - minX + 1) * 32 * (maxY - minY + 1) * 32),
        })
        void cells
      }
    }
    boxes.value = list
    const toCanvas = (id: ImageData) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.putImageData(id, 0, 0)
      return c
    }
    const dSmall = toCanvas(heat)
    // 红框画到热力图上
    const dctx = dSmall.getContext('2d')!
    dctx.strokeStyle = '#3b82f6'
    dctx.lineWidth = Math.max(1.5, w / 500)
    for (const bx of list) dctx.strokeRect(bx.x, bx.y, bx.w, bx.h)
    views.value = { a: toCanvas(da), b: toCanvas(db), diff: dSmall }
  } finally {
    computing.value = false
  }
}

watch([views, tab], (v) => {
  const cur = v[0]
  if (!cur) return
  const show = tab.value === 'a' ? cur.a : tab.value === 'b' ? cur.b : cur.diff
  if (mounted) mounted.remove()
  if (stage.value) {
    show.style.maxWidth = '100%'
    show.style.height = 'auto'
    show.style.display = 'block'
    show.style.margin = '0 auto'
    stage.value.appendChild(show)
    mounted = show
  }
})

/* rx3：阈值防抖 150ms 重算 */
let timer = 0
watch(threshold, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void compute(), 150)
})

/** rx4：点击列表项 → 舞台滚动到该区域 */
function scrollToBox(b: { x: number; y: number }) {
  const st = stage.value
  if (!st) return
  const scale = st.clientWidth / Math.max(1, views.value?.diff.width ?? 1)
  st.scrollTo({
    left: Math.max(0, b.x * scale - st.clientWidth / 2),
    top: Math.max(0, b.y * scale - st.clientHeight / 2),
    behavior: 'smooth',
  })
}

function shift(dx: number, dy: number) {
  offX.value = Math.max(-200, Math.min(200, offX.value + dx))
  offY.value = Math.max(-200, Math.min(200, offY.value + dy))
  void compute()
}

async function download() {
  if (!views.value) return
  const blob = await canvasToBlob(views.value.diff, 'image/png')
  saveBlob(blob, 'image-diff.png')
}

const sizeText = (c: HTMLCanvasElement | null) => (c ? `${c.width} × ${c.height}` : '—')
</script>

<template>
  <div class="grid-2">
    <div>
      <div class="field-label">图片 A（{{ nameA || '未选择' }}，{{ sizeText(fileA) }}）</div>
      <FileDrop accept="image/*" :multiple="false" label="拖放图片 A" @files="(f) => load(f, 'a')" />
    </div>
    <div>
      <div class="field-label">图片 B（{{ nameB || '未选择' }}，{{ sizeText(fileB) }}）</div>
      <FileDrop accept="image/*" :multiple="false" label="拖放图片 B" @files="(f) => load(f, 'b')" />
    </div>
  </div>

  <template v-if="views">
    <div v-if="aspectWarn" class="notice notice-warn mt-2 small">
      两张图宽高比不一致 —— 已改用等比居中缩放（不再整幅形变）；黑边区域会按差异计入，建议使用同尺寸截图对比。
    </div>

    <div class="row row-wrap mt-2" style="gap: 14px">
      <div class="tabs">
        <button class="chip" :class="{ active: tab === 'a' }" @click="tab = 'a'">图 A</button>
        <button class="chip" :class="{ active: tab === 'b' }" @click="tab = 'b'">图 B</button>
        <button class="chip" :class="{ active: tab === 'diff' }" @click="tab = 'diff'">差异热力图</button>
      </div>
      <div style="min-width: 220px">
        <span class="field-label">差异阈值：{{ threshold }}</span>
        <input v-model.number="threshold" type="range" min="2" max="120" step="1" />
      </div>
    </div>

    <!-- rx1 偏移微调 -->
    <div class="row row-wrap mt-1" style="gap: 8px; align-items: center">
      <span class="field-label">B 图对齐微调（{{ offX }}, {{ offY }}）</span>
      <button class="chip" @click="shift(-10, 0)">←10</button>
      <button class="chip" @click="shift(-1, 0)">←1</button>
      <button class="chip" @click="shift(1, 0)">→1</button>
      <button class="chip" @click="shift(10, 0)">→10</button>
      <button class="chip" @click="shift(0, -10)">↑10</button>
      <button class="chip" @click="shift(0, -1)">↑1</button>
      <button class="chip" @click="shift(0, 1)">↓1</button>
      <button class="chip" @click="shift(0, 10)">↓10</button>
      <button class="chip" @click="((offX = 0), (offY = 0), compute())">复位</button>
    </div>

    <div v-if="tab === 'diff'" class="row row-wrap mt-1" style="gap: 12px">
      <span class="badge">差异像素占比：{{ (diffRatio * 100).toFixed(2) }}%</span>
      <span class="badge badge-plain">对比区域：{{ views.diff.width }} × {{ views.diff.height }}（取两图较小尺寸）</span>
      <span v-if="computing" class="badge badge-plain">计算中…</span>
    </div>

    <div ref="stage" class="stage mt-2"></div>

    <!-- rx4 差异区域列表 -->
    <div v-if="tab === 'diff' && boxes.length" class="mt-2">
      <span class="field-label">差异区域（{{ boxes.length }} 块，点击定位）</span>
      <div class="box-list mt-1">
        <button v-for="(b, i) in boxes" :key="i" class="box-row" @click="scrollToBox(b)">
          #{{ i + 1 }} · 坐标 ({{ b.x }}, {{ b.y }}) · {{ b.w }}×{{ b.h }} px · 区域差异 {{ (b.ratio * 100).toFixed(1) }}%
        </button>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载热力图 PNG</button>
      <span class="muted small">红色 = 有差异（越亮差异越大），蓝框 = 聚合差异区块，暗部 = 一致区域</span>
    </div>
  </template>
  <p v-else class="muted small mt-2">两张图都载入后自动开始对比；尺寸不同时会被缩放到相同大小再比较（比例不一致时等比缩放）。</p>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  overflow: auto;
  max-height: 72vh;
}
.box-list {
  display: grid;
  gap: 4px;
  max-width: 560px;
}
.box-row {
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 10px;
  background: none;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--text-2);
}
.box-row:hover {
  border-color: var(--accent);
  color: var(--text);
}
</style>
