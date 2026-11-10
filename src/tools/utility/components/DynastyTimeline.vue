<script setup lang="ts">
import { computed, ref } from 'vue'
import { DYNASTIES } from '@/lib/utilData'

const selected = ref(-1)

const span = computed(() => {
  const first = DYNASTIES[0]?.startNum ?? 0
  const last = DYNASTIES[DYNASTIES.length - 1]?.startNum ?? 0
  // 时间轴以「起点位置」为主：用最后一条的 startNum 加一段长度
  const total = Math.max(1, last - first + 300)
  return { first, total }
})

const pctOf = (n: number) => `${((n - span.value.first) / span.value.total) * 100}%`

const d = computed(() => DYNASTIES[selected.value])
</script>

<template>
  <div>
    <div class="opts-panel">
      <p class="hint">内置主要朝代速查（约 20 条主干政权，起始年份含过渡期口径，仅供快速参考）。点击时间轴分段或表格行查看详情。</p>
    </div>

    <div class="timeline mt-2">
      <div class="track">
        <div
          v-for="(dy, i) in DYNASTIES"
          :key="i"
          class="seg"
          :class="{ on: selected === i }"
          :style="{ left: pctOf(dy.startNum), width: 'max(4px, 3%)' }"
          :title="`${dy.name} ${dy.start} — ${dy.end}`"
          @click="selected = i"
        ></div>
      </div>
      <div class="scale"><span>{{ DYNASTIES[0]?.start }}</span><span>{{ DYNASTIES[DYNASTIES.length - 1]?.end }}</span></div>
    </div>

    <div class="tbl-wrap mt-2">
      <table class="tbl">
        <thead><tr><th>朝代</th><th>起止</th><th>都城</th><th>建立者</th></tr></thead>
        <tbody>
          <tr v-for="(dy, i) in DYNASTIES" :key="dy.name + i" :class="{ on: selected === i }" @click="selected = i">
            <td class="nm">{{ dy.name }}</td>
            <td class="mono">{{ dy.start }} — {{ dy.end }}</td>
            <td>{{ dy.capital }}</td>
            <td>{{ dy.founder }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="d" class="hint mt-2">{{ d.name }}（{{ d.start }} — {{ d.end }}），都城 {{ d.capital }}，建立者 {{ d.founder }}。</p>
  </div>
</template>

<style scoped>
.hint { font-size: 12px; color: var(--muted); }
.timeline { padding: 0 4px; }
.track { position: relative; height: 44px; background: var(--surface-2, rgba(127,127,127,.1)); border-radius: 8px; }
.seg { position: absolute; top: 6px; bottom: 6px; background: var(--accent); opacity: .5; border-radius: 3px; cursor: pointer; }
.seg:hover { opacity: .75; }
.seg.on { opacity: 1; outline: 2px solid var(--accent-text); }
.scale { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 4px; }
.tbl-wrap { border: 1px solid var(--border); border-radius: 10px; max-height: 400px; overflow: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th, .tbl td { padding: 7px 12px; border-bottom: 1px solid var(--border); text-align: left; }
.tbl thead th { position: sticky; top: 0; background: var(--surface-2, inherit); }
.tbl tbody tr { cursor: pointer; }
.tbl tbody tr.on { background: var(--accent-soft); }
.nm { font-weight: 700; color: var(--accent-text); }
</style>
