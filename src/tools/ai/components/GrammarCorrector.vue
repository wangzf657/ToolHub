<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, X } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { applyFixes, findIssues, type GIssue } from './grammarRules'

const toast = useToast()
const text = ref('我非常非常开心。他在作天来了，跑的很快。th i s is fine！')

const issues = computed<GIssue[]>(() => findIssues(text.value))

// rx5 逐条采纳：默认全选，可逐条忽略
const ignored = ref<Set<number>>(new Set())
const resetIgnored = () => (ignored.value = new Set())
const adopt = (i: number) => {
  const s = new Set(ignored.value)
  s.delete(i)
  ignored.value = s
}
const ignore = (i: number) => {
  ignored.value = new Set(ignored.value).add(i)
}
const adopted = computed(() => issues.value.filter((_, i) => !ignored.value.has(i)))

// rx1 止损：替换按 matchLen 精确切片（从后往前应用避免索引位移）
const fixedText = computed(() => applyFixes(text.value, adopted.value))

// rx2 问题定位：位置 X + 前 6 字【错误串】后 6 字
const contextOf = (it: GIssue) => {
  const src = text.value
  const before = src.slice(Math.max(0, it.index - 6), it.index)
  const after = src.slice(it.index + it.matchLen, it.index + it.matchLen + 6)
  return `${before}【${it.match}】${after}`
}

const applyAll = () => {
  text.value = fixedText.value
  resetIgnored()
  toast.ok(`已应用 ${adopted.value.length} 处修复`)
}

const doCopy = async () => {
  if (await copyText(fixedText.value)) toast.ok('修正稿已复制')
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      <b>重复字词/标点规则清理 · 本地规则（非语法分析）</b>——按内置规则表检查叠字、标点冗余、同音错别字与的地得混用，不联网。
    </div>

    <textarea v-model="text" class="textarea mono mt-2" style="min-height: 130px" placeholder="粘贴要检查的文本…" @input="resetIgnored"></textarea>

    <div class="row mt-2">
      <span class="chip" :class="{ 'chip-bad': issues.length }">发现 {{ issues.length }} 处问题</span>
      <button v-if="issues.length" class="btn btn-primary btn-sm" @click="applyAll">全部采纳</button>
      <button v-if="adopted.length" class="btn btn-ghost btn-sm" @click="doCopy">复制修正稿</button>
    </div>

    <!-- rx5 逐条采纳卡片 -->
    <div v-if="issues.length" class="issue-list mt-2">
      <div v-for="(it, i) in issues" :key="`${it.index}-${i}`" class="issue" :class="{ ignored: ignored.has(i) }">
        <div class="i-head">
          <span class="i-pos">位置 {{ it.index }}：{{ contextOf(it) }}</span>
          <span class="i-msg">{{ it.msg }}</span>
        </div>
        <div class="i-fix">
          <code class="bad">{{ it.match }}</code>
          <span class="arrow">→</span>
          <code class="good">{{ it.suggestion }}</code>
          <span class="i-btns">
            <button class="mini-btn ok" :disabled="!ignored.has(i)" @click="adopt(i)"><Check :size="13" /> 修复</button>
            <button class="mini-btn no" :disabled="ignored.has(i)" @click="ignore(i)"><X :size="13" /> 忽略</button>
          </span>
        </div>
      </div>
    </div>
    <div v-else class="notice notice-ok mt-2">未发现明显问题 ✓</div>

    <ResultBox v-if="issues.length" class="mt-2" :model-value="fixedText" title="修正稿（按已采纳项实时更新）" :min-height="'110px'" />
    <p class="hint mt-1">示例试试：「我非常非常开心。他在作天来了，跑的很快。th i s is fine！」——验证叠词收缩、错别字、的地得与英文 i 大写互不吞字。</p>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.chip-bad { border-color: var(--err); color: var(--err); }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.issue-list { display: grid; gap: 8px; }
.issue { border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; display: grid; gap: 6px; }
.issue.ignored { opacity: 0.55; }
.i-head { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
.i-pos { font-size: 13px; color: var(--text-2); font-family: var(--font-mono); }
.i-msg { font-size: 12.5px; color: var(--warn); }
.i-fix { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
code { font-family: var(--font-mono); font-size: 12.5px; padding: 1px 7px; border-radius: 5px; }
code.bad { background: rgba(248, 113, 113, 0.14); color: var(--err); text-decoration: line-through; }
code.good { background: rgba(52, 211, 153, 0.14); color: var(--ok); }
.arrow { color: var(--text-3); font-size: 13px; }
.i-btns { margin-left: auto; display: flex; gap: 6px; }
.mini-btn { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: none; border-radius: 7px; padding: 3px 9px; font-size: 12px; color: var(--text-2); cursor: pointer; }
.mini-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.mini-btn.ok:not(:disabled):hover { border-color: var(--ok); color: var(--ok); }
.mini-btn.no:not(:disabled):hover { border-color: var(--err); color: var(--err); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
