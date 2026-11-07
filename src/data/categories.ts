import type { CategoryDef } from '@/types'

/** 分类定义（顺序 = 导航与首页顺序） */
export const categories: CategoryDef[] = [
  {
    id: 'image',
    name: '图片工具',
    short: '图片',
    desc: '免费、纯本地的图片工具：压缩、转格式、调整尺寸、裁剪、滤镜、OCR、抠图、GIF 制作等，图片从不离开你的设备。',
    icon: 'image',
    color: '#38bdf8',
    path: '/image-tools',
  },
  {
    id: 'video',
    name: '视频工具',
    short: '视频',
    desc: '免费、纯本地的视频工具：压缩到指定大小、MP4/WebM/MOV 转换、裁剪、合并、变速、抽帧、转 GIF。视频全程不上传。',
    icon: 'video',
    color: '#f472b6',
    path: '/video-tools',
  },
  {
    id: 'audio',
    name: '音频工具',
    short: '音频',
    desc: '免费、纯本地的音频工具：MP3/WAV/M4A/FLAC 转换、压缩、裁剪、合并、音量标准化、降噪、人声消除、转写。录音从不离开设备。',
    icon: 'audio',
    color: '#a78bfa',
    path: '/audio-tools',
  },
  {
    id: 'pdf',
    name: 'PDF 工具',
    short: 'PDF',
    desc: '免费、纯本地的 PDF 工具：合并、拆分、加密、页码、水印、转图片、转 Office 等，文档全程留在你的浏览器里。',
    icon: 'pdf',
    color: '#f87171',
    path: '/pdf-tools',
  },
  {
    id: 'data',
    name: '数据工具',
    short: '数据',
    desc: '在浏览器里分析 CSV / Excel / Parquet：SQL 查询、数据透视、图表、对比、合并、拆分与去重，数据不上传。',
    icon: 'data',
    color: '#34d399',
    path: '/data-tools',
  },
  {
    id: 'utility',
    name: '实用工具',
    short: '实用',
    desc: '免费、纯本地的日常工具：二维码、密码生成、单位换算、各类计算器、文本处理等，一切都在你的设备上运行。',
    icon: 'utility',
    color: '#4ade80',
    path: '/utility-tools',
  },
  {
    id: 'developer',
    name: '开发工具',
    short: '开发',
    desc: '免费、纯本地的开发者工具：JSON 格式化、哈希、Base64、JWT、正则测试等，数据不出浏览器。',
    icon: 'code',
    color: '#60a5fa',
    path: '/developer-tools',
  },
  {
    id: 'finance',
    name: '金融交易',
    short: '金融',
    desc: '期权定价、仓位管理、夏普比率、年化收益等金融计算器，全部在浏览器本地完成，无注册、不上传。',
    icon: 'finance',
    color: '#fbbf24',
    path: '/finance-tools',
  },
  {
    id: 'business',
    name: '商业 SaaS',
    short: '商业',
    desc: 'LTV、CAC、流失率、MRR/ARR、留存热力图等增长指标计算器与简历生成器，数据留在本地。',
    icon: 'business',
    color: '#fb923c',
    path: '/business-tools',
  },
  {
    id: 'seo',
    name: 'SEO 工具',
    short: 'SEO',
    desc: 'JSON-LD 结构化数据生成、hreflang、站点地图、搜索结果预览、可读性与关键词分析，纯浏览器运行。',
    icon: 'seo',
    color: '#2dd4bf',
    path: '/seo-tools',
  },
  {
    id: 'ai',
    name: 'AI 工具',
    short: 'AI',
    desc: '端侧运行的 AI 文本与图像工具：摘要、情感分析、关键词、翻译、OCR、抠图。文本不上传，本地推理。',
    icon: 'ai',
    color: '#c084fc',
    path: '/ai-tools',
  },
  {
    id: 'editors',
    name: '编辑器工作室',
    short: '工作室',
    desc: '四款浏览器端完整编辑器：PDF 工作台、视频工作台、照片工作台与数据工作台——通常按订阅收费的能力，这里免费。',
    icon: 'studio',
    color: '#818cf8',
    path: '/studios',
  },
]

export const categoryMap = new Map(categories.map((c) => [c.id, c]))

/** 路径段（image-tools）→ 分类定义 */
export const pathMap = new Map(categories.map((c) => [c.path.slice(1), c]))

/** 路由参数解析分类：兼容 /image-tools 路径段与 image 类别 id 两种写法 */
export function categoryByRoute(id: string): CategoryDef | undefined {
  if (id === 'all') return undefined
  return pathMap.get(id) ?? categoryMap.get(id as never)
}

export function catPath(id: string): string {
  return categoryMap.get(id as never)?.path ?? '/'
}
