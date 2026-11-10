<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, FolderOpen, Loader2 } from 'lucide-vue-next'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 文件夹内容清单：webkitdirectory 选择文件夹 → 文件树/平铺清单（相对路径、大小、类型、修改时间）
 * → 统计（文件数/总大小/最大 5 个文件）→ 导出 CSV / Excel。
 */
interface FileRow {
  path: string
  name: string
  dir: string
  size: number
  ext: string
  mtime: string
}

const toast = useToast()
const dirInput = ref<HTMLInputElement | null>(null)
const rows = ref<FileRow[]>([])
const rootName = ref('')
const view = ref<'flat' | 'tree'>('flat')
const busy = ref(false)
const exporting = ref(false)

const pickFolder = (e: Event) => {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files ?? [])
  if (!list.length) return
  rows.value = list.map((f) => {
    const rel = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name
    const idx = rel.lastIndexOf('/')
    const dot = rel.lastIndexOf('.')
    return {
      path: rel,
      name: idx >= 0 ? rel.slice(idx + 1) : rel,
      dir: idx >= 0 ? rel.slice(0, idx) : '',
      size: f.size,
      ext: dot > 0 ? rel.slice(dot + 1).toLowerCase() : '',
      mtime: f.lastModified ? new Date(f.lastModified).toLocaleString('zh-CN') : '—',
    }
  })
  const first = rows.value[0]?.path ?? ''
  rootName.value = first.split('/')[0] || '文件夹'
  toast.ok(`已读取 ${rows.value.length} 个文件`)
}

const fmtSize = (n: number) => {
  if (n >= 1048576 * 1024) return `${(n / 1073741824).toFixed(2)} GB`
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

const totalSize = computed(() => rows.value.reduce((s, r) => s + r.size, 0))
const dirCount = computed(() => new Set(rows.value.map((r) => r.dir).filter(Boolean)).size)
const top5 = computed(() => [...rows.value].sort((a, b) => b.size - a.size).slice(0, 5))

/** 树形：按目录分组渲染（两级目录树，深层目录以路径展示） */
interface TreeNode {
  dir: string
  files: FileRow[]
}
const tree = computed<TreeNode[]>(() => {
  const groups = new Map<string, FileRow[]>()
  for (const r of rows.value) {
    const arr = groups.get(r.dir) ?? []
    arr.push(r)
    groups.set(r.dir, arr)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dir, files]) => ({ dir, files: [...files].sort((a, b) => a.name.localeCompare(b.name)) }))
})

const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`

const exportCsv = () => {
  if (!rows.value.length) return
  const header = ['相对路径', '文件名', '大小(字节)', '大小(可读)', '类型', '修改时间']
  const lines = [header.map(csvEscape).join(',')]
  for (const r of rows.value) {
    lines.push([csvEscape(r.path), csvEscape(r.name), String(r.size), csvEscape(fmtSize(r.size)), csvEscape(r.ext || '—'), csvEscape(r.mtime)].join(','))
  }
  saveText('\ufeff' + lines.join('\n'), `${rootName.value}-清单.csv`, 'text/csv;charset=utf-8')
  toast.ok('CSV 已导出（UTF-8 BOM，Excel 直接可读）')
}

const exportXlsx = async () => {
  if (!rows.value.length) return
  exporting.value = true
  try {
    const header = ['相对路径', '文件名', '大小(字节)', '大小(可读)', '类型', '修改时间']
    const body = rows.value.map((r) => [r.path, r.name, r.size, fmtSize(r.size), r.ext || '—', r.mtime])
    const blob = await rowsToXlsx(header, body as (string | number)[][], '文件清单')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${rootName.value}-清单.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
    toast.ok('Excel 已导出')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <div class="row mt-1">
      <button class="btn btn-primary" @click="dirInput?.click()"><FolderOpen :size="16" /> 选择文件夹</button>
      <input ref="dirInput" type="file" webkitdirectory multiple class="hidden-input" @change="pickFolder" />
      <span v-if="rows.length" class="small muted">已选 {{ rootName }}</span>
    </div>

    <div v-if="rows.length" class="mt-2">
      <div class="stats">
        <div class="stat"><span class="k">文件数</span><span class="v">{{ rows.length }}</span></div>
        <div class="stat"><span class="k">子文件夹</span><span class="v">{{ dirCount }}</span></div>
        <div class="stat"><span class="k">总大小</span><span class="v accent">{{ fmtSize(totalSize) }}</span></div>
      </div>

      <div class="row row-wrap mt-2" style="gap: 10px">
        <span class="field-label">视图</span>
        <select v-model="view" class="select" style="max-width: 120px">
          <option value="flat">平铺清单</option>
          <option value="tree">按目录分组</option>
        </select>
        <span class="grow"></span>
        <button class="btn btn-sm" :disabled="exporting" @click="exportCsv"><Download :size="14" /> 导出 CSV</button>
        <button class="btn btn-sm" :disabled="exporting" @click="exportXlsx"><Loader2 v-if="exporting" :size="14" class="spin" /><Download v-else :size="14" /> 导出 Excel</button>
      </div>

      <div v-if="view === 'flat'" class="list mt-1">
        <div v-for="r in rows.slice(0, 500)" :key="r.path" class="entry">
          <span class="path" :title="r.path">{{ r.path }}</span>
          <span class="ext">{{ r.ext || '—' }}</span>
          <span class="size">{{ fmtSize(r.size) }}</span>
        </div>
      </div>

      <div v-else class="list mt-1">
        <template v-for="g in tree" :key="g.dir">
          <div class="dir-row">📁 {{ g.dir || rootName }}<span class="muted small" style="margin-left: 6px">（{{ g.files.length }} 个文件）</span></div>
          <div v-for="r in g.files" :key="r.path" class="entry indent">
            <span class="path" :title="r.name">{{ r.name }}</span>
            <span class="ext">{{ r.ext || '—' }}</span>
            <span class="size">{{ fmtSize(r.size) }}</span>
            <span class="size muted">{{ r.mtime }}</span>
          </div>
        </template>
      </div>
      <p v-if="rows.length > 500 && view === 'flat'" class="small muted mt-1">仅显示前 500 行，导出包含全部 {{ rows.length }} 项。</p>

      <div class="mt-2">
        <p class="small muted">最大的 5 个文件</p>
        <div class="list mt-1">
          <div v-for="r in top5" :key="r.path" class="entry">
            <span class="path" :title="r.path">{{ r.path }}</span>
            <span class="size">{{ fmtSize(r.size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      只读取文件名与元信息，不读取文件内容；清单按 webkitdirectory 选择时的相对路径展示，
      CSV 带 UTF-8 BOM，Excel 打开不乱码。
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
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 16px;
  font-weight: 700;
}
.v.accent {
  color: var(--accent-text);
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 400px;
  overflow: auto;
}
.entry {
  display: flex;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
  align-items: center;
}
.entry:last-child {
  border-bottom: none;
}
.entry.indent {
  padding-left: 26px;
}
.dir-row {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  background: var(--bg-soft, rgba(127, 127, 127, 0.08));
  position: sticky;
  top: 0;
}
.path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext {
  flex: none;
  width: 52px;
  color: var(--text-3);
  font-size: 11.5px;
}
.size {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
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
