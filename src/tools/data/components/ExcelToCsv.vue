<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileSpreadsheet, Loader2, Download, Repeat } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { readXlsx, type SheetData } from '@/lib/officeEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** Excel 转 CSV：多 sheet 选择（可勾选打包）+ 逐表预览 + 编码档 + sticky 导出栏 */
const toast = useToast()
const fileName = ref('工作簿')
const sheets = ref<SheetData[]>([])
const activeSheet = ref(0)
/** 勾选参与打包的 sheet（默认全选） */
const picked = ref<Set<number>>(new Set())
const loading = ref(false)
const bigFile = ref(false)
const delim = ref(',')
/** 输出编码：BOM 默认（Excel 兼容）；GBK 浏览器原生不可编码，置灰说明 */
const encoding = ref<'bom' | 'utf8'>('bom')
const PREVIEW = 50

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  bigFile.value = f.size > 5 * 1024 * 1024
  try {
    // 先让出主线程让进度提示先绘制，再进入解析
    await new Promise((r) => requestAnimationFrame(r))
    sheets.value = await readXlsx(f)
    activeSheet.value = 0
    fileName.value = baseName(f.name)
    picked.value = new Set(sheets.value.map((_, i) => i))
    if (!sheets.value.length) {
      toast.warn('该工作簿没有可读取的工作表')
    } else {
      toast.ok(`已读取 ${sheets.value.length} 个工作表`)
    }
  } catch (e) {
    toast.err((e as Error).message || 'xlsx 解析失败，请确认为有效的 Excel 文件')
  } finally {
    loading.value = false
    bigFile.value = false
  }
}

const cur = computed(() => sheets.value[activeSheet.value] ?? null)
const previewRows = computed(() => cur.value?.rows.slice(0, PREVIEW) ?? [])
const pickedCount = computed(() => picked.value.size)

const sheetCsv = (s: SheetData): string => rowsToCsv(s.header, s.rows, delim.value)

const encode = (text: string): string => (encoding.value === 'bom' ? '\uFEFF' + text : text)

const togglePick = (i: number) => {
  const s = new Set(picked.value)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  picked.value = s
}

const dlCurrent = () => {
  if (!cur.value) return
  saveText(encode(sheetCsv(cur.value)), `${fileName.value}-${cur.value.name}.csv`, 'text/csv;charset=utf-8')
}

const dlAll = async () => {
  const list = sheets.value.map((s, i) => ({ s, i })).filter(({ i }) => picked.value.has(i))
  if (!list.length) return toast.warn('请先勾选要打包的工作表')
  if (list.length === 1) {
    activeSheet.value = list[0]!.i
    dlCurrent()
    return
  }
  await saveMany(
    list.map(({ s }) => ({
      name: `${fileName.value}-${s.name}.csv`,
      blob: new Blob([encode(sheetCsv(s))], { type: 'text/csv;charset=utf-8' }),
    })),
    `${fileName.value}-CSV.zip`,
  )
  toast.ok(`已打包下载 ${list.length} 个勾选工作表`)
}
</script>

<template>
  <div>
    <FileDrop accept=".xlsx,.xls" :multiple="false" label="拖放 Excel（xlsx/xls）文件，或点击选择" @files="onFiles" />
    <div v-if="loading" class="read-progress mt-2">
      <div class="bar"><div class="fill indet" /></div>
      <span class="muted small">
        {{ bigFile ? '正在读取大工作簿（>5MB，约需数秒，请稍候）…' : '正在读取…' }}
      </span>
    </div>

    <template v-if="sheets.length">
      <div class="row row-wrap mt-2">
        <label
          v-for="(s, i) in sheets"
          :key="s.name"
          class="chip sheet-chip"
          :class="{ active: activeSheet === i }"
          :title="picked.has(i) ? '已勾选参与打包，点击预览' : '未勾选，点击预览'"
        >
          <input type="checkbox" :checked="picked.has(i)" @change="togglePick(i)" />
          <span class="sheet-name" @click="activeSheet = i">{{ s.name }}（{{ s.rows.length }} 行）</span>
        </label>
      </div>

      <!-- sticky 导出栏：载入后首屏即可见，滚动预览时保持可达 -->
      <div class="row row-wrap mt-2 action-bar">
        <button class="btn btn-primary" @click="dlCurrent">
          <Download :size="16" /> 下载当前表 CSV
        </button>
        <button v-if="sheets.length > 1" class="btn" :disabled="!pickedCount" @click="dlAll">
          <Download :size="16" /> 打包勾选工作表（{{ pickedCount }}）
        </button>
        <label class="check">
          分隔符
          <select v-model="delim" class="select" style="width: 90px">
            <option value=",">逗号 ,</option>
            <option value="&#9;">制表符 Tab</option>
            <option value=";">分号 ;</option>
          </select>
        </label>
        <label class="check">
          输出编码
          <select v-model="encoding" class="select" style="width: 130px">
            <option value="bom">UTF-8（含 BOM，Excel 首选）</option>
            <option value="utf8">UTF-8（无 BOM）</option>
          </select>
        </label>
        <span class="muted small" title="浏览器原生编码能力有限，暂不支持直接输出 GBK 字节；UTF-8 带 BOM 在 Excel 中打开中文同样正常">GBK：浏览器不支持直接编码，建议 UTF-8+BOM</span>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="(h, i) in cur?.header ?? []" :key="i">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in previewRows" :key="ri">
              <td v-for="(_, ci) in cur?.header ?? []" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="(cur?.rows.length ?? 0) > PREVIEW" class="muted small mt-1">
        仅预览前 {{ PREVIEW }} 行，导出包含全部 {{ cur?.rows.length }} 行。
      </p>

      <p class="muted small mt-2">
        <Repeat :size="13" style="vertical-align: -2px" /> 需要反向转换？去
        <RouterLink to="/t/csv-to-excel">CSV 转 Excel</RouterLink>
        。
      </p>
    </template>
    <div v-else-if="!loading" class="row mt-2 muted small"><FileSpreadsheet :size="14" /> 载入 xlsx 后按工作表预览与导出。</div>
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
.read-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bar {
  flex: 1;
  max-width: 320px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill.indet {
  height: 100%;
  width: 40%;
  background: var(--accent);
  animation: indet 1.1s ease-in-out infinite;
}
@keyframes indet {
  0% { margin-left: -40%; }
  100% { margin-left: 100%; }
}
.sheet-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.sheet-name {
  cursor: pointer;
}
/* sticky 导出栏：预览表滚动时保持操作可达 */
.action-bar {
  position: sticky;
  top: 8px;
  z-index: 5;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 85%, transparent);
}
/* 预览弹性高度：视口口径 */
.table-wrap {
  height: min(420px, calc(100vh - 480px));
  min-height: 240px;
  overflow: auto;
}
</style>
