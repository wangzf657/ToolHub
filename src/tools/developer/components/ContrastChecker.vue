<script setup lang="ts">
import { computed, ref } from 'vue'
import { Contrast } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const fg = ref('#6366f1')
const bg = ref('#ffffff')

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = Number.parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = computed(() => {
  const l1 = luminance(fg.value)
  const l2 = luminance(bg.value)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
})

const ratioText = computed(() => ratio.value.toFixed(2))

interface Level {
  label: string
  need: number
  pass: boolean
}

const levels = computed<Level[]>(() => [
  { label: 'AA 普通字号（≥ 4.5）', need: 4.5, pass: ratio.value >= 4.5 },
  { label: 'AA 大字号（≥ 3.0）', need: 3, pass: ratio.value >= 3 },
  { label: 'AAA 普通字号（≥ 7.0）', need: 7, pass: ratio.value >= 7 },
  { label: 'AAA 大字号（≥ 4.5）', need: 4.5, pass: ratio.value >= 4.5 },
])

const swap = () => {
  const t = fg.value
  fg.value = bg.value
  bg.value = t
}

const suggest = computed(() => (ratio.value >= 4.5 ? null : luminance(fg.value) > luminance(bg.value) ? '#1a1a2e' : '#ffffff'))

const applySuggest = () => {
  if (suggest.value) {
    fg.value = suggest.value
    toast.ok(`已换用对比更强的前景色 ${suggest.value}`)
  }
}

const copy = async () => {
  const okFlag = await copyText(`对比度 ${ratioText.value}:1（${fg.value} on ${bg.value}）`)
  okFlag ? toast.ok('结果已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="contrast-check">
    <div class="row row-wrap" style="gap: 16px; align-items: end">
      <div>
        <span class="field-label">前景色（文字）</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="fg" type="color" class="color-pick" />
          <input v-model="fg" type="text" class="input mono" style="width: 110px" spellcheck="false" />
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-bottom: 2px" @click="swap">⇄ 交换</button>
      <div>
        <span class="field-label">背景色</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="bg" type="color" class="color-pick" />
          <input v-model="bg" type="text" class="input mono" style="width: 110px" spellcheck="false" />
        </div>
      </div>
    </div>

    <div class="mt-3 ratio-card" :style="{ background: bg, color: fg }">
      <div class="ratio-num mono">{{ ratioText }}<small>:1</small></div>
      <div class="ratio-sample">
        <p style="font-size: 20px; font-weight: 700; margin: 0 0 4px">大字号标题预览（18pt+）</p>
        <p style="font-size: 14.5px; margin: 0">普通字号正文预览：浏览器本地计算，数据不出设备。</p>
      </div>
    </div>

    <div class="mt-3 levels">
      <div v-for="l in levels" :key="l.label" class="level-row" :class="{ pass: l.pass }">
        <span class="lv-badge">{{ l.pass ? '通过' : '未通过' }}</span>
        <span>{{ l.label }}</span>
      </div>
    </div>

    <div v-if="suggest" class="notice notice-warn mt-2">
      对比度不足 4.5:1。试试更安全的前景色 <button class="btn btn-soft btn-sm" style="margin: 0 6px" @click="applySuggest">{{ suggest }}</button>
    </div>

    <button class="btn btn-ghost btn-sm mt-2" @click="copy"><Contrast :size="14" /> 复制结果</button>

    <p class="notice notice-info mt-2 small">
      计算口径：WCAG 2.x 相对亮度公式 L = 0.2126R + 0.7152G + 0.0722B（sRGB 线性化），对比度 = (L亮 + 0.05) / (L暗 + 0.05)。
    </p>
  </div>
</template>

<style scoped>
.color-pick {
  width: 44px;
  height: 38px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: none;
  cursor: pointer;
  padding: 2px;
}
.ratio-card {
  border-radius: 14px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 26px;
  border: 1px solid var(--border);
  transition: background 0.2s, color 0.2s;
}
.ratio-num {
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  flex: none;
}
.ratio-num small {
  font-size: 20px;
}
.levels {
  display: grid;
  gap: 7px;
}
.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  color: var(--text-2);
}
.lv-badge {
  flex: none;
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}
.level-row.pass .lv-badge {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
</style>
