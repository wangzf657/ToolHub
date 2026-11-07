<script setup lang="ts">
import { ref } from 'vue'
import { FileSpreadsheet, Braces } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { parseCsvAsync } from '@/lib/csvEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('')
const output = ref('')
const delim = ref(',')
const toNumber = ref(true)
const headerRow = ref(true)
const fileName = ref('')
const rowCount = ref(0)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  fileName.value = files[0].name
  text.value = await files[0].text()
  convert()
}

const convert = async () => {
  if (!text.value.trim()) {
    toast.warn('请先粘贴 CSV 内容或拖入文件')
    return
  }
  try {
    const { header, rows } = await parseCsvAsync(text.value, { delimiter: delim.value, header: headerRow.value })
    const cast = (s: string): unknown => {
      if (!toNumber.value) return s
      if (s !== '' && !Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s.trim())) return Number(s)
      if (s === 'true' || s === 'false') return s === 'true'
      return s
    }
    const objects = rows.map((r) => {
      const o: Record<string, unknown> = {}
      header.forEach((h, i) => (o[h] = cast(r[i] ?? '')))
      return o
    })
    output.value = JSON.stringify(objects, null, 2)
    rowCount.value = objects.length
    toast.ok(`转换完成，共 ${objects.length} 行`)
  } catch (e) {
    toast.err(`解析失败：${(e as Error).message}`)
  }
}

const sample = () => {
  text.value = '姓名,年龄,城市\n张三,28,北京\n李四,35,上海'
  convert()
}
</script>

<template>
  <div class="c2j">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <span class="field-label" style="margin: 0">分隔符</span>
      <select v-model="delim" class="select" style="width: 110px">
        <option value=",">逗号 ,</option>
        <option value=";">分号 ;</option>
        <option :value="'\t'">制表符</option>
      </select>
      <label class="check"><input v-model="headerRow" type="checkbox" /> 首行为表头</label>
      <label class="check"><input v-model="toNumber" type="checkbox" /> 数字自动转为 number</label>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="sample">填入示例</button>
    </div>

    <FileDrop label="拖入 CSV 文件，或直接在下方粘贴" accept=".csv,.tsv,.txt" :multiple="false" @files="onFiles" />

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">CSV 输入{{ fileName ? `（${fileName}）` : '' }}</span>
        <textarea v-model="text" class="textarea mono" style="min-height: 240px" placeholder="姓名,年龄,城市&#10;张三,28,北京"></textarea>
      </div>
      <ResultBox v-model="output" title="JSON 输出" download="json" min-height="240px" />
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="convert"><Braces :size="16" /> 转换为 JSON</button>
      <span v-if="rowCount" class="muted small">共 {{ rowCount }} 条记录</span>
      <FileSpreadsheet v-if="!text" :size="16" class="muted" />
    </div>
  </div>
</template>

<style scoped>
.c2j :deep(.select) {
  padding: 7px 32px 7px 12px;
  font-size: 13.5px;
}
</style>
