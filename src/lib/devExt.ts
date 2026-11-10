/**
 * 开发工具扩展逻辑（本批次新增工具共享的纯函数）
 * 含：docker run ↔ compose、地理坐标系互转、雪花 ID、Cookie 解析、
 *     变量命名风格互转、MAC 地址规整、Base64/二进制字符串字节工具
 */
import { yamlParse } from '@/lib/jsEngine'

/* =============== 通用字节 / 编码工具 =============== */

/** Uint8Array → Base64（分块防栈溢出） */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(bin)
}

/** Base64 → Uint8Array（忽略空白） */
export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Uint8Array → latin1 二进制字符串（即每字节一个字符） */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) out += String.fromCharCode(...bytes.subarray(i, i + CH))
  return out
}

/** latin1 二进制字符串 → Uint8Array */
export function latin1ToBytes(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)
}

/** 字节数人性化显示 */
export function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`
}

/* =============== docker run ↔ compose =============== */

/** 引号感知的命令行分词 */
function shlex(cmd: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]!
    if (quote) {
      if (c === quote) quote = null
      else cur += c
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (/\s/.test(c)) {
      if (cur) { out.push(cur); cur = '' }
    } else {
      cur += c
    }
  }
  if (cur) out.push(cur)
  return out
}

/** 需要值且已映射到 compose 的 flag */
const RUN_VALUE_FLAGS = new Set([
  '-p', '--publish', '-v', '--volume', '-e', '--env', '--env-file', '--restart', '--name',
  '--network', '--entrypoint', '--user', '-w', '--workdir', '--hostname', '-h', '--device',
  '--label', '-l', '--health-cmd', '--depends-on', '--memory', '-m', '--cpus', '--add-host',
])

/** 需要值但暂不映射到 compose 的常见 flag（吞掉值并提示，避免污染镜像/命令） */
const RUN_IGNORE_VALUE_FLAGS = new Set([
  '--cap-add', '--cap-drop', '--dns', '--dns-search', '--dns-option', '--log-driver', '--log-opt',
  '--ulimit', '--sysctl', '--shm-size', '--stop-signal', '--memory-swap', '--platform', '--pull',
  '--mount', '--network-alias', '--link', '--expose', '--ip', '--ip6', '--mac-address', '--tmpfs',
  '--group-add', '--volumes-from', '--cpuset-cpus', '--memory-reservation', '--label-file',
  '--health-interval', '--health-timeout', '--health-retries', '--health-start-period',
  '--pid', '--ipc', '--uts', '--userns', '--security-opt', '--storage-opt', '--isolation',
  '--runtime', '--gpus', '--blkio-weight', '--cgroup-parent', '--cpu-shares',
  '--device-cgroup-rule', '--device-read-bps', '--device-write-bps', '--pids-limit', '--oom-score-adj',
])

/** docker run 单个服务的解析结果 */
export interface DockerRunParsed {
  service: Record<string, unknown>
  /** 无法映射到 compose 的参数提醒 */
  warnings: string[]
}

/** 解析 docker run 命令为 compose service 结构 */
export function parseDockerRun(cmd: string): DockerRunParsed {
  const tokens = shlex(cmd.replace(/^\s*docker\s+((container\s+)?create|run)\s+/i, ''))
  const s: Record<string, unknown> = {}
  const envList: string[] = []
  const labelList: string[] = []
  const warnings: string[] = []
  let image = ''
  const cmdArgs: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    // docker 语义：镜像之后的参数全部是容器启动命令，不再解析 flag
    if (image) {
      cmdArgs.push(t)
      i++
      continue
    }
    if (t.startsWith('-')) {
      // 组合短参（如 -it、-dit）逐字符展开
      if (/^-[a-z]{2,}$/i.test(t) && !RUN_VALUE_FLAGS.has(t)) {
        for (const ch of t.slice(1)) pushShort(ch, undefined)
        i++
        continue
      }
      const hasInline = t.includes('=') && t.startsWith('--')
      const key = hasInline ? t.slice(0, t.indexOf('=')) : t
      const val = hasInline ? t.slice(t.indexOf('=') + 1) : undefined
      if (RUN_VALUE_FLAGS.has(key)) {
        const v = val ?? tokens[++i]
        if (v === undefined) throw new Error(`参数 ${key} 缺少值`)
        pushValue(key, v)
      } else if (RUN_IGNORE_VALUE_FLAGS.has(key)) {
        const v = val ?? tokens[++i]
        warnings.push(`参数 ${key}（${v ?? ''}）暂不支持映射到 compose，已忽略`)
      } else {
        pushFlag(key)
      }
      i++
    } else {
      image = t
      i++
    }
  }
  function pushShort(ch: string, _: unknown) {
    pushFlag('-' + ch)
  }
  /** 向 s[key] 追加字符串列表项（首次自动建数组） */
  function pushArr(key: string, v: string) {
    const arr = (s[key] as string[] | undefined) ?? []
    arr.push(v)
    s[key] = arr
  }
  function pushValue(key: string, v: string) {
    switch (key) {
      case '-p': case '--publish': pushArr('ports', v); break
      case '-v': case '--volume': pushArr('volumes', v); break
      case '-e': case '--env': envList.push(v); break
      case '--env-file': pushArr('env_file', v); break
      case '--restart': s.restart = v; break
      case '--name': s.container_name = v; break
      case '--network': pushArr('networks', v); break
      case '--entrypoint': s.entrypoint = v; break
      case '--user': s.user = v; break
      case '-w': case '--workdir': s.working_dir = v; break
      case '--hostname': case '-h': s.hostname = v; break
      case '--device': pushArr('devices', v); break
      case '--label': case '-l': labelList.push(v); break
      case '--health-cmd': s.healthcheck = { test: ['CMD-SHELL', v] }; break
      case '--depends-on': pushArr('depends_on', v); break
      case '--memory': case '-m': s.mem_limit = v; warnings.push('--memory 在 compose v3 部署模式由 deploy.resources 管理，已写入 mem_limit 供本地 docker compose 使用'); break
      case '--cpus': s.cpus = Number(v) || v; break
      case '--add-host': pushArr('extra_hosts', v); break
    }
  }
  function pushFlag(key: string) {
    switch (key) {
      case '-d': case '--detach': break // 后台运行是 run 时行为，compose 默认即为托管
      case '--rm': warnings.push('--rm 为一次性运行参数，compose 服务不适用，已忽略'); break
      case '-i': case '--interactive': s.stdin_open = true; break
      case '-t': case '--tty': s.tty = true; break
      case '--privileged': s.privileged = true; break
      default: warnings.push(`未识别的参数 ${key}，已忽略`)
    }
  }
  if (envList.length) {
    // 全部为 K=V 时输出映射，否则保留列表形式（等价透传宿主变量）
    if (envList.every((e) => e.includes('='))) {
      const m: Record<string, string> = {}
      for (const e of envList) {
        const eq = e.indexOf('=')
        m[e.slice(0, eq)] = e.slice(eq + 1)
      }
      s.environment = m
    } else {
      s.environment = envList
    }
  }
  if (labelList.length) {
    // 全部为 K=V 时输出映射，否则保留列表形式
    if (labelList.every((l) => l.includes('='))) {
      const m: Record<string, string> = {}
      for (const l of labelList) {
        const eq = l.indexOf('=')
        m[l.slice(0, eq)] = l.slice(eq + 1)
      }
      s.labels = m
    } else {
      s.labels = labelList
    }
  }
  if (!image) throw new Error('没有找到镜像名：docker run 后第一个位置参数应为镜像')
  s.image = image
  if (cmdArgs.length) s.command = cmdArgs
  return { service: s, warnings }
}

/** 极简 YAML 标量序列化（布尔/数值直接输出，字符串按需加引号） */
function yamlScalar(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (typeof v === 'boolean') return String(v)
  const s = String(v)
  if (s === '' || /[:#{}\[\],&*'"?|~%!@`>]/.test(s) || /^\s|\s$/.test(s) || /^(true|false|null|~|yes|no|on|off|\d+(\.\d+)?([eE][+-]?\d+)?)$/i.test(s) || /\n/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

/** 极简 YAML 生成（对象/数组/标量，2 空格缩进） */
export function toSimpleYaml(value: unknown, indent = 0): string[] {
  const pad = ' '.repeat(indent)
  const lines: string[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        const sub = toSimpleYaml(item, indent + 2)
        lines.push(`${pad}- ${sub[0]!.slice(indent + 2)}`, ...sub.slice(1))
      } else {
        lines.push(`${pad}- ${yamlScalar(item)}`)
      }
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object') {
        const sub = toSimpleYaml(v, indent + 2)
        if (!sub.length) lines.push(`${pad}${yamlScalar(k)}: {}`)
        else lines.push(`${pad}${yamlScalar(k)}:`, ...sub)
      } else {
        lines.push(`${pad}${yamlScalar(k)}: ${yamlScalar(v)}`)
      }
    }
  } else {
    lines.push(`${pad}${yamlScalar(value)}`)
  }
  return lines
}

/** docker run 命令 → compose v3 YAML 文本 */
export function dockerRunToCompose(cmd: string): string {
  const { service, warnings } = parseDockerRun(cmd)
  const body = toSimpleYaml({ services: { app: service } }, 0)
  const head = [
    '# 由 docker run 命令生成（compose v3）',
    ...warnings.map((w) => `# 注意：${w}`),
  ]
  return [...head, ...body, ''].join('\n')
}

/** compose YAML → docker run 命令（尽力还原） */
export function dockerComposeToRun(yaml: string): string {
  const parsed = yamlParse(yaml) as Record<string, unknown> | null
  if (!parsed || typeof parsed !== 'object') throw new Error('无法解析 YAML：请确认是 compose 文件内容')
  const services = (parsed as Record<string, unknown>).services
  if (!services || typeof services !== 'object') throw new Error('没找到 services 段：请粘贴完整的 compose 服务配置')
  const lines: string[] = []
  for (const [name, raw] of Object.entries(services as Record<string, unknown>)) {
    const s = (raw ?? {}) as Record<string, unknown>
    const parts = ['docker run -d --name ' + shq(String(s.container_name ?? name))]
    const list = (key: string): unknown[] => (Array.isArray(s[key]) ? (s[key] as unknown[]) : s[key] && typeof s[key] === 'object' ? Object.entries(s[key] as Record<string, unknown>).map(([a, b]) => (b === null || b === '' ? a : `${a}:${b}`)) : [])
    for (const p of list('ports')) parts.push('-p ' + shq(String(p)))
    for (const v of list('volumes')) parts.push('-v ' + shq(String(v)))
    for (const d of list('devices')) parts.push('--device ' + shq(String(d)))
    for (const h of list('extra_hosts')) parts.push('--add-host ' + shq(String(h)))
    const env = s.environment
    if (Array.isArray(env)) for (const e of env) parts.push('-e ' + shq(String(e)))
    else if (env && typeof env === 'object') for (const [k, v] of Object.entries(env as Record<string, unknown>)) parts.push('-e ' + shq(`${k}=${v}`))
    const labels = s.labels
    if (Array.isArray(labels)) for (const e of labels) parts.push('--label ' + shq(String(e)))
    else if (labels && typeof labels === 'object') for (const [k, v] of Object.entries(labels as Record<string, unknown>)) parts.push('--label ' + shq(`${k}=${v}`))
    for (const f of list('env_file')) parts.push('--env-file ' + shq(String(f)))
    const nets = s.networks
    if (Array.isArray(nets)) for (const n of nets) parts.push('--network ' + shq(String(n)))
    else if (nets && typeof nets === 'object') for (const n of Object.keys(nets as Record<string, unknown>)) parts.push('--network ' + shq(n))
    if (s.restart) parts.push('--restart ' + shq(String(s.restart)))
    if (s.entrypoint) parts.push('--entrypoint ' + shq(String(s.entrypoint)))
    if (s.user) parts.push('--user ' + shq(String(s.user)))
    if (s.working_dir) parts.push('-w ' + shq(String(s.working_dir)))
    if (s.hostname) parts.push('-h ' + shq(String(s.hostname)))
    if (s.privileged === true) parts.push('--privileged')
    if (s.stdin_open === true) parts.push('-i')
    if (s.tty === true) parts.push('-t')
    const hc = s.healthcheck as { test?: unknown } | undefined
    if (hc && Array.isArray(hc.test) && hc.test.length) parts.push('--health-cmd ' + shq(String(hc.test[hc.test.length - 1])))
    const deps = s.depends_on
    if (Array.isArray(deps)) for (const d of deps) parts.push('--depends-on ' + shq(String(d)))
    else if (deps && typeof deps === 'object') for (const d of Object.keys(deps as Record<string, unknown>)) parts.push('--depends-on ' + shq(d))
    if (!s.image) throw new Error(`服务 ${name} 缺少 image 字段`)
    parts.push(shq(String(s.image)))
    if (Array.isArray(s.command)) for (const c of s.command) parts.push(shq(String(c)))
    else if (typeof s.command === 'string') parts.push(shq(s.command))
    lines.push(parts.join(' '))
  }
  return lines.join('\n\n')
}

/** shell 单值引用 */
function shq(v: string): string {
  return /\s|"|'|\$/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v
}

/* =============== 地理坐标系互转（WGS84/GCJ02/BD09 公开纠偏算法） =============== */

export type CoordSys = 'wgs84' | 'gcj02' | 'bd09'

export const COORD_LABELS: Record<CoordSys, string> = {
  wgs84: 'WGS84（GPS 原始坐标）',
  gcj02: 'GCJ02（火星坐标，高德/腾讯）',
  bd09: 'BD09（百度坐标）',
}

const X_PI = Math.PI * 3000.0 / 180.0
const GCJ_A = 6378245.0
const GCJ_EE = 0.00669342162296594323

/** 是否在中国大陆纠偏范围外（范围外不做偏移） */
export function outOfChina(lon: number, lat: number): boolean {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transLat(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
  return r
}

function transLon(x: number, y: number): number {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
  return r
}

function wgsDelta(lon: number, lat: number): { dLon: number; dLat: number } {
  let dLat = transLat(lon - 105, lat - 35)
  let dLon = transLon(lon - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI)
  dLon = (dLon * 180) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI)
  return { dLon, dLat }
}

/** WGS84 → GCJ02 */
export function wgs84ToGcj02(lon: number, lat: number): { lon: number; lat: number } {
  if (outOfChina(lon, lat)) return { lon, lat }
  const { dLon, dLat } = wgsDelta(lon, lat)
  return { lon: lon + dLon, lat: lat + dLat }
}

/** GCJ02 → WGS84（迭代反算，精度约 1m） */
export function gcj02ToWgs84(lon: number, lat: number): { lon: number; lat: number } {
  let wLon = lon
  let wLat = lat
  for (let i = 0; i < 3; i++) {
    const g = wgs84ToGcj02(wLon, wLat)
    wLon += lon - g.lon
    wLat += lat - g.lat
  }
  return { lon: wLon, lat: wLat }
}

/** GCJ02 → BD09 */
export function gcj02ToBd09(lon: number, lat: number): { lon: number; lat: number } {
  const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI)
  const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI)
  return { lon: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 }
}

/** BD09 → GCJ02 */
export function bd09ToGcj02(lon: number, lat: number): { lon: number; lat: number } {
  const x = lon - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI)
  return { lon: z * Math.cos(theta), lat: z * Math.sin(theta) }
}

export interface Coord {
  lon: number
  lat: number
}

/** 任意两坐标系互转 */
export function convertCoord(lon: number, lat: number, from: CoordSys, to: CoordSys): Coord {
  if (from === to) return { lon, lat }
  // 先统一转成 GCJ02 中间系，再转目标系
  const g = from === 'wgs84' ? wgs84ToGcj02(lon, lat) : from === 'bd09' ? bd09ToGcj02(lon, lat) : { lon, lat }
  if (to === 'gcj02') return g
  if (from === 'gcj02' && to === 'wgs84') return gcj02ToWgs84(lon, lat)
  if (to === 'bd09') return gcj02ToBd09(g.lon, g.lat)
  // BD09/WGS84 → WGS84：先回到 GCJ02（g），再反算
  return gcj02ToWgs84(g.lon, g.lat)
}

/* =============== 雪花 ID（41 时间戳 + 10 机器 + 12 序列） =============== */

export const SNOWFLAKE_EPOCH = 1288834974657 // Twitter 默认纪元（2010-11-04）

/** 雪花 ID 生成器：标准布局 = 1 符号位 + 41 时间戳 + 5 数据中心 + 5 机器 + 12 序列 */
export class SnowflakeGen {
  private lastTs = -1
  private seq = 0
  constructor(
    /** 数据中心 ID（0–31） */
    public datacenterId = 0,
    /** 机器 ID（0–31） */
    public workerId = 0,
    /** 起始纪元毫秒 */
    public epoch = SNOWFLAKE_EPOCH,
  ) {}

  nextId(): bigint {
    let ts = Date.now()
    if (ts < this.lastTs) throw new Error('检测到系统时钟回拨，为避免生成重复 ID 已暂停，请校准系统时间后重试')
    if (ts === this.lastTs) {
      this.seq = (this.seq + 1) & 0xfff
      if (this.seq === 0) {
        // 当前毫秒序列耗尽，自旋等待下一毫秒
        while (ts <= this.lastTs) ts = Date.now()
      }
    } else {
      this.seq = 0
    }
    this.lastTs = ts
    return (BigInt(ts - this.epoch) << 22n)
      | (BigInt(this.datacenterId & 31) << 17n)
      | (BigInt(this.workerId & 31) << 12n)
      | BigInt(this.seq)
  }
}

export interface SnowflakeParsed {
  timestamp: number
  dateText: string
  datacenterId: number
  workerId: number
  sequence: number
}

/** 从雪花 ID 反解时间戳与机器位 */
export function parseSnowflake(id: string, epoch = SNOWFLAKE_EPOCH): SnowflakeParsed {
  const v = BigInt(id)
  if (v < 0n || v > 0x7fffffffffffffffn) throw new Error('不是合法的 63 位以内雪花 ID')
  const ts = Number(v >> 22n) + epoch
  const dc = Number((v >> 17n) & 31n)
  const wk = Number((v >> 12n) & 31n)
  const seq = Number(v & 0xfffn)
  return {
    timestamp: ts,
    dateText: new Date(ts).toLocaleString('sv-SE', { hour12: false }),
    datacenterId: dc,
    workerId: wk,
    sequence: seq,
  }
}

/* =============== 变量命名风格互转 =============== */

export type CaseTarget = 'snake' | 'camel' | 'pascal' | 'kebab' | 'constant'

export const CASE_TARGETS: { value: CaseTarget; label: string; example: string }[] = [
  { value: 'snake', label: 'snake_case 小写下划线', example: 'user_name' },
  { value: 'camel', label: 'camelCase 小驼峰', example: 'userName' },
  { value: 'pascal', label: 'PascalCase 大驼峰', example: 'UserName' },
  { value: 'kebab', label: 'kebab-case 中划线', example: 'user-name' },
  { value: 'constant', label: 'CONSTANT_CASE 常量', example: 'USER_NAME' },
]

/** 把任意风格的标识符切分成小写单词 */
export function wordsOfIdentifier(name: string): string[] {
  const s = name.trim()
  if (!s) return []
  const parts = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[\s_\-.$]+/)
  return parts.filter(Boolean).map((w) => w.toLowerCase())
}

const cap = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)

/** 单个标识符转目标风格 */
export function convertIdentifier(name: string, target: CaseTarget): string {
  const words = wordsOfIdentifier(name)
  if (!words.length) return name
  switch (target) {
    case 'snake': return words.join('_')
    case 'kebab': return words.join('-')
    case 'constant': return words.map((w) => w.toUpperCase()).join('_')
    case 'camel': return words.map((w, i) => (i === 0 ? w : cap(w))).join('')
    case 'pascal': return words.map(cap).join('')
  }
}

/* =============== Cookie 解析 =============== */

export interface CookieAttrRow {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  maxAge?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  other?: Record<string, string>
}

/** 按分号拆 k=v（值内引号里的分号不拆） */
function splitCookiePairs(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (const c of line) {
    if (quote) {
      cur += c
      if (c === quote) quote = null
    } else if (c === '"') {
      quote = c
      cur += c
    } else if (c === ';') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const ATTR_KEYS = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite', 'partitioned'] as const

/** 解析 Cookie 输入（document.cookie 串 / Set-Cookie 行，可多行）→ JSON 文本 */
export function parseCookieInput(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) throw new Error('请输入 Cookie 字符串或 Set-Cookie 响应头')
  const rows: CookieAttrRow[] = []
  const simpleMap: Record<string, string> = {}
  let setCookieMode = false
  for (let line of lines) {
    line = line.replace(/^set-cookie\s*:\s*/i, '')
    const pairs = splitCookiePairs(line)
    const first = pairs[0] ?? ''
    const eq = first.indexOf('=')
    const name = eq > 0 ? first.slice(0, eq).trim() : first
    const value = eq > 0 ? first.slice(eq + 1).trim() : ''
    const rest = pairs.slice(1)
    const hasAttrs = rest.some((p) => ATTR_KEYS.includes(p.split('=')[0]!.trim().toLowerCase() as (typeof ATTR_KEYS)[number]))
    if (hasAttrs) {
      setCookieMode = true
      const row: CookieAttrRow = { name, value: value.replace(/^"|"$/g, '') }
      for (const p of rest) {
        const e = p.indexOf('=')
        const k = (e > 0 ? p.slice(0, e) : p).trim().toLowerCase()
        const v = e > 0 ? p.slice(e + 1).trim() : ''
        if (k === 'domain') row.domain = v
        else if (k === 'path') row.path = v
        else if (k === 'expires') row.expires = v
        else if (k === 'max-age') row.maxAge = v
        else if (k === 'httponly') row.httpOnly = true
        else if (k === 'secure') row.secure = true
        else if (k === 'samesite') row.sameSite = v
        else {
          row.other ??= {}
          row.other[e > 0 ? p.slice(0, e).trim() : p] = v
        }
      }
      rows.push(row)
    } else {
      // 普通请求 Cookie 串：整行所有 k=v 全部收集
      for (const p of pairs) {
        const e2 = p.indexOf('=')
        const k = e2 > 0 ? p.slice(0, e2).trim() : p.trim()
        const val = e2 > 0 ? p.slice(e2 + 1).trim() : ''
        if (k) simpleMap[k] = val.replace(/^"|"$/g, '')
      }
    }
  }
  if (setCookieMode) return JSON.stringify(rows.length === 1 ? rows[0] : rows, null, 2)
  return JSON.stringify(simpleMap, null, 2)
}

/** JSON → Cookie 字符串（对象 → 请求头格式；含属性对象 → Set-Cookie 格式） */
export function cookieJsonToHeader(json: string): string {
  const data = JSON.parse(json) as unknown
  const emitSetCookie = (row: Record<string, unknown>): string => {
    const parts = [`${row.name}=${row.value}`]
    if (row.domain) parts.push(`Domain=${row.domain}`)
    if (row.path) parts.push(`Path=${row.path}`)
    if (row.expires) parts.push(`Expires=${row.expires}`)
    if (row.maxAge) parts.push(`Max-Age=${row.maxAge}`)
    if (row.sameSite) parts.push(`SameSite=${row.sameSite}`)
    if (row.secure === true) parts.push('Secure')
    if (row.httpOnly === true) parts.push('HttpOnly')
    const other = row.other as Record<string, string> | undefined
    if (other && typeof other === 'object') for (const [k, v] of Object.entries(other)) parts.push(v ? `${k}=${v}` : k)
    return parts.join('; ')
  }
  if (Array.isArray(data)) return data.map((r) => emitSetCookie(r as Record<string, unknown>)).join('\n')
  const obj = data as Record<string, unknown>
  if (obj && typeof obj === 'object' && ('name' in obj || 'value' in obj) && Object.keys(obj).some((k) => ['domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite', 'maxAge'].includes(k))) {
    return emitSetCookie(obj)
  }
  if (!obj || typeof obj !== 'object') throw new Error('JSON 需要是对象：{ "键": "值", … }')
  return Object.entries(obj).map(([k, v]) => `${k}=${String(v)}`).join('; ')
}

/* =============== MAC 地址 =============== */

export interface MacNormalized {
  /** 纯十六进制小写串（12 或 16 位） */
  hex: string
  /** 字节数：6 = MAC-48，8 = EUI-64 */
  bytes: number
}

/** 规整 MAC 输入（冒号/连字符/点/无分隔均可），失败返回 null */
export function normalizeMac(input: string): MacNormalized | null {
  const hex = input.trim().toLowerCase().replace(/[^0-9a-f]/g, '')
  if (hex.length !== 12 && hex.length !== 16) return null
  return { hex, bytes: hex.length / 2 }
}

/** MAC-48 → EUI-64 展开（中插 FF:FE、翻转 U/L 位）与 IPv6 链路本地地址 */
export function macToEui64(hex12: string): { eui64: string; linkLocal: string } {
  const b = hex12.match(/../g) ?? []
  const first = (parseInt(b[0]!, 16) ^ 0x02).toString(16).padStart(2, '0')
  const eui64 = [first, b[1], b[2], 'ff', 'fe', b[3], b[4], b[5]].join(':').toUpperCase()
  const linkLocal = `fe80::${first}${b[1]}:${b[2]}ff:fe${b[3]}:${b[4]}${b[5]}`
  return { eui64, linkLocal }
}
