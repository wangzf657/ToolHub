import type { ToolDef } from '@/types'
import { readability, keywordDensity } from '@/lib/nlpEngine'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** SEO 工具注册表（13 项） */
const tools: ToolDef[] = [
  { slug: 'sitemap-generator', title: 'XML 站点地图生成', category: 'seo', desc: '粘贴 URL 列表生成带 changefreq、priority 与 lastmod 的 sitemap.xml。', keywords: ['sitemap', '站点地图', 'xml'], component: () => import('./components/SitemapGenerator.vue') },
  {
    slug: 'keyword-density-checker', title: '关键词密度分析', category: 'seo',
    desc: '统计 1–3 词短语的出现次数与密度占比，可选过滤停用词。',
    keywords: ['关键词密度', 'keyword', '密度'],
    textDef: {
      options: [],
      transform: (t) => {
        const items = keywordDensity(t, 3)
        if (!items.length) return '（未发现出现 2 次以上的词组）'
        return [
          '短语\t次数\t密度',
          ...items.slice(0, 30).map((i) => `${i.phrase}\t${i.count}\t${i.density.toFixed(2)}%`),
        ].join('\n')
      },
      placeholder: '粘贴文章内容…',
    },
  },
  { slug: 'utm-builder', title: 'UTM 链接构建器', category: 'seo', desc: '生成正确编码的 utm_source/medium/campaign/term/content 追踪链接。', keywords: ['utm', '追踪', 'campaign'], component: () => import('./components/UtmBuilder.vue') },
  { slug: 'serp-snippet-preview', title: '搜索结果预览', category: 'seo', desc: '预览标题、描述与 URL 在搜索结果中的样子，附像素宽度与字符数提示。', keywords: ['serp', '预览', '搜索结果'], component: () => import('./components/SerpPreview.vue') },
  { slug: 'schema-faq-generator', title: 'FAQ Schema 生成', category: 'seo', desc: '把问答对转成 FAQPage JSON-LD，争取搜索结果中的 FAQ 展示位。', keywords: ['faq', 'schema', '问答'], component: () => import('./components/SchemaGenerators.vue') },
  {
    slug: 'readability-checker', title: '可读性评分', category: 'seo',
    desc: '分析文本可读性：句长、词长与综合评分，并给出改进建议。',
    keywords: ['可读性', 'flesch', '可读'],
    textDef: {
      options: [],
      transform: (t) => {
        const r = readability(t)
        const cn = r.mode === 'cn'
        return [
          `综合可读性评分：${r.score.toFixed(0)} / 100（${r.level}）`,
          `句子数：${r.sentences}`,
          `字词数：${r.words}`,
          cn ? `句均字数：${r.avgSentenceLen.toFixed(1)} 字/句` : `平均句长：${r.avgSentenceLen.toFixed(1)} 词/句`,
          cn ? `估算词长：${r.avgWordLen.toFixed(1)} 字/词（中文以双字词为主）` : `平均词长：${r.avgWordLen.toFixed(1)}`,
          '',
          r.avgSentenceLen > 25 ? '建议：句子偏长，试着拆分长句，提升扫读体验。' : '句子长度适中，阅读体验良好。',
          '',
          cn
            ? '口径说明：中文文本按「句均字数」简化估分（30 字/句以内每字扣 0.9 分，超出部分每字扣 0.45 分），不套用英文 Flesch 公式。'
            : '口径说明：英文文本按句长与词长综合罚分估分（句均词长与平均词长越高越难读）。',
        ].join('\n')
      },
      placeholder: '粘贴要评估的文本…',
    },
  },
  { slug: 'heading-structure-checker', title: '标题结构检查', category: 'seo', desc: '粘贴 HTML 提取 H1–H6 结构，检查缺失 H1、多 H1 与跳级等问题。', keywords: ['标题', 'h1', '结构'], component: () => import('./components/HeadingStructure.vue') },
  {
    slug: 'schema-article-generator', title: '文章 Schema 生成', category: 'seo',
    desc: '生成 Article 等 JSON-LD 结构化数据，助力搜索富摘要。',
    keywords: ['schema', 'article', 'json-ld'],
    component: () => import('./components/SchemaGenerators.vue'),
  },
  { slug: 'schema-product-generator', title: '商品 Schema 生成', category: 'seo', desc: '生成含价格、库存与评分的 Product JSON-LD，用于商品富摘要。', keywords: ['schema', 'product', '商品'], component: () => import('./components/SchemaGenerators.vue') },
  { slug: 'schema-localbusiness-generator', title: '本地商家 Schema 生成', category: 'seo', desc: '生成含地址、坐标、营业时间与价位的 LocalBusiness JSON-LD。', keywords: ['localbusiness', 'schema', '本地'], component: () => import('./components/SchemaGenerators.vue') },
  { slug: 'schema-event-generator', title: '活动 Schema 生成', category: 'seo', desc: '生成含时间、地点与票务的 Event JSON-LD，用于活动富结果。', keywords: ['event', 'schema', '活动'], component: () => import('./components/SchemaGenerators.vue') },
  { slug: 'schema-breadcrumb-generator', title: '面包屑 Schema 生成', category: 'seo', desc: '生成位置编号正确的 BreadcrumbList JSON-LD，优化面包屑富摘要。', keywords: ['breadcrumb', 'schema', '面包屑'], component: () => import('./components/SchemaGenerators.vue') },
  { slug: 'hreflang-generator', title: 'hreflang 标签生成', category: 'seo', desc: '为多语言/多地区站点生成正确的 rel=alternate hreflang 标签，含 x-default。', keywords: ['hreflang', '多语言', 'alternate'], component: () => import('./components/HreflangGenerator.vue') },
]

export default tools
void esc
