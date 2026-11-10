# -*- coding: utf-8 -*-
"""developer + ai 注册追加：markdown-to-slides / text-similarity / image-classifier。"""
import io

# ---------- developer ----------
p = 'src/tools/developer/registry.ts'
s = io.open(p, encoding='utf-8').read()
ADD = r'''  { slug: 'markdown-to-slides', title: 'Markdown 转幻灯片', category: 'developer', desc: '用 --- 分页的 Markdown 导出为零依赖单文件 HTML 幻灯片，方向键翻页。', keywords: ['幻灯片', 'slides', '演示', 'ppt'], component: () => import('./components/MarkdownToSlides.vue') },
]

export default tools'''
idx = s.rindex(']\n\nexport default tools')
s = s[:idx] + ADD[ADD.index('  {'):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('developer ok:', s.count("slug: '"))

# ---------- ai ----------
p = 'src/tools/ai/registry.ts'
s = io.open(p, encoding='utf-8').read()
head = io.open(p, encoding='utf-8').read().split('\n')
ADD2 = r'''  { slug: 'text-similarity', title: '文本相似度对比', category: 'ai', desc: '两段文本的多算法相似度（字符 n-gram 余弦/Jaccard/编辑距离），查重与去重辅助。', keywords: ['相似度', '查重', '文本对比', '余弦'], component: () => import('./components/TextSimilarity.vue') },
  { slug: 'image-classifier', title: '图像分类识别', category: 'ai', desc: '端侧模型识别图片主体类别（首次下载模型，之后离线可用）。', keywords: ['图像分类', '识别', '图片内容'], needModel: true, component: () => import('./components/ImageClassifier.vue') },
]

export default tools'''
idx = s.rindex(']\n\nexport default tools')
s = s[:idx] + ADD2[ADD2.index('  {'):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ai ok:', s.count("slug: '"))
