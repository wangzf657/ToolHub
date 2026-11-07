<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2, Target } from 'lucide-vue-next'

/** 成绩计算器：加权总评 + 期末所需分数反推 */
interface Item {
  name: string
  score: number | ''
  weight: number | ''
}

const items = ref<Item[]>([
  { name: '平时作业', score: 90, weight: 20 },
  { name: '期中考试', score: 85, weight: 30 },
  { name: '期末考试', score: '' as number | '', weight: 50 },
])
const target = ref(90)

const valid = computed(() => items.value.filter((i) => i.score !== '' && i.weight))
const weightedScore = computed(() => {
  let s = 0
  let w = 0
  for (const i of valid.value) {
    s += Number(i.score) * Number(i.weight)
    w += Number(i.weight)
  }
  return { s, w }
})
const currentGrade = computed(() => {
  const { s, w } = weightedScore.value
  return w ? s / w : 0
})
/** 已计入权重中「期末之后」的未知项总权重 */
const pendingWeight = computed(() => {
  const totalW = items.value.reduce((s, i) => s + (Number(i.weight) || 0), 0)
  return totalW - weightedScore.value.w
})
const neededOnFinal = computed(() => {
  const pw = pendingWeight.value
  if (!pw) return null
  const need = (Number(target.value) - (weightedScore.value.s || 0)) / pw
  return need * 100
})
const letter = computed(() => {
  const g = currentGrade.value
  if (!g) return '—'
  if (g >= 93) return 'A'
  if (g >= 90) return 'A-'
  if (g >= 87) return 'B+'
  if (g >= 83) return 'B'
  if (g >= 80) return 'B-'
  if (g >= 77) return 'C+'
  if (g >= 73) return 'C'
  if (g >= 70) return 'C-'
  if (g >= 60) return 'D'
  return 'F'
})

const addRow = () => items.value.push({ name: '', score: '', weight: '' })
const removeAt = (i: number) => items.value.splice(i, 1)
</script>

<template>
  <div>
    <div class="course-list">
      <div v-for="(it, i) in items" :key="i" class="course-row">
        <input v-model="it.name" class="input" placeholder="项目名称" style="flex: 1.3" />
        <input v-model.number="it.score" type="number" min="0" max="100" class="input" style="width: 90px" placeholder="得分" />
        <input v-model.number="it.weight" type="number" min="0" max="100" class="input" style="width: 90px" placeholder="权重%" />
        <button class="mini-btn danger" title="删除" aria-label="删除" @click="removeAt(i)"><Trash2 :size="14" /></button>
      </div>
    </div>

    <div class="row mt-2 row-wrap">
      <button class="btn btn-soft btn-sm" @click="addRow"><Plus :size="14" /> 添加项目</button>
      <span class="grow"></span>
      <label class="row" style="gap: 8px; font-size: 13.5px; color: var(--text-2)">
        目标总评
        <input v-model.number="target" type="number" min="0" max="100" class="input" style="width: 80px" />
      </label>
    </div>

    <div class="result-grid mt-3">
      <div class="result-card">
        <span class="rc-label">当前已知部分加权成绩</span>
        <strong class="rc-value">{{ currentGrade ? currentGrade.toFixed(1) : '—' }}</strong>
        <span class="rc-hint">等级 {{ letter }} · 已计入权重 {{ weightedScore.w }}%</span>
      </div>
      <div class="result-card" :class="{ accent: pendingWeight > 0 }">
        <span class="rc-label"><Target :size="14" /> 剩余 {{ pendingWeight }}% 权重需达到</span>
        <strong class="rc-value">
          {{ neededOnFinal === null ? '—' : neededOnFinal > 100 ? '无法达标' : neededOnFinal.toFixed(1) }}
        </strong>
        <span class="rc-hint">
          {{ neededOnFinal === null ? '留一项空着得分即可反推' : neededOnFinal > 100 ? '该目标在当前权重下无法实现' : neededOnFinal <= 0 ? '目标已锁定，剩余部分随便考' : `剩余项目平均需 ≥ ${neededOnFinal.toFixed(1)} 分` }}
        </span>
      </div>
    </div>

    <p class="calc-note muted small mt-2">
      总评 = Σ(各项得分 × 权重)。把还未考的项目得分留空，即可反推「需要在剩余项目拿到多少分」。
    </p>
  </div>
</template>

<style scoped>
.course-list {
  display: grid;
  gap: 8px;
}
.course-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 30px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
}
.mini-btn.danger:hover {
  color: var(--err);
  border-color: var(--err);
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}
.result-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  display: grid;
  gap: 4px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.result-card.accent {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: var(--accent-soft);
}
.rc-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}
.rc-value {
  font-size: 30px;
  font-weight: 800;
}
.rc-hint {
  font-size: 12px;
  color: var(--text-3);
}
.calc-note {
  margin-top: 12px;
}
</style>
