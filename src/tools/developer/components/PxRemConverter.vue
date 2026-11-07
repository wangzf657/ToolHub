<script setup lang="ts">
import { computed, ref } from 'vue'
import { Ruler, ArrowDown, ArrowUp } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const root = ref(16)
const pxInput = ref('')
const remInput = ref('')

const rootNum = computed(() => (root.value > 0 ? root.value : 16))

const onPx = () => {
  const n = Number(pxInput.value)
  remInput.value = pxInput.value === '' || Number.isNaN(n) ? '' : String(Number((n / rootNum.value).toFixed(4)))
}
const onRem = () => {
  const n = Number(remInput.value)
  pxInput.value = remInput.value === '' || Number.isNaN(n) ? '' : String(Number((n * rootNum.value).toFixed(2)))
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

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 8px">
        <span class="field-label" style="margin: 0"><Ruler :size="14" style="vertical-align: -2px" /> 常用值对照表</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copyTable">复制对照表</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>px</th><th>rem</th><th>em</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in COMMON" :key="p">
              <td class="mono">{{ p }}px</td>
              <td class="mono">{{ (p / rootNum).toFixed(3) }}rem</td>
              <td class="mono">{{ (p / rootNum).toFixed(3) }}em</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：rem = px ÷ 根字号；em 基于当前元素字号，此处按根字号估算。修改根字号后表格与换算实时更新。
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
</style>
