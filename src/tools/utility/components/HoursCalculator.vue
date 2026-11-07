<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { sumHours, formatMinutes } from '@/lib/dateEngine'

/** 工时计算器：多段上下班时间 + 休息扣除 → 累计工时 */
interface Range {
  start: string
  end: string
  breakMinutes: number | ''
}

const rows = ref<Range[]>([
  { start: '09:00', end: '18:00', breakMinutes: 60 },
  { start: '', end: '', breakMinutes: 0 },
])

const result = computed(() => {
  const clean = rows.value
    .filter((r) => r.start && r.end)
    .map((r) => ({ start: r.start, end: r.end, breakMinutes: Number(r.breakMinutes) || 0 }))
  return sumHours(clean)
})

const addRow = () => rows.value.push({ start: '', end: '', breakMinutes: 0 })
const removeAt = (i: number) => rows.value.splice(i, 1)
const clearAll = () => (rows.value = [{ start: '', end: '', breakMinutes: 0 }])

const perDayMinutes = computed(() => result.value.perDay)
</script>

<template>
  <div>
    <div class="hours-list">
      <div v-for="(r, i) in rows" :key="i" class="hours-row">
        <span class="day-label">第 {{ i + 1 }} 段</span>
        <input v-model="r.start" type="time" class="input" style="width: 128px" />
        <span class="muted">至</span>
        <input v-model="r.end" type="time" class="input" style="width: 128px" />
        <label class="row" style="gap: 6px; font-size: 12.5px; color: var(--text-3)">
          休息
          <input v-model.number="r.breakMinutes" type="number" min="0" step="5" class="input" style="width: 70px" />
          分钟
        </label>
        <span v-if="perDayMinutes[i] !== undefined" class="per-day">{{ formatMinutes(perDayMinutes[i]) }}</span>
        <button class="mini-btn danger" title="删除" aria-label="删除" @click="removeAt(i)"><Trash2 :size="14" /></button>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-soft btn-sm" @click="addRow"><Plus :size="14" /> 添加时间段</button>
      <button class="btn btn-ghost btn-sm" @click="clearAll">清空</button>
    </div>

    <div class="total mt-3">
      <span class="total-label">累计工时</span>
      <strong class="total-value">{{ formatMinutes(result.totalMinutes) }}</strong>
      <span class="total-sub">
        = {{ Math.floor(result.totalMinutes / 60) }} 小时 {{ result.totalMinutes % 60 }} 分钟
        （{{ (result.totalMinutes / 60).toFixed(2) }} 小时 / {{ (result.totalMinutes / 480).toFixed(2) }} 个工作日）
      </span>
    </div>

    <p class="calc-note muted small mt-2">
      跨午夜时间段（如 22:00 → 06:00）按次日结束计算。工时表结果仅保存在本页内存中，不会上传。
    </p>
  </div>
</template>

<style scoped>
.hours-list {
  display: grid;
  gap: 8px;
}
.hours-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.day-label {
  flex: none;
  min-width: 44px;
  font-size: 12.5px;
  color: var(--text-3);
  font-weight: 600;
}
.per-day {
  font-size: 12.5px;
  color: var(--ok);
  font-weight: 600;
  margin-left: auto;
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
.total {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  background: var(--accent-soft);
  border-radius: 14px;
}
.total-label {
  font-size: 13.5px;
  color: var(--text-2);
}
.total-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--accent-text);
}
.total-sub {
  font-size: 12.5px;
  color: var(--text-3);
}
.calc-note {
  margin-top: 12px;
}
</style>
