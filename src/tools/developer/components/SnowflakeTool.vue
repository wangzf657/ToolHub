<script setup lang="ts">
import { ref } from 'vue'
import { Snowflake, Copy, Check, ScanSearch } from 'lucide-vue-next'
import { SnowflakeGen, parseSnowflake, SNOWFLAKE_EPOCH, type SnowflakeParsed } from '@/lib/devExt'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/* ---------- 批量生成 ---------- */
const dcId = ref(0)
const workerId = ref(0)
const epoch = ref(SNOWFLAKE_EPOCH)
const count = ref(10)
const ids = ref<string[]>([])
const genMs = ref(0)
const copied = ref(false)

const clampId = (v: number) => Math.min(31, Math.max(0, Math.round(Number.isFinite(v) ? v : 0)))

const gen = () => {
  const n = Math.min(500, Math.max(1, Math.round(count.value) || 1))
  try {
    const g = new SnowflakeGen(clampId(dcId.value), clampId(workerId.value), Number(epoch.value) || SNOWFLAKE_EPOCH)
    const t0 = performance.now()
    ids.value = Array.from({ length: n }, () => g.nextId().toString())
    genMs.value = Math.round(performance.now() - t0)
    toast.ok(`已生成 ${n} 个雪花 ID`)
  } catch (e) {
    toast.err((e as Error).message)
  }
}

const copyAll = async () => {
  if (!ids.value.length) return
  if (await copyText(ids.value.join('\n'))) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('已复制全部 ID（每行一个）')
  } else toast.err('复制失败')
}

/* ---------- 反查解析 ---------- */
const parseInput = ref('')
const parsed = ref<(SnowflakeParsed & { id: string })[]>([])

const runParse = () => {
  const lines = parseInput.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return toast.warn('请粘贴要解析的雪花 ID（每行一个）')
  const out: (SnowflakeParsed & { id: string })[] = []
  const bad: string[] = []
  for (const l of lines.slice(0, 500)) {
    try {
      out.push({ id: l, ...parseSnowflake(l, Number(epoch.value) || SNOWFLAKE_EPOCH) })
    } catch {
      bad.push(l)
    }
  }
  parsed.value = out
  if (bad.length) toast.warn(`${bad.length} 行不是合法雪花 ID，已跳过：${bad.slice(0, 3).join('、')}${bad.length > 3 ? '…' : ''}`)
  else toast.ok(`已解析 ${out.length} 个 ID`)
}
</script>

<template>
  <div class="sf grid-2" style="gap: 16px; grid-template-columns: 1fr 1fr;">
    <!-- 生成 -->
    <div class="pane">
      <div class="row" style="gap: 8px; align-items: center">
        <Snowflake :size="16" class="ic" /><span class="pane-title">批量生成</span>
      </div>
      <div class="fields mt-2">
        <div class="f-item">
          <span class="field-label">数据中心 ID</span>
          <input v-model.number="dcId" type="number" min="0" max="31" class="input" />
        </div>
        <div class="f-item">
          <span class="field-label">机器 ID</span>
          <input v-model.number="workerId" type="number" min="0" max="31" class="input" />
        </div>
        <div class="f-item">
          <span class="field-label">生成数量</span>
          <input v-model.number="count" type="number" min="1" max="500" class="input" />
        </div>
        <div class="f-item wide">
          <span class="field-label">起始纪元 epoch（毫秒时间戳）</span>
          <input v-model.number="epoch" type="number" class="input mono" />
          <span class="muted small">默认 {{ SNOWFLAKE_EPOCH }}（Twitter 纪元，2010-11-04）；与目标系统保持一致，否则解析出的时间会偏移</span>
        </div>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" @click="gen"><Snowflake :size="15" /> 生成</button>
        <button v-if="ids.length" class="btn btn-ghost btn-sm" @click="copyAll"><Check v-if="copied" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制全部</button>
        <span v-if="ids.length" class="muted small">{{ ids.length }} 个 · 耗时 {{ genMs }}ms</span>
      </div>
      <div v-if="ids.length" class="id-list mono mt-2">
        <div v-for="id in ids" :key="id" class="id-row">{{ id }}</div>
      </div>
    </div>

    <!-- 解析 -->
    <div class="pane">
      <div class="row" style="gap: 8px; align-items: center">
        <ScanSearch :size="16" class="ic" /><span class="pane-title">时间戳反查</span>
      </div>
      <div class="mt-2">
        <span class="field-label">雪花 ID 列表（每行一个，最多 500 行）</span>
        <textarea v-model="parseInput" class="textarea mono" style="min-height: 84px" :placeholder="ids.length ? ids[0] : '粘贴 64 位整数 ID…'"></textarea>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" @click="runParse"><ScanSearch :size="15" /> 解析</button>
      </div>
      <div v-if="parsed.length" class="mt-2 table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>生成时间</th><th>数据中心</th><th>机器</th><th>序列</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in parsed" :key="p.id">
              <td class="mono">{{ p.id }}</td>
              <td>{{ p.dateText }}</td>
              <td>{{ p.datacenterId }}</td>
              <td>{{ p.workerId }}</td>
              <td>{{ p.sequence }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small mt-2">解析同样使用上方 epoch 设置；ID 布局：1 符号位 + 41 位毫秒时间戳 + 5 位数据中心 + 5 位机器 + 12 位序列。</p>
    </div>
  </div>
</template>

<style scoped>
.pane { padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); min-width: 0; }
.ic { color: var(--accent-text); }
.pane-title { font-weight: 700; font-size: 14px; }
.fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.f-item { display: grid; gap: 4px; }
.f-item.wide { grid-column: 1 / -1; }
.id-list { max-height: 220px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 12.5px; color: var(--text-2); }
.id-row { padding: 1px 0; user-select: all; }
@media (max-width: 860px) { .sf { grid-template-columns: 1fr !important; } }
</style>
