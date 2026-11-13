<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ArrowLeftRight, Download, FileDown, Loader2, Package } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { sfntToWoff, woffToSfnt, readFontInfo } from '@/lib/fileExt'
import type { FontInfo } from '@/lib/fileExt'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 字体格式转换（UX1.0 五处方）：
 * - name 列表弹性高度（rx1）：max-height 50vh。
 * - 下载引导（rx2）：转换成功后下载按钮变 primary 并 focus（Enter 即可下载）。
 * - 试字预览（rx3）：FontFace 加载转换产物渲染试字框（默认「永Dj 0123」）。
 * - 批量（rx4）：多文件逐行状态，一键全部转换后 ZIP 下载。
 * - TTC 选择（rx5）：读 ttcf 头 numFonts，下拉选择导出第 N 个字体。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const direction = ref<'' | 'toWoff' | 'toTtf'>('')
const info = ref<FontInfo | null>(null)
const converted = ref<{ blob: Blob; ext: string } | null>(null)
const dlBtn = ref<HTMLButtonElement | null>(null)

// rx3 试字预览
const previewText = ref('永Dj 0123')
const previewOk = ref(false)
const previewTried = ref(false)

// rx5 TTC
const ttcCount = ref(0)
const ttcIndex = ref(0)

// rx4 批量
interface BatchRow {
  name: string
  dir: 'toWoff' | 'toTtf'
  status: '待转换' | '转换中' | '完成' | '失败'
  blob?: Blob
  ext?: string
}
const batch = ref<BatchRow[]>([])

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** 按签名识别字体容器类型 */
const detect = (bytes: Uint8Array): 'sfnt' | 'woff' | 'woff2' | 'ttc' | 'unknown' => {
  const sig = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!
  if (sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74727565) return 'sfnt'
  if (sig === 0x774f4646) return 'woff'
  if (sig === 0x774f4632) return 'woff2'
  if (sig === 0x74746366) return 'ttc' // 'ttcf'
  return 'unknown'
}

/** rx5：读取 ttcf 头，切出第 i 个 sfnt（相邻偏移分界） */
function ttcSlice(bytes: Uint8Array, i: number): Uint8Array {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const num = dv.getUint32(8, false)
  const off = dv.getUint32(12 + i * 4, false)
  const end = i + 1 < num ? dv.getUint32(12 + (i + 1) * 4, false) : bytes.byteLength
  return bytes.subarray(off, end)
}

async function convertBytes(bytes: Uint8Array, kind: string, ttcIdx = 0): Promise<{ blob: Blob; ext: string; dir: 'toWoff' | 'toTtf' }> {
  let target = bytes
  if (kind === 'ttc') target = ttcSlice(bytes, ttcIdx)
  if (kind === 'sfnt' || kind === 'ttc') {
    const woff = await sfntToWoff(target)
    return { blob: new Blob([woff as BlobPart], { type: 'font/woff' }), ext: 'woff', dir: 'toWoff' }
  }
  if (kind === 'woff') {
    const sfnt = await woffToSfnt(bytes)
    return { blob: new Blob([sfnt as BlobPart], { type: 'font/ttf' }), ext: 'ttf', dir: 'toTtf' }
  }
  throw new Error('不支持的字体格式')
}

/** rx3：FontFace 试字预览 */
async function tryPreview(blob: Blob) {
  previewTried.value = false
  try {
    const url = URL.createObjectURL(blob)
    const ff = new FontFace('toolhubFontPreview', `url(${url})`)
    await ff.load()
    document.fonts.add(ff)
    previewOk.value = true
    previewTried.value = true
  } catch {
    previewOk.value = false
    previewTried.value = true
  }
}

const open = async (files: File[]) => {
  if (!files.length) return
  // rx4 批量行初始化
  batch.value = []
  for (const f of files) {
    if (!/\.(ttf|otf|woff|woff2|ttc)$/i.test(f.name)) {
      toast.warn(`「${f.name}」不是字体文件，已跳过`)
      continue
    }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const kind = detect(bytes)
      if (kind === 'woff2') {
        toast.warn(`「${f.name}」为 WOFF2（需 brotli/wasm），暂不支持`)
        continue
      }
      if (kind === 'unknown') {
        toast.warn(`「${f.name}」无法识别，已跳过`)
        continue
      }
      batch.value.push({ name: f.name, dir: kind === 'woff' ? 'toTtf' : 'toWoff', status: '待转换' })
    } catch {
      toast.warn(`「${f.name}」读取失败`)
    }
  }
  // 主文件（首个）走单文件流程
  const f = files[0]
  if (!f) return
  file.value = f
  busy.value = true
  direction.value = ''
  info.value = null
  converted.value = null
  ttcCount.value = 0
  try {
    const bytes = new Uint8Array(await f.arrayBuffer())
    const kind = detect(bytes)
    if (kind === 'woff2' || kind === 'unknown') return
    if (kind === 'ttc') {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      ttcCount.value = dv.getUint32(8, false)
      ttcIndex.value = 0
      direction.value = 'toWoff'
    } else {
      direction.value = kind === 'sfnt' ? 'toWoff' : 'toTtf'
    }
    const sfntBytes = kind === 'sfnt' ? bytes : kind === 'ttc' ? ttcSlice(bytes, 0) : await woffToSfnt(bytes)
    try {
      info.value = readFontInfo(sfntBytes)
    } catch {
      info.value = null
    }
    toast.ok(kind === 'woff' ? '已识别为 WOFF 字体' : kind === 'ttc' ? `已识别为 TTC 字体集合（${ttcCount.value} 个字体）` : '已识别为 TTF/OTF 字体')
  } catch (e) {
    toast.err((e as Error).message || '字体解析失败')
  } finally {
    busy.value = false
  }
}

const convert = async () => {
  if (!file.value || !direction.value) return
  busy.value = true
  try {
    const bytes = new Uint8Array(await file.value.arrayBuffer())
    const kind = detect(bytes)
    const r = await convertBytes(bytes, kind === 'unknown' ? '' : kind, ttcIndex.value)
    converted.value = { blob: r.blob, ext: r.ext }
    direction.value = r.dir
    toast.ok(`已转换：${fmtSize(bytes.length)} → ${fmtSize(r.blob.size)}`)
    void tryPreview(r.blob)
    // rx2：下载按钮 primary + focus（Enter 即可下载）
    await nextTick()
    dlBtn.value?.focus()
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

/** rx4：一键全部转换并打 ZIP */
const batchBusy = ref(false)
const convertAll = async () => {
  if (!batch.value.length) return
  batchBusy.value = true
  try {
    for (const row of batch.value) {
      const src = batch.value.find((b) => b.name === row.name)
      const f = [...(batchFiles.value || [])].find((x) => x.name === row.name)
      if (!f || !src) continue
      src.status = '转换中'
      try {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const r = await convertBytes(bytes, detect(bytes))
        src.blob = r.blob
        src.ext = r.ext
        src.status = '完成'
      } catch {
        src.status = '失败'
      }
    }
    const ok = batch.value.filter((r) => r.blob)
    if (ok.length) {
      await saveMany(ok.map((r) => ({ name: `${baseName(r.name)}.${r.ext}`, blob: r.blob! })), `字体转换-${ok.length}个.zip`)
      toast.ok(`已转换 ${ok.length}/${batch.value.length} 个字体并打包`)
    }
  } finally {
    batchBusy.value = false
  }
}
const batchFiles = ref<File[] | null>(null)
const onBatchFiles = (list: File[]) => {
  batchFiles.value = list
  void open(list)
}

const download = () => {
  if (!converted.value || !file.value) return
  saveBlob(converted.value.blob, `${baseName(file.value.name)}.${converted.value.ext}`)
}
</script>

<template>
  <div>
    <FileDrop accept=".ttf,.otf,.woff,.woff2,.ttc" :multiple="true" label="拖入 TTF / OTF / WOFF 字体文件（可批量）" hint="自动识别方向：TTF/OTF → WOFF 压缩，WOFF → TTF 解包；本地处理" @files="onBatchFiles" />

    <div v-if="busy" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在处理字体…</div>

    <div v-if="batch.length > 1" class="mt-2">
      <div class="row" style="justify-content: space-between; margin-bottom: 6px">
        <span class="field-label">批量转换（{{ batch.length }} 个文件）</span>
        <button class="btn btn-primary btn-sm" :disabled="batchBusy" @click="convertAll">
          <Loader2 v-if="batchBusy" :size="14" class="spin" /><Package v-else :size="14" /> 全部转换并打 ZIP
        </button>
      </div>
      <div class="list">
        <div v-for="r in batch" :key="r.name" class="entry">
          <span class="v2" :title="r.name">{{ r.name }}</span>
          <span class="k">{{ r.dir === 'toWoff' ? '→ WOFF' : '→ TTF' }}</span>
          <span class="k" :style="r.status === '失败' ? 'color:var(--warn)' : r.status === '完成' ? 'color:#34d399' : ''">{{ r.status }}</span>
        </div>
      </div>
    </div>

    <div v-if="direction" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="chip">{{ direction === 'toWoff' ? 'TTF/OTF → WOFF' : 'WOFF → TTF/OTF' }}</span>
        <template v-if="ttcCount > 1">
          <label class="row" style="gap: 6px">
            <span class="small muted">TTC 字体序号</span>
            <select v-model.number="ttcIndex" class="select" style="width: 110px">
              <option v-for="i in ttcCount" :key="i" :value="i - 1">第 {{ i }} 个字体</option>
            </select>
          </label>
        </template>
        <span class="grow"></span>
        <button class="btn btn-primary" :disabled="busy" @click="convert">
          <Loader2 v-if="busy" :size="15" class="spin" />
          <ArrowLeftRight v-else :size="15" /> 转换
        </button>
        <button v-if="converted" ref="dlBtn" class="btn btn-soft" :class="{ 'btn-primary': !!converted }" @click="download">
          <FileDown :size="15" /> 下载 .{{ converted.ext }}（回车可直接下载）
        </button>
      </div>

      <!-- rx3 试字预览 -->
      <div v-if="converted" class="try mt-2">
        <span class="field-label">试字预览（用转换产物渲染）</span>
        <input v-model="previewText" type="text" class="input" style="max-width: 420px; margin: 4px 0" placeholder="输入试字文案" />
        <div class="try-box" :style="{ fontFamily: previewOk ? 'toolhubFontPreview, sans-serif' : 'sans-serif' }">
          {{ previewText || '永Dj 0123' }}
        </div>
        <p v-if="previewTried && !previewOk" class="small" style="color: var(--warn)">字体加载失败 —— 产物可能不完整，请重新转换或换文件。</p>
      </div>
    </div>

    <div v-if="info" class="mt-2">
      <div class="stats">
        <div class="stat"><span class="k">容器格式</span><span class="v">{{ info.sfntVersion }}</span></div>
        <div class="stat"><span class="k">字形数量</span><span class="v">{{ info.numGlyphs }}</span></div>
        <div class="stat"><span class="k">unitsPerEm</span><span class="v">{{ info.unitsPerEm }}</span></div>
        <div class="stat"><span class="k">表数量</span><span class="v">{{ info.numTables }}</span></div>
      </div>

      <p v-if="info.names.length" class="small muted mt-2">name 表主要记录</p>
      <div v-if="info.names.length" class="list mt-1">
        <div v-for="n in info.names" :key="`${n.id}-${n.value}`" class="entry">
          <span class="k">{{ n.label }}</span>
          <span class="v2">{{ n.value }}</span>
        </div>
      </div>

      <p class="small muted mt-2">包含的数据表</p>
      <div class="tags mt-1">
        <span v-for="t in info.tables" :key="t.tag" class="tag">{{ t.tag }}</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      转换说明：WOFF = 原字体按表拆分后逐表 zlib 压缩再加目录（压缩无收益的表保持原样），
      解包则逐表 inflate 并按 sfnt 规范重排、重算校验和。WOFF2（brotli 压缩）暂不支持。
      .ttc 字体集合可下拉选择导出第 N 个字体。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
.grow {
  flex: 1;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12.5px;
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
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 15px;
  font-weight: 700;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 50vh; /* rx1：弹性高度 */
  overflow: auto;
}
.entry {
  display: flex;
  gap: 14px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  align-items: center;
}
.entry:last-child {
  border-bottom: none;
}
.entry .k {
  flex: none;
  width: 90px;
  color: var(--text-3);
}
.v2 {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.try-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 30px;
  line-height: 1.3;
  max-width: 460px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
</style>
