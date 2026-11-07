import type { ToolDef } from '@/types'

/** 编辑器工作室注册表（4 项） */
const tools: ToolDef[] = [
  { slug: 'pdf-studio', title: 'PDF 工作台', category: 'editors', desc: '完整的浏览器 PDF 编辑器：页面管理、文字、签名、水印与导出。', keywords: ['pdf', '编辑器', '工作室'], studio: true, component: () => import('./components/PdfStudio.vue'), steps: ['打开 PDF 浏览缩略图', '删页/转页/排序/加内容', '导出新 PDF'] },
  { slug: 'video-studio', title: '视频工作台', category: 'editors', desc: '时间线式视频剪辑：多段拼接、裁剪、变速、静音与导出。', keywords: ['视频', '剪辑', '工作室'], studio: true, component: () => import('./components/VideoStudio.vue'), steps: ['导入素材', '时间线裁剪排序', '导出成片'] },
  { slug: 'photo-studio', title: '照片工作台', category: 'editors', desc: '分层修图：调整、滤镜、文字、裁剪与 AI 增强一步到位。', keywords: ['照片', '修图', '工作室'], studio: true, component: () => import('./components/PhotoStudio.vue'), steps: ['打开照片', '调整 / 滤镜 / 文字', '导出成品'] },
  { slug: 'data-studio', title: '数据工作台', category: 'editors', desc: 'CSV/Excel/JSON/Parquet 分析台：筛选、透视、图表与 SQL。', keywords: ['数据', '分析', '工作室'], studio: true, component: () => import('./components/DataStudio.vue'), steps: ['导入数据文件', '筛选、透视与图表', 'SQL 查询并导出'] },
]

export default tools
