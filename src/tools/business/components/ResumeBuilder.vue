<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Eye, EyeOff, Plus, Trash2, Printer, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import ResumePreview, { type ResumeDraft } from './ResumePreview.vue'

/**
 * 简历生成器：4 步向导（可回跳）、示例一键填充、要点截断警告、分区显隐、
 * 页数提示、邮箱/电话校验、打印按钮 sticky。草稿结构不变（旧 localStorage 草稿兼容）。
 */
const toast = useToast()

interface Edu { school: string; major: string; degree: string; range: string }
interface Work { company: string; position: string; range: string; points: string }

const draft = ref<ResumeDraft>({
  name: '', phone: '', email: '', city: '', intent: '',
  edu: [{ school: '', major: '', degree: '本科', range: '' }] as Edu[],
  work: [{ company: '', position: '', range: '', points: '' }] as Work[],
  skills: [] as string[], skillInput: '', summary: '',
})
const theme = ref<'blue' | 'green' | 'slate'>('blue')
const THEMES: Record<string, string> = { blue: '#2563eb', green: '#0d9488', slate: '#334155' }

/* ---------- 分区显隐（独立记忆，不改动草稿结构） ---------- */
const HIDDEN_KEY = 'toolhub-resume-hidden'
const hidden = ref<Record<string, boolean>>({ basic: false, work: false, skill: false, summary: false })
watch(hidden, () => {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden.value)) } catch { /* 静默失败 */ }
}, { deep: true })

/* ---------- 分步向导（4 步，可回跳） ---------- */
const step = ref(1)
const STEPS = ['基本信息', '教育经历', '工作经历', '技能与评价']
const gotoStep = (n: number) => (step.value = Math.min(4, Math.max(1, n)))

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

/* ---------- 工作要点截断警告（最多 3 条） ---------- */
const pointLines = (w: Work) => w.points.split(/\n/).filter((s) => s.trim()).length
const overflowWork = (w: Work) => pointLines(w) > 3

/* ---------- 邮箱/电话校验 ---------- */
const emailTouched = ref(false)
const phoneTouched = ref(false)
const emailBad = computed(() => emailTouched.value && draft.value.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.value.email.trim()))
const phoneBad = computed(() => phoneTouched.value && draft.value.phone.trim() !== '' && !/^[+\d][\d\s\-]{5,}$/.test(draft.value.phone.trim()))

/* ---------- 示例一键填充 ---------- */
const fillSample = (kind: 'social' | 'campus') => {
  draft.value = {
    name: '张小明',
    phone: '138-0000-0000',
    email: 'xiaoming@example.com',
    city: '上海',
    intent: kind === 'social' ? '前端开发工程师' : '前端开发工程师（2026 届校招）',
    edu: [
      ...(kind === 'campus' ? [{ school: '华东师范大学', major: '软件工程', degree: '本科', range: '2022-2026' }] : []),
      ...(kind === 'social' ? [{ school: '华东师范大学', major: '软件工程', degree: '本科', range: '2015-2019' }] : []),
    ],
    work: kind === 'social'
      ? [{
          company: '某互联网科技公司',
          position: '高级前端工程师',
          range: '2021-至今',
          points: '负责核心产品 Web 端架构演进，首屏加载时间下降 45%\n搭建组件库与工程化体系，团队交付效率提升 30%\n主导性能专项，LCP 从 4.2s 优化至 1.8s',
        }]
      : [{
          company: '某互联网科技公司',
          position: '前端开发实习生',
          range: '2025-2025',
          points: '参与运营后台开发，完成 10+ 页面与 3 个通用组件\n修复 20+ 线上问题，编写单元测试覆盖核心逻辑',
        }],
    skills: ['Vue 3', 'TypeScript', 'Vite', '性能优化', '工程化'],
    skillInput: '',
    summary: kind === 'social'
      ? '6 年前端经验，深耕 Vue 生态与工程化，主导过大型项目架构演进，注重质量与可维护性。'
      : '2026 届本科毕业生，扎实的前端基础与工程实践，实习期间独立承担模块开发，学习能力强。',
  } as ResumeDraft
  toast.ok(kind === 'social' ? '已填入示例（社招版）' : '已填入示例（校招版）')
}

/* ---------- localStorage 草稿（结构不变，旧草稿可读） ---------- */
const KEY = 'toolhub-resume-draft'
onMounted(() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) draft.value = { ...draft.value, ...(JSON.parse(raw) as Partial<ResumeDraft>) }
    const h = localStorage.getItem(HIDDEN_KEY)
    if (h) hidden.value = { ...hidden.value, ...(JSON.parse(h) as typeof hidden.value) }
  } catch { /* 忽略损坏草稿 */ }
})
watch(draft, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 静默失败 */ }
}, { deep: true })

/* ---------- 页数与打印 ---------- */
const pageCount = ref(1)
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
      <!-- 步骤条 -->
      <div class="steps">
        <button v-for="(s, i) in STEPS" :key="s" class="step-chip" :class="{ on: step === i + 1, done: step > i + 1 }" @click="gotoStep(i + 1)">
          {{ i + 1 }} · {{ s }}
        </button>
      </div>

      <!-- 第 1 步：基本信息（含主题色） -->
      <fieldset v-show="step === 1" class="sec">
        <legend>
          基本信息
          <button class="eye" :title="hidden.basic ? '显示该区' : '隐藏该区（不进预览不进打印）'" @click="hidden.basic = !hidden.basic">
            <EyeOff v-if="!hidden.basic" :size="13" /><Eye v-else :size="13" />
          </button>
        </legend>
        <div class="grid-2">
          <div><label class="field-label">姓名</label><input v-model="draft.name" class="input" placeholder="张三" /></div>
          <div><label class="field-label">城市</label><input v-model="draft.city" class="input" placeholder="如 上海" /></div>
          <div>
            <label class="field-label">电话</label>
            <input v-model="draft.phone" class="input" :class="{ 'input-bad': phoneBad }" placeholder="138xxxxxxxx" @blur="phoneTouched = true" />
            <span v-if="phoneBad" class="warn-text">格式可能有误，请检查</span>
          </div>
          <div>
            <label class="field-label">邮箱</label>
            <input v-model="draft.email" class="input" :class="{ 'input-bad': emailBad }" placeholder="you@example.com" @blur="emailTouched = true" />
            <span v-if="emailBad" class="warn-text">格式可能有误，请检查</span>
          </div>
        </div>
        <div class="mt-1"><label class="field-label">求职意向</label><input v-model="draft.intent" class="input" placeholder="如 前端开发工程师" /></div>
        <div class="mt-2">
          <label class="field-label">主题色</label>
          <div class="row">
            <button v-for="(c, k) in THEMES" :key="k" class="swatch" :class="{ active: theme === k }" :style="{ background: c }" :title="k" :aria-label="k" @click="theme = k as typeof theme"></button>
          </div>
        </div>
      </fieldset>

      <!-- 第 2 步：教育经历 -->
      <fieldset v-show="step === 2" class="sec">
        <legend>教育经历</legend>
        <div v-for="(e, i) in draft.edu" :key="i" class="dyn-row">
          <input v-model="e.school" class="input" placeholder="学校" />
          <input v-model="e.major" class="input" placeholder="专业" />
          <select v-model="e.degree" class="select w-deg"><option>大专</option><option>本科</option><option>硕士</option><option>博士</option></select>
          <input v-model="e.range" class="input w-range" placeholder="2018-2022" />
          <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeAt(draft.edu, i)"><Trash2 :size="14" /></button>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" @click="addEdu"><Plus :size="14" /> 添加教育经历</button>
      </fieldset>

      <!-- 第 3 步：工作经历 -->
      <fieldset v-show="step === 3" class="sec">
        <legend>工作经历</legend>
        <div v-for="(w, i) in draft.work" :key="i" class="work-block">
          <div class="dyn-row">
            <input v-model="w.company" class="input" placeholder="公司" />
            <input v-model="w.position" class="input" placeholder="职位" />
            <input v-model="w.range" class="input w-range" placeholder="2022-至今" />
            <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeAt(draft.work, i)"><Trash2 :size="14" /></button>
          </div>
          <textarea v-model="w.points" class="textarea w-points" rows="3" placeholder="每行一条工作要点（最多 3 条）&#10;负责 XX 模块开发，性能提升 40%"></textarea>
          <span v-if="overflowWork(w)" class="warn-text">最多 3 条，超出部分不会导出（当前 {{ pointLines(w) }} 条）</span>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" @click="addWork"><Plus :size="14" /> 添加工作经历</button>
      </fieldset>

      <!-- 第 4 步：技能与评价 -->
      <fieldset v-show="step === 4" class="sec">
        <legend>
          技能
          <button class="eye" :title="hidden.skill ? '显示该区' : '隐藏该区（不进预览不进打印）'" @click="hidden.skill = !hidden.skill">
            <EyeOff v-if="!hidden.skill" :size="13" /><Eye v-else :size="13" />
          </button>
        </legend>
        <div class="row row-wrap">
          <span v-for="(s, i) in draft.skills" :key="s" class="chip active">
            {{ s }}<X :size="12" class="chip-x" @click="draft.skills.splice(i, 1)" />
          </span>
        </div>
        <input v-model="draft.skillInput" class="input mt-1" placeholder="输入技能后按回车添加，如 Vue" @keydown="onSkillKey" @blur="addSkill" />
      </fieldset>
      <fieldset v-show="step === 4" class="sec">
        <legend>
          自我评价
          <button class="eye" :title="hidden.summary ? '显示该区' : '隐藏该区（不进预览不进打印）'" @click="hidden.summary = !hidden.summary">
            <EyeOff v-if="!hidden.summary" :size="13" /><Eye v-else :size="13" />
          </button>
        </legend>
        <textarea v-model="draft.summary" class="textarea" rows="3" placeholder="3 年前端经验，熟悉 Vue 生态，注重工程质量…"></textarea>
      </fieldset>

      <div class="step-nav mt-2">
        <button class="btn btn-ghost btn-sm" :disabled="step <= 1" @click="gotoStep(step - 1)">上一步</button>
        <button class="btn btn-soft btn-sm" :disabled="step >= 4" @click="gotoStep(step + 1)">下一步</button>
      </div>

      <!-- 打印操作行：sticky 固定在表单列底部 -->
      <div class="rb-actions">
        <button class="btn btn-primary" @click="doPrint"><Printer :size="16" /> 打印 / 另存 PDF</button>
        <span class="hint">打印时自动隐藏表单，只输出简历页</span>
      </div>
      <div class="row row-wrap mt-2">
        <button class="btn btn-ghost btn-sm" @click="fillSample('social')">填入示例（社招版）</button>
        <button class="btn btn-ghost btn-sm" @click="fillSample('campus')">填入示例（校招版）</button>
      </div>
    </div>

    <div class="rb-preview">
      <p v-if="pageCount > 1" class="page-badge">共 {{ pageCount }} 页（建议精简至 1 页）</p>
      <ResumePreview :draft="draft" :hidden="hidden" :theme-color="THEMES[theme]!" @pages="(n: number) => (pageCount = n)" />
    </div>
  </div>
</template>

<style scoped>
.rb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
@media (max-width: 900px) { .rb { grid-template-columns: 1fr; } }
.steps { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.step-chip { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 999px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.step-chip.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
.step-chip.done { color: var(--ok); }
.step-nav { display: flex; gap: 8px; }
.sec { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin: 0 0 12px; }
.sec legend { font-size: 13px; font-weight: 700; color: var(--text-2); padding: 0 6px; display: flex; align-items: center; gap: 6px; }
.eye { border: none; background: none; color: var(--text-3); cursor: pointer; display: grid; place-items: center; padding: 2px; }
.eye:hover { color: var(--text); }
.dyn-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.dyn-row .input { min-width: 0; }
.w-deg { width: 84px; flex: none; }
.w-range { width: 110px; flex: none; }
.w-points { width: 100%; font-size: 13px; }
.work-block { margin-bottom: 10px; }
.warn-text { color: var(--err); font-size: 12px; display: inline-block; margin-top: 2px; }
.input-bad { border-color: var(--err); }
.icon-btn {
  width: 30px; height: 30px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.chip-x { cursor: pointer; margin-left: 4px; }
.swatch { width: 34px; height: 34px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: var(--text); }
/* 打印按钮 sticky：任意滚动位置可触达 */
.rb-actions {
  position: sticky;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
}
.rb-preview { position: sticky; top: 16px; align-self: start; }
.page-badge {
  display: inline-block;
  background: color-mix(in srgb, var(--warn) 16%, transparent);
  color: var(--warn);
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 12.5px;
  margin-bottom: 8px;
}
.hint { font-size: 12px; color: var(--text-3); }
</style>
