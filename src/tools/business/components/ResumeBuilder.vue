<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Plus, Trash2, Printer, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Edu { school: string; major: string; degree: string; range: string }
interface Work { company: string; position: string; range: string; points: string }

const draft = ref({
  name: '', phone: '', email: '', city: '', intent: '',
  edu: [{ school: '', major: '', degree: '本科', range: '' }] as Edu[],
  work: [{ company: '', position: '', range: '', points: '' }] as Work[],
  skills: [] as string[], skillInput: '', summary: '',
})
const theme = ref<'blue' | 'green' | 'slate'>('blue')

const THEMES: Record<string, string> = { blue: '#2563eb', green: '#0d9488', slate: '#334155' }

const addEdu = () => draft.value.edu.push({ school: '', major: '', degree: '本科', range: '' })
const addWork = () => draft.value.work.push({ company: '', position: '', range: '', points: '' })
const removeAt = (arr: Edu[] | Work[], i: number) => arr.splice(i, 1)

/* ---------- 技能标签 ---------- */
const addSkill = () => {
  const s = draft.value.skillInput.trim().replace(/[,，]$/, '')
  if (s && !draft.value.skills.includes(s) && draft.value.skills.length < 20) draft.value.skills.push(s)
  draft.value.skillInput = ''
}
const onSkillKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    addSkill()
  }
}

/* ---------- 预览数据 ---------- */
const workPoints = (w: Work) => w.points.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3)

/* ---------- localStorage 草稿 ---------- */
const KEY = 'toolhub-resume-draft'
onMounted(() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) draft.value = { ...draft.value, ...(JSON.parse(raw) as typeof draft.value) }
  } catch { /* 忽略损坏草稿 */ }
})
watch(draft, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 静默失败 */ }
}, { deep: true })

/* ---------- 打印（只打印简历区域） ---------- */
const doPrint = () => {
  if (!draft.value.name.trim()) {
    toast.warn('请先填写姓名，再打印或另存 PDF')
    return
  }
  const done = () => document.body.classList.remove('print-resume')
  document.body.classList.add('print-resume')
  window.addEventListener('afterprint', done, { once: true })
  window.print()
  setTimeout(done, 4000) // 兜底：部分浏览器不触发 afterprint
}
</script>

<template>
  <div class="rb">
    <div class="rb-form">
      <fieldset class="sec">
        <legend>基本信息</legend>
        <div class="grid-2">
          <div><label class="field-label">姓名</label><input v-model="draft.name" class="input" placeholder="张三" /></div>
          <div><label class="field-label">城市</label><input v-model="draft.city" class="input" placeholder="如 上海" /></div>
          <div><label class="field-label">电话</label><input v-model="draft.phone" class="input" placeholder="138xxxxxxxx" /></div>
          <div><label class="field-label">邮箱</label><input v-model="draft.email" class="input" placeholder="you@example.com" /></div>
        </div>
        <div class="mt-1"><label class="field-label">求职意向</label><input v-model="draft.intent" class="input" placeholder="如 前端开发工程师" /></div>
      </fieldset>

      <fieldset class="sec">
        <legend>教育经历</legend>
        <div v-for="(e, i) in draft.edu" :key="i" class="dyn-row">
          <input v-model="e.school" class="input" placeholder="学校" />
          <input v-model="e.major" class="input" placeholder="专业" />
          <select v-model="e.degree" class="select w-deg"><option>大专</option><option>本科</option><option>硕士</option><option>博士</option></select>
          <input v-model="e.range" class="input w-range" placeholder="2018-2022" />
          <button class="icon-btn danger" title="删除" @click="removeAt(draft.edu, i)"><Trash2 :size="14" /></button>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" @click="addEdu"><Plus :size="14" /> 添加教育经历</button>
      </fieldset>

      <fieldset class="sec">
        <legend>工作经历</legend>
        <div v-for="(w, i) in draft.work" :key="i" class="work-block">
          <div class="dyn-row">
            <input v-model="w.company" class="input" placeholder="公司" />
            <input v-model="w.position" class="input" placeholder="职位" />
            <input v-model="w.range" class="input w-range" placeholder="2022-至今" />
            <button class="icon-btn danger" title="删除" @click="removeAt(draft.work, i)"><Trash2 :size="14" /></button>
          </div>
          <textarea v-model="w.points" class="textarea w-points" rows="3" placeholder="每行一条工作要点（最多 3 条）&#10;负责 XX 模块开发，性能提升 40%"></textarea>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" @click="addWork"><Plus :size="14" /> 添加工作经历</button>
      </fieldset>

      <fieldset class="sec">
        <legend>技能</legend>
        <div class="row row-wrap">
          <span v-for="(s, i) in draft.skills" :key="s" class="chip active">
            {{ s }}<X :size="12" class="chip-x" @click="draft.skills.splice(i, 1)" />
          </span>
        </div>
        <input v-model="draft.skillInput" class="input mt-1" placeholder="输入技能后按回车添加，如 Vue" @keydown="onSkillKey" @blur="addSkill" />
      </fieldset>

      <fieldset class="sec">
        <legend>自我评价</legend>
        <textarea v-model="draft.summary" class="textarea" rows="3" placeholder="3 年前端经验，熟悉 Vue 生态，注重工程质量…"></textarea>
      </fieldset>

      <fieldset class="sec">
        <legend>主题色</legend>
        <div class="row">
          <button v-for="(c, k) in THEMES" :key="k" class="swatch" :class="{ active: theme === k }" :style="{ background: c }" :title="k" @click="theme = k as typeof theme"></button>
        </div>
      </fieldset>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="doPrint"><Printer :size="16" /> 打印 / 另存 PDF</button>
        <span class="hint">打印时自动隐藏表单，只输出简历页</span>
      </div>
    </div>

    <div class="rb-preview">
      <div class="sheet" :style="{ '--rv': THEMES[theme] }">
        <h1 class="rv-name">{{ draft.name || '你的姓名' }}</h1>
        <p class="rv-contact">{{ [draft.city, draft.phone, draft.email].filter(Boolean).join(' ｜ ') }}</p>
        <p v-if="draft.intent" class="rv-intent">求职意向：{{ draft.intent }}</p>

        <template v-if="draft.edu.some((e) => e.school)">
          <h2 class="rv-sec">教育经历</h2>
          <div v-for="(e, i) in draft.edu.filter((x) => x.school)" :key="i" class="rv-item">
            <div class="rv-line"><b>{{ e.school }}</b><span>{{ e.range }}</span></div>
            <div class="rv-sub">{{ [e.major, e.degree].filter(Boolean).join(' · ') }}</div>
          </div>
        </template>

        <template v-if="draft.work.some((w) => w.company)">
          <h2 class="rv-sec">工作经历</h2>
          <div v-for="(w, i) in draft.work.filter((x) => x.company)" :key="i" class="rv-item">
            <div class="rv-line"><b>{{ w.company }}</b><span>{{ w.range }}</span></div>
            <div class="rv-sub">{{ w.position }}</div>
            <ul class="rv-ul"><li v-for="(p, j) in workPoints(w)" :key="j">{{ p }}</li></ul>
          </div>
        </template>

        <template v-if="draft.skills.length">
          <h2 class="rv-sec">专业技能</h2>
          <p class="rv-skill">{{ draft.skills.join(' · ') }}</p>
        </template>

        <template v-if="draft.summary.trim()">
          <h2 class="rv-sec">自我评价</h2>
          <p class="rv-sum">{{ draft.summary }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
@media (max-width: 900px) { .rb { grid-template-columns: 1fr; } }
.sec { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin: 0 0 12px; }
.sec legend { font-size: 13px; font-weight: 700; color: var(--text-2); padding: 0 6px; }
.dyn-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.dyn-row .input { min-width: 0; }
.w-deg { width: 84px; flex: none; }
.w-range { width: 110px; flex: none; }
.w-points { width: 100%; font-size: 13px; }
.work-block { margin-bottom: 10px; }
.icon-btn {
  width: 30px; height: 30px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.chip-x { cursor: pointer; margin-left: 4px; }
.swatch { width: 34px; height: 34px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: var(--text); }

/* ---------- 简历预览（A4 比例） ---------- */
.rb-preview { position: sticky; top: 16px; align-self: start; }
.sheet {
  aspect-ratio: 210 / 297;
  overflow: auto;
  background: #ffffff;
  color: #1f2937;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  padding: 9% 8%;
  font-size: 12.5px;
  line-height: 1.55;
}
.rv-name { margin: 0; font-size: 26px; color: var(--rv); letter-spacing: 1px; }
.rv-contact { margin: 6px 0 0; color: #6b7280; font-size: 12px; }
.rv-intent { margin: 4px 0 0; font-weight: 600; color: #374151; }
.rv-sec {
  margin: 14px 0 6px; font-size: 14px; color: var(--rv);
  border-bottom: 2px solid var(--rv); padding-bottom: 3px; letter-spacing: 2px;
}
.rv-item { margin-bottom: 8px; }
.rv-line { display: flex; justify-content: space-between; gap: 8px; }
.rv-line span { color: #6b7280; font-size: 11.5px; flex: none; }
.rv-sub { color: #4b5563; font-size: 12px; margin-top: 1px; }
.rv-ul { margin: 4px 0 0; padding-left: 1.2em; }
.rv-ul li { color: #374151; font-size: 12px; }
.rv-skill { margin: 0; color: #374151; }
.rv-sum { margin: 0; color: #374151; text-indent: 2em; }

/* ---------- 打印：只输出简历区域 ---------- */
@media print {
  :global(body.print-resume *) { visibility: hidden !important; }
  :global(body.print-resume .sheet),
  :global(body.print-resume .sheet *) { visibility: visible !important; }
  :global(body.print-resume .sheet) {
    position: absolute; left: 0; top: 0; width: 100%;
    aspect-ratio: auto; box-shadow: none; border-radius: 0; padding: 0;
    overflow: visible;
  }
}
.hint { font-size: 12px; color: var(--text-3); }
</style>
