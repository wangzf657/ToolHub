import type { ToolDef } from '@/types'

/** AI 工具注册表（15 项）—— nlpEngine 规则模型即时可用，无需下载 */
const tools: ToolDef[] = [
  {
    slug: 'text-summarizer', title: '文本自动摘要', category: 'ai',
    desc: '抽取式摘要引擎在本地运行：自动挑出文中最关键的句子，生成简洁摘要（可按句数或目标字数）。',
    keywords: ['摘要', '总结', 'summarize'],
    component: () => import('./components/TextSummarizer.vue'),
  },
  {
    slug: 'keyword-extractor', title: '关键词提取', category: 'ai',
    desc: 'TF-IDF 算法在本地运行，按重要度提取文中最具代表性的短语，可回看出处句。',
    keywords: ['关键词', '提取', 'tfidf'],
    component: () => import('./components/KeywordExtractor.vue'),
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
  { slug: 'chat-with-pdf', title: '与 PDF 对话', category: 'ai', desc: '上传 PDF 后输入问题，本地检索算法从文档原文找出最相关的段落作答（非生成式对话）。', keywords: ['pdf', '问答', 'chatpdf'], component: () => import('./components/ChatWithPdf.vue') },
  {
    slug: 'sentiment-analyzer', title: '情感倾向分析', category: 'ai',
    desc: '基于中文情感词典的本地分析：判断好评/差评倾向并高亮关键词。',
    keywords: ['情感', '好评', '差评'],
    component: () => import('./components/SentimentAnalyzer.vue'),
  },
  {
    slug: 'emotion-detector', title: '情绪识别', category: 'ai',
    desc: '识别文本中的喜悦、悲伤、愤怒、恐惧等六类情绪及词频占比（中文情绪词典规则法）。',
    keywords: ['情绪', 'emotion', '识别'],
    component: () => import('./components/EmotionDetector.vue'),
  },
  {
    slug: 'grammar-corrector', title: '中文笔误检查', category: 'ai',
    desc: '本地规则引擎检查重复字词、标点问题与英文大小写，逐条采纳并实时生成修正稿（规则法，非 AI 模型）。',
    keywords: ['纠错', '语法', 'grammar'],
    component: () => import('./components/GrammarCorrector.vue'),
  },
  {
    slug: 'paraphraser', title: '同义改写', category: 'ai',
    desc: '本地同义词库轮换替换，为句子换一种说法；替换片段高亮可切换候选（规则法，非 AI 模型）。',
    keywords: ['改写', '同义', 'paraphrase'],
    component: () => import('./components/Paraphraser.vue'),
  },
  {
    slug: 'translator', title: '离线基础翻译', category: 'ai',
    desc: '内置常用词库的离线对照翻译（词级替换，非神经网络翻译）；中英为主，无需联网。',
    keywords: ['翻译', 'translate', '英语'],
    needModel: false,
    component: () => import('./components/Translator.vue'),
  },
  { slug: 'text-similarity', title: '文本相似度对比', category: 'ai', desc: '两段文本的多算法相似度（字符 n-gram 余弦/Jaccard/编辑距离），查重与去重辅助。', keywords: ['相似度', '查重', '文本对比', '余弦'], component: () => import('./components/TextSimilarity.vue') },
  {
    slug: 'zero-shot-classifier', title: '免训练文本归类', category: 'ai',
    desc: '自定义标签集合，词面相似度算法把文本归到最匹配的标签（无需训练数据，非神经网络）。',
    keywords: ['分类', '零样本', 'classifier'],
    component: () => import('./components/ZeroShotClassifier.vue'),
  },
  { slug: 'image-classifier', title: '图像分类识别', category: 'ai', desc: '端侧模型识别图片主体类别（首次下载模型，之后离线可用）。', keywords: ['图像分类', '识别', '图片内容'], needModel: true, component: () => import('./components/ImageClassifier.vue') },
  { slug: 'object-detector', title: '图像显著区域检测', category: 'ai', desc: '用显著性网格标出照片中最可能包含物体的区域并给出占比（启发式算法，无需下载模型）。', keywords: ['物体检测', '显著性', 'detection'], component: () => import('./components/ObjectDetector.vue') },
  { slug: 'image-caption', title: '图像描述建议', category: 'ai', desc: '基于色彩与构图分析的启发式描述建议，可直接用作 alt 文本（规则法，无需下载模型）。', keywords: ['图像描述', 'alt', '无障碍'], component: () => import('./components/ImageCaption.vue') },
]

export default tools