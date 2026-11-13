<script setup lang="ts">
import { computed, ref } from 'vue'
import { SquareDashed, Copy, Check, Link2, Link2Off } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const linked = ref(true)
const tl = ref(16)
const tr = ref(16)
const br = ref(16)
const bl = ref(16)
/** 八值模式（rx1）：四角水平/垂直半径 */
const advanced = ref(false)
const tlV = ref(16)
const trV = ref(16)
const brV = ref(16)
const blV = ref(16)
/** 单位（rx4）：px / % */
const unit = ref<'px' | '%'>('px')
const maxR = computed(() => (unit.value === 'px' ? 150 : 100))

const all = computed({
  get: () => tl.value,
  set: (v: number) => {
    tl.value = tr.value = br.value = bl.value = v
  },
})

const u = (v: number) => `${v}${unit.value}`
const css = computed(() =>
  advanced.value
    ? `border-radius: ${u(tl.value)} ${u(tr.value)} ${u(br.value)} ${u(bl.value)} / ${u(tlV.value)} ${u(trV.value)} ${u(brV.value)} ${u(blV.value)};`
    : `border-radius: ${u(tl.value)} ${u(tr.value)} ${u(br.value)} ${u(bl.value)};`,
)
const uniform = computed(() =>
  advanced.value
    ? tl.value === tr.value && tr.value === br.value && br.value === bl.value && tlV.value === trV.value && trV.value === brV.value && brV.value === blV.value
    : tl.value === tr.value && tr.value === br.value && br.value === bl.value,
)
const cssSmart = computed(() => {
  if (advanced.value) return css.value
  return uniform.value ? `border-radius: ${u(tl.value)};` : css.value
})

/** 预设（rx5）：按形状命名，含八值组合 */
const PRESETS: { name: string; apply: () => void }[] = [
  { name: '直角', apply: () => { tl.value = tr.value = br.value = bl.value = tlV.value = trV.value = brV.value = blV.value = 0 } },
  { name: '圆角', apply: () => { tl.value = tr.value = br.value = bl.value = tlV.value = trV.value = brV.value = blV.value = 12 } },
  { name: '胶囊', apply: () => { unit.value = '%'; tl.value = tr.value = br.value = bl.value = 50; tlV.value = trV.value = brV.value = blV.value = 50 } },
  { name: '叶形', apply: () => { unit.value = '%'; tl.value = br.value = 60; tr.value = bl.value = 8; tlV.value = brV.value = 60; trV.value = blV.value = 8; linked.value = false } },
  { name: '梭形', apply: () => { unit.value = '%'; tl.value = br.value = 75; tr.value = bl.value = 25; tlV.value = brV.value = 75; trV.value = blV.value = 25; linked.value = false } },
  { name: '水滴', apply: () => { unit.value = '%'; tl.value = bl.value = tr.value = 70; br.value = 8; tlV.value = blV.value = trV.value = 70; brV.value = 8; linked.value = false } },
  { name: 'blob-A', apply: () => { unit.value = '%'; tl.value = 62; tr.value = 34; br.value = 56; bl.value = 42; tlV.value = 38; trV.value = 62; brV.value = 44; blV.value = 58; linked.value = false } },
  { name: 'blob-B', apply: () => { unit.value = '%'; tl.value = 30; tr.value = 68; br.value = 44; bl.value = 70; tlV.value = 66; trV.value = 32; brV.value = 60; blV.value = 36; linked.value = false } },
]

const copied = ref(false)
const doCopy = async () => {
  const okFlag = await copyText(cssSmart.value)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('border-radius 已复制')
  } else toast.err('复制失败')
}

const setAll = (v: number) => {
  tl.value = tr.value = br.value = bl.value = v
}
</script>

<template>
  <div class="radius-gen">
    <div class="row row-wrap" style="gap: 14px; align-items: center">
      <label class="check">
        <input v-model="linked" type="checkbox" />
        <Link2 v-if="linked" :size="15" />
        <Link2Off v-else :size="15" />
        四角联动
      </label>
      <span class="grow"></span>
      <button v-for="p in PRESETS" :key="p.name" class="btn btn-ghost btn-sm" @click="p.apply()">{{ p.name }}</button>
    </div>

    <div class="layout mt-2">
      <div class="stage">
        <div class="demo-box" :style="{ borderRadius: css.replace('border-radius: ', '').replace(';', '') }">预览</div>
      </div>

      <div class="controls">
        <div class="row row-wrap" style="gap: 8px; align-items: center">
          <label class="check" title="四角各出水平/垂直双滑杆，输出含斜杠的八值语法"><input v-model="advanced" type="checkbox" /> 高级（八值）</label>
          <label class="check" style="gap: 6px">单位
            <select v-model="unit" class="select" style="width: 84px">
              <option value="px">px</option>
              <option value="%">%</option>
            </select>
          </label>
        </div>
        <div class="ctrl"><span>左上{{ advanced ? ' ⤻' : '' }}</span><input v-if="linked && !advanced" v-model.number="all" type="range" min="0" :max="maxR" /><input v-else v-model.number="tl" type="range" min="0" :max="maxR" /><b class="mono">{{ tl }}{{ unit }}</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>右上{{ advanced ? ' ⤻' : '' }}</span><input v-model.number="tr" type="range" min="0" :max="maxR" :disabled="linked" /><b class="mono">{{ tr }}{{ unit }}</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>右下{{ advanced ? ' ⤻' : '' }}</span><input v-model.number="br" type="range" min="0" :max="maxR" :disabled="linked" /><b class="mono">{{ br }}{{ unit }}</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>左下{{ advanced ? ' ⤻' : '' }}</span><input v-model.number="bl" type="range" min="0" :max="maxR" :disabled="linked" /><b class="mono">{{ bl }}{{ unit }}</b></div>
        <template v-if="advanced">
          <div class="ctrl"><span>左上 ⤵</span><input v-model.number="tlV" type="range" min="0" :max="maxR" /><b class="mono">{{ tlV }}{{ unit }}</b></div>
          <div class="ctrl"><span>右上 ⤵</span><input v-model.number="trV" type="range" min="0" :max="maxR" /><b class="mono">{{ trV }}{{ unit }}</b></div>
          <div class="ctrl"><span>右下 ⤵</span><input v-model.number="brV" type="range" min="0" :max="maxR" /><b class="mono">{{ brV }}{{ unit }}</b></div>
          <div class="ctrl"><span>左下 ⤵</span><input v-model.number="blV" type="range" min="0" :max="maxR" /><b class="mono">{{ blV }}{{ unit }}</b></div>
        </template>
      </div>
    </div>

    <div class="mt-3 code-card">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <span class="field-label" style="margin: 0"><SquareDashed :size="14" style="vertical-align: -2px" /> CSS 代码</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy">
          <Check v-if="copied" :size="14" color="#34d399" />
          <Copy v-else :size="14" /> 复制
        </button>
      </div>
      <pre class="code mono">{{ cssSmart }}</pre>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.stage {
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    repeating-conic-gradient(rgba(128, 128, 128, 0.08) 0 25%, transparent 0 50%) 0 0 / 20px 20px;
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 16px;
}
.demo-box {
  width: 170px;
  height: 130px;
  background: linear-gradient(135deg, var(--accent), #7c74f2);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 600;
  transition: border-radius 0.15s ease;
}
.controls {
  display: grid;
  gap: 12px;
  align-content: center;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: var(--text-2);
}
.ctrl > span:first-child {
  flex: none;
  width: 40px;
}
.ctrl input[type='range'] {
  flex: 1;
}
.ctrl b {
  flex: none;
  width: 56px;
  text-align: right;
  font-size: 12.5px;
}
.ctrl.dim {
  opacity: 0.55;
}
.code-card pre {
  margin: 0;
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 13.5px;
  overflow-x: auto;
}
@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
