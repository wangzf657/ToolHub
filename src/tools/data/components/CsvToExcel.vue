<script setup lang="ts">
import { ref } from 'vue'
import { FileSpreadsheet, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { rowsToXlsx, smartCell } from '@/lib/officeEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV/TSV/JSON 转 Excel：smartCell 自动识别数字类型，生成 xlsx；分隔符与输入编码可选 */
const toast = useToast()
const csvText = ref('')
const fileName = ref('数据')
const data = ref<CsvData | null>(null)
const loading = ref(false)
/** 分隔符：auto = 引擎自动嗅探 */
const delim = ref<'auto' | ',' | ';' | '\t'>('auto')
/** 文件输入编码：GBK/Big5 用 TextDecoder 解码（浏览器原生支持） */
const encoding = ref<'utf-8' | 'gbk' | 'big5'>('utf-8')

/** 类型披露：统计「非空值多数为数字」的列数 */
const numericCols = (d: CsvData): number => {
  let n = 0
  for (let c = 0; c < d.header.length; c++) {
    const vals = d.rows.map((r) => (r[c] ?? '').trim()).filter((v) => v !== '')
    if (!vals.length) continue
    const nums = vals.filter((v) => !Number.isNaN(Number(v))).length
    if (nums / vals.length >= 0.8) n++
  }
  return n
}

const parseOpts = () => ({ delimiter: delim.value === 'auto' ? '' : delim.value })

const fromText = async () => {
  if (!csvText.value.trim()) {
    toast.warn('请先粘贴 CSV / TSV 内容')
    return
  }
  loading.value = true
  try {
    fileName.value = '粘贴数据'
    data.value = await parseCsvAsync(csvText.value, parseOpts())
    if (!data.value.rows.length) throw new Error('没有数据行')
    toast.ok(`已解析 ${data.value.rows.length} 行 × ${data.value.header.length} 列（${numericCols(data.value)} 列已识别为数字）`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    fileName.value = baseName(f.name)
    const lower = f.name.toLowerCase()
    if (lower.endsWith('.json')) {
      const arr = JSON.parse(await f.text())
      if (!Array.isArray(arr) || !arr.length) throw new Error('JSON 需为非空对象数组')
      const header = [...new Set(arr.flatMap((o: Record<string, unknown>) => Object.keys(o)))]
      data.value = {
        header,
        rows: arr.map((o: Record<string, unknown>) =>
          header.map((h) => (o[h] === undefined || o[h] === null ? '' : String(o[h]))),
        ),
      }
    } else {
      // 编码档：按所选编码解码文件字节（UTF-8 默认；GBK/Big5 供旧文件）
      const buf = await f.arrayBuffer()
      const text = new TextDecoder(encoding.value).decode(buf)
      data.value = await parseCsvAsync(text, parseOpts())
    }
    if (!data.value.rows.length) throw new Error('没有数据行')
    toast.ok(`已解析 ${data.value.rows.length} 行 × ${data.value.header.length} 列（${numericCols(data.value)} 列已识别为数字）`)
  } catch (e) {
    toast.err((e as Error).message || '文件解析失败')
  } finally {
    loading.value = false
  }
}

const buildXlsx = async (): Promise<Blob> => {
  if (!data.value) throw new Error('请先载入数据')
  // smartCell：纯数字串转为 number，Excel 中可直接参与计算
  const rows = data.value.rows.map((r) => r.map((c) => smartCell(c ?? '')))
  return rowsToXlsx(data.value.header, rows, 'Sheet1')
}
</script>

<template>
  <div>
    <div class="input-panel">
      <div class="label">粘贴 CSV / TSV 内容</div>
      <textarea
        v-model="csvText"
        class="textarea mono"
        style="min-height: 140px"
        placeholder="姓名,分数&#10;张三,92.5&#10;李四,88"
      ></textarea>
      <div class="row row-wrap mt-1">
        <label class="check">
          分隔符
          <select v-model="delim" class="select" style="width: 100px">
            <option value="auto">自动识别</option>
            <option value=",">逗号 ,</option>
            <option value=";">分号 ;</option>
            <option value="&#9;">制表符 Tab</option>
          </select>
        </label>
        <button class="btn btn-primary" :disabled="loading" @click="fromText">
          <Loader2 v-if="loading" :size="16" class="spin" />
          <FileSpreadsheet v-else :size="16" />
          解析文本
        </button>
      </div>
    </div>

    <div class="mt-2">
      <FileDrop accept=".csv,.tsv,.txt,.json" :multiple="false" label="拖放 CSV / TSV / JSON 文件，或点击选择" @files="onFiles" />
      <label class="check small mt-1">
        文件编码
        <select v-model="encoding" class="select" style="width: 110px">
          <option value="utf-8">UTF-8</option>
          <option value="gbk">GBK（简体中文）</option>
          <option value="big5">Big5（繁体中文）</option>
        </select>
      </label>
    </div>

    <template v-if="data">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ data.rows.length }} 行 × {{ data.header.length }} 列</span>
        <span class="badge badge-plain">{{ numericCols(data) }} 列已识别为数字</span>
      </div>
      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr><th v-for="(h, i) in data.header" :key="i">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in data.rows.slice(0, 50)" :key="ri">
              <td v-for="(_, ci) in data.header" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <DownloadButton :produce="buildXlsx" :default-name="`${fileName}.xlsx`" button-text="转换并下载 xlsx" />
      <p class="muted small mt-1">数字与日期自动识别为真实类型，Excel 中可直接求和与排序。</p>
    </template>
  </div>
</template>

<style scoped>
.input-panel {
  display: grid;
  gap: 8px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* 预览弹性高度：视口口径 */
.table-wrap {
  height: min(300px, calc(100dvh - 460px));
  min-height: 200px;
  overflow: auto;
}
</style>
