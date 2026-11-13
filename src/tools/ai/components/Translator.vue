<script setup lang="ts">
import { computed, ref } from 'vue'
import { Languages } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'

const text = ref('你好，我的朋友。今天工作顺利吗？谢谢！')
const from = ref('auto')
const target = ref('en')

/** 本地词库（与 nlpEngine.translateBasic 同源数据；结构化以便逐语种统计与最大匹配） */
const DICT: Record<string, Partial<Record<'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru', string>>> = {
  你好: { en: 'hello', ja: 'こんにちは', ko: '안녕하세요', fr: 'bonjour', de: 'hallo', es: 'hola', ru: 'привет' },
  谢谢: { en: 'thank you', ja: 'ありがとう', ko: '감사합니다', fr: 'merci', de: 'danke', es: 'gracias', ru: 'спасибо' },
  再见: { en: 'goodbye', ja: 'さようなら', ko: '안녕히 가세요', fr: 'au revoir', de: 'auf wiedersehen', es: 'adiós', ru: 'до свидания' },
  我: { en: 'I', ja: '私', ko: '나', fr: 'je', de: 'ich', es: 'yo', ru: 'я' },
  你: { en: 'you', ja: 'あなた', ko: '너', fr: 'tu', de: 'du', es: 'tú', ru: 'ты' },
  爱: { en: 'love', ja: '愛', ko: '사랑', fr: 'amour', de: 'Liebe', es: 'amor', ru: 'любовь' },
  时间: { en: 'time', ja: '時間', ko: '시간', fr: 'temps', de: 'Zeit', es: 'tiempo', ru: 'время' },
  工作: { en: 'work', ja: '仕事', ko: '일', fr: 'travail', de: 'Arbeit', es: 'trabajo', ru: 'работа' },
  朋友: { en: 'friend', ja: '友達', ko: '친구', fr: 'ami', de: 'Freund', es: 'amigo', ru: 'друг' },
  水: { en: 'water', ja: '水', ko: '물', fr: 'eau', de: 'Wasser', es: 'agua', ru: 'вода' },
  好: { en: 'good', ja: '良い', ko: '좋다', fr: 'bon', de: 'gut', es: 'bueno', ru: 'хорошо' },
  是: { en: 'yes', ja: 'はい', ko: '네', fr: 'oui', de: 'ja', es: 'sí', ru: 'да' },
  不是: { en: 'no', ja: 'いいえ', ko: '아니요', fr: 'non', de: 'nein', es: 'no', ru: 'нет' },
  网站: { en: 'website', ja: 'ウェブサイト' },
  文件: { en: 'file', ja: 'ファイル' },
  图片: { en: 'image', ja: '画像' },
  视频: { en: 'video', ja: '動画' },
  工具: { en: 'tool', ja: 'ツール' },
  中国: { en: 'China', ja: '中国' },
  今天: { en: 'today', ja: '今日' },
  明天: { en: 'tomorrow', ja: '明日' },
}

const LANG_LABELS: { value: string; label: string }[] = [
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'ru', label: '俄语' },
  { value: 'zh', label: '中文' },
]

// rx3 语种如实标注：按词库实际可命中词数显示
const langCounts = computed(() => {
  const m = new Map<string, number>()
  for (const l of LANG_LABELS) {
    m.set(
      l.value,
      l.value === 'zh' ? Object.keys(DICT).length : Object.values(DICT).filter((tr) => tr[l.value as 'en']).length,
    )
  }
  return m
})
const targetLangs = computed(() => LANG_LABELS.filter((l) => l.value !== 'zh').map((l) => ({ ...l, label: `${l.label}（${langCounts.value.get(l.value) ?? 0} 词）` })))

/** 英→中反向索引（en 词 → 中文键） */
const EN_INDEX = new Map<string, string>()
for (const [zh, tr] of Object.entries(DICT)) {
  if (tr.en) EN_INDEX.set(tr.en.toLowerCase(), zh)
}

interface Seg {
  text: string
  hit: boolean
}

/** zh→X：正向最大词典匹配（最长 4 字优先），未命中回退单字，仍不中保持原文 */
const maxMatch = (run: string, to: string): Seg[] => {
  const keys = Object.keys(DICT)
  const out: Seg[] = []
  let i = 0
  while (i < run.length) {
    let matched = ''
    for (let len = Math.min(4, run.length - i); len >= 1; len--) {
      const cand = run.slice(i, i + len)
      if (DICT[cand]?.[to as 'en']) {
        matched = cand
        break
      }
    }
    if (matched) {
      out.push({ text: DICT[matched]![to as 'en']!, hit: true })
      i += matched.length
    } else {
      out.push({ text: run[i], hit: false })
      i++
    }
  }
  return out
}

/** 分词执行：CJK 连续段做最大匹配，英文按词查反向索引，标点空格原样透出（不计入命中率） */
const segs = computed<Seg[]>(() => {
  const src = text.value
  if (!src.trim()) return []
  const out: Seg[] = []
  const re = /([\u4e00-\u9fff]+)|([a-zA-Z]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), hit: true })
    if (m[1]) {
      if (target.value === 'zh') {
        out.push({ text: m[1], hit: true }) // 目标为中文时中文原样保留
      } else {
        out.push(...maxMatch(m[1], target.value))
      }
    } else if (m[2]) {
      if (target.value === 'zh') {
        const zh = EN_INDEX.get(m[2].toLowerCase())
        out.push(zh ? { text: zh, hit: true } : { text: m[2], hit: false })
      } else {
        out.push({ text: m[2], hit: false }) // 非中文目标下英文无法查库，按未命中计
      }
    }
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last), hit: true })
  return out
})

const result = computed(() => segs.value.map((s) => s.text).join(''))
const tokens = computed(() => segs.value.filter((s) => /[\u4e00-\u9fff]|[a-zA-Z]/.test(s.text)))
const hitCount = computed(() => tokens.value.filter((s) => s.hit).length)
const coverage = computed(() => (tokens.value.length ? Math.round((hitCount.value / tokens.value.length) * 100) : 0))
// rx2 命中明细（徽章悬停显示）
const missedWords = computed(() => tokens.value.filter((s) => !s.hit).map((s) => s.text))
const hitWords = computed(() => tokens.value.filter((s) => s.hit && /[\u4e00-\u9fff]|[a-zA-Z]/.test(s.text) && s.text !== '，' && s.text !== '。').map((s) => s.text))
const detailTitle = computed(() => `命中 ${hitCount.value}：${hitWords.value.slice(0, 12).join('、')}${hitWords.value.length > 12 ? '…' : ''}｜未命中 ${missedWords.value.length}：${missedWords.value.slice(0, 12).join('、')}${missedWords.value.length > 12 ? '…' : ''}`)

const targetLabel = computed(() => LANG_LABELS.find((l) => l.value === target.value)?.label ?? target.value)

const swapToZh = () => {
  target.value = 'zh'
}
</script>

<template>
  <div>
    <div class="notice notice-warn">
      <b>诚实说明：</b>本页使用内置小词库的<b>离线规则翻译</b>（正向最大匹配，逐词查库），覆盖常用问候与基础词汇；未命中的词保持原文不动。
      完整的神经网络翻译需要部署 transformers.js 等端侧模型（本站已预留能力位），当前版本适合轻量场景，请勿用于正式文书。
    </div>

    <div class="lang-row mt-2">
      <div class="grow">
        <label class="field-label">源语言</label>
        <select v-model="from" class="select w-full">
          <option value="auto">自动检测（按中文处理）</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <button class="swap" title="反向翻译（目标改为中文）" aria-label="反向翻译（目标改为中文）" @click="swapToZh"><Languages :size="16" /></button>
      <div class="grow">
        <label class="field-label">目标语言</label>
        <select v-model="target" class="select w-full">
          <option v-for="l in targetLangs" :key="l.value" :value="l.value">{{ l.label }}</option>
          <option value="zh">中文（反查英→中）</option>
        </select>
      </div>
    </div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 110px" placeholder="输入要翻译的短句或段落…"></textarea>

    <div class="cov-row mt-2">
      <span class="chip" :title="detailTitle">词库命中率：{{ coverage }}%（悬停看明细）</span>
      <span class="chip">{{ targetLabel }}（离线基础翻译）</span>
    </div>

    <!-- rx2 未命中灰色底纹可视化 -->
    <div class="rich mt-2">
      <template v-for="(s, i) in segs" :key="i">
        <span v-if="!s.hit && /[\u4e00-\u9fff]|[a-zA-Z]/.test(s.text)" class="miss" :title="`词库未命中「${s.text}」`">{{ s.text }}</span>
        <span v-else>{{ s.text }}</span>
      </template>
    </div>

    <ResultBox class="mt-2" :model-value="result" title="翻译结果（纯文本）" :min-height="'110px'" />

    <p class="hint mt-1">
      词库覆盖：你好 / 谢谢 / 再见 / 我 / 你 / 爱 / 时间 / 工作 / 朋友 等 20 组高频词的多语种对照；
      灰色底纹为词库未命中的片段；命中率越低说明原文越超出词库范围。
    </p>
  </div>
</template>

<style scoped>
.lang-row { display: flex; gap: 12px; align-items: flex-end; }
.w-full { width: 100%; }
.swap {
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: none;
  color: var(--text-2);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.swap:hover { border-color: var(--accent); color: var(--accent-text); }
.cov-row { display: flex; gap: 8px; flex-wrap: wrap; }
.rich { line-height: 1.8; font-size: 14.5px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); min-height: 60px; word-break: break-all; }
.miss { background: color-mix(in srgb, var(--text-3) 20%, transparent); color: var(--text-3); border-radius: 3px; padding: 0 2px; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
