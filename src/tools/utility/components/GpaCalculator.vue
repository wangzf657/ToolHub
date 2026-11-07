<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

/** GPA 计算器：4.0 制加权平均绩点 */
interface Course {
  name: string
  grade: string
  credits: number
}

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, F: 0,
}

const toast = useToast()
const courses = ref<Course[]>([
  { name: '高等数学', grade: 'A', credits: 5 },
  { name: '大学英语', grade: 'B+', credits: 3 },
])
const gpa = computed(() => {
  let pts = 0
  let credits = 0
  for (const c of courses.value) {
    const p = GRADE_POINTS[c.grade.toUpperCase()]
    if (p === undefined || !c.credits) continue
    pts += p * c.credits
    credits += c.credits
  }
  return credits ? pts / credits : 0
})
const totalCredits = computed(() => courses.value.reduce((s, c) => s + (c.credits || 0), 0))

const addRow = () => courses.value.push({ name: '', grade: 'A', credits: 3 })
const removeAt = (i: number) => courses.value.splice(i, 1)
const clearAll = () => (courses.value = [])

const gpaColor = computed(() =>
  gpa.value >= 3.7 ? '#34d399' : gpa.value >= 3 ? '#fbbf24' : gpa.value > 0 ? '#f87171' : 'var(--text-3)',
)

watch(courses, () => {}, { deep: true })
void toast
</script>

<template>
  <div>
    <div class="course-list">
      <div v-for="(c, i) in courses" :key="i" class="course-row">
        <input v-model="c.name" class="input" placeholder="课程名（可选）" style="flex: 1.4" />
        <select v-model="c.grade" class="select" style="width: 96px">
          <option v-for="(pt, g) in GRADE_POINTS" :key="g" :value="g">{{ g }}（{{ pt.toFixed(1) }}）</option>
        </select>
        <input v-model.number="c.credits" type="number" min="0" step="0.5" class="input" style="width: 84px" placeholder="学分" />
        <button class="mini-btn danger" title="删除" aria-label="删除" @click="removeAt(i)"><Trash2 :size="14" /></button>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-soft btn-sm" @click="addRow"><Plus :size="14" /> 添加课程</button>
      <button class="btn btn-ghost btn-sm" @click="clearAll">清空</button>
    </div>

    <div class="result mt-3">
      <div class="gpa-big" :style="{ color: gpaColor }">{{ gpa ? gpa.toFixed(2) : '—' }}</div>
      <div class="gpa-meta">
        <span>加权 GPA（4.0 制）</span>
        <strong>共 {{ totalCredits }} 学分</strong>
      </div>
    </div>

    <p class="calc-note muted small mt-2">
      标准绩点：A/A+ = 4.0、A- = 3.7、B+ = 3.3、B = 3.0、B- = 2.7、C+ = 2.3、C = 2.0、C- = 1.7、D+ = 1.3、D = 1.0、F = 0。不同学校换算规则可能不同，以教务规定为准。
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
.result {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  background: var(--accent-soft);
  border-radius: 14px;
}
.gpa-big {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -1px;
}
.gpa-meta {
  display: grid;
  gap: 3px;
  font-size: 13.5px;
  color: var(--text-2);
}
.gpa-meta strong {
  color: var(--text);
}
.calc-note {
  margin-top: 12px;
}
</style>
