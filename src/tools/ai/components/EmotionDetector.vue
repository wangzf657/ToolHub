<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('今天居然中奖了！天哪，太开心了哈哈。不过想到明天要加班，又有点焦虑…')

/** 本地情绪词典（喜悦/爱两表已去重：「喜欢」只保留在喜悦，修复双计点亮问题） */
const EMO_LEX: { emo: string; color: string; words: string[] }[] = [
  { emo: '喜悦', color: '#f59e0b', words: ['开心', '高兴', '快乐', '兴奋', '太好了', '哈哈', '太棒', '喜欢', '幸福', '满意', '惊喜', '笑'] },
  { emo: '悲伤', color: '#60a5fa', words: ['难过', '伤心', '哭', '遗憾', '失望', '低落', '痛苦', '想他', '想她', '怀念', '唉'] },
  { emo: '愤怒', color: '#ef4444', words: ['气死', '生气', '愤怒', '恶心', '烦', '滚', '无耻', '可恶', '忍无可忍', '离谱', '坑'] },
  { emo: '恐惧', color: '#8b5cf6', words: ['害怕', '担心', '恐惧', '紧张', '焦虑', '慌', '怕', '不安', '压力大'] },
  { emo: '爱', color: '#f472b6', words: ['爱', '想你', '爱你', '宝贝', '亲爱', '心动', '浪漫', '在一起'] },
  { emo: '惊讶', color: '#34d399', words: ['竟然', '居然', '卧槽', '天哪', '不会吧', '震惊', '没想到', '意外', '哇'] },
]

const result = computed(() => {
  const t = text.value
  const hits = EMO_LEX.map((e) => ({ ...e, count: e.words.reduce((n, w) => n + t.split(w).length - 1, 0) }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
  return { emotions: hits, dominant: hits[0]?.emo ?? null }
})
const maxCount = computed(() => Math.max(1, ...result.value.emotions.map((e) => e.count)))
const totalHits = computed(() => result.value.emotions.reduce((n, e) => n + e.count, 0))

/** 每个情绪实际命中的词（去重，按出现次数排序） */
const hitWords = computed(() =>
  result.value.emotions.map((e) => ({
    emo: e.emo,
    color: e.color,
    words: (EMO_LEX.find((x) => x.emo === e.emo)?.words ?? [])
      .filter((w) => text.value.includes(w))
      .sort((a, b) => text.value.split(b).length - text.value.split(a).length),
  })),
)

// rx4 复制结果（情绪：次数/占比，仅非零行）
const copied = ref(false)
const copyResult = async () => {
  const lines = result.value.emotions.map((e) => `${e.emo}：${e.count} 次（${Math.round((e.count / totalHits.value) * 100)}%）`)
  if (!lines.length) {
    toast.warn('还没有可复制的结果')
    return
  }
  if (await copyText(lines.join('\n'))) {
    copied.value = true
    toast.ok('结果已复制')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const EMOJI: Record<string, string> = { 喜悦: '😄', 悲伤: '😢', 愤怒: '😠', 恐惧: '😨', 爱: '🥰', 惊讶: '😮' }
</script>

<template>
  <div>
    <div class="notice notice-info">本地情绪词典即时识别六类情绪：喜悦、悲伤、愤怒、恐惧、爱、惊讶。文本不会上传。</div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 120px" placeholder="粘贴一段聊天记录、评论或日记…"></textarea>

    <template v-if="result.emotions.length">
      <div class="dominant mt-2" :style="{ borderColor: result.emotions[0].color }">
        <span class="d-emoji">{{ EMOJI[result.dominant ?? ''] ?? '🙂' }}</span>
        <div>
          <div class="d-label">主导情绪</div>
          <strong class="d-word" :style="{ color: result.emotions[0].color }">{{ result.dominant }}</strong>
        </div>
        <span class="d-count">命中 {{ totalHits }} 词次</span>
        <button class="copy-btn" @click="copyResult">
          <Check v-if="copied" :size="14" color="#34d399" />
          <Copy v-else :size="14" /> 复制结果
        </button>
      </div>

      <div class="bars mt-2">
        <div v-for="e in result.emotions" :key="e.emo" class="bar-row">
          <span class="bar-name" :style="{ color: e.color }">{{ e.emo }}</span>
          <span class="bar-track">
            <span class="bar-fill" :style="{ width: `${(e.count / maxCount) * 100}%`, background: e.color }"></span>
          </span>
          <span class="bar-num">{{ e.count }}（{{ Math.round((e.count / totalHits) * 100) }}%）</span>
        </div>
      </div>

      <div class="hits mt-2">
        <div v-for="h in hitWords" :key="h.emo" class="hit-group">
          <span class="hit-title" :style="{ color: h.color }">{{ h.emo }}：</span>
          <span v-for="w in h.words" :key="w" class="chip" :style="{ borderColor: h.color + '66', color: h.color }">{{ w }}</span>
        </div>
      </div>
    </template>
    <div v-else-if="text.trim()" class="notice notice-warn mt-2">没有命中情绪词。六类词典以中文口语表达为主，试试带情绪的句子。</div>
  </div>
</template>

<style scoped>
.dominant {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1.5px solid;
  border-radius: 14px;
  padding: 14px 18px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.d-emoji { font-size: 38px; line-height: 1; }
.d-label { font-size: 12px; color: var(--text-3); }
.d-word { font-size: 30px; line-height: 1.2; }
.d-count { margin-left: auto; font-size: 12.5px; color: var(--text-3); }
.copy-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border);
  background: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12.5px;
  color: var(--text-2);
  cursor: pointer;
}
.copy-btn:hover { border-color: var(--accent); color: var(--text-1); }
.bars { display: grid; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-name { flex: none; width: 44px; font-size: 13.5px; font-weight: 600; text-align: right; }
.bar-track { flex: 1; height: 12px; border-radius: 999px; background: var(--border); overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.25s ease; }
.bar-num { flex: none; width: 84px; font-size: 12.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.hits { display: grid; gap: 8px; }
.hit-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.hit-title { font-size: 13px; font-weight: 600; }
</style>
