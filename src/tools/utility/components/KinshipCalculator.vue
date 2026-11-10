<script setup lang="ts">
import { ref } from 'vue'
import { RotateCcw, X, Users } from 'lucide-vue-next'
import { kinshipOfChain, chainOfKinship, REL_STEPS } from '@/lib/kinship'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const dir = ref<'forward' | 'reverse'>('forward')
const mySex = ref(1)
const chain = ref<string[]>([])
const titleInput = ref('')

const forwardResult = ref<string[]>([])
const reverseResult = ref<string[]>([])
const busy = ref(false)

const chainText = () => chain.value.join('的')

const pick = async (seg: string) => {
  if (chain.value.length >= 8) return toast.warn('关系链最多 8 层，太长的关系请直接输入称呼')
  chain.value.push(seg)
  await runForward()
}

const undo = () => {
  chain.value.pop()
  if (chain.value.length) runForward()
  else forwardResult.value = []
}

const reset = () => {
  chain.value = []
  forwardResult.value = []
}

const runForward = async () => {
  if (!chain.value.length) return
  busy.value = true
  try {
    forwardResult.value = await kinshipOfChain(chainText(), mySex.value)
  } catch (e) {
    toast.err(`解析失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const runReverse = async () => {
  if (!titleInput.value.trim()) return toast.warn('请输入要查询的称呼')
  busy.value = true
  try {
    reverseResult.value = await chainOfKinship(titleInput.value.trim(), mySex.value)
    if (!reverseResult.value.length) toast.warn('未找到该称呼，试试更常用的说法')
  } catch (e) {
    toast.err(`解析失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const doCopy = async (t: string) => {
  const ok = await copyText(t)
  ok ? toast.ok('已复制') : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row gap wrap">
        <label class="seg" :class="{ active: dir === 'forward' }"><input v-model="dir" type="radio" value="forward" class="sr" /> 关系链 → 称呼</label>
        <label class="seg" :class="{ active: dir === 'reverse' }"><input v-model="dir" type="radio" value="reverse" class="sr" /> 称呼 → 关系链</label>
        <span class="spacer"></span>
        <label class="check"><input v-model.number="mySex" type="radio" :value="1" /> 我是男</label>
        <label class="check"><input v-model.number="mySex" type="radio" :value="0" /> 我是女</label>
      </div>
    </div>

    <div v-if="dir === 'forward'" class="mt-2">
      <div class="chain-line">
        <span class="me">我</span>
        <template v-for="(seg, i) in chain" :key="i">
          <span class="arrow">›</span>
          <span class="seg-item">{{ seg }}</span>
        </template>
        <button class="mini-btn" title="撤销一步" @click="undo"><RotateCcw :size="14" /></button>
        <button class="mini-btn" title="清空重来" @click="reset"><X :size="14" /></button>
      </div>

      <div class="chips mt-2">
        <button v-for="s in REL_STEPS" :key="s.label" class="chip-btn" @click="pick(s.seg)">+{{ s.label }}</button>
      </div>

      <div v-if="forwardResult.length" class="result mt-2">
        <p class="q-line">「<b>{{ chainText() }}</b>」是我的——</p>
        <div class="ans-row">
          <span v-for="r in forwardResult" :key="r" class="ans" @click="doCopy(r)">{{ r }}</span>
        </div>
        <p class="hint mt-1">多结果为不同叫法（如年龄大小），点击可复制。</p>
      </div>
    </div>

    <div v-else class="mt-2">
      <div class="row gap">
        <input v-model="titleInput" class="input grow" placeholder="输入称呼，如：大舅、姑妈、表哥" @keyup.enter="runReverse" />
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="runReverse"><Users :size="15" /> 查关系链</button>
      </div>
      <div v-if="reverseResult.length" class="result mt-2">
        <p class="q-line">「<b>{{ titleInput }}</b>」对应的关系链——</p>
        <div class="ans-row">
          <span v-for="r in reverseResult" :key="r" class="ans">{{ r }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.gap { gap: 10px; }
.spacer { flex: 1; }
.grow { flex: 1; }
.chain-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 10px 14px; border: 1px dashed var(--border); border-radius: 10px; }
.me { font-weight: 700; color: var(--accent-text); }
.arrow { color: var(--muted); }
.seg-item { padding: 2px 10px; background: var(--surface-2, rgba(127,127,127,.12)); border-radius: 6px; font-size: 13px; }
.mini-btn { border: 1px solid var(--border); background: transparent; border-radius: 6px; padding: 4px 6px; cursor: pointer; color: var(--muted); }
.mini-btn:hover { color: var(--text); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-btn { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 13px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.q-line { margin-bottom: 8px; }
.ans-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ans { padding: 8px 18px; background: var(--accent-soft, rgba(99,102,241,.14)); color: var(--accent-text); border-radius: 10px; font-size: 20px; font-weight: 700; cursor: pointer; }
.hint { font-size: 12px; color: var(--muted); }
</style>
