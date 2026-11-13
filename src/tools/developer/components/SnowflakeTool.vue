<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Snowflake, Copy, Check, ScanSearch } from 'lucide-vue-next'
import { SnowflakeGen, parseSnowflake, SNOWFLAKE_EPOCH, type SnowflakeParsed } from '@/lib/devExt'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun, installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()

/* ---------- 批量生成 ---------- */
const dcId = ref(0)
const workerId = ref(0)
const epoch = ref(SNOWFLAKE_EPOCH)
const count = ref(10)
const ids = ref<string[]>([])
const genMs = ref(0)
const copied = ref(false)

/** epoch 预设（rx1）：Twitter / Discord / 自定义毫秒 */
const EPOCH_PRESETS = [
  { label: 'Twitter（2010-11-04）', value: 1288834974657 },
  { label: 'Discord（2015-01-01）', value: 1420070400000 },
  { label: '自定义毫秒', value: -1 },
]
const epochPreset = ref(1288834974657)
watch(epochPreset, (v) => {
  if (v > 0) epoch.value = v
})

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
const parsed = ref<(SnowflakeParsed & { id: string; warn: string })[]>([])
const pasteEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null

/** 粘贴即解析（rx4，400ms 防抖） */
onMounted(() => {
  const deb = debounceRun(() => {
    if (parseInput.value.trim()) runParse()
  }, 400)
  unbindPaste = installPasteRun(pasteEl.value, () => deb.call())
})
onBeforeUnmount(() => unbindPaste?.())

/** 非标准布局判别（rx2）：时间戳超出 1971~2089 或 dc/worker 位全 1 */
const layoutWarnOf = (p: SnowflakeParsed): string => {
  if (p.datacenterId === 31 && p.workerId === 31) return '数据中心与机器位全 1'
  if (p.timestamp < 31536000000 || p.timestamp > 3786825600000) return '时间戳超出 1971~2089 合理域'
  return ''
}

/** 位布局色块（rx3）：1 符号 + 41 时间戳 + 5 数据中心 + 5 机器 + 12 序列 */
const layoutSegs = (id: string) => {
  const v = BigInt(id)
  const ts = Number(v >> 22n)
  const dc = Number((v >> 17n) & 31n)
  const wk = Number((v >> 12n) & 31n)
  const seq = Number(v & 0xfffn)
  return [
    { label: `1 符号位 = 0`, cells: 1, cls: 'ls-sign' },
    { label: `41 位毫秒时间戳 = ${ts}`, cells: 41, cls: 'ls-ts' },
    { label: `5 位数据中心 = ${dc}`, cells: 5, cls: 'ls-dc' },
    { label: `5 位机器 = ${wk}`, cells: 5, cls: 'ls-wk' },
    { label: `12 位序列 = ${seq}`, cells: 12, cls: 'ls-seq' },
  ]
}

const runParse = () => {
  const lines = parseInput.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return toast.warn('请粘贴要解析的雪花 ID（每行一个）')
  const out: (SnowflakeParsed & { id: string; warn: string })[] = []
  const bad: string[] = []
  for (const l of lines.slice(0, 500)) {
    try {
      const base = parseSnowflake(l, Number(epoch.value) || SNOWFLAKE_EPOCH)
      out.push({ id: l, ...base, warn: layoutWarnOf(base) })
    } catch {
      bad.push(l)
    }
  }
  parsed.value = out
  const warnCount = out.filter((p) => p.warn).length
  if (bad.length) toast.warn(`${bad.length} 行不是合法雪花 ID，已跳过：${bad.slice(0, 3).join('、')}${bad.length > 3 ? '…' : ''}`)
  else if (warnCount) toast.warn(`已解析 ${out.length} 个 ID，其中 ${warnCount} 个疑似非标准 5+5 布局（见黄色警告）`)
  else toast.ok(`已解析 ${out.length} 个 ID`)
}

const copiedRow = ref('')
const copyRow = async (p: SnowflakeParsed & { id: string }) => {
  const okFlag = await copyText(`生成时间=${p.dateText}`)
  if (okFlag) {
    copiedRow.value = p.id
    setTimeout(() => (copiedRow.value = ''), 1500)
  } else toast.err('复制失败')
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
          <div class="row" style="gap: 8px; align-items: center">
            <input v-model.number="epoch" type="number" class="input mono grow" />
            <select v-model.number="epochPreset" class="select" style="width: 190px">
              <option v-for="p in EPOCH_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
          <span class="muted small">默认 {{ SNOWFLAKE_EPOCH }}（Twitter 纪元）；与目标系统保持一致，否则解析出的时间会偏移</span>
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
        <span class="field-label">雪花 ID 列表（每行一个，最多 500 行，粘贴后自动解析）</span>
        <textarea ref="pasteEl" v-model="parseInput" class="textarea mono" style="min-height: 84px" :placeholder="ids.length ? ids[0] : '粘贴 64 位整数 ID…'"></textarea>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" @click="runParse"><ScanSearch :size="15" /> 解析</button>
      </div>
      <div v-if="parsed.length" class="mt-2 table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>生成时间</th><th>数据中心</th><th>机器</th><th>序列</th><th>位布局</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="p in parsed" :key="p.id">
              <td class="mono">{{ p.id }}</td>
              <td>{{ p.dateText }}</td>
              <td>{{ p.datacenterId }}</td>
              <td>{{ p.workerId }}</td>
              <td>{{ p.sequence }}</td>
              <td>
                <div class="ls-bar" :title="layoutSegs(p.id).map((s) => s.label).join(' | ')">
                  <span v-for="s in layoutSegs(p.id)" :key="s.cls" class="ls-seg" :class="s.cls" :style="{ flex: s.cells }"></span>
                </div>
              </td>
              <td>
                <button class="mini-btn" :title="`复制生成时间`" :aria-label="`复制 ${p.id} 的生成时间`" @click="copyRow(p)">
                  <Check v-if="copiedRow === p.id" :size="13" color="#34d399" /><Copy v-else :size="13" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="parsed.some((p) => p.warn)" class="notice notice-warn mt-2 small">
        <span v-for="p in parsed.filter((x) => x.warn)" :key="p.id">「{{ p.id }}」{{ p.warn }}——该 ID 可能非标准 5+5 布局，请核对生成方位宽。</span>
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
/* 位布局色块条（rx3） */
.ls-bar { display: flex; height: 12px; width: 150px; border-radius: 3px; overflow: hidden; border: 1px solid var(--border); }
.ls-seg { display: block; }
.ls-sign { background: #64748b; flex: 1; }
.ls-ts { background: #60a5fa; flex: 41; }
.ls-dc { background: #34d399; flex: 5; }
.ls-wk { background: #c084fc; flex: 5; }
.ls-seq { background: #fbbf24; flex: 12; }
.mini-btn { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 7px; width: 26px; height: 26px; display: grid; place-items: center; cursor: pointer; }
.mini-btn:hover { border-color: var(--accent); color: var(--text); }
@media (max-width: 860px) { .sf { grid-template-columns: 1fr !important; } }
</style>
