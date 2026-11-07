<script setup lang="ts">
import { computed, ref } from 'vue'
import { extractEntities, type Entity } from '@/lib/nlpEngine'

const text = ref(`2026年3月12日，张伟在上海交通大学做了题为《大模型落地实践》的分享。
他目前担任深度智创公司的 CTO，联系邮箱是 zhangwei@deepzc.cn，电话 13812345678。
公司去年营收达到 1.2 亿元，同比增长 35%，官网 https://www.deepzc.cn 有详细介绍。`)

const result = computed<Entity[]>(() => extractEntities(text.value))

/** 去重叠：按 start 排序后跳过与前一个实体重叠的项 */
const cleanEntities = computed<Entity[]>(() => {
  const out: Entity[] = []
  let end = -1
  for (const e of result.value) {
    if (e.start >= end) {
      out.push(e)
      end = e.start + e.text.length
    }
  }
  return out
})

const TYPES = ['人名', '地名', '机构', '时间', '金额', '邮箱', '电话', '网址', '百分比'] as const
const typeIdx = (t: string) => Math.max(0, TYPES.indexOf(t as (typeof TYPES)[number]))

/* ---------- 过滤 Tab ---------- */
const presentTypes = computed(() => TYPES.filter((t) => cleanEntities.value.some((e) => e.type === t)))
const activeType = ref<string>('全部')
const filtered = computed(() =>
  activeType.value === '全部' ? cleanEntities.value : cleanEntities.value.filter((e) => e.type === activeType.value),
)

/* ---------- 高亮 ---------- */
const activeId = ref(-1)
const toggle = (i: number) => (activeId.value = activeId.value === i ? -1 : i)

/* ---------- 原文标注渲染（先转义再拼接） ---------- */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const markedHtml = computed(() => {
  const src = text.value
  let html = ''
  let pos = 0
  for (let i = 0; i < cleanEntities.value.length; i++) {
    const e = cleanEntities.value[i]
    html += esc(src.slice(pos, e.start))
    const cls = `ent t${typeIdx(e.type)}${activeId.value === i ? ' active' : ''}`
    html += `<span class="${cls}" data-eid="${i}">${esc(e.text)}</span>`
    pos = e.start + e.text.length
  }
  html += esc(src.slice(pos))
  return html
})

const stats = computed(() => {
  const m = new Map<string, number>()
  for (const e of cleanEntities.value) m.set(e.type, (m.get(e.type) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})
</script>

<template>
  <div>
    <div class="notice notice-info">本地规则 + 词典引擎，识别人名、机构、时间、金额、联系方式等实体，全部即时完成。</div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 120px" placeholder="粘贴包含人名、机构、金额、日期等信息的文本…"></textarea>

    <div v-if="cleanEntities.length" class="grid mt-2">
      <!-- 左：原文标注 -->
      <div class="pane">
        <h4 class="sec-title">原文标注（点击右侧列表可联动高亮）</h4>
        <div class="article" v-html="markedHtml"></div>
      </div>

      <!-- 右：实体列表 -->
      <div class="pane">
        <h4 class="sec-title">实体列表（{{ cleanEntities.length }} 个）</h4>
        <div class="row row-wrap mb-1">
          <button class="chip" :class="{ active: activeType === '全部' }" @click="activeType = '全部'">全部 {{ cleanEntities.length }}</button>
          <button v-for="t in presentTypes" :key="t" class="chip" :class="{ active: activeType === t }" @click="activeType = t">
            {{ t }} {{ cleanEntities.filter((e) => e.type === t).length }}
          </button>
        </div>
        <div class="ent-list">
          <button
            v-for="(e, i) in filtered"
            :key="`${e.start}-${i}`"
            class="ent-item"
            :class="{ active: activeId === cleanEntities.indexOf(e) }"
            @click="toggle(cleanEntities.indexOf(e))"
          >
            <span class="ent-tag" :class="`bt${typeIdx(e.type)}`">{{ e.type }}</span>
            <span class="ent-text">{{ e.text }}</span>
            <span class="ent-pos">@{{ e.start }}</span>
          </button>
        </div>

        <h4 class="sec-title mt-2">统计</h4>
        <div class="row row-wrap">
          <span v-for="[t, n] in stats" :key="t" class="chip">{{ t }}：{{ n }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="text.trim()" class="notice notice-warn mt-2">未识别到实体，试试包含姓名、公司、金额或日期的句子。</div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 16px;
}
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}
.pane {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  min-width: 0;
}
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.article {
  font-size: 14px;
  line-height: 2;
  word-break: break-all;
  white-space: pre-wrap;
}
.ent { border-radius: 4px; padding: 1px 3px; border-bottom: 2px solid; cursor: pointer; }
.ent.active { outline: 2px solid var(--accent); }
/* 各类型配色（下划线 + 底色） */
.t0 { color: #2563eb; border-color: #2563eb; background: rgba(37, 99, 235, 0.08); }
.t1 { color: #059669; border-color: #059669; background: rgba(5, 150, 105, 0.08); }
.t2 { color: #7c3aed; border-color: #7c3aed; background: rgba(124, 58, 237, 0.08); }
.t3 { color: #d97706; border-color: #d97706; background: rgba(217, 119, 6, 0.08); }
.t4 { color: #b45309; border-color: #b45309; background: rgba(180, 83, 9, 0.08); }
.t5 { color: #0891b2; border-color: #0891b2; background: rgba(8, 145, 178, 0.08); }
.t6 { color: #db2777; border-color: #db2777; background: rgba(219, 39, 119, 0.08); }
.t7 { color: #4f46e5; border-color: #4f46e5; background: rgba(79, 70, 229, 0.08); }
.t8 { color: #dc2626; border-color: #dc2626; background: rgba(220, 38, 38, 0.08); }
.ent-list {
  display: grid;
  gap: 6px;
  max-height: 320px;
  overflow: auto;
}
.ent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  color: var(--text);
}
.ent-item:hover { border-color: var(--accent); }
.ent-item.active { border-color: var(--accent); background: var(--accent-soft); }
.ent-tag {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 8px;
  color: #fff;
}
.bt0 { background: #2563eb; } .bt1 { background: #059669; } .bt2 { background: #7c3aed; }
.bt3 { background: #d97706; } .bt4 { background: #b45309; } .bt5 { background: #0891b2; }
.bt6 { background: #db2777; } .bt7 { background: #4f46e5; } .bt8 { background: #dc2626; }
.ent-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ent-pos { flex: none; font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }
.mb-1 { margin-bottom: 8px; }
</style>
