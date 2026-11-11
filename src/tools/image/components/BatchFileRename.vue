<script setup lang="ts">
import { computed, ref } from 'vue'
import { FolderOpen, Loader2, Package } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

/**
 * 文件夹批量重命名：webkitdirectory 选择文件夹 → 规则改写文件名 → 预览表 → 打 zip 副本下载。
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
const find = ref('')
const replace = ref('')
const newExt = ref('')
const caseMode = ref<'keep' | 'lower' | 'upper'>('keep')

interface RenameRow {
  path: string
  name: string
  newPath: string
  newName: string
  file: File
  /** true = 规则产出重名，已自动追加序号后缀 */
  conflict?: boolean
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

/** 按规则改写单个文件名（不含目录部分） */
const renameOne = (name: string, index: number): string => {
  const dot = name.lastIndexOf('.')
  let base = dot > 0 ? name.slice(0, dot) : name
  let ext = dot > 0 ? name.slice(dot) : '' // 含点
  // 查找替换（作用于主名）
  if (find.value) base = base.split(find.value).join(replace.value)
  // 大小写
  if (caseMode.value === 'lower') base = base.toLowerCase()
  else if (caseMode.value === 'upper') base = base.toUpperCase()
  // 序号 + 前缀 + 后缀
  const seq = seqOn.value ? String(seqStart.value + index).padStart(Math.max(1, seqPad.value), '0') : ''
  base = `${prefix.value}${seq}${base}${suffix.value}`
  // 扩展名改写
  if (newExt.value.trim()) ext = `.${newExt.value.trim().replace(/^\./, '')}`
  return `${base}${ext}`
}

const rows = computed<RenameRow[]>(() =>
  files.value.map((f, i) => {
    const rel = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name
    const idx = rel.lastIndexOf('/')
    const dir = idx >= 0 ? rel.slice(0, idx + 1) : ''
    const name = idx >= 0 ? rel.slice(idx + 1) : rel
    return { path: rel, name, newPath: `${dir}${renameOne(name, i)}`, newName: renameOne(name, i), file: f }
  }),
)

/** 在主名与扩展名之间插入序号后缀：name.jpg → name(2).jpg（目录部分保留） */
const withSeqSuffix = (path: string, k: number): string => {
  const slash = path.lastIndexOf('/')
  const dir = slash >= 0 ? path.slice(0, slash + 1) : ''
  const name = slash >= 0 ? path.slice(slash + 1) : path
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  return `${dir}${base}(${k})${ext}`
}

/**
 * 重名消解：zip 内同名条目会静默互相覆盖，规则产出撞名时自动追加 (2)、(3)… 序号后缀。
 * 未改名行先占住原路径（不让改名结果抢占），改名行逐个撞名消解；消解结果在预览与导出中保持一致。
 */
const finalRows = computed<RenameRow[]>(() => {
  const used = new Set<string>()
  for (const r of rows.value) if (r.newPath === r.path) used.add(r.path)
  return rows.value.map((r) => {
    if (r.newPath === r.path) return { ...r, conflict: false }
    let p = r.newPath
    let k = 2
    while (used.has(p)) p = withSeqSuffix(r.newPath, k++)
    used.add(p)
    if (p === r.newPath) return { ...r, conflict: false }
    const slash = p.lastIndexOf('/')
    return { ...r, newPath: p, newName: slash >= 0 ? p.slice(slash + 1) : p, conflict: true }
  })
})

const conflictCount = computed(() => finalRows.value.filter((r) => r.conflict).length)
const changedCount = computed(() => finalRows.value.filter((r) => r.newPath !== r.path).length)

const execute = async () => {
  if (!files.value.length) {
    toast.warn('请先选择文件夹')
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
    for (const r of finalRows.value) {
      // 保留相对路径（含子文件夹）；使用消解后的路径，避免 zip 内同名条目静默覆盖
      zip.file(r.newPath, r.file)
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
    toast.ok(
      `已生成 ${finalRows.value.length} 个文件的 zip 副本（改名 ${changedCount.value} 个${
        conflictCount.value ? `，重名自动加序号 ${conflictCount.value} 个` : ''
      }）`,
    )
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
      <div><span class="field-label">查找</span><input v-model="find" type="text" class="input" placeholder="要替换的文字" /></div>
      <div><span class="field-label">替换为</span><input v-model="replace" type="text" class="input" placeholder="新文字（可留空）" /></div>
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

    <label class="row mt-2" style="gap: 8px; cursor: pointer">
      <input v-model="seqOn" type="checkbox" />
      <span class="small">添加序号</span>
      <template v-if="seqOn">
        <span class="small muted" style="margin-left: 8px">起始</span>
        <input v-model.number="seqStart" type="number" class="input" style="width: 70px" min="0" />
        <span class="small muted">位数</span>
        <input v-model.number="seqPad" type="number" class="input" style="width: 70px" min="1" max="8" />
      </template>
    </label>

    <div v-if="files.length" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="chip">预览 {{ finalRows.length }} 项 · 改名 {{ changedCount }} 个</span>
        <span v-if="conflictCount" class="chip chip-warn">重名自动加序号 {{ conflictCount }} 个</span>
        <span class="grow"></span>
        <button class="btn btn-primary" :disabled="busy" @click="execute">
          <Loader2 v-if="busy" :size="15" class="spin" /> <Package v-else :size="15" /> 确认并导出 zip
        </button>
      </div>
      <div class="list mt-1">
        <div
          v-for="r in finalRows.slice(0, 300)"
          :key="r.path"
          class="entry"
          :class="{ same: r.newPath === r.path, conflict: r.conflict }"
        >
          <span class="old">{{ r.path }}</span>
          <span class="arrow">→</span>
          <span class="new">{{ r.newPath }}</span>
          <span v-if="r.conflict" class="conflict-tag" title="规则产出重名，已自动追加序号后缀">重名已加序号</span>
        </div>
      </div>
      <p v-if="finalRows.length > 300" class="small muted mt-1">仅预览前 300 项，导出包含全部 {{ finalRows.length }} 项。</p>
    </div>

    <p class="notice notice-warn mt-2 small">
      浏览器无法改写磁盘上的原文件——导出的是保留相对路径结构的 zip 副本，解压后即为改名结果。
      序号按选择时的文件顺序编号；空文件夹不会保留。规则产生重名时会自动追加序号后缀（预览中有标注），不会互相覆盖。
    </p>
  </div>
</template>

<style scoped>
.hidden-input {
  display: none;
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
.entry.conflict .new {
  color: #b45309;
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
