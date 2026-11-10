<script setup lang="ts">
import { computed, ref } from 'vue'
import { Shuffle, Copy } from 'lucide-vue-next'
import { setOperations, lineCounts, type SetOptions } from '@/lib/textExt'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const a = ref('')
const b = ref('')
const op = ref<'intersection' | 'union' | 'aMinusB' | 'bMinusA'>('intersection')
const ignoreCase = ref(false)
const trim = ref(true)
const swap = ref(false)

const opts = computed<SetOptions>(() => ({ ignoreCase: ignoreCase.value, trim: trim.value }))
const left = computed(() => (swap.value ? b.value : a.value))
const right = computed(() => (swap.value ? a.value : b.value))

const counts = computed(() => lineCounts(left.value, right.value, opts.value))

const OPS = [
  { k: 'intersection', label: '交集（A∩B）', hint: '两边都有的行' },
  { k: 'union', label: '并集（A∪B）', hint: '合并去重' },
  { k: 'aMinusB', label: 'A−B', hint: '只在 A 里有' },
  { k: 'bMinusA', label: 'B−A', hint: '只在 B 里有' },
] as const

const result = computed(() => setOperations(left.value, right.value, op.value, opts.value))

const swapSides = () => {
  ;[a.value, b.value] = [b.value, a.value]
}

const doCopy = async () => {
  const ok = await copyText(result.value)
  ok ? toast.ok(`已复制 ${result.value.split('\n').length} 行`) : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <button v-for="o in OPS" :key="o.k" class="seg" :class="{ active: op === o.k }" :title="o.hint" @click="op = o.k">{{ o.label }}</button>
        <span class="spacer"></span>
        <label class="check"><input v-model="ignoreCase" type="checkbox" /> 忽略大小写</label>
        <label class="check"><input v-model="trim" type="checkbox" /> 去首尾空白</label>
        <button class="btn btn-sm" @click="swapSides"><Shuffle :size="14" /> 交换</button>
      </div>
    </div>

    <div class="two mt-2">
      <div>
        <span class="field-label">文本 A（{{ counts.a }} 行）</span>
        <textarea v-model="a" class="input area" rows="8" placeholder="每行一项…"></textarea>
      </div>
      <div>
        <span class="field-label">文本 B（{{ counts.b }} 行）</span>
        <textarea v-model="b" class="input area" rows="8" placeholder="每行一项…"></textarea>
      </div>
    </div>

    <div v-if="result" class="mt-2">
      <div class="row gap">
        <span class="field-label">结果（{{ result ? result.split('\n').length : 0 }} 行）</span>
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> 复制结果</button>
      </div>
      <pre class="result mono mt-1">{{ result || '（空）' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; align-items: center; }
.spacer { flex: 1; }
.seg { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.area { width: 100%; resize: vertical; font-family: inherit; }
.result { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; max-height: 300px; overflow: auto; font-size: 13px; white-space: pre-wrap; word-break: break-all; }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
