<script setup lang="ts">
import { computed, ref } from 'vue'
import { Palette, Copy, Check, Plus, X } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const type = ref<'linear' | 'radial'>('linear')
const angle = ref(135)
const stops = ref([
  { color: '#6366f1', pos: 0 },
  { color: '#22d3ee', pos: 100 },
])
const copied = ref(false)

const stopsCss = computed(() => stops.value.map((s) => `${s.color} ${s.pos}%`).join(', '))
const css = computed(() =>
  type.value === 'linear' ? `linear-gradient(${angle.value}deg, ${stopsCss.value})` : `radial-gradient(circle at 50% 50%, ${stopsCss.value})`,
)

const addStop = () => {
  if (stops.value.length >= 5) return toast.warn('最多支持 5 个色标')
  stops.value.push({ color: '#fbbf24', pos: 50 })
  sortStops()
}

const removeStop = (i: number) => {
  if (stops.value.length <= 2) return toast.warn('至少保留 2 个色标')
  stops.value.splice(i, 1)
}

const sortStops = () => {
  stops.value = [...stops.value].sort((a, b) => a.pos - b.pos)
}

const doCopy = async () => {
  const text = `background: ${css.value};`
  const okFlag = await copyText(text)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('CSS 已复制')
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="grad-gen">
    <div class="row row-wrap" style="gap: 14px; align-items: center">
      <select v-model="type" class="select" style="width: 130px">
        <option value="linear">线性渐变</option>
        <option value="radial">径向渐变</option>
      </select>
      <template v-if="type === 'linear'">
        <span class="field-label" style="margin: 0">角度 {{ angle }}°</span>
        <input v-model.number="angle" type="range" min="0" max="360" step="5" style="width: 190px" />
      </template>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="addStop"><Plus :size="14" /> 加色标</button>
    </div>

    <div class="mt-2 stop-list">
      <div v-for="(s, i) in stops" :key="i" class="stop-row">
        <input v-model="s.color" type="color" class="color-pick" />
        <input v-model="s.color" type="text" class="input mono" style="width: 110px" spellcheck="false" />
        <input v-model.number="s.pos" type="range" min="0" max="100" step="1" class="grow" @change="sortStops" />
        <b class="pos mono">{{ s.pos }}%</b>
        <button class="del-btn" title="删除色标" aria-label="删除色标" :disabled="stops.length <= 2" @click="removeStop(i)"><X :size="13" /></button>
      </div>
    </div>

    <div class="mt-3 preview" :style="{ background: css }">
      <span class="preview-hint">实时预览</span>
    </div>

    <div class="mt-3 code-card">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <span class="field-label" style="margin: 0"><Palette :size="14" style="vertical-align: -2px" /> CSS 代码</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy">
          <Check v-if="copied" :size="14" color="#34d399" />
          <Copy v-else :size="14" /> 复制
        </button>
      </div>
      <pre class="code mono">background: {{ css }};</pre>
    </div>
  </div>
</template>

<style scoped>
.color-pick {
  width: 42px;
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  background: none;
  cursor: pointer;
  padding: 2px;
  flex: none;
}
.stop-list {
  display: grid;
  gap: 8px;
}
.stop-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pos {
  flex: none;
  width: 46px;
  text-align: right;
  color: var(--text-2);
  font-size: 13px;
}
.del-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.del-btn:hover:not(:disabled) {
  color: var(--err);
  border-color: var(--err);
}
.del-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.preview {
  height: 130px;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
}
.preview-hint {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
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
</style>
