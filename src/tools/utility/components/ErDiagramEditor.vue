<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, Link2, Download, Table2 } from 'lucide-vue-next'
import { saveBlob, saveText } from '@/lib/download'
import { toPng } from 'html-to-image'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Field { name: string; type: string }
interface Table { id: number; x: number; y: number; name: string; fields: Field[] }
interface Link { from: number; fIdx: number; to: number; tIdx: number }

const TABLE_TYPES = ['INT', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'DECIMAL(10,2)', 'DATETIME', 'DATE', 'BOOLEAN', 'JSON']

const tables = ref<Table[]>([])
const links = ref<Link[]>([])
const selected = ref<number | null>(null)
const linking = ref<{ t: number; f: number } | null>(null)
const nextId = ref(1)
const drag = ref<{ id: number; dx: number; dy: number } | null>(null)

const canvasRef = ref<HTMLDivElement | null>(null)

const addTable = () => {
  const id = nextId.value++
  tables.value.push({ id, x: 40 + (id % 4) * 220, y: 40 + Math.floor((id - 1) / 4) * 160, name: `table_${id}`, fields: [{ name: 'id', type: 'BIGINT' }, { name: 'name', type: 'VARCHAR(255)' }] })
  selected.value = id
}

const removeTable = (id: number) => {
  // 表 id 由 nextId 单调递增、tableOf 按 id 查找，因此删除时绝不重映射 id/字段索引；
  // 只需同步清理与被删表关联的连线，其余连线保持原字段对位不变（旧行为会把无关连线改连到不存在的表且抹掉 fIdx/tIdx）
  tables.value = tables.value.filter((t) => t.id !== id)
  links.value = links.value.filter((l) => l.from !== id && l.to !== id)
  if (selected.value === id) selected.value = null
}

const addField = (t: Table) => t.fields.push({ name: `field_${t.fields.length + 1}`, type: 'VARCHAR(255)' })

const startLink = (tId: number, fIdx: number) => {
  if (!linking.value) {
    linking.value = { t: tId, f: fIdx }
    toast.ok('已选起点字段，再点另一个表的外键字段完成连线')
    return
  }
  const from = linking.value
  if (from.t === tId) return toast.warn('起止不能是同一张表')
  links.value.push({ from: from.t, fIdx: from.f, to: tId, tIdx: fIdx })
  linking.value = null
}

const tableOf = (id: number) => tables.value.find((t) => t.id === id)

const onDown = (e: PointerEvent, t: Table) => {
  selected.value = t.id
  const r = canvasRef.value!.getBoundingClientRect()
  drag.value = { id: t.id, dx: e.clientX - r.left - t.x, dy: e.clientY - r.top - t.y }
  canvasRef.value?.setPointerCapture(e.pointerId)
}

const onMove = (e: PointerEvent) => {
  if (!drag.value) return
  const r = canvasRef.value!.getBoundingClientRect()
  const t = tableOf(drag.value.id)
  if (!t) return
  t.x = Math.max(0, e.clientX - r.left - drag.value.dx)
  t.y = Math.max(0, e.clientY - r.top - drag.value.dy)
}

const onUp = () => {
  drag.value = null
}

const linkPath = (l: Link): string => {
  const a = tableOf(l.from)
  const b = tableOf(l.to)
  if (!a || !b) return ''
  const ax = a.x + 170
  const ay = a.y + 40 + l.fIdx * 24 + 12
  const bx = b.x
  const by = b.y + 40 + l.tIdx * 24 + 12
  const mx = (ax + bx) / 2
  return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`
}

const exportSql = () => {
  if (!tables.value.length) return toast.warn('请先添加表')
  const out: string[] = ['-- 由 ToolHub ER 图设计器生成（MySQL 方言）', '']
  for (const t of tables.value) {
    out.push(`CREATE TABLE \`${t.name}\` (`)
    t.fields.forEach((f, i) => {
      const pk = f.name === 'id' ? ' PRIMARY KEY AUTO_INCREMENT' : ''
      out.push(`  \`${f.name}\` ${f.type}${i === 0 && f.name === 'id' ? pk : ''},`)
    })
    out.push(`  PRIMARY KEY (\`${t.fields[0]?.name ?? 'id'}\`)`)
    out.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')
    out.push('')
  }
  for (const l of links.value) {
    const a = tableOf(l.from)
    const b = tableOf(l.to)
    if (!a || !b) continue
    out.push(`ALTER TABLE \`${b.name}\` ADD CONSTRAINT \`fk_${b.name}_${b.fields[l.tIdx]?.name}\` FOREIGN KEY (\`${b.fields[l.tIdx]?.name}\`) REFERENCES \`${a.name}\`(\`${a.fields[l.fIdx]?.name}\`);`)
  }
  saveText(out.join('\n'), 'schema.sql')
  toast.ok('已导出 SQL')
}

const exportPng = async () => {
  if (!canvasRef.value) return
  try {
    const url = await toPng(canvasRef.value, { pixelRatio: 2, backgroundColor: '#ffffff' })
    saveBlob(await (await fetch(url)).blob(), 'er-diagram.png')
    toast.ok('已导出 PNG')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <button class="btn btn-primary btn-sm" @click="addTable"><Plus :size="14" /> 新建表</button>
        <span v-if="linking" class="chip warn">连线中：{{ tableOf(linking.t)?.name }}.{{ tableOf(linking.t)?.fields[linking.f]?.name }} → 点目标字段完成（<button class="btnx" @click="linking = null">取消</button>）</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" :disabled="!tables.length" @click="exportSql"><Download :size="14" /> 导出 SQL</button>
        <button class="btn btn-sm" :disabled="!tables.length" @click="exportPng"><Table2 :size="14" /> 导出 PNG</button>
      </div>
      <p class="hint mt-1">拖动表卡片布局；点「链」进入连线模式（先后点两个表的外键字段）；双击字段名可改名。生成 CREATE TABLE + 外键（MySQL）。</p>
    </div>

    <div ref="canvasRef" class="canvas mt-2" @pointermove="onMove" @pointerup="onUp">
      <svg class="links">
        <path v-for="(l, i) in links" :key="i" :d="linkPath(l)" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4" />
      </svg>
      <div
        v-for="t in tables"
        :key="t.id"
        class="t-card"
        :class="{ sel: selected === t.id }"
        :style="{ left: t.x + 'px', top: t.y + 'px' }"
        @pointerdown="onDown($event, t)"
      >
        <div class="t-head">
          <input v-model="t.name" class="t-name" @pointerdown.stop />
          <button class="mini-btn" title="删除表" @pointerdown.stop @click="removeTable(t.id)"><Trash2 :size="13" /></button>
        </div>
        <div v-for="(f, fi) in t.fields" :key="fi" class="f-row">
          <Link2 class="f-link" :class="{ hot: linking?.t === t.id && linking.f === fi }" :size="13" title="从此字段连线" @pointerdown.stop @click="startLink(t.id, fi)" />
          <input v-model="f.name" class="f-name" @pointerdown.stop />
          <select v-model="f.type" class="f-type" @pointerdown.stop>
            <option v-for="ty in TABLE_TYPES" :key="ty" :value="ty">{{ ty }}</option>
          </select>
          <button class="mini-btn" title="删除字段" @pointerdown.stop @click="t.fields.splice(fi, 1)"><Trash2 :size="12" /></button>
        </div>
        <button class="addf" @pointerdown.stop @click="addField(t)">+ 字段</button>
      </div>
      <p v-if="!tables.length" class="empty">点「新建表」开始设计</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.chip.warn { color: var(--warn); font-size: 12px; }
.btnx { border: none; background: none; color: var(--accent-text); cursor: pointer; text-decoration: underline; font-size: 12px; }
.canvas { position: relative; height: 460px; border: 1px solid var(--border); border-radius: 12px; overflow: auto; background: repeating-conic-gradient(var(--surface-2, rgba(127,127,127,.08)) 0% 25%, transparent 0% 50%) 50% / 24px 24px; }
.links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.t-card { position: absolute; width: 200px; background: var(--panel-solid, #fff); border: 2px solid var(--accent); border-radius: 10px; cursor: grab; user-select: none; }
.t-card.sel { box-shadow: 0 6px 20px rgba(99, 102, 241, .3); }
.t-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: var(--accent-soft, rgba(99,102,241,.14)); border-bottom: 1px solid var(--border); }
.t-name { flex: 1; border: none; background: transparent; font-weight: 700; font-size: 13px; width: 110px; }
.f-row { display: flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 12px; }
.f-link { color: var(--muted); cursor: pointer; flex: none; }
.f-link.hot { color: var(--warn); scale: 1.3; }
.f-name { border: 1px dashed transparent; background: transparent; width: 86px; font-size: 12px; }
.f-name:hover { border-color: var(--border); }
.f-type { border: 1px solid var(--border); border-radius: 5px; background: transparent; font-size: 11px; width: 74px; }
.mini-btn { border: none; background: none; color: var(--muted); cursor: pointer; padding: 2px; }
.addf { width: 100%; text-align: center; border: none; border-top: 1px dashed var(--border); background: none; padding: 5px; cursor: pointer; font-size: 12px; color: var(--muted); }
.empty { text-align: center; color: var(--muted); padding-top: 200px; }
</style>
