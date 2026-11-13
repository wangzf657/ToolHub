<script setup lang="ts">
import { computed, ref } from 'vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { planReplacements, type Repl } from './paraphraserCore'

const toast = useToast()

const text = ref('现在很多工具都需要联网使用，但是 ToolHub 可以帮助你在本地快速处理文件，使用起来非常简单，获得的结果也很安全。Good tools make work fast.')
const strength = ref<'0.25' | '0.5' | '1'>('0.5')

// 纯逻辑在 ./paraphraserCore（可测性提取，与测试同源）
const replacements = computed<Repl[]>(() => planReplacements(text.value, Number(strength.value)))

/** 选中某条替换的候选 */
const chosen = ref<Record<number, number>>({})
const onStrengthOrText = () => (chosen.value = {})

/** 渲染分段：原文 + 已替换片段（高亮可点击；pick = -1 表示保留原词） */
const segments = computed(() => {
  const src = text.value
  const segs: { text: string; replIdx: number }[] = []
  let cursor = 0
  replacements.value.forEach((r, i) => {
    const pick = chosen.value[i] ?? r.current
    if (r.start > cursor) segs.push({ text: src.slice(cursor, r.start), replIdx: -1 })
    if (pick >= 0) segs.push({ text: r.candidates[pick] ?? r.from, replIdx: i })
    else segs.push({ text: src.slice(r.start, r.end), replIdx: i })
    cursor = r.end
  })
  if (cursor < src.length) segs.push({ text: src.slice(cursor), replIdx: -1 })
  return segs
})

const output = computed(() => segments.value.map((s) => s.text).join(''))
const pickCandidate = (replIdx: number, candIdx: number) => (chosen.value = { ...chosen.value, [replIdx]: candIdx })
const activePop = ref<number>(-1)
const togglePop = (i: number) => (activePop.value = activePop.value === i ? -1 : i)

const doCopy = async () => {
  if (await copyText(output.value)) toast.ok('改写结果已复制')
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      <b>同义词词典替换（本地规则，非生成式改写）</b>——只做词级同义轮换，不重组句式；高亮片段可点击切换候选词。
    </div>

    <textarea v-model="text" class="textarea mono mt-2" style="min-height: 130px" placeholder="粘贴要改写的句子或段落…" @input="onStrengthOrText"></textarea>

    <div class="row row-wrap mt-2">
      <span class="opt-label">改写幅度：</span>
      <button class="chip" :class="{ active: strength === '0.25' }" @click="strength = '0.25'; onStrengthOrText()">轻微</button>
      <button class="chip" :class="{ active: strength === '0.5' }" @click="strength = '0.5'; onStrengthOrText()">适中</button>
      <button class="chip" :class="{ active: strength === '1' }" @click="strength = '1'; onStrengthOrText()">大幅</button>
      <button class="btn btn-ghost btn-sm" @click="doCopy">复制结果</button>
    </div>

    <!-- rx3 替换计数行 -->
    <div class="count-row mt-2">共替换 <b>{{ replacements.length }}</b> 处（幅度：{{ strength === '0.25' ? '轻微' : strength === '0.5' ? '适中' : '大幅' }}）</div>

    <!-- rx1 diff 高亮渲染 -->
    <div class="rich mt-1">
      <template v-for="(s, i) in segments" :key="i">
        <mark
          v-if="s.replIdx >= 0"
          class="repl"
          :class="{ active: activePop === s.replIdx }"
          :title="`原词：${replacements[s.replIdx]?.from}（点击切换候选）`"
          @click="togglePop(s.replIdx)"
        >{{ s.text }}</mark>
        <span v-else>{{ s.text }}</span>
      </template>
    </div>

    <!-- rx5 多候选切换 -->
    <div v-if="activePop >= 0 && replacements[activePop]" class="pop mt-1">
      <span class="pop-from">「{{ replacements[activePop].from }}」的候选：</span>
      <button
        v-for="(c, ci) in replacements[activePop].candidates"
        :key="c"
        class="chip"
        :class="{ active: (chosen[activePop] ?? replacements[activePop].current) === ci }"
        @click="pickCandidate(activePop, ci)"
      >{{ c }}</button>
      <button class="chip" @click="pickCandidate(activePop, -1)">保留原词</button>
    </div>

    <ResultBox class="mt-2" :model-value="output" title="改写结果（纯文本）" :min-height="'110px'" />
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.opt-label { font-size: 13px; color: var(--text-3); }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.count-row { font-size: 13px; color: var(--text-2); }
.rich { line-height: 1.9; font-size: 14.5px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); min-height: 60px; word-break: break-word; }
.repl { background: rgba(251, 191, 36, 0.4); border-radius: 3px; padding: 0 3px; cursor: pointer; color: inherit; }
.repl.active { outline: 2px solid var(--accent); }
.repl:hover { background: rgba(251, 191, 36, 0.6); }
.pop { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 8px 12px; border: 1px dashed var(--accent); border-radius: 10px; }
.pop-from { font-size: 13px; color: var(--text-2); }
</style>
