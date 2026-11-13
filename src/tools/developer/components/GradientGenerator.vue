<script setup lang="ts">
import { computed, ref } from 'vue'
import { Palette, Copy, Check, Plus, X } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const type = ref<'linear' | 'radial' | 'conic'>('linear')
const angle = ref(135)
interface Stop { color: string; pos: number; alpha: number }
const stops = ref([
  { color: '#6366f1', pos: 0, alpha: 100 },
  { color: '#22d3ee', pos: 100, alpha: 100 },
])
const copied = ref(false)

const stopsCss = computed(() =>
  stops.value
    .map((s) => {
      const hex = s.color.replace('#', '')
      const n = Number.parseInt(hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex, 16)
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
      return s.alpha < 100 ? `rgba(${r}, ${g}, ${b}, ${(s.alpha / 100).toFixed(2)}) ${s.pos}%` : `${s.color} ${s.pos}%`
    })
    .join(', '))
const css = computed(() =>
  type.value === 'linear'
    ? `linear-gradient(${angle.value}deg, ${stopsCss.value})`
    : type.value === 'conic'
      ? `conic-gradient(from ${angle.value}deg at 50% 50%, ${stopsCss.value})`
      : `radial-gradient(circle at 50% 50%, ${stopsCss.value})`,
)

const addStop = () => {
  if (stops.value.length >= 5) return toast.warn('最多支持 5 个色标')
  stops.value.push({ color: '#fbbf24', pos: 50, alpha: 100 })
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

/** 预设库（rx3）：点击全量载入色标与角度 */
const PRESETS: { name: string; type: 'linear' | 'radial' | 'conic'; angle: number; stops: Stop[] }[] = [
  { name: '淡出', type: 'linear', angle: 180, stops: [{ color: '#1e293b', pos: 0, alpha: 60 }, { color: '#1e293b', pos: 100, alpha: 0 }] },
  { name: '霓虹', type: 'linear', angle: 45, stops: [{ color: '#22d3ee', pos: 0, alpha: 100 }, { color: '#a855f7', pos: 50, alpha: 100 }, { color: '#f43f5e', pos: 100, alpha: 100 }] },
  { name: '落日', type: 'linear', angle: 120, stops: [{ color: '#fde68a', pos: 0, alpha: 100 }, { color: '#fb923c', pos: 55, alpha: 100 }, { color: '#dc2626', pos: 100, alpha: 100 }] },
  { name: '薄荷', type: 'linear', angle: 90, stops: [{ color: '#ecfeff', pos: 0, alpha: 100 }, { color: '#14b8a6', pos: 100, alpha: 100 }] },
  { name: '夜空', type: 'radial', angle: 0, stops: [{ color: '#1e1b4b', pos: 0, alpha: 100 }, { color: '#0f172a', pos: 100, alpha: 100 }] },
  { name: '熔岩', type: 'conic', angle: 0, stops: [{ color: '#dc2626', pos: 0, alpha: 100 }, { color: '#f59e0b', pos: 40, alpha: 100 }, { color: '#dc2626', pos: 100, alpha: 100 }] },
  { name: '扇形扫描', type: 'conic', angle: 0, stops: [{ color: '#3b82f6', pos: 0, alpha: 90 }, { color: '#3b82f6', pos: 25, alpha: 20 }, { color: '#3b82f6', pos: 100, alpha: 90 }] },
  { name: '青金石', type: 'linear', angle: 135, stops: [{ color: '#0ea5e9', pos: 0, alpha: 100 }, { color: '#6366f1', pos: 60, alpha: 100 }, { color: '#1e1b4b', pos: 100, alpha: 100 }] },
  { name: '蜜桃', type: 'radial', angle: 0, stops: [{ color: '#fecaca', pos: 0, alpha: 100 }, { color: '#fda4af', pos: 60, alpha: 100 }, { color: '#fb7185', pos: 100, alpha: 100 }] },
  { name: '极光', type: 'conic', angle: 90, stops: [{ color: '#34d399', pos: 0, alpha: 100 }, { color: '#60a5fa', pos: 50, alpha: 100 }, { color: '#a78bfa', pos: 100, alpha: 100 }] },
  { name: '单色淡出', type: 'linear', angle: 180, stops: [{ color: '#000000', pos: 0, alpha: 55 }, { color: '#000000', pos: 100, alpha: 0 }] },
  { name: '琥珀', type: 'linear', angle: 30, stops: [{ color: '#fef3c7', pos: 0, alpha: 100 }, { color: '#f59e0b', pos: 100, alpha: 100 }] },
]
const loadPreset = (p: { type: 'linear' | 'radial' | 'conic'; angle: number; stops: Stop[] }) => {
  type.value = p.type
  angle.value = p.angle
  stops.value = p.stops.map((s) => ({ ...s }))
  toast.ok('预设已载入')
}
</script>

<template>
  <div class="grad-gen">
    <div class="row row-wrap" style="gap: 14px; align-items: center">
      <select v-model="type" class="select" style="width: 130px">
        <option value="linear">线性渐变</option>
        <option value="radial">径向渐变</option>
        <option value="conic">锥形渐变</option>
      </select>
      <template v-if="type === 'linear' || type === 'conic'">
        <span class="field-label" style="margin: 0">{{ type === 'conic' ? '起始角' : '角度' }} {{ angle }}°</span>
        <input v-model.number="angle" type="range" min="0" max="360" step="1" style="width: 190px" />
      </template>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="addStop"><Plus :size="14" /> 加色标</button>
    </div>

    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">预设</span>
      <button v-for="p in PRESETS" :key="p.name" class="chip" @click="loadPreset(p)">{{ p.name }}</button>
    </div>

    <div class="mt-2 stop-list">
      <div v-for="(s, i) in stops" :key="i" class="stop-row">
        <input v-model="s.color" type="color" class="color-pick" />
        <input v-model="s.color" type="text" class="input mono" style="width: 110px" spellcheck="false" />
        <input v-model.number="s.pos" type="range" min="0" max="100" step="1" class="grow" @change="sortStops" />
        <b class="pos mono">{{ s.pos }}%</b>
        <input type="range" min="0" max="100" :value="s.alpha" title="色标不透明度" style="width: 80px" @input="s.alpha = Number(($event.target as HTMLInputElement).value)" />
        <b class="pos mono" style="width: 44px">{{ s.alpha }}%</b>
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
