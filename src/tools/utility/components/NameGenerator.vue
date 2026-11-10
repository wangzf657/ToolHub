<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, Copy } from 'lucide-vue-next'
import { SURNAMES, NAME_STYLES, NAME_BANKS, type NameStyle } from '@/lib/utilNames'
import { pinyinOf } from '@/lib/chineseText'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const style = ref<NameStyle>('classic')
const gender = ref<'male' | 'female'>('male')
const count = ref(10)
const names = ref<{ n: string; py: string }[]>([])

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!

const gen = async () => {
  const bank = NAME_BANKS[style.value][gender.value]
  const raw = Array.from({ length: count.value }, () => rand(SURNAMES) + rand(bank))
  names.value = []
  const out: { n: string; py: string }[] = []
  for (const n of raw) {
    out.push({ n, py: await pinyinOf(n, { tone: 'symbol', spaced: true }) })
  }
  names.value = out
}

void gen()

const doCopy = async () => {
  const ok = await copyText(names.value.map((x) => x.n).join('、'))
  ok ? toast.ok('已复制全部名字') : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">风格</span>
        <select v-model="style" class="input">
          <option v-for="s in NAME_STYLES" :key="s.value" :value="s.value">{{ s.label }} · {{ s.desc }}</option>
        </select>
        <span class="field-label">性别偏好</span>
        <label class="check"><input v-model="gender" type="radio" value="male" /> 男名</label>
        <label class="check"><input v-model="gender" type="radio" value="female" /> 女名</label>
        <span class="field-label">数量</span>
        <input v-model.number="count" type="number" class="input slim" min="4" max="30" />
        <button class="btn btn-primary btn-sm" @click="gen"><RefreshCw :size="15" /> 换一批</button>
        <button class="btn btn-sm" @click="doCopy"><Copy :size="15" /> 复制</button>
      </div>
    </div>
    <div class="grid mt-2">
      <div v-for="x in names" :key="x.n" class="card" @click="copyText(x.n)">
        <b>{{ x.n }}</b>
        <span class="py">{{ x.py }}</span>
      </div>
    </div>
    <p class="hint mt-2">随机组合仅供起名灵感参考；点击卡片复制单个名字。不带任何命理话术。</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 74px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.card { padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.card:hover { border-color: var(--accent); }
.card b { font-size: 17px; }
.py { font-size: 12px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
