<script setup lang="ts">
import { computed, ref } from 'vue'
import { Shuffle, Copy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const raw = ref('')
const mode = ref<'byGroup' | 'byCount'>('byGroup')
const groupCount = ref(4)
const perGroup = ref(5)
const seed = ref(0) // 重摇计数

const groups = ref<string[][]>([])

const names = computed(() => [...new Set(raw.value.split(/[\n,，、\s]+/).map((s) => s.trim()).filter(Boolean))])

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

const split = () => {
  const list = names.value
  if (list.length < 2) return toast.warn('请至少输入 2 个名字（支持换行/逗号/顿号分隔）')
  let g = 0
  if (mode.value === 'byGroup') g = Math.min(20, Math.max(2, Math.round(groupCount.value)))
  else g = Math.max(1, Math.ceil(list.length / Math.max(1, Math.round(perGroup.value))))
  const shuffled = shuffle(list)
  groups.value = Array.from({ length: g }, () => [] as string[])
  shuffled.forEach((name, i) => groups.value[i % g]!.push(name))
  seed.value++
}

const resultText = computed(() =>
  groups.value.map((g, i) => `第 ${i + 1} 组：${g.join('、')}`).join('\n'),
)

const doCopy = async () => {
  const ok = await copyText(resultText.value)
  ok ? toast.ok('已复制分组结果') : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <textarea v-model="raw" class="input area" rows="6" placeholder="每行一个名字，或用逗号、顿号分隔，如：张三、李四、王五…"></textarea>
      <div class="row wrap gap mt-2">
        <label class="seg" :class="{ active: mode === 'byGroup' }"><input v-model="mode" type="radio" value="byGroup" class="sr" /> 按组数</label>
        <label class="seg" :class="{ active: mode === 'byCount' }"><input v-model="mode" type="radio" value="byCount" class="sr" /> 按每组人数</label>
        <template v-if="mode === 'byGroup'">
          <span class="field-label">组数</span>
          <input v-model.number="groupCount" type="number" class="input n-input" min="2" max="20" />
        </template>
        <template v-else>
          <span class="field-label">每组人数</span>
          <input v-model.number="perGroup" type="number" class="input n-input" min="1" />
        </template>
        <button class="btn btn-primary btn-sm" @click="split"><Shuffle :size="15" /> 随机分组</button>
        <span class="hint">已识别 {{ names.length }} 人</span>
      </div>
    </div>

    <div v-if="groups.length" class="mt-2">
      <div class="grid" :style="{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }" :key="seed">
        <div v-for="(g, i) in groups" :key="i" class="group-card">
          <h4 class="g-title">第 {{ i + 1 }} 组</h4>
          <p v-for="n in g" :key="n" class="g-name">{{ n }}</p>
        </div>
      </div>
      <div class="row gap mt-2">
        <button class="btn btn-sm" @click="split"><Shuffle :size="14" /> 重摇一次</button>
        <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> 复制结果</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.area { width: 100%; resize: vertical; }
.gap { gap: 10px; }
.n-input { width: 84px; }
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.grid { display: grid; gap: 10px; }
.group-card { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; }
.g-title { margin-bottom: 6px; color: var(--accent-text); font-size: 14px; }
.g-name { font-size: 15px; padding: 2px 0; }
.hint { font-size: 12px; color: var(--muted); }
</style>
