<script setup lang="ts">
/**
 * 清除照片 EXIF（UX1.0 五处方）：
 * - 清除验证回读（rx1）：对输出 Blob 回读 EXIF，显示「回读 0 条 ✓（原片 N 条，含 GPS：是/否）」。
 * - 结果预览（rx2）：成品图内嵌显示，可切换原图/成品核对（方向转正肉眼可判）。
 * - 批量模式（rx3）：多图逐行结果 + 单独下载 + ZIP 打包；不自动下载。
 * - 副作用披露（rx4）：处理前注明重编码行为（方向按像素原样、色彩配置文件移除）。
 * - EXIF 占比参考（rx5）：徽章区显示「其中元数据约 X KB」。
 */
import { computed, ref, shallowRef } from 'vue'
import { Loader2, Download, Package } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseExifExtended } from './exifParser'

const toast = useToast()
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const quality = ref(92)
const running = ref(false)

interface Row {
  name: string
  before: number
  after: number
  metaKB: number
  origCount: number
  hasGps: boolean
  verified: boolean
  blob: Blob | null
  outName: string
}
const files = ref<File[]>([])
const rows = ref<Row[]>([])
const showOrig = ref(false)
/** 预览（成品 / 原图切换） */
const previewUrl = ref('')
const origPreviewUrl = ref('')

const fmt = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

/** rx5：估算 JPEG 元数据段体积（APP1/APP2 总长） */
async function metaSize(f: File): Promise<number> {
  try {
    const buf = new Uint8Array(await f.slice(0, 1024 * 1024).arrayBuffer())
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return 0
    let i = 2
    let total = 0
    while (i < buf.length - 4) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]!
      if (marker === 0xda) break
      if (marker === 0xe1 || marker === 0xe2) {
        total += (buf[i + 2]! << 8) | buf[i + 3]!
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue }
      const len = (buf[i + 2]! << 8) | buf[i + 3]!
      i += 2 + len
    }
    return total
  } catch {
    return 0
  }
}

async function onFiles(list: File[]) {
  files.value = list
  rows.value = []
  showOrig.value = false
  previewUrl.value = ''
  if (origPreviewUrl.value) URL.revokeObjectURL(origPreviewUrl.value)
  origPreviewUrl.value = list.length ? URL.createObjectURL(list[0]!) : ''
}

async function run() {
  if (!files.value.length) {
    toast.warn('请先选择照片')
    return
  }
  running.value = true
  rows.value = []
  try {
    for (let i = 0; i < files.value.length; i++) {
      const f = files.value[i]!
      const info = await parseExifExtended(f)
      const metaKB = await metaSize(f)
      const canvas = await decodeToCanvas(f)
      const blob = await canvasToBlob(canvas, format.value, quality.value / 100)
      // rx1 清除验证回读
      const verify = await parseExifExtended(new Blob([blob], { type: format.value === 'image/jpeg' ? 'image/jpeg' : 'image/png' }))
      const ext = format.value === 'image/png' ? 'png' : 'jpg'
      rows.value.push({
        name: f.name,
        before: f.size,
        after: blob.size,
        metaKB,
        origCount: info.entries.length,
        hasGps: info.gpsCount > 0,
        verified: verify.entries.length === 0,
        blob,
        outName: `${baseName(f.name)}-clean.${ext}`,
      })
      if (i === 0) {
        if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
        previewUrl.value = URL.createObjectURL(blob)
      }
    }
    const okCount = rows.value.filter((r) => r.verified).length
    toast.ok(okCount === rows.value.length ? `已处理 ${rows.value.length} 张，回读验证全部为 0 条 EXIF` : `已处理 ${rows.value.length} 张（部分回读非 0，见列表）`)
  } catch (e) {
    toast.err((e as Error).message || '处理失败')
  } finally {
    running.value = false
  }
}

function downloadRow(r: Row) {
  if (r.blob) saveBlob(r.blob, r.outName)
}

async function zipAll() {
  const ok = rows.value.filter((r) => r.blob)
  if (!ok.length) return
  await saveMany(ok.map((r) => ({ name: r.outName, blob: r.blob! })), `已清除EXIF-${ok.length}张.zip`)
  toast.ok(`已打包 ${ok.length} 张`)
}

const totalSaved = computed(() => rows.value.reduce((s, r) => s + Math.max(0, r.before - r.after), 0))
</script>

<template>
  <div>
    <!-- rx4 副作用披露 -->
    <div class="notice notice-info small mb-2">
      输出将按重编码重写：方向（Orientation）按像素原样嵌入、色彩配置文件（ICC Profile）将被移除、EXIF/GPS 全部清除。
    </div>
    <FileDrop
      accept="image/jpeg,image/*"
      :multiple="true"
      label="拖放照片到此处（可批量）"
      hint="重编码后 EXIF（含 GPS 位置）将被彻底清除，回读验证"
      @files="onFiles"
    />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="width: 130px">
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
        </select>
      </label>
      <div v-if="format === 'image/jpeg'" style="min-width: 220px">
        <span class="field-label">JPG 质量：{{ quality }}%</span>
        <input v-model.number="quality" type="range" min="50" max="100" step="1" />
      </div>
      <button class="btn btn-primary" :disabled="running || !files.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" /><Download v-else :size="16" /> 清除 EXIF（不自动下载）
      </button>
    </div>

    <div v-if="rows.length" class="mt-2">
      <div class="row row-wrap" style="gap: 10px; margin-bottom: 6px">
        <span class="field-label">结果（{{ rows.length }} 张）</span>
        <button class="btn btn-soft btn-sm" @click="showOrig = !showOrig">{{ showOrig ? '看成品' : '看原图' }}</button>
        <button v-if="rows.length > 1" class="btn btn-soft btn-sm" @click="zipAll"><Package :size="14" /> 打包 ZIP</button>
      </div>

      <!-- rx2 成品预览（原图/成品切换核对） -->
      <img
        :src="showOrig ? origPreviewUrl : previewUrl"
        class="pv"
        :alt="showOrig ? '原图' : '清除后的成品图'"
      />

      <div class="list mt-2">
        <div v-for="(r, i) in rows" :key="i" class="entry">
          <span class="name" :title="r.name">{{ r.name }}</span>
          <span class="muted small">{{ fmt(r.before) }} → {{ fmt(r.after) }}</span>
          <span class="muted small">其中元数据约 {{ fmt(r.metaKB) }}（EXIF {{ r.origCount }} 条{{ r.hasGps ? '，含 GPS' : '' }}）</span>
          <span class="small" :style="{ color: r.verified ? '#34d399' : 'var(--warn)' }">
            回读 EXIF：{{ r.origCount > 0 ? '' : '' }}{{ r.verified ? '0 条 ✓' : '非 0，请重试' }}
          </span>
          <button class="btn btn-soft btn-sm" @click="downloadRow(r)"><Download :size="13" /> 下载</button>
        </div>
      </div>
      <p v-if="totalSaved > 0" class="muted small mt-1">本批合计减少 {{ fmt(totalSaved) }}（体积变化来自重编码本身，与 EXIF 大小无关）。</p>
    </div>

    <p class="muted small mt-2">PNG / WebP 本身通常不含 EXIF；此工具对任何图片重编码后输出都是「干净」的。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pv {
  max-width: 100%;
  max-height: 46vh;
  display: block;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.entry {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
}
.entry:last-child {
  border-bottom: none;
}
.name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
