<script setup lang="ts">
/**
 * EXIF 信息查看（UX1.0 五处方全落地）：
 * rx1 GPS 十进制坐标 + 高德/Google 地图外链；rx2 隐私警示条（GPS/序列号/作者）；
 * rx3 扩展标签 ≥10 项（镜头/白平衡/测光/曝光补偿/色彩空间…，单项失败跳过）；
 * rx4 分组（GPS 置顶展开）+ 行复制 + 导出 JSON；rx5 完整性提示（大 EXIF 段 / XMP）。
 */
import { computed, ref } from 'vue'
import { Loader2, Copy, Download, AlertTriangle } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { saveText, copyText } from '@/lib/download'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseExifExtended, type ExifEntry } from './exifParser'

const toast = useToast()
const file = ref<File | null>(null)
const entries = ref<ExifEntry[]>([])
const loading = ref(false)
const truncated = ref('')
const openGroups = ref<Record<string, boolean>>({ GPS: true })

const GROUP_ORDER: ExifEntry['group'][] = ['GPS', '相机', '镜头', '曝光', '其他']
const grouped = computed(() => {
  const map = new Map<string, ExifEntry[]>()
  for (const e of entries.value) {
    const list = map.get(e.group) ?? []
    list.push(e)
    map.set(e.group, list)
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ name: g, items: map.get(g)! }))
})

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    entries.value = []
    truncated.value = ''
    return
  }
  const f = files[0]!
  file.value = f
  loading.value = true
  try {
    const r = await parseExifExtended(f)
    entries.value = r.entries
    truncated.value = r.truncated ?? ''
    openGroups.value = { GPS: r.gpsCount > 0 }
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

/** 隐私警示条（P0）：GPS / 序列号 / 作者任一命中即逐项列出 */
const privateRows = computed(() =>
  entries.value.filter(
    (e) => e.name.includes('GPS') || e.name === '机身序列号' || e.name === '镜头序列号' || e.name === '作者',
  ),
)

async function copyRow(e: ExifEntry) {
  const ok = await copyText(`${e.name}: ${e.value}`)
  if (ok) toast.ok(`已复制「${e.name}」`)
  else toast.err('复制失败，请手动选择文本')
}

function exportJson() {
  if (!entries.value.length) return
  const data: Record<string, string> = {}
  for (const e of entries.value) data[e.name] = e.value
  saveText(JSON.stringify(data, null, 2), 'exif.json', 'application/json;charset=utf-8')
}

const mapLinks = (e: ExifEntry) =>
  e.geo
    ? [
        { t: '高德地图', u: `https://ditu.amap.com/regeo?lng=${e.geo.lng.toFixed(6)}&lat=${e.geo.lat.toFixed(6)}` },
        { t: 'Google Maps', u: `https://www.google.com/maps/search/?api=1&query=${e.geo.lat.toFixed(6)},${e.geo.lng.toFixed(6)}` },
      ]
    : []

const isJpeg = () => (file.value?.type || '').includes('jpeg') || /\.jpe?g$/i.test(file.value?.name || '')
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放照片到此处"
      hint="支持 JPG（含相机 EXIF）；PNG / WebP 通常没有元数据"
      @files="onFiles"
    />

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="15" class="spin" /> 正在解析…</div>

    <template v-else-if="file">
      <!-- 隐私警示条（P0 rx2）：发布照片前先看清带了什么 -->
      <div v-if="privateRows.length" class="notice notice-warn mt-2" role="alert">
        <div class="row" style="gap: 6px; font-weight: 600">
          <AlertTriangle :size="15" /> 这张照片含 {{ privateRows.length }} 项隐私信息，发图前建议清除（可用「清除照片 EXIF」工具）
        </div>
        <ul class="p-list">
          <li v-for="(p, i) in privateRows" :key="i">{{ p.name }}：{{ p.value }}</li>
        </ul>
      </div>

      <div v-if="truncated" class="notice notice-info mt-2">{{ truncated }}</div>

      <div v-if="entries.length" class="mt-2">
        <div class="row" style="justify-content: space-between; margin-bottom: 6px">
          <span class="field-label">共 {{ entries.length }} 项元数据（按类分组）</span>
          <button class="btn btn-soft btn-sm" @click="exportJson"><Download :size="14" /> 导出 JSON</button>
        </div>
        <details v-for="g in grouped" :key="g.name" class="group" :open="openGroups[g.name]">
          <summary @click.prevent="openGroups[g.name] = !openGroups[g.name]">
            {{ g.name }}（{{ g.items.length }}）
          </summary>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th style="width: 40%">标签</th><th>值</th><th style="width: 90px"></th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in g.items" :key="i">
                  <td class="muted">{{ r.name }}</td>
                  <td class="mono">
                    {{ r.value }}
                    <template v-if="r.geo">
                      ·
                      <a v-for="m in mapLinks(r)" :key="m.t" :href="m.u" target="_blank" rel="noopener" class="map-link">{{ m.t }}</a>
                    </template>
                  </td>
                  <td>
                    <button class="mini-btn" title="复制该行" :aria-label="`复制 ${r.name}`" @click="copyRow(r)">
                      <Copy :size="12" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <div v-else-if="isJpeg()" class="notice notice-info mt-2">
        这张 JPG 里没有读到 EXIF —— 可能发布平台已清除，或不是相机直出照片。
      </div>
      <div v-else class="notice notice-info mt-2">
        当前格式（PNG / WebP 等）通常不包含 EXIF 元数据。想查看相机参数请提供 JPG 原片。
      </div>
    </template>

    <p class="muted small mt-2">解析完全在你的浏览器本地完成，照片不会上传到任何服务器。</p>
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
.p-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
}
.group {
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
}
.group summary {
  cursor: pointer;
  padding: 9px 12px;
  font-weight: 600;
  font-size: 13.5px;
  user-select: none;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.group .table-wrap {
  border: none;
  border-top: 1px solid var(--border);
  border-radius: 0;
}
.map-link {
  margin-right: 8px;
  color: var(--accent-text);
  text-decoration: underline;
  white-space: nowrap;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
</style>
