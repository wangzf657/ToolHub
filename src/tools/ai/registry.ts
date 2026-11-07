import type { ToolDef } from '@/types'
import { summarize, extractKeywords, grammarCheck, paraphrase } from '@/lib/nlpEngine'

/** AI 工具注册表（13 项）—— nlpEngine 规则模型即时可用，无需下载 */
const tools: ToolDef[] = [
  {
    slug: 'text-summarizer', title: 'AI 文本摘要', category: 'ai',
    desc: '抽取式摘要引擎在本地运行：自动挑出文中最关键的句子，生成简洁摘要。',
    keywords: ['摘要', '总结', 'summarize'],
    textDef: {
      options: [{ key: 'count', label: '摘要句数', type: 'number', default: 3 }],
      transform: (t, o) => {
        const r = summarize(t, Math.max(1, Number(o.count) || 3))
        // 输出保持纯摘要（句数即所选项），统计信息不混入结果文本
        return r.summary
      },
      placeholder: '粘贴长文章、报告或段落…',
    },
  },
  {
    slug: 'sentiment-analyzer', title: '情感倾向分析', category: 'ai',
    desc: '基于中文情感词典的本地分析：判断好评/差评倾向并高亮关键词。',
    keywords: ['情感', '好评', '差评'],
    component: () => import('./components/SentimentAnalyzer.vue'),
  },
  {
    slug: 'entity-extractor', title: '实体识别抽取', category: 'ai',
    desc: '本地规则引擎识别人名、机构、地点、金额、日期与联系方式并高亮。',
    keywords: ['实体', 'ner', '识别'],
    component: () => import('./components/EntityExtractor.vue'),
  },
  {
    slug: 'question-answering', title: '文本问答抽取', category: 'ai',
    desc: '粘贴一段资料再提问，本地匹配算法直接从原文抽出最相关的答案句。',
    keywords: ['问答', 'qa', '抽取'],
    component: () => import('./components/QuestionAnswering.vue'),
  },
  {
    slug: 'keyword-extractor', title: '关键词提取', category: 'ai',
    desc: 'TF-IDF 算法在本地运行，按重要度提取文中最具代表性的短语。',
    keywords: ['关键词', '提取', 'tfidf'],
    textDef: {
      options: [{ key: 'n', label: '提取数量', type: 'number', default: 10 }],
      transform: (t, o) => {
        const items = extractKeywords(t, Math.max(1, Number(o.n) || 10))
        return items.map((k, i) => `${i + 1}. ${k.word}（权重 ${k.score.toFixed(2)}）`).join('\n')
      },
      placeholder: '粘贴文本…',
    },
  },
  {
    slug: 'translator', title: '离线基础翻译', category: 'ai',
    desc: '内置词库的离线翻译，支持 7 种语言常用表达；无需联网，隐私绝对安全。',
    keywords: ['翻译', 'translate', '英语'],
    needModel: false,
    component: () => import('./components/Translator.vue'),
  },
  {
    slug: 'grammar-corrector', title: 'AI 语法纠错', category: 'ai',
    desc: '本地规则模型检查重复字词、标点问题与英文大小写，一键修复。',
    keywords: ['纠错', '语法', 'grammar'],
    textDef: {
      options: [],
      transform: (t) => {
        const issues = grammarCheck(t)
        if (!issues.length) return '未发现明显语法问题 ✓'
        let fixed = t
        for (const issue of issues.slice().reverse()) {
          if (issue.suggestion) {
            fixed = fixed.slice(0, issue.index) + issue.suggestion + fixed.slice(issue.index + (issue.msg.includes('未闭合') ? 0 : issue.msg.length))
          }
        }
        void paraphrase
        return `发现 ${issues.length} 处问题：\n${issues.map((i) => `• ${i.msg}`).join('\n')}\n\n修正后：\n${fixed}`
      },
      placeholder: '粘贴要检查的文本…',
    },
  },
  {
    slug: 'paraphraser', title: 'AI 文本改写', category: 'ai',
    desc: '本地同义词库驱动的改写引擎，为句子换一种说法，保留原意。',
    keywords: ['改写', '同义', 'paraphrase'],
    textDef: {
      options: [{ key: 'strength', label: '改写幅度', type: 'select', default: '0.5', choices: [
        { value: '0.25', label: '轻微' }, { value: '0.5', label: '适中' }, { value: '1', label: '大幅' },
      ] }],
      transform: (t, o) => paraphrase(t, Number(o.strength)),
    },
  },
  {
    slug: 'emotion-detector', title: '情绪识别', category: 'ai',
    desc: '识别文本中的喜悦、悲伤、愤怒、恐惧等六类情绪及占比。',
    keywords: ['情绪', 'emotion', '识别'],
    component: () => import('./components/EmotionDetector.vue'),
  },
  {
    slug: 'zero-shot-classifier', title: '零样本分类', category: 'ai',
    desc: '自定义标签集合，本地相似度模型把文本归类到最匹配的标签。',
    keywords: ['分类', '零样本', 'classifier'],
    component: () => import('./components/ZeroShotClassifier.vue'),
  },
  { slug: 'image-caption', title: '图像描述生成', category: 'ai', desc: '为图片生成中文描述与可直接使用的 alt 文本（本地启发式分析）。', keywords: ['图像描述', 'alt', '无障碍'], needModel: true, component: () => import('./components/ImageCaption.vue') },
  { slug: 'object-detector', title: '图像物体检测', category: 'ai', desc: '检测并标注照片中的常见物体（端侧模型，首次需下载）。', keywords: ['物体检测', '识别', 'detection'], needModel: true, component: () => import('./components/ObjectDetector.vue') },
  { slug: 'chat-with-pdf', title: '与 PDF 对话', category: 'ai', desc: '上传 PDF 后用自然语言提问，答案直接引用文档原文（本地匹配）。', keywords: ['pdf', '问答', 'chatpdf'], component: () => import('./components/ChatWithPdf.vue') },
]

export default tools
