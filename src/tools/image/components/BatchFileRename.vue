<script setup lang="ts">
import { computed, ref } from 'vue'
import { FolderOpen, Loader2, Package } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

/**
 * 文件夹批量重命名（UX1.0 五处方）：
 * - 碰撞检测（rx1）：规则产出重名的行标红，「确认并导出」禁用并 toast 说明冲突数（不再静默加序号）。
 * - 序号排序基准（rx2）：选择顺序/名称/修改时间，序号按所选基准编号。
 * - 只看改动项（rx3）：预览头开关，仅显示 newPath≠path 行。
 * - 类型过滤（rx4）：全部｜仅图片｜仅视频，不匹配的行灰显且导出不改名。
 * - 正则查找替换（rx5）：正则开关 + 捕获组 $1 引用。
 * 浏览器安全模型无法改写磁盘原文件，输出为保留相对路径结构的 zip 副本。
 */
const toast = useToast()
const dirInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const rootName = ref('')
const busy = ref(false)

// 规则
const prefix = ref('')
const suffix = ref('')
const seqOn = ref(false)
const seqStart = ref(1)
const seqPad = ref(3)
const seqBase = ref<'order' | 'name' | 'mtime'>('order')
const find = ref('')
const replace = ref('')
const regexOn = ref(false)
const regexErr = ref('')
const newExt = ref('')
const caseMode = ref<'keep' | 'lower' | 'upper'>('keep')
const onlyChanged = ref(false)
const typeFilter = ref<'all' | 'image' | 'video'>('all')

type Cat = 'image' | 'video' | 'other'
const catOf = (f: File): Cat => (f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'other')

interface RenameRow {
  path: string
  name: string
  newPath: string
  file: File
  cat: Cat
  /** 规则产出重名（碰撞） */
  dup?: boolean
}

const pickFolder = (e: Event) => {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files ?? [])
  if (!list.length) return
  files.value = list.filter((f) => (f as File & { webkitRelativePath: string }).webkitRelativePath)
  const first = (files.value[0] as (File & { webkitRelativePath: string }) | undefined)?.webkitRelativePath ?? ''
  rootName.value = first.split('/')[0] || '文件夹'
  toast.ok(`已读取 ${files.value.length} 个文件`)
}

/** 序号基准排序（rx2）：按选择顺序 / 名称 / 修改时间 */
const seqRank = computed(() => {
  const arr = files.value.map((f, i) => ({ f, i }))
  if (seqBase.value === 'name') arr.sort((a, b) => a.f.name.localeCompare(b.f.name, 'zh', { numeric: true }))
  else if (seqBase.value === 'mtime') arr.sort((a, b) => a.f.lastModified - b.f.lastModified)
  const rank = new Array<number>(files.value.length)
  arr.forEach((it, k) => (rank[it.i] = k))
  return rank
})

/** 按规则改写单个文件名（不含目录部分） */
const renameOne = (name: string, index: number): string => {
  const dot = name.lastIndexOf('.')
  let base = dot > 0 ? name.slice(0, dot) : name
  let ext = dot > 0 ? name.slice(dot) : ''
  if (find.value) {
    if (regexOn.value) {
      try {
        base = base.replace(new RegExp(find.value, 'g'), replace.value)
        regexErr.value = ''
      } catch {
        regexErr.value = '正则表达式无效，已按普通文本处理'
        base = base.split(find.value).join(replace.value)
      }
    } else {
      base = base.split(find.value).join(replace.value)
    }
  }
  if (caseMode.value === 'lower') base = base.toLowerCase()
  else if (caseMode.value === 'upper') base = base.toUpperCase()
  const seq = seqOn.value ? String(seqStart.value + index).padStart(Math.max(1, seqPad.value), '0') : ''
  base = `${prefix.value}${seq}${base}${suffix.value}`
  if (newExt.value.trim()) ext = `.${newExt.value.trim().replace(/^\./, '')}`
  return `${base}${ext}`
}

const rows = computed<RenameRow[]>(() =>
  files.value.map((f, i) => {
    const rel = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name
    const idx = rel.lastIndexOf('/')
    const dir = idx >= 0 ? rel.slice(0, idx + 1) : ''
    const name = idx >= 0 ? rel.slice(idx + 1) : rel
    const seqIdx = seqRank.value[i] ?? i
    return { path: rel, name, newPath: `${dir}${renameOne(name, seqIdx)}`, file: f, cat: catOf(f) }
  }),
)

/** rx1 碰撞检测：同 newPath 出现多次 → 全部标红并禁用导出 */
const dupSet = computed(() => {
  const count = new Map<string, number>()
  for (const r of rows.value) count.set(r.newPath, (count.get(r.newPath) ?? 0) + 1)
  return new Set([...count.entries()].filter(([, n]) => n > 1).map(([p]) => p))
})
const dupCount = computed(() => {
  const count = new Map<string, number>()
  for (const r of rows.value) count.set(r.newPath, (count.get(r.newPath) ?? 0) + 1)
  return [...count.values()].filter((n) => n > 1).length
})

const keepName = (r: RenameRow) => typeFilter.value !== 'all' && r.cat !== typeFilter.value
const isChanged = (r: RenameRow) => r.newPath !== r.path && !keepName(r)
const changedCount = computed(() => rows.value.filter(isChanged).length)
const conflictCount = computed(() => dupCount.value)

const visibleRows = computed(() =>
  rows.value.filter((r) => (!onlyChanged.value || isChanged(r)) && (typeFilter.value === 'all' || true)).slice(0, 300),
)

const execute = async () => {
  if (!files.value.length) {
    toast.warn('请先选择文件夹')
    return
  }
  if (conflictCount.value) {
    toast.err(`存在 ${conflictCount.value} 组重名冲突，请调整规则后重试（冲突行已标红）`)
    return
  }
  if (!changedCount.value) {
    toast.warn('规则没有产生任何改名，请检查设置')
    return
  }
  busy.value = true
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const r of rows.value) {
      // 类型过滤命中的行不改名（rx4），其余保留相对路径
      zip.file(isChanged(r) ? r.newPath : r.path, r.file)
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${rootName.value}-重命名.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
    toast.ok(`已生成 ${rows.value.length} 个文件的 zip 副本（改名 ${changedCount.value} 个）`)
  } catch (e) {
    toast.err(`打包失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row mt-1">
      <button class="btn btn-primary" @click="dirInput?.click()"><FolderOpen :size="16" /> 选择文件夹</button>
      <input ref="dirInput" type="file" webkitdirectory multiple class="hidden-input" @change="pickFolder" />
      <span v-if="files.length" class="small muted">已选 {{ rootName }}：{{ files.length }} 个文件（含子文件夹）</span>
    </div>

    <div class="grid-3 mt-2">
      <div><span class="field-label">前缀</span><input v-model="prefix" type="text" class="input" placeholder="如 photo-" /></div>
      <div>
        <span class="field-label">查找 <label class="check-inline"><input v-model="regexOn" type="checkbox" /> 正则</label></span>
        <input v-model="find" type="text" class="input" placeholder="要替换的文字或正则" />
      </div>
      <div><span class="field-label">替换为</span><input v-model="replace" type="text" class="input" placeholder="新文字（正则下支持 $1）" /></div>
      <div><span class="field-label">后缀</span><input v-model="suffix" type="text" class="input" placeholder="加在扩展名前" /></div>
      <div><span class="field-label">扩展名改为</span><input v-model="newExt" type="text" class="input" placeholder="留空保持不变，如 jpg" /></div>
      <div>
        <span class="field-label">大小写</span>
        <select v-model="caseMode" class="select">
          <option value="keep">保持不变</option>
          <option value="lower">全部小写</option>
          <option value="upper">全部大写</option>
        </select>
      </div>
    </div>
    <p v-if="regexErr" class="small" style="color: var(--warn)">{{ regexErr }}</p>

    <div class="row row-wrap mt-2" style="gap: 14px">
      <label class="row" style="gap: 8px; cursor: pointer">
        <input v-model="seqOn" type="checkbox" />
        <span class="small">添加序号</span>
        <template v-if="seqOn">
          <span class="small muted" style="margin-left: 8px">起始</span>
          <input v-model.number="seqStart" type="number" class="input" style="width: 70px" min="0" />
          <span class="small muted">位数</span>
          <input v-model.number="seqPad" type="number" class="input" style="width: 70px" min="1" max="8" />
          <span class="small muted">排序依据</span>
          <select v-model="seqBase" class="select" style="width: 110px">
            <option value="order">选择顺序</option>
            <option value="name">名称</option>
            <option value="mtime">修改时间</option>
          </select>
        </template>
      </label>
      <label class="row" style="gap: 8px">
        <span class="small muted">类型过滤</span>
        <button class="chip" :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">全部</button>
        <button class="chip" :class="{ active: typeFilter === 'image' }" @click="typeFilter = 'image'">仅图片</button>
        <button class="chip" :class="{ active: typeFilter === 'video' }" @click="typeFilter = 'video'">仅视频</button>
      </label>
    </div>

    <div v-if="files.length" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="chip">预览 {{ rows.length }} 项 · 改名 {{ changedCount }} 个</span>
        <span v-if="conflictCount" class="chip chip-warn">{{ conflictCount }} 组重名冲突 · 已禁止导出</span>
        <label class="row" style="gap: 6px; cursor: pointer">
          <input v-model="onlyChanged" type="checkbox" /> <span class="small">只看改动项</span>
        </label>
        <span class="grow"></span>
        <button class="btn btn-primary" :disabled="busy || conflictCount > 0" @click="execute">
          <Loader2 v-if="busy" :size="15" class="spin" /> <Package v-else :size="15" /> 确认并导出 zip
        </button>
      </div>
      <div class="list mt-1">
        <div v-for="r in visibleRows" :key="r.path" class="entry" :class="{ same: r.newPath === r.path || keepName(r), dup: dupSet.has(r.newPath), dimmed: keepName(r) }">
          <span class="old">{{ r.path }}</span>
          <span class="arrow">→</span>
          <span class="new">{{ keepName(r) ? r.path : r.newPath }}</span>
          <span v-if="dupSet.has(r.newPath)" class="conflict-tag">重名冲突</span>
          <span v-else-if="keepName(r)" class="conflict-tag" style="color: var(--text-3)">不改名</span>
        </div>
      </div>
      <p v-if="rows.length > 300" class="small muted mt-1">仅预览前 300 项，导出包含全部 {{ rows.length }} 项。</p>
      <p v-if="conflictCount" class="notice notice-warn mt-1 small">
        存在 {{ conflictCount }} 组重名冲突（规则会让多个文件同名）。请加序号、改前缀或缩小查找范围后重试。
      </p>
    </div>

    <p class="notice notice-warn mt-2 small">
      浏览器无法改写磁盘上的原文件——导出的是保留相对路径结构的 zip 副本，解压后即为改名结果。
      序号可按选择顺序/名称/修改时间编号；类型过滤选「仅图片/仅视频」时其余文件原样保留不改名。
    </p>
  </div>
</template>

<style scoped>
.hidden-input {
  display: none;
}
.check-inline {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
  margin-left: 8px;
}
.grow {
  flex: 1;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
}
.chip.active {
  border-color: var(--accent);
}
.chip-warn {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: #b45309;
}
.conflict-tag {
  flex: none;
  font-size: 11.5px;
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
  padding: 1px 8px;
  border-radius: 999px;
}
.entry.dup .new,
.entry.dup .old {
  color: #b45309;
  font-weight: 600;
}
.entry.dimmed {
  opacity: 0.5;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 360px;
  overflow: auto;
}
.entry {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
  align-items: center;
}
.entry:last-child {
  border-bottom: none;
}
.entry.same {
  color: var(--text-3);
}
.old,
.new {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.old {
  flex: 1;
}
.new {
  flex: 1;
  color: var(--accent-text);
}
.entry.same .new {
  color: var(--text-3);
}
.arrow {
  flex: none;
  color: var(--text-3);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
