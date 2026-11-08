<script setup lang="ts">
/** 图片批量处理：批量压缩（目标 KB 二分）/ 批量改尺寸 / 批量格式转换，4 路并发 + ZIP 打包 */
import { ref } from 'vue'
import { Loader2, Package, X } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

type Op = 'compress' | 'resize' | 'convert'
const op = ref<Op>('compress')
const targetKB = ref(200)
const outFormat = ref<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg')
const width = ref<number | ''>('')
const height = ref<number | ''>('')
const quality = ref(85)

interface Row {
  name: string
  before: number
  after: number
  status: 'ok' | 'fail'
  msg: string
  blob: Blob | null
  outName: string
}

const rows = ref<Row[]>([])
const running = ref(false)
const done = ref(0)
const total = ref(0)
const packed = ref(false)

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)
const extOf = (mime: string) => (mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'png')

/** 二分质量逼近目标体积，仍超则逐步降分辨率（最低 32%） */
async function compressOne(file: File): Promise<{ blob: Blob; outName: string }> {
  const src = await decodeToCanvas(file)
  const target = Math.max(5, targetKB.value) * 1024
  const mime = outFormat.value === 'image/png' ? 'image/jpeg' : outFormat.value // PNG 无质量参数，统一走 JPG
  let scale = 1
  for (;;) {
    const draw = (s: number) => {
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(src.width * s))
      c.height = Math.max(1, Math.round(src.height * s))
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      ctx.drawImage(src, 0, 0, c.width, c.height)
      return c
    }
    let c = draw(scale)
    let lo = 0.05
    let hi = 0.95
    let best = await canvasToBlob(c, mime, lo)
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      const r = await canvasToBlob(c, mime, mid)
      if (r.size <= target) {
        best = r
        lo = mid
      } else {
        hi = mid
      }
      if (hi - lo < 0.03) break
    }
    if (best.size <= target || scale <= 0.32) {
      const dot = file.name.lastIndexOf('.')
      const base = dot > 0 ? file.name.slice(0, dot) : file.name
      return { blob: best, outName: `${base}-compressed.${extOf(mime)}` }
    }
    scale = Math.max(0.32, scale * 0.8)
    c = draw(scale)
  }
}

/** 统一改尺寸/格式（空值 = 保持该边） */
async function resizeOrConvertOne(file: File, isResize: boolean): Promise<{ blob: Blob; outName: string }> {
  const src = await decodeToCanvas(file)
  const w = isResize && width.value ? Number(width.value) : src.width
  const h = isResize && height.value ? Number(height.value) : src.height
  const ratio = isResize
    ? width.value && height.value
      ? Math.min(w / src.width, h / src.height)
      : w !== src.width
        ? w / src.width
        : h / src.height
    : 1
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(src.width * ratio))
  c.height = Math.max(1, Math.round(src.height * ratio))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const mime = isResize && outFormat.value === 'image/png' ? 'image/png' : outFormat.value
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(src, 0, 0, c.width, c.height)
  const blob = await canvasToBlob(c, mime, quality.value / 100)
  const dot = file.name.lastIndexOf('.')
  const base = dot > 0 ? file.name.slice(0, dot) : file.name
  const suffix = isResize ? `-${c.width}x${c.height}` : '-converted'
  return { blob, outName: `${base}${suffix}.${extOf(mime)}` }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return results
}

const run = async () => {
  if (!dropFiles.value.length) {
    toast.warn('请先添加图片')
    return
  }
  running.value = true
  rows.value = []
  packed.value = false
  try {
    const files = dropFiles.value
    total.value = files.length
    done.value = 0
    const results = await pool(files, 4, async (f): Promise<Row> => {
      const row: Row = { name: f.name, before: f.size, after: 0, status: 'fail', msg: '', blob: null, outName: '' }
      try {
        const r =
          op.value === 'compress'
            ? await compressOne(f)
            : await resizeOrConvertOne(f, op.value === 'resize')
        row.blob = r.blob
        row.outName = r.outName
        row.after = r.blob.size
        row.status = 'ok'
      } catch (e) {
        row.msg = (e as Error).message || '处理失败'
      }
      done.value++
      return row
    })
    rows.value = results
    const ok = results.filter((r) => r.status === 'ok').length
    const failed = results.length - ok
    if (failed) toast.warn(`完成 ${ok} 张，失败 ${failed} 张（见列表原因）`)
    else toast.ok(`已处理 ${ok} 张图片`)
  } finally {
    running.value = false
  }
}

const dropRef = ref<InstanceType<typeof FileDrop> | null>(null)
const dropFiles = ref<File[]>([])
const onFiles = (list: File[]) => {
  dropFiles.value = list
  rows.value = []
  packed.value = false
}

const packZip = async () => {
  const files = rows.value.filter((r) => r.blob && r.outName).map((r) => ({ name: r.outName, blob: r.blob! }))
  if (!files.length) return
  await saveMany(files, files.length > 1 ? '批量处理结果.zip' : files[0].name)
  packed.value = true
  toast.ok(files.length > 1 ? `已打包 ${files.length} 个文件为 ZIP` : '已下载')
}

const removeRow = (i: number) => {
  rows.value.splice(i, 1)
}
</script>

<template>
  <div>
    <FileDrop ref="dropRef" accept="image/*" :multiple="true" label="拖放多张图片到此处（支持 50 张）" hint="批量压缩 / 改尺寸 / 格式转换 · 全部本地处理" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">批量操作</span>
        <select v-model="op" class="select" style="width: 150px">
          <option value="compress">压缩到目标体积</option>
          <option value="resize">批量改尺寸</option>
          <option value="convert">批量格式转换</option>
        </select>
      </label>
      <template v-if="op === 'compress'">
        <label class="opt">
          <span class="field-label">目标大小（KB）</span>
          <input v-model.number="targetKB" type="number" min="5" class="input" style="width: 110px" />
        </label>
        <label class="opt">
          <span class="field-label">输出格式</span>
          <select v-model="outFormat" class="select" style="width: 120px">
            <option value="image/jpeg">JPG</option>
            <option value="image/webp">WebP</option>
          </select>
        </label>
      </template>
      <template v-else>
        <label class="opt">
          <span class="field-label">宽（px，可留空）</span>
          <input v-model.number="width" type="number" min="1" class="input" style="width: 110px" placeholder="自动" />
        </label>
        <label class="opt">
          <span class="field-label">高（px，可留空）</span>
          <input v-model.number="height" type="number" min="1" class="input" style="width: 110px" placeholder="自动" />
        </label>
        <label class="opt">
          <span class="field-label">格式</span>
          <select v-model="outFormat" class="select" style="width: 120px">
            <option value="image/jpeg">JPG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
        <label v-if="op === 'convert'" class="opt">
          <span class="field-label">质量（%）</span>
          <input v-model.number="quality" type="number" min="10" max="100" class="input" style="width: 90px" />
        </label>
      </template>
      <button class="btn btn-primary" :disabled="running || !dropFiles.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Package v-else :size="16" /> 开始处理
      </button>
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round((done / Math.max(1, total)) * 100) + '%' }" /></div>
    </div>
    <p v-if="running" class="muted small mt-1">正在处理 {{ done }}/{{ total }}（4 路并发）…</p>

    <div v-if="rows.length" class="mt-2">
      <table class="result-table">
        <thead>
          <tr><th>文件</th><th>原大小</th><th>处理后</th><th>节省</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td class="ellipsis" :title="r.status === 'fail' ? r.msg : r.outName">
              {{ r.name }}<span v-if="r.status === 'fail'" class="fail-msg"> — {{ r.msg }}</span>
            </td>
            <td>{{ fmtSize(r.before) }}</td>
            <td>{{ r.status === 'ok' ? fmtSize(r.after) : '失败' }}</td>
            <td>{{ r.status === 'ok' ? `${Math.max(0, Math.round((1 - r.after / Math.max(1, r.before)) * 100))}%` : '—' }}</td>
            <td><button class="icon-btn" title="移除" @click="removeRow(i)"><X :size="13" /></button></td>
          </tr>
        </tbody>
      </table>
      <div class="row mt-2">
        <button class="btn btn-primary" @click="packZip"><Package :size="15" /> {{ rows.filter((r) => r.blob).length > 1 ? '打包下载 ZIP' : '下载' }}</button>
        <span v-if="packed" class="muted small">已保存，可重复点击重新打包</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.result-table th,
.result-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.result-table th {
  color: var(--text-3);
  font-weight: 500;
  font-size: 12px;
}
.ellipsis {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fail-msg {
  color: var(--danger, #d9534f);
  font-size: 12px;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
}
.icon-btn:hover {
  color: var(--accent-text);
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
