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

const all = computed({
  get: () => tl.value,
  set: (v: number) => {
    tl.value = tr.value = br.value = bl.value = v
  },
})

const css = computed(() => `border-radius: ${tl.value}px ${tr.value}px ${br.value}px ${bl.value}px;`)
const uniform = computed(() => tl.value === tr.value && tr.value === br.value && br.value === bl.value)
const cssSmart = computed(() => (uniform.value ? `border-radius: ${tl.value}px;` : css.value))

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
      <button class="btn btn-ghost btn-sm" @click="setAll(0)">直角</button>
      <button class="btn btn-ghost btn-sm" @click="setAll(12)">小圆角</button>
      <button class="btn btn-ghost btn-sm" @click="setAll(50)">胶囊</button>
    </div>

    <div class="layout mt-2">
      <div class="stage">
        <div
          class="demo-box"
          :style="{ borderRadius: `${tl}px ${tr}px ${br}px ${bl}px` }"
        >
          预览
        </div>
      </div>

      <div class="controls">
        <div class="ctrl"><span>左上</span><input v-if="linked" v-model.number="all" type="range" min="0" max="150" /><input v-else v-model.number="tl" type="range" min="0" max="150" /><b class="mono">{{ tl }}px</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>右上</span><input v-model.number="tr" type="range" min="0" max="150" :disabled="linked" /><b class="mono">{{ tr }}px</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>右下</span><input v-model.number="br" type="range" min="0" max="150" :disabled="linked" /><b class="mono">{{ br }}px</b></div>
        <div class="ctrl" :class="{ dim: linked }"><span>左下</span><input v-model.number="bl" type="range" min="0" max="150" :disabled="linked" /><b class="mono">{{ bl }}px</b></div>
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
