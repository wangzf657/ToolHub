<script setup lang="ts">
import { ref } from 'vue'
import { Wifi, Loader2, Search } from 'lucide-vue-next'
import { normalizeMac, macToEui64 } from '@/lib/devExt'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const mode = ref<'single' | 'batch'>('single')
const macInput = ref('')
const batchInput = ref('')
const loading = ref(false)
let loaded = false

/** 单个查询结果 */
interface MacResult {
  raw: string
  hex: string
  bytes: number
  vendor: string
  oui: string
  eui64: string
  linkLocal: string
  universal: boolean
  multicast: boolean
  unknown: boolean
}
const result = ref<MacResult | null>(null)
const batchRows = ref<MacResult[]>([])

interface OuiEntry { p: string; o: string }
let ouiMap: Map<string, string> | null = null
let ouiExtra: OuiEntry[] = []

/** 懒加载并缓存 /data/oui.json（约 2MB，IEEE OUI 注册数据整理） */
async function ensureData(): Promise<number> {
  if (loaded && ouiMap) return ouiMap.size
  loading.value = true
  try {
    const res = await fetch('/data/oui.json')
    if (!res.ok) throw new Error(`厂商数据库加载失败（HTTP ${res.status}）`)
    const arr = (await res.json()) as OuiEntry[]
    const map = new Map<string, string>()
    const extra: OuiEntry[] = []
    for (const e of arr) {
      const hex = e.p.toLowerCase().replace(/[^0-9a-f]/g, '')
      if (hex.length === 6) map.set(hex, e.o)
      else if (hex) extra.push({ p: hex, o: e.o })
    }
    extra.sort((a, b) => b.p.length - a.p.length)
    ouiMap = map
    ouiExtra = extra
    loaded = true
    return map.size
  } finally {
    loading.value = false
  }
}

function vendorOf(hex: string): { vendor: string; oui: string; unknown: boolean } {
  if (!ouiMap) return { vendor: '未加载', oui: '', unknown: true }
  const oui = hex.slice(0, 6)
  let vendor = ouiMap.get(oui)
  let unknown = false
  if (!vendor) {
    // 非 3 字节前缀条目（如 28/36 位扩展前缀）按最长匹配兜底
    const hit = ouiExtra.find((e) => hex.startsWith(e.p))
    if (hit) vendor = hit.o
  }
  if (!vendor) {
    vendor = '未收录（可能是本地管理地址或新注册厂商）'
    unknown = true
  }
  return { vendor, oui: oui.toUpperCase().match(/../g)?.join(':') ?? '', unknown }
}

const toResult = (raw: string): MacResult | { error: string } => {
  const norm = normalizeMac(raw)
  if (!norm) return { error: '不是合法 MAC 地址（需 12 或 16 个十六进制位）' }
  const hex = norm.hex
  const { vendor, oui, unknown } = vendorOf(hex)
  const first = parseInt(hex.slice(0, 2), 16)
  const is64 = norm.bytes === 8
  const eui = is64 ? { eui64: hex.match(/../g)!.join(':').toUpperCase(), linkLocal: `fe80::${hex.slice(0, 2)}${hex.slice(2, 4)}:${hex.slice(4, 8)}:${hex.slice(8, 12)}:${hex.slice(12, 16)}` } : macToEui64(hex)
  return {
    raw: raw.trim(),
    hex: hex.match(/../g)!.join(':').toUpperCase(),
    bytes: norm.bytes,
    vendor,
    oui,
    eui64: eui.eui64,
    linkLocal: eui.linkLocal,
    universal: (first & 0x02) === 0,
    multicast: (first & 0x01) === 1,
    unknown,
  }
}

const runSingle = async () => {
  if (!macInput.value.trim()) return toast.warn('请输入 MAC 地址')
  try {
    const size = await ensureData()
    const r = toResult(macInput.value)
    if ('error' in r) return toast.warn(r.error)
    result.value = r
    batchRows.value = []
    if (r.unknown) toast.toast(`已查询（当前库 ${size.toLocaleString()} 条，该前缀未收录）`, 'info')
  } catch (e) {
    toast.err((e as Error).message)
  }
}

const runBatch = async () => {
  const lines = batchInput.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return toast.warn('请粘贴 MAC 地址列表（每行一个）')
  if (lines.length > 1000) return toast.warn('单次最多查询 1000 行，请分批查询')
  try {
    await ensureData()
    batchRows.value = lines.map((l) => {
      const r = toResult(l)
      return 'error' in r
        ? { raw: l, hex: '—', bytes: 0, vendor: r.error, oui: '', eui64: '', linkLocal: '', universal: true, multicast: false, unknown: true }
        : r
    })
    result.value = null
    toast.ok(`已查询 ${batchRows.value.length} 条`)
  } catch (e) {
    toast.err((e as Error).message)
  }
}
</script>

<template>
  <div class="oui">
    <div class="row row-wrap" style="gap: 12px">
      <label class="seg" :class="{ active: mode === 'single' }"><input v-model="mode" type="radio" value="single" class="sr" /> 单个查询</label>
      <label class="seg" :class="{ active: mode === 'batch' }"><input v-model="mode" type="radio" value="batch" class="sr" /> 批量查询</label>
      <span v-if="loading" class="muted small"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> 正在加载厂商数据库（约 2MB，仅首次）…</span>
    </div>

    <div v-if="mode === 'single'" class="mt-2">
      <span class="field-label">MAC 地址（冒号 / 连字符 / 点分隔 / 无分隔均可，支持 EUI-64）</span>
      <div class="row" style="gap: 10px; align-items: center">
        <input v-model="macInput" class="input mono grow" placeholder="如 00:1B:44:11:3A:B7 或 001b.4411.3ab7 或 001b44113ab7" @keyup.enter="runSingle" />
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="runSingle"><Search :size="15" /> 查询厂商</button>
      </div>
    </div>

    <div v-else class="mt-2">
      <span class="field-label">批量查询（每行一个 MAC 地址，最多 1000 行）</span>
      <textarea v-model="batchInput" class="textarea mono" style="min-height: 110px" placeholder="00:1B:44:11:3A:B7&#10;A4-C1-38-12-9F-0D&#10;8C16455D3A21"></textarea>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="runBatch"><Search :size="15" /> 批量查询</button>
      </div>
    </div>

    <!-- 单个结果 -->
    <div v-if="result" class="card mt-3 single">
      <div class="row row-wrap" style="gap: 16px; align-items: baseline">
        <span class="mac mono">{{ result.hex }}</span>
        <span class="vendor" :class="{ unknown: result.unknown }">{{ result.vendor }}</span>
      </div>
      <div class="detail mt-2">
        <div class="d-row"><span class="d-k">OUI 前缀</span><code class="mono">{{ result.oui }}</code><span class="d-note">前 3 字节由 IEEE 分配给厂商</span></div>
        <div class="d-row"><span class="d-k">厂商分配位说明</span><span>{{ result.multicast ? '第 1 字节最低位为 1：组播地址' : '单播地址' }} · {{ result.universal ? '全局唯一（IEEE 注册）' : '本地管理（随机化/自定义 MAC，如手机隐私地址）' }}</span></div>
        <div class="d-row"><span class="d-k">地址长度</span><span>{{ result.bytes === 8 ? 'EUI-64（8 字节）' : 'MAC-48（6 字节，后 3 字节为厂商自定义序列号）' }}</span></div>
        <div v-if="result.bytes === 6" class="d-row"><span class="d-k">EUI-64 展开</span><code class="mono">{{ result.eui64 }}</code><span class="d-note">中间插入 FF:FE 并翻转 U/L 位</span></div>
        <div v-if="result.bytes === 6" class="d-row"><span class="d-k">IPv6 链路本地地址</span><code class="mono">{{ result.linkLocal }}</code></div>
      </div>
    </div>

    <!-- 批量结果 -->
    <div v-if="batchRows.length" class="mt-3 table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>输入</th><th>规整后</th><th>OUI</th><th>厂商</th><th>类型</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in batchRows" :key="i + r.raw">
            <td class="mono">{{ r.raw }}</td>
            <td class="mono">{{ r.hex }}</td>
            <td class="mono">{{ r.oui }}</td>
            <td :class="{ unknown: r.unknown }">{{ r.vendor }}</td>
            <td class="small">{{ r.multicast ? '组播' : '单播' }} / {{ r.universal ? '全局' : '本地' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="notice notice-info mt-3 small">
      <p>原理：MAC 前 3 字节（OUI）由 IEEE 统一注册，本工具按 <code>/data/oui.json</code> 内置注册表离线查询；首次加载约 2MB 后缓存在页面内存。</p>
      <p class="mt-1">注意：手机/设备的「随机 MAC」「私有地址」第 1 字节次低位为 1，查不到厂商属正常现象；EUI-64 展开结果用于 IPv6 无状态地址推导。</p>
    </div>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.mac { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
.vendor { font-weight: 700; color: var(--accent-text); font-size: 15px; }
.vendor.unknown { color: var(--muted); font-weight: 500; }
.detail { display: grid; gap: 8px; }
.d-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; font-size: 13px; }
.d-k { flex: none; width: 118px; color: var(--text-2); font-weight: 600; font-size: 12.5px; }
.d-note { color: var(--muted); font-size: 12px; }
td.unknown { color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
