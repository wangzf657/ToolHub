<script setup lang="ts">
import { ref } from 'vue'
import { Dices, History, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const notation = ref('2d6+3')
const groups = ref<{ dice: number; faces: number; rolls: number[]; keptIdx: number[]; mode: string }[]>([])
const bonus = ref(0)
const total = ref(0)
const history = ref<{ text: string; at: string }[]>([])

/** 解析骰子记法：2d6+3、4d6dl1、2d20kh1 等（kh/kl/dl/dh） */
const parseNotation = (input: string) => {
  const s = input.replace(/\s+/g, '').toLowerCase()
  let rest = s
  let b = 0
  const bonusMatch = rest.match(/([+-]\d+)$/)
  if (bonusMatch) {
    b = parseInt(bonusMatch[1], 10)
    rest = rest.slice(0, -bonusMatch[1].length)
  }
  const gs: { dice: number; faces: number; rolls: number[]; keptIdx: number[]; mode: string }[] = []
  let cursor = 0
  let sum = 0
  while (cursor < rest.length) {
    const m = rest.slice(cursor).match(/^([+-]?)(\d*)d(\d+)(kh|kl|dl|dh)?(\d*)/)
    if (!m) throw new Error('记法无法识别，示例：2d6+3、4d6dl1、2d20kh1')
    const sign = m[1] === '-' ? -1 : 1
    const dice = Math.max(1, Math.min(100, parseInt(m[2] || '1', 10)))
    const faces = Math.max(2, Math.min(1000, parseInt(m[3], 10)))
    const mode = m[4] ?? ''
    const keepN = m[5] ? Math.max(1, Math.min(dice, parseInt(m[5], 10))) : 1
    // 密码学随机骰子
    const buf = new Uint32Array(dice)
    crypto.getRandomValues(buf)
    const rolls = [...buf].map((v) => (v % faces) + 1)
    let keptIdx: number[] = rolls.map((_, i) => i)
    if (mode) {
      const idx = rolls.map((v, i) => [v, i] as const)
      idx.sort((a, b2) => (mode === 'kh' || mode === 'dh' ? b2[0] - a[0] : a[0] - b2[0]))
      keptIdx = idx.slice(0, keepN).map(([, i]) => i)
    }
    const kept = keptIdx.map((i) => rolls[i])
    const groupSum = kept.reduce((a, c) => a + c, 0)
    sum += sign * groupSum
    gs.push({ dice, faces, rolls, keptIdx, mode })
    cursor += m[0].length
  }
  return { groups: gs, bonus: b, total: sum + b }
}

const roll = () => {
  try {
    const r = parseNotation(notation.value)
    groups.value = r.groups
    bonus.value = r.bonus
    total.value = r.total
    history.value.unshift({ text: `${notation.value.trim()} = ${r.total}`, at: new Date().toLocaleTimeString('zh-CN') })
    history.value = history.value.slice(0, 8)
  } catch (e) {
    toast.err((e as Error).message || '记法错误')
  }
}

roll()

const clearHistory = () => {
  history.value = []
}
</script>

<template>
  <div>
    <div class="in-row">
      <input
        v-model="notation"
        class="input mono"
        placeholder="记法：2d6+3、4d6dl1、2d20kh1（kh保留最高 / kl保留最低 / dl弃最低 / dh弃最高）"
        @keydown.enter="roll"
      />
      <button class="btn btn-primary" @click="roll">
        <Dices :size="17" /> 掷骰
      </button>
    </div>

    <div class="row row-wrap chips-row mt-1">
      <button v-for="p in ['2d6+3', '1d20', '4d6dl1', '2d20kh1', '3d8-1', '1d100']" :key="p" class="chip" @click="notation = p; roll()">
        {{ p }}
      </button>
    </div>

    <div class="result-panel mt-2">
      <div v-if="!groups.length" class="muted small">输入记法后点击掷骰</div>
      <template v-else>
        <div class="dice-row">
          <div v-for="(g, gi) in groups" :key="gi" class="dice-group">
            <span class="g-title">{{ g.dice }}d{{ g.faces }}<template v-if="g.mode"> ({{ g.mode }})</template></span>
            <div class="dice-faces">
              <span
                v-for="(v, vi) in g.rolls"
                :key="vi"
                class="die"
                :class="{ dropped: g.mode && !g.keptIdx.includes(vi) }"
              >{{ v }}</span>
            </div>
          </div>
          <span v-if="bonus !== 0" class="bonus mono">{{ bonus > 0 ? `+${bonus}` : bonus }}</span>
        </div>
        <div class="total-row">
          <span class="total-label">总和</span>
          <span class="total-num">{{ total }}</span>
        </div>
      </template>
    </div>

    <div v-if="history.length" class="mt-2">
      <div class="io-head">
        <span class="io-title"><History :size="14" /> 最近记录（最多 8 次）</span>
        <button class="mini-clear" @click="clearHistory"><X :size="13" /> 清空</button>
      </div>
      <div class="hist-list">
        <div v-for="(h, i) in history" :key="i" class="hist-row">
          <span class="mono">{{ h.text }}</span>
          <span class="muted small">{{ h.at }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.in-row {
  display: flex;
  gap: 10px;
}
.chips-row {
  gap: 8px;
}
.result-panel {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.dice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
}
.g-title {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.dice-faces {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.die {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1.5px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
  font-family: var(--font-mono);
}
.die.dropped {
  opacity: 0.3;
  text-decoration: line-through;
  border-style: dashed;
}
.bonus {
  font-size: 20px;
  color: var(--text-2);
}
.total-row {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.total-label {
  font-size: 14px;
  color: var(--text-2);
}
.total-num {
  font-size: 40px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--accent-text);
  line-height: 1;
}
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.mini-clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--text-3);
  font-size: 12.5px;
  cursor: pointer;
}
.mini-clear:hover {
  color: var(--err);
}
.hist-list {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}
.hist-row {
  display: flex;
  justify-content: space-between;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
</style>
