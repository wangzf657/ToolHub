<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2, Trophy } from 'lucide-vue-next'
import { similarity } from '@/lib/nlpEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('这个手机用了一周就发烫严重，客服还一直拖，真是不推荐买。')

interface LabelItem {
  label: string
  example: string
}

const labels = ref<LabelItem[]>([
  { label: '好评', example: '' },
  { label: '差评', example: '' },
  { label: '咨询', example: '' },
  { label: '吐槽', example: '' },
])

const addLabel = () => {
  if (labels.value.length >= 10) {
    toast.warn('最多支持 10 个标签')
    return
  }
  labels.value.push({ label: '', example: '' })
}

/** 内置同义扩展词：为常见标签自动补充，提高区分度 */
const AUTO: Record<string, string> = {
  好评: '好 满意 喜欢 赞 不错 推荐 划算 超预期',
  差评: '差 失望 不满 后悔 难用 不推荐 别买',
  咨询: '请问 想知道 咨询 询问 多少 怎么 如何',
  吐槽: '无语 离谱 服了 吐槽 难受 没办法',
  投诉: '投诉 维权 退款 客服 投诉无门',
  建议: '建议 希望 改进 可以加 期待',
  正面: '好 优秀 满意 推荐 出色',
  负面: '差 垃圾 失望 难用 坑',
  新闻: '报道 发布 官方 宣布 近日',
  情感: '喜欢 心动 想念 在一起',
}
const expandOf = (l: string) => AUTO[l.trim()] ?? ''

interface Scored {
  label: string
  score: number
}

const scored = computed<Scored[]>(() => {
  const t = text.value.trim()
  if (!t) return []
  return labels.value
    .filter((l) => l.label.trim())
    .map((l) => {
      const probe = [l.label.trim(), expandOf(l.label), l.example.trim()].filter(Boolean).join(' ')
      return { label: l.label.trim(), score: similarity(t, probe) }
    })
    .sort((a, b) => b.score - a.score)
})

const maxScore = computed(() => Math.max(0.0001, ...scored.value.map((s) => s.score)))
const totalScore = computed(() => scored.value.reduce((s, x) => s + x.score, 0))
/** 把相似度归一化为「归属置信度」分布 */
const confidence = (s: number) => (totalScore.value > 0 ? (s / totalScore.value) * 100 : 0)
</script>

<template>
  <div>
    <div class="notice notice-info">
      本地相似度算法（零样本）：给出一组自定义标签，引擎计算文本与每个标签（含同义扩展词与示例句）的匹配度并排序。
    </div>

    <div class="mt-2">
      <label class="field-label">待分类文本</label>
      <textarea v-model="text" class="textarea" style="min-height: 100px" placeholder="粘贴一条评论、留言或短文…"></textarea>
    </div>

    <div class="mt-2">
      <label class="field-label">标签集合（可加示例句提升区分度）</label>
      <div v-for="(l, i) in labels" :key="i" class="label-row">
        <input v-model="l.label" class="input w-label" placeholder="标签，如 好评" />
        <input v-model="l.example" class="input grow" placeholder="示例句（可选），如 物流很快非常满意" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="labels.splice(i, 1)"><Trash2 :size="14" /></button>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addLabel"><Plus :size="14" /> 添加标签</button>
    </div>

    <template v-if="scored.length">
      <div class="mt-2">
        <h4 class="sec-title">分类结果</h4>
        <div class="result-top">
          <span class="trophy"><Trophy :size="16" /></span>
          最可能属于：<b class="top-label">{{ scored[0].label }}</b>
          <span class="conf">归一化置信度 {{ confidence(scored[0].score).toFixed(1) }}%</span>
        </div>
        <div v-for="s in scored" :key="s.label" class="score-row">
          <span class="s-label">{{ s.label }}</span>
          <span class="s-track">
            <span class="s-fill" :style="{ width: `${(s.score / maxScore) * 100}%` }"></span>
          </span>
          <span class="s-num">{{ confidence(s.score).toFixed(1) }}%</span>
        </div>
      </div>
      <p class="hint mt-1">
        计算口径：文本与「标签 + 同义扩展词 + 示例句」的词汇余弦相似度，再在标签间归一化。内置扩展词覆盖
        好评 / 差评 / 咨询 / 吐槽 / 投诉 / 建议 等常见标签，其他标签建议填写示例句。
      </p>
    </template>
    <div v-else class="notice notice-warn mt-2">请填写待分类文本，并至少保留一个非空标签。</div>
  </div>
</template>

<style scoped>
.label-row { display: flex; gap: 8px; margin-bottom: 8px; }
.w-label { width: 160px; flex: none; }
.icon-btn {
  width: 30px; height: 30px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.result-top {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  margin-bottom: 12px;
}
.trophy { color: #f59e0b; display: grid; place-items: center; }
.top-label { font-size: 17px; color: var(--accent-text); }
.conf { margin-left: auto; font-size: 12px; color: var(--text-3); }
.score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.s-label { flex: none; width: 130px; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; color: var(--text-2); }
.s-track { flex: 1; height: 16px; border-radius: 999px; background: var(--border); overflow: hidden; }
.s-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), #34d399);
  transition: width 0.25s ease;
}
.s-num { flex: none; width: 52px; font-size: 12.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
