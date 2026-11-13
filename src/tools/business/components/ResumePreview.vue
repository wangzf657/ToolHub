<script setup lang="ts">
/** 简历预览子组件：A4 纸渲染、分区显隐、页数估算（超 1 页提示）、打印样式 */
import { nextTick, onMounted, ref, watch } from 'vue'

export interface Edu {
  school: string
  major: string
  degree: string
  range: string
}
export interface Work {
  company: string
  position: string
  range: string
  points: string
}
export interface ResumeDraft {
  name: string
  phone: string
  email: string
  city: string
  intent: string
  edu: Edu[]
  work: Work[]
  skills: string[]
  skillInput: string
  summary: string
}

const props = defineProps<{ draft: ResumeDraft; hidden: Record<string, boolean>; themeColor: string }>()
const emit = defineEmits<{ pages: [n: number] }>()

const sheet = ref<HTMLElement | null>(null)
const workPoints = (w: Work) => w.points.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3)

/** 页数估算：按滚动高度 / 视口高度向上取整 */
const estimate = async () => {
  await nextTick()
  const el = sheet.value
  if (!el) return
  const pages = Math.max(1, Math.ceil(el.scrollHeight / Math.max(1, el.clientHeight)))
  emit('pages', pages)
}
onMounted(estimate)
watch(() => [props.draft, props.hidden], estimate, { deep: true })
</script>

<template>
  <div>
    <div ref="sheet" class="sheet" :style="{ '--rv': themeColor }">
      <h1 class="rv-name">{{ draft.name || '你的姓名' }}</h1>
      <p class="rv-contact">{{ [draft.city, draft.phone, draft.email].filter(Boolean).join(' ｜ ') }}</p>
      <p v-if="draft.intent" class="rv-intent">求职意向：{{ draft.intent }}</p>

      <template v-if="!hidden.basic">
        <template v-if="draft.edu.some((e) => e.school)">
          <h2 class="rv-sec">教育经历</h2>
          <div v-for="(e, i) in draft.edu.filter((x) => x.school)" :key="i" class="rv-item">
            <div class="rv-line"><b>{{ e.school }}</b><span>{{ e.range }}</span></div>
            <div class="rv-sub">{{ [e.major, e.degree].filter(Boolean).join(' · ') }}</div>
          </div>
        </template>
      </template>

      <template v-if="!hidden.work && draft.work.some((w) => w.company)">
        <h2 class="rv-sec">工作经历</h2>
        <div v-for="(w, i) in draft.work.filter((x) => x.company)" :key="i" class="rv-item">
          <div class="rv-line"><b>{{ w.company }}</b><span>{{ w.range }}</span></div>
          <div class="rv-sub">{{ w.position }}</div>
          <ul class="rv-ul"><li v-for="(p, j) in workPoints(w)" :key="j">{{ p }}</li></ul>
        </div>
      </template>

      <template v-if="!hidden.skill && draft.skills.length">
        <h2 class="rv-sec">专业技能</h2>
        <p class="rv-skill">{{ draft.skills.join(' · ') }}</p>
      </template>

      <template v-if="!hidden.summary && draft.summary.trim()">
        <h2 class="rv-sec">自我评价</h2>
        <p class="rv-sum">{{ draft.summary }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 简历预览（A4 比例） ---------- */
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
</style>
