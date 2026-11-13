<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Ruler, ArrowDown, ArrowUp } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const root = ref(Number(localStorage.getItem('toolhub.pxrem-root') || 16))
watch(root, (v) => localStorage.setItem('toolhub.pxrem-root', String(v)))
const pxInput = ref('')
const remInput = ref('')
/** 最近编辑方向（rx1）：改根字号后沿该方向重算 */
const lastEdit = ref<'px' | 'rem' | ''>('')
/** 父字号（rx5）：em 列口径 */
const parent = ref(16)
const parentNum = computed(() => (parent.value > 0 ? parent.value : rootNum.value))
/** 批量模式（rx2） */
const mode = ref<'single' | 'batch'>('single')
const batchInput = ref('')
const batchOutput = ref('')

const rootNum = computed(() => (root.value > 0 ? root.value : 16))

/** 根字号变化 → 双向重算（rx1） */
watch(rootNum, () => {
  if (lastEdit.value === 'px') onPx()
  else if (lastEdit.value === 'rem') onRem()
})

const onPx = () => {
  lastEdit.value = 'px'
  const n = Number(pxInput.value)
  remInput.value = pxInput.value === '' || Number.isNaN(n) ? '' : String(Number((n / rootNum.value).toFixed(4)))
}
const onRem = () => {
  lastEdit.value = 'rem'
  const n = Number(remInput.value)
  pxInput.value = remInput.value === '' || Number.isNaN(n) ? '' : String(Number((n * rootNum.value).toFixed(2)))
}

/** 批量：任意 CSS 文本中的 Npx → Nrem（保留原格式，rx2） */
const runBatch = () => {
  batchOutput.value = batchInput.value.replace(/(-?\d+(?:\.\d+)?)px\b/gi, (m, num: string) => {
    const n = Number(num)
    if (Number.isNaN(n)) return m
    return `${Number((n / rootNum.value).toFixed(4))}rem`
  })
}
watch(batchInput, runBatch)
watch(rootNum, () => {
  if (mode.value === 'batch') runBatch()
})
const copyBatch = async () => {
  const ok = await copyText(batchOutput.value)
  ok ? toast.ok('批量转换结果已复制') : toast.err('复制失败')
}

const COMMON = [4, 8, 12, 16, 24, 32]

const copyTable = async () => {
  const text = COMMON.map((p) => `${p}px = ${(p / rootNum.value).toFixed(3)}rem`).join('\n')
  const okFlag = await copyText(text)
  okFlag ? toast.ok('常用对照表已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="px-rem">
    <div class="row row-wrap" style="gap: 14px; align-items: end">
      <div>
        <span class="field-label">根字号（root font-size）</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model.number="root" type="number" class="input mono" style="width: 90px" min="1" />
          <span class="muted small">px</span>
        </div>
      </div>
      <span class="muted small">默认浏览器为 16px，可在网站样式中被覆盖</span>
    </div>

    <div class="grid-2 mt-3" style="gap: 14px; align-items: start">
      <div class="cvt-card">
        <span class="field-label"><ArrowDown :size="14" style="vertical-align: -2px" /> PX → REM</span>
        <div class="row" style="gap: 8px; flex-wrap: nowrap">
          <input v-model="pxInput" type="number" class="input mono grow" placeholder="输入 px" @input="onPx" />
          <span class="eq">=</span>
          <input v-model="remInput" type="number" class="input mono grow" placeholder="rem" readonly />
        </div>
      </div>
      <div class="cvt-card">
        <span class="field-label"><ArrowUp :size="14" style="vertical-align: -2px" /> REM → PX</span>
        <div class="row" style="gap: 8px; flex-wrap: nowrap">
          <input v-model="remInput" type="number" class="input mono grow" placeholder="输入 rem" @input="onRem" />
          <span class="eq">=</span>
          <input v-model="pxInput" type="number" class="input mono grow" placeholder="px" readonly />
        </div>
      </div>
    </div>

    <div class="row row-wrap mt-3" style="gap: 10px; align-items: center">
      <span class="kf" :class="{ on: mode === 'single' }" @click="mode = 'single'">单个</span>
      <span class="kf" :class="{ on: mode === 'batch' }" @click="mode = 'batch'">批量（CSS 全文替换）</span>
    </div>

    <div v-if="mode === 'batch'" class="mt-2">
      <span class="field-label">粘贴任意 CSS 文本：所有 Npx 按当前根字号替换为 Nrem（其余文本原样）</span>
      <textarea v-model="batchInput" class="textarea mono" style="min-height: 110px" placeholder=".card { padding: 16px; margin: 24px; width: 320.5px }"></textarea>
      <div v-if="batchOutput" class="mt-2">
        <pre class="batch-out mono">{{ batchOutput }}</pre>
        <button class="btn btn-ghost btn-sm mt-1" @click="copyBatch">复制全文</button>
      </div>
    </div>

    <div v-else class="mt-3">
      <div class="row row-wrap" style="align-items: center; margin-bottom: 8px; gap: 10px">
        <span class="field-label" style="margin: 0"><Ruler :size="14" style="vertical-align: -2px" /> 常用值对照表</span>
        <span class="field-label" style="margin: 0">父字号（em 口径）</span>
        <input v-model.number="parent" type="number" class="input mono" style="width: 80px" min="1" />
        <span class="muted small">px</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copyTable">复制对照表</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>px</th><th>rem</th><th>em（按父字号）</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in COMMON" :key="p">
              <td class="mono">{{ p }}px</td>
              <td class="mono">{{ (p / rootNum).toFixed(3) }}rem</td>
              <td class="mono">{{ (p / parentNum).toFixed(3) }}em</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：rem = px ÷ 根字号；em = px ÷ 父元素字号（默认等于根字号，可单独修改联动对照表第三列）。修改根字号后已填值沿最近编辑方向重算，根字号本地记忆。
    </p>
  </div>
</template>

<style scoped>
.cvt-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.eq {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-3);
}
.kf {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 3px 12px;
  cursor: pointer;
  color: var(--text-2);
  font-size: 12.5px;
}
.kf.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.batch-out {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  font-size: 12.5px;
  white-space: pre-wrap;
  max-height: 300px;
  overflow: auto;
}
</style>
