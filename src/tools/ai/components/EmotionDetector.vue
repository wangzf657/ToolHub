<script setup lang="ts">
import { computed, ref } from 'vue'
import { detectEmotion } from '@/lib/nlpEngine'

const text = ref('今天居然中奖了！天哪，太开心了哈哈。不过想到明天要加班，又有点焦虑…')

const result = computed(() => detectEmotion(text.value))
const maxCount = computed(() => Math.max(1, ...result.value.emotions.map((e) => e.count)))

/** 与引擎词库一致的展示用词表：用于列出每个情绪命中的具体词 */
const EMO_WORDS: Record<string, string[]> = {
  喜悦: ['开心', '高兴', '快乐', '兴奋', '太好了', '哈哈', '太棒', '喜欢', '幸福', '满意', '惊喜', '笑'],
  悲伤: ['难过', '伤心', '哭', '遗憾', '失望', '低落', '痛苦', '想他', '想她', '怀念', '唉'],
  愤怒: ['气死', '生气', '愤怒', '恶心', '烦', '滚', '无耻', '可恶', '忍无可忍', '离谱', '坑'],
  恐惧: ['害怕', '担心', '恐惧', '紧张', '焦虑', '慌', '怕', '不安', '压力大'],
  爱: ['爱', '想你', '爱你', '宝贝', '亲爱', '喜欢', '心动', '浪漫', '在一起'],
  惊讶: ['竟然', '居然', '卧槽', '天哪', '不会吧', '震惊', '没想到', '意外', '哇'],
}

/** 每个情绪实际命中的词（去重，按出现次数排序） */
const hitWords = computed(() =>
  result.value.emotions.map((e) => ({
    emo: e.emo,
    color: e.color,
    words: (EMO_WORDS[e.emo] ?? [])
      .filter((w) => text.value.includes(w))
      .sort((a, b) => text.value.split(b).length - text.value.split(a).length),
  })),
)

const EMOJI: Record<string, string> = { 喜悦: '😄', 悲伤: '😢', 愤怒: '😠', 恐惧: '😨', 爱: '🥰', 惊讶: '😮' }
</script>

<template>
  <div>
    <div class="notice notice-info">本地情绪词典即时识别六类情绪：喜悦、悲伤、愤怒、恐惧、爱、惊讶。文本不会上传。</div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 120px" placeholder="粘贴一段聊天记录、评论或日记…"></textarea>

    <template v-if="result.emotions.length">
      <!-- 主导情绪 -->
      <div class="dominant mt-2" :style="{ borderColor: result.emotions[0].color }">
        <span class="d-emoji">{{ EMOJI[result.dominant ?? ''] ?? '🙂' }}</span>
        <div>
          <div class="d-label">主导情绪</div>
          <strong class="d-word" :style="{ color: result.emotions[0].color }">{{ result.dominant }}</strong>
        </div>
        <span class="d-count">命中 {{ result.emotions[0].count }} 次</span>
      </div>

      <!-- 六情绪彩条（仅显示有命中的） -->
      <div class="bars mt-2">
        <div v-for="e in result.emotions" :key="e.emo" class="bar-row">
          <span class="bar-name" :style="{ color: e.color }">{{ e.emo }}</span>
          <span class="bar-track">
            <span class="bar-fill" :style="{ width: `${(e.count / maxCount) * 100}%`, background: e.color }"></span>
          </span>
          <span class="bar-num">{{ e.count }}</span>
        </div>
      </div>

      <!-- 命中词列表 -->
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
.bars { display: grid; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-name { flex: none; width: 44px; font-size: 13.5px; font-weight: 600; text-align: right; }
.bar-track {
  flex: 1;
  height: 12px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.bar-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.25s ease; }
.bar-num { flex: none; width: 26px; font-size: 12.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.hits { display: grid; gap: 8px; }
.hit-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.hit-title { font-size: 13px; font-weight: 600; }
</style>
