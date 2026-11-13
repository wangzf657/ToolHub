<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, FileDown, ShieldCheck, ExternalLink } from 'lucide-vue-next'
import { extractEntities, type Entity } from '@/lib/nlpEngine'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref(`2026年3月12日，张伟在上海交通大学做了题为《大模型落地实践》的分享。
他目前担任深度智创公司的 CTO，联系邮箱是 zhangwei@deepzc.cn，电话 13812345678。
公司去年营收达到 1.2 亿元，同比增长 35%，官网 https://www.deepzc.cn 有详细介绍。
公司与杭州分部同事合作推进新项目，办公地点位于杭州市西湖区文三路。`)

/* ---------------- rx2 人名召回放宽：前置放宽为行首/标点/空格/连接字，支持 2~4 字名 ---------------- */
const SURNAMES2 = new Set(['欧阳', '司马', '诸葛', '上官', '东方', '皇甫', '慕容', '司徒'])
const SURNAMES = new Set('李王张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split(''))
const GIVEN_BAD = /[们说的在是和与对为要会能去来看听做用有个中上下这那很就到]/
const TITLES = ['教授', '老师', '博士', '先生', '女士', '经理', '医生', '律师', '院长', '校长', '总监', '主任']
/** 名字后允许衔接的谓语/连接词（启发式边界） */
const TRAIL_WORDS = ['指导', '合作', '带领', '参加', '负责', '介绍', '告诉', '访问', '出席', '主持', '完成', '提出', '发现', '带来', '表示', '认为', '来到', '说', '讲', '谈', '来', '去', '做', '写', '看', '读', '在', '是', '了', '的', '和', '与', '或', '让', '由', '都', '也', '还', '很']
const trailOk = (after: string) => !after || /[，。！？、；：（）""''…\s]/.test(after[0]) || TRAIL_WORDS.some((w) => after.startsWith(w))

function detectPersons(src: string): Entity[] {
  const out: Entity[] = []
  for (let i = 0; i < src.length - 1; i++) {
    const prev = i > 0 ? src[i - 1] : '\n'
    if (!(i === 0 || /[，。！？、；：（）""''…\s]/.test(prev) || '的和与或让由他她它被把就都很也还从在为对着'.includes(prev))) continue
    let name = ''
    let nextIdx = -1
    const tryName = (surnameLen: number) => {
      const rest = src.slice(i + surnameLen)
      const t = TITLES.find((tt) => rest.startsWith(tt))
      if (t) return { name: src.slice(i, i + surnameLen + t.length), next: i + surnameLen + t.length }
      for (const len of [2, 1]) {
        const cand = rest.slice(0, len)
        if (cand.length === len && /^[\u4e00-\u9fff]{1,2}$/.test(cand) && !GIVEN_BAD.test(cand) && trailOk(rest.slice(len))) {
          return { name: src.slice(i, i + surnameLen + len), next: i + surnameLen + len }
        }
      }
      return null
    }
    if (SURNAMES2.has(src.slice(i, i + 2))) {
      const r = tryName(2)
      if (r) ({ name, next: nextIdx } = r)
    } else if (SURNAMES.has(src[i])) {
      const r = tryName(1)
      if (r) ({ name, next: nextIdx } = r)
    }
    if (name) {
      out.push({ type: '人名', text: name, start: i })
      i = nextIdx - 1
    }
  }
  return out
}

/* ---------------- rx1 地名补齐：省市词典 + 后缀规则 ---------------- */
const PROVINCES = '北京 上海 天津 重庆 河北 山西 辽宁 吉林 黑龙江 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 海南 四川 贵州 云南 陕西 甘肃 青海 台湾 内蒙古 广西 西藏 宁夏 新疆 香港 澳门'.split(' ')
const CITIES = '广州 深圳 珠海 佛山 东莞 中山 南京 苏州 无锡 常州 杭州 宁波 温州 绍兴 嘉兴 合肥 济南 青岛 郑州 武汉 长沙 成都 西安 昆明 贵阳 沈阳 大连 哈尔滨 石家庄 太原 南昌 福州 厦门 兰州 西宁 银川 乌鲁木齐 拉萨 南宁 海口 呼和浩特'.split(' ')
/** 常见非地名的「X道/X市/X区」组合排除 */
const PLACE_GUARD = new Set(['知道', '通道', '频道', '一道', '味道', '门道', '渠道', '河道', '报道', '城市', '都市', '上市', '地区', '社区', '山区', '城区', '郊区', '分区'])

function detectPlaces(src: string, occupied: [number, number][]): Entity[] {
  const out: Entity[] = []
  const taken = (s: number, e: number) => occupied.some(([a, b]) => s < b && e > a)
  const dict = [...PROVINCES, ...CITIES].sort((a, b) => b.length - a.length)
  for (const d of dict) {
    let pos = src.indexOf(d)
    while (pos >= 0) {
      if (!taken(pos, pos + d.length)) out.push({ type: '地名', text: d, start: pos })
      pos = src.indexOf(d, pos + d.length)
    }
  }
  for (const re of [/[\u4e00-\u9fff]{1,6}?(?:省|市|县|区|镇|乡|村)/g, /[\u4e00-\u9fff]{1,8}?(?:路|街|道|巷)/g]) {
    for (const m of src.matchAll(new RegExp(re.source, 'g'))) {
      if (PLACE_GUARD.has(m[0])) continue
      if (!taken(m.index, m.index + m[0].length)) out.push({ type: '地名', text: m[0], start: m.index })
    }
  }
  return out.sort((a, b) => a.start - b.start || b.text.length - a.text.length)
}

const base = computed<Entity[]>(() => extractEntities(text.value))
const persons = computed<Entity[]>(() => {
  const occ: [number, number][] = base.value.map((e) => [e.start, e.start + e.text.length])
  return detectPersons(text.value).filter((p) => !occ.some(([a, b]) => p.start < b && p.start + p.text.length > a))
})
const places = computed<Entity[]>(() => {
  const occ: [number, number][] = [...base.value, ...persons.value].map((e) => [e.start, e.start + e.text.length])
  return detectPlaces(text.value, occ)
})

/** 合并 + 去重叠：同起点取最长 */
const result = computed<Entity[]>(() =>
  [...base.value, ...persons.value, ...places.value].sort((a, b) => a.start - b.start || b.text.length - a.text.length),
)

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

const presentTypes = computed(() => TYPES.filter((t) => cleanEntities.value.some((e) => e.type === t)))
const activeType = ref<string>('全部')
const filtered = computed(() =>
  activeType.value === '全部' ? cleanEntities.value : cleanEntities.value.filter((e) => e.type === activeType.value),
)

const activeId = ref(-1)
const toggle = (i: number) => (activeId.value = activeId.value === i ? -1 : i)

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

// rx4 复制全部 / 下载 CSV（类型,文本,位置）
const copyAll = async () => {
  const t = cleanEntities.value.map((e) => `${e.type}\t${e.text}\t${e.start}`).join('\n')
  if (await copyText(t)) toast.ok(`已复制 ${cleanEntities.value.length} 条实体`)
  else toast.err('复制失败')
}
const downloadCsv = () => {
  const rows = ['类型,文本,位置', ...cleanEntities.value.map((e) => `${e.type},"${e.text.replace(/"/g, '""')}",${e.start}`)]
  saveText('\ufeff' + rows.join('\n'), '实体清单.csv', 'text/csv;charset=utf-8')
  toast.ok('CSV 已开始下载')
}
// rx5 脱敏联动：携带原文跳转隐私脱敏工具
const scrubLink = `/t/pii-scrubber?text=${encodeURIComponent(text.value.slice(0, 20000))}`
</script>

<template>
  <div>
    <div class="notice notice-info">
      本地规则 + 词典引擎，识别人名、地名、机构、时间、金额、联系方式等实体，全部即时完成。
      边界说明：地名与人名基于词典与规则，生僻人名可能漏检、部分普通词可能误报，仅供参考。
    </div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 120px" placeholder="粘贴包含人名、机构、金额、日期等信息的文本…"></textarea>

    <div v-if="cleanEntities.length" class="grid mt-2">
      <div class="pane">
        <h4 class="sec-title">原文标注（点击右侧列表可联动高亮）</h4>
        <div class="article" v-html="markedHtml"></div>
      </div>

      <div class="pane">
        <div class="row">
          <h4 class="sec-title">实体列表（{{ cleanEntities.length }} 个）</h4>
          <span class="export-btns">
            <button class="mini-btn" @click="copyAll"><Copy :size="13" /> 复制全部</button>
            <button class="mini-btn" @click="downloadCsv"><FileDown :size="13" /> 下载 CSV</button>
          </span>
        </div>
        <div class="row row-wrap mb-1">
          <button class="chip" :class="{ active: activeType === '全部' }" @click="activeType = '全部'">全部 {{ cleanEntities.length }}</button>
          <button v-for="t in presentTypes" :key="t" class="chip" :class="{ active: activeType === t }" @click="activeType = t">
            {{ t }} {{ cleanEntities.filter((e) => e.type === t).length }}
          </button>
        </div>
        <div class="ent-list">
          <div
            v-for="(e, i) in filtered"
            :key="`${e.start}-${i}`"
            class="ent-row"
            :class="{ active: activeId === cleanEntities.indexOf(e) }"
          >
            <button class="ent-item" @click="toggle(cleanEntities.indexOf(e))">
              <span class="ent-tag" :class="`bt${typeIdx(e.type)}`">{{ e.type }}</span>
              <span class="ent-text">{{ e.text }}</span>
              <span class="ent-pos">@{{ e.start }}</span>
            </button>
            <a
              v-if="['邮箱', '电话', '网址'].includes(e.type)"
              class="mini-btn scrub"
              :href="scrubLink"
              title="携带原文跳转到隐私信息脱敏"
            ><ShieldCheck :size="13" /> 去脱敏</a>
          </div>
        </div>

        <h4 class="sec-title mt-2">统计</h4>
        <div class="row row-wrap">
          <span v-for="[t, n] in stats" :key="t" class="chip">{{ t }}：{{ n }}</span>
        </div>
        <a class="mini-link mt-1" :href="scrubLink"><ExternalLink :size="13" /> 把以上原文送去隐私信息脱敏 →</a>
      </div>
    </div>
    <div v-else-if="text.trim()" class="notice notice-warn mt-2">未识别到实体，试试包含姓名、公司、金额或日期的句子。</div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.pane { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; min-width: 0; }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.row-wrap { flex-wrap: wrap; }
.export-btns { margin-left: auto; display: flex; gap: 6px; }
.mini-btn { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: none; border-radius: 7px; padding: 3px 9px; font-size: 12px; color: var(--text-2); cursor: pointer; text-decoration: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--text-1); }
.scrub { flex: none; }
.article { font-size: 14px; line-height: 2; word-break: break-all; white-space: pre-wrap; }
.ent { border-radius: 4px; padding: 1px 3px; border-bottom: 2px solid; cursor: pointer; }
.ent.active { outline: 2px solid var(--accent); }
.t0 { color: #2563eb; border-color: #2563eb; background: rgba(37, 99, 235, 0.08); }
.t1 { color: #059669; border-color: #059669; background: rgba(5, 150, 105, 0.08); }
.t2 { color: #7c3aed; border-color: #7c3aed; background: rgba(124, 58, 237, 0.08); }
.t3 { color: #d97706; border-color: #d97706; background: rgba(217, 119, 6, 0.08); }
.t4 { color: #b45309; border-color: #b45309; background: rgba(180, 83, 9, 0.08); }
.t5 { color: #0891b2; border-color: #0891b2; background: rgba(8, 145, 178, 0.08); }
.t6 { color: #db2777; border-color: #db2777; background: rgba(219, 39, 119, 0.08); }
.t7 { color: #4f46e5; border-color: #4f46e5; background: rgba(79, 70, 229, 0.08); }
.t8 { color: #dc2626; border-color: #dc2626; background: rgba(220, 38, 38, 0.08); }
.ent-list { display: grid; gap: 6px; max-height: 320px; overflow: auto; }
.ent-row { display: flex; align-items: center; gap: 6px; }
.ent-row.active .ent-item { border-color: var(--accent); background: var(--accent-soft); }
.ent-item { flex: 1; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 8px; background: none; padding: 6px 10px; cursor: pointer; font-size: 13px; text-align: left; color: var(--text-1); }
.ent-item:hover { border-color: var(--accent); }
.ent-tag { flex: none; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 8px; color: #fff; }
.bt0 { background: #2563eb; } .bt1 { background: #059669; } .bt2 { background: #7c3aed; }
.bt3 { background: #d97706; } .bt4 { background: #b45309; } .bt5 { background: #0891b2; }
.bt6 { background: #db2777; } .bt7 { background: #4f46e5; } .bt8 { background: #dc2626; }
.ent-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ent-pos { flex: none; font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }
.mini-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--accent); }
.mini-link:hover { text-decoration: underline; }
.mb-1 { margin-bottom: 8px; }
</style>
