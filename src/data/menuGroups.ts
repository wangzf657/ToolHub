/**
 * 菜单领域族数据层(V1.2 过渡态)——由 scripts/gen-menu-groups.mjs 从蓝图生成,勿手改;
 * 改分组/排序请先改蓝图再重跑生成器。单一事实源:工具名/简介/URL 实时取自注册表,本文件只定义归属与顺序。
 */
import type { CategoryId } from '@/types'

/** 菜单大类(7 个,显示层归并;≠ 数据分类 CategoryId 13 个) */
export interface MenuCategoryDef { id: string; name: string; icon: string }

export interface MenuGroupDef {
  /** 组 id,如 image-1 */
  id: string
  /** 领域族名,如「压缩与调整」 */
  name: string
  /** lucide 图标名(预留,当前菜单不渲染族图标) */
  icon: string
  /** 所属数据分类(组成员必须一致,脚本断言) */
  category: CategoryId
  /** 所属菜单大类(7 值之一,显示层归并) */
  menuCategory: string
}

export const menuCategories: MenuCategoryDef[] = [
  { id: 'image', name: '图片', icon: 'image' },
  { id: 'av', name: '音视频', icon: 'video' },
  { id: 'docdata', name: '文档与数据', icon: 'pdf' },
  { id: 'utility', name: '实用工具', icon: 'utility' },
  { id: 'dev', name: '开发工具', icon: 'code' },
  { id: 'ai', name: 'AI', icon: 'ai' },
  { id: 'games', name: '小游戏', icon: 'gamepad-2' },
]

/** 数组顺序 = 菜单组级顺序(蓝图定稿);组内工具序 = 注册表数组序(reorder 后与蓝图一致) */
export const menuGroups: MenuGroupDef[] = [
  /* ---- 图片 ---- */
  { id: 'image-1', name: '压缩与调整', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-2', name: '格式转换', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-3', name: '抠图·OCR·去除', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-4', name: '设计与美化', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-5', name: 'AI 增强与修复', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-6', name: 'GIF 工坊', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-7', name: '色彩工具', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-8', name: '打码与隐私', icon: 'wrench', category: 'image', menuCategory: 'image' },
  { id: 'image-9', name: '文件与趣味小件', icon: 'wrench', category: 'image', menuCategory: 'image' },
  /* ---- 音视频 ---- */
  { id: 'av-1', name: '视频压缩与转码', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-2', name: '视频剪辑', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-3', name: '视频音轨与字幕', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-4', name: '视频 GIF 与帧', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-5', name: '视频水印与标注', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-6', name: '视频效果进阶', icon: 'wrench', category: 'video', menuCategory: 'av' },
  { id: 'av-7', name: '语音合成与识别', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  { id: 'av-8', name: '音频格式转换与压缩', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  { id: 'av-9', name: '音频剪辑与合并', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  { id: 'av-10', name: '降噪与人声', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  { id: 'av-11', name: '声音工坊', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  { id: 'av-12', name: '音频标签与波形', icon: 'wrench', category: 'audio', menuCategory: 'av' },
  /* ---- 文档与数据 ---- */
  { id: 'docdata-1', name: 'PDF 合并与拆分', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-2', name: 'PDF 压缩与优化', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-3', name: 'PDF 转 Office 与文本', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-4', name: 'PDF 转图片与合成', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-5', name: 'PDF 编辑·页面', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-6', name: 'PDF 签名与表单', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-7', name: 'PDF 编辑·内容', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-8', name: 'PDF 加密与脱敏', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-9', name: 'PDF 修补与扫描', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-10', name: 'PDF 对比与批处理', icon: 'wrench', category: 'pdf', menuCategory: 'docdata' },
  { id: 'docdata-11', name: '表格与文件查看', icon: 'wrench', category: 'data', menuCategory: 'docdata' },
  { id: 'docdata-12', name: '格式互转与打包', icon: 'wrench', category: 'data', menuCategory: 'docdata' },
  { id: 'docdata-13', name: '数据处理', icon: 'wrench', category: 'data', menuCategory: 'docdata' },
  { id: 'docdata-14', name: '分析与可视化', icon: 'wrench', category: 'data', menuCategory: 'docdata' },
  /* ---- 实用工具 ---- */
  { id: 'utility-1', name: '二维码与条码', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-2', name: '密码·安全·文件', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-3', name: '计算器与换算', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-4', name: '贷款·房贷·利息', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-5', name: '个税与薪资', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-6', name: '日期·时间·计时', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-7', name: '健康与健身', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-8', name: '中文工具', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-9', name: '文本工具', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-10', name: '文案与符号', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-11', name: '教育学习', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-12', name: '文化查询', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-13', name: '生活服务', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-14', name: '互动·娱乐·检测', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-15', name: '创作与设计', icon: 'wrench', category: 'utility', menuCategory: 'utility' },
  { id: 'utility-16', name: '编辑器工作室', icon: 'wrench', category: 'editors', menuCategory: 'utility' },
  { id: 'utility-17', name: '贷款与分期', icon: 'wrench', category: 'finance', menuCategory: 'utility' },
  { id: 'utility-18', name: '投资与收益', icon: 'wrench', category: 'finance', menuCategory: 'utility' },
  { id: 'utility-19', name: '指标与风险', icon: 'wrench', category: 'finance', menuCategory: 'utility' },
  { id: 'utility-20', name: '期权与衍生品', icon: 'wrench', category: 'finance', menuCategory: 'utility' },
  { id: 'utility-21', name: '职场与个人', icon: 'wrench', category: 'business', menuCategory: 'utility' },
  { id: 'utility-22', name: '经营与利润', icon: 'wrench', category: 'business', menuCategory: 'utility' },
  { id: 'utility-23', name: '增长指标', icon: 'wrench', category: 'business', menuCategory: 'utility' },
  { id: 'utility-24', name: '技术 SEO 与链接', icon: 'wrench', category: 'seo', menuCategory: 'utility' },
  { id: 'utility-25', name: '结构化数据 Schema', icon: 'wrench', category: 'seo', menuCategory: 'utility' },
  { id: 'utility-26', name: '内容与 SERP 分析', icon: 'wrench', category: 'seo', menuCategory: 'utility' },
  /* ---- 开发工具 ---- */
  { id: 'dev-1', name: 'JSON 族', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-2', name: '编解码', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-3', name: '哈希·加密·JWT', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-4', name: '代码格式化', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-5', name: 'Markdown 全家桶', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-6', name: '正则', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-7', name: '时间·进制·位运算', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-8', name: '网络与协议', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-9', name: '前端设计', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-10', name: '建站小件', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-11', name: '运行·测试·数据', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-12', name: '运维与配置', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  { id: 'dev-13', name: '对比与查询杂项', icon: 'wrench', category: 'developer', menuCategory: 'dev' },
  /* ---- AI ---- */
  { id: 'ai-1', name: '摘要·提取·问答', icon: 'wrench', category: 'ai', menuCategory: 'ai' },
  { id: 'ai-2', name: '分析与改写', icon: 'wrench', category: 'ai', menuCategory: 'ai' },
  { id: 'ai-3', name: '图像 AI', icon: 'wrench', category: 'ai', menuCategory: 'ai' },
  /* ---- 小游戏 ---- */
  { id: 'games-1', name: '休闲游戏', icon: 'wrench', category: 'games', menuCategory: 'games' },
]

/** slug → 组 id,516 项全覆盖 */
export const groupOf: Record<string, string> = {
  /* 压缩与调整 */
  'compress-image-to-size': 'image-1', 'resize-image': 'image-1', 'crop-image': 'image-1', 'circle-crop': 'image-1', 'rotate-image': 'image-1', 'flip-image': 'image-1', 'adjust-brightness': 'image-1', 'grayscale-image': 'image-1', 'invert-image': 'image-1', 'add-watermark': 'image-1', 'social-media-resizer': 'image-1', 'batch-image-process': 'image-1',
  /* 格式转换 */
  'png-to-jpg': 'image-2', 'jpg-to-png': 'image-2', 'webp-to-jpg': 'image-2', 'heic-to-jpg': 'image-2', 'jpg-to-webp': 'image-2', 'png-to-webp': 'image-2', 'webp-to-png': 'image-2', 'heic-to-png': 'image-2', 'avif-to-jpg': 'image-2', 'avif-to-png': 'image-2', 'gif-to-png': 'image-2', 'bmp-to-png': 'image-2', 'svg-to-png': 'image-2', 'tiff-to-png': 'image-2', 'ico-to-png': 'image-2', 'png-to-ico': 'image-2', 'psd-to-jpg': 'image-2',
  /* 抠图·OCR·去除 */
  'remove-background': 'image-3', 'ocr': 'image-3', 'remove-watermark': 'image-3', 'remove-object': 'image-3', 'blemish-remover': 'image-3',
  /* 设计与美化 */
  'passport-photo': 'image-4', 'meme-generator': 'image-4', 'merge-images-long': 'image-4', 'photo-collage': 'image-4', 'split-image-grid': 'image-4', 'overlay-images': 'image-4', 'photo-filters': 'image-4', 'round-corners': 'image-4', 'image-border': 'image-4', 'screenshot-dress-up': 'image-4', 'favicon-generator': 'image-4', 'app-icon-generator': 'image-4',
  /* AI 增强与修复 */
  'upscale-image': 'image-5', 'enhance-image': 'image-5', 'restore-old-photo': 'image-5', 'colorize-photo': 'image-5', 'scan-enhancer': 'image-5',
  /* GIF 工坊 */
  'gif-maker': 'image-6', 'gif-compressor': 'image-6', 'gif-editor': 'image-6', 'gif-frame-extractor': 'image-6',
  /* 色彩工具 */
  'screen-color-picker': 'image-7', 'image-color-picker': 'image-7', 'color-palette': 'image-7', 'color-blindness-simulator': 'image-7',
  /* 打码与隐私 */
  'blur-region': 'image-8', 'pixelate-image': 'image-8', 'strip-exif': 'image-8', 'exif-viewer': 'image-8', 'image-steganography': 'image-8',
  /* 文件与趣味小件 */
  'batch-file-rename': 'image-9', 'folder-content-lister': 'image-9', 'font-converter': 'image-9', 'image-to-base64': 'image-9', 'image-diff': 'image-9', 'image-to-ascii': 'image-9', 'string-art-generator': 'image-9',
  /* 视频压缩与转码 */
  'compress-video': 'av-1', 'convert-video': 'av-1', 'mov-to-mp4': 'av-1', 'mkv-to-mp4': 'av-1', 'avi-to-mp4': 'av-1', 'webm-to-mp4': 'av-1', 'wmv-to-mp4': 'av-1', 'flv-to-mp4': 'av-1', 'mp4-to-webm': 'av-1', 'mp4-to-mov': 'av-1',
  /* 视频剪辑 */
  'trim-video': 'av-2', 'merge-video': 'av-2', 'split-video': 'av-2', 'crop-video': 'av-2', 'resize-video': 'av-2', 'rotate-video': 'av-2', 'change-video-speed': 'av-2', 'reverse-video': 'av-2', 'loop-video': 'av-2',
  /* 视频音轨与字幕 */
  'video-to-mp3': 'av-3', 'mp4-to-mp3': 'av-3', 'mov-to-mp3': 'av-3', 'mp4-to-wav': 'av-3', 'mute-video': 'av-3', 'remove-silence-from-video': 'av-3', 'remove-background-noise-from-video': 'av-3', 'add-music-to-video': 'av-3', 'add-subtitles-to-video': 'av-3', 'subtitle-converter': 'av-3',
  /* 视频 GIF 与帧 */
  'video-to-gif': 'av-4', 'gif-to-mp4': 'av-4', 'video-thumbnail': 'av-4', 'video-to-images': 'av-4',
  /* 视频水印与标注 */
  'video-watermark': 'av-5', 'add-text-to-video': 'av-5', 'blur-video': 'av-5',
  /* 视频效果进阶 */
  'video-color-grading': 'av-6', 'stabilize-video': 'av-6', 'green-screen-video': 'av-6', 'side-by-side-video': 'av-6', 'audiogram-maker': 'av-6',
  /* 语音合成与识别 */
  'text-to-speech': 'av-7', 'speech-to-text': 'av-7', 'voice-recorder': 'av-7',
  /* 音频格式转换与压缩 */
  'convert-audio': 'av-8', 'wav-to-mp3': 'av-8', 'mp3-to-wav': 'av-8', 'm4a-to-mp3': 'av-8', 'mp3-to-m4a': 'av-8', 'm4a-to-wav': 'av-8', 'wav-to-m4a': 'av-8', 'flac-to-mp3': 'av-8', 'wav-to-flac': 'av-8', 'flac-to-wav': 'av-8', 'ogg-to-mp3': 'av-8', 'aac-to-mp3': 'av-8', 'opus-to-mp3': 'av-8', 'wma-to-mp3': 'av-8', 'compress-audio': 'av-8',
  /* 音频剪辑与合并 */
  'audio-trimmer': 'av-9', 'merge-audio': 'av-9', 'fade-audio': 'av-9', 'change-audio-speed': 'av-9', 'reverse-audio': 'av-9', 'remove-silence-from-audio': 'av-9',
  /* 降噪与人声 */
  'remove-noise-from-audio': 'av-10', 'vocal-remover': 'av-10', 'normalize-audio': 'av-10', 'audio-pitch-shift': 'av-10',
  /* 声音工坊 */
  'white-noise-generator': 'av-11', 'metronome': 'av-11', 'tone-generator': 'av-11', 'instrument-tuner': 'av-11', 'audio-equalizer': 'av-11', 'audio-visualizer': 'av-11', 'decibel-meter': 'av-11',
  /* 音频标签与波形 */
  'mp3-tag-editor': 'av-12', 'audio-waveform-generator': 'av-12',
  /* PDF 合并与拆分 */
  'merge-pdf': 'docdata-1', 'split-pdf': 'docdata-1', 'extract-pdf-pages': 'docdata-1', 'delete-pdf-pages': 'docdata-1', 'reorder-pdf': 'docdata-1', 'reverse-pdf-pages': 'docdata-1', 'insert-blank-pages-pdf': 'docdata-1', 'split-pdf-by-size': 'docdata-1',
  /* PDF 压缩与优化 */
  'compress-pdf': 'docdata-2', 'compress-pptx': 'docdata-2', 'flatten-pdf': 'docdata-2', 'grayscale-pdf': 'docdata-2', 'pdf-to-pdfa': 'docdata-2',
  /* PDF 转 Office 与文本 */
  'pdf-to-word': 'docdata-3', 'pdf-to-excel': 'docdata-3', 'pdf-to-powerpoint': 'docdata-3', 'office-to-pdf': 'docdata-3', 'pdf-to-text': 'docdata-3', 'pdf-to-markdown': 'docdata-3',
  /* PDF 转图片与合成 */
  'pdf-to-jpg': 'docdata-4', 'pdf-to-png': 'docdata-4', 'pdf-to-one-jpg': 'docdata-4', 'extract-images-from-pdf': 'docdata-4', 'jpg-to-pdf': 'docdata-4', 'png-to-pdf': 'docdata-4', 'images-to-pdf': 'docdata-4',
  /* PDF 编辑·页面 */
  'rotate-pdf': 'docdata-5', 'crop-pdf': 'docdata-5', 'resize-pdf': 'docdata-5', 'pdf-nup': 'docdata-5', 'watermark-pdf': 'docdata-5', 'pdf-page-numbers': 'docdata-5', 'pdf-header-footer': 'docdata-5', 'bates-numbering': 'docdata-5',
  /* PDF 签名与表单 */
  'sign-pdf': 'docdata-6', 'signature-drawing': 'docdata-6', 'fill-pdf-form': 'docdata-6', 'pdf-form-data': 'docdata-6',
  /* PDF 编辑·内容 */
  'pdf-editor': 'docdata-7', 'add-text-to-pdf': 'docdata-7', 'insert-image-pdf': 'docdata-7', 'find-and-replace-pdf': 'docdata-7', 'pdf-metadata-editor': 'docdata-7', 'pdf-annotation-remover': 'docdata-7',
  /* PDF 加密与脱敏 */
  'protect-pdf': 'docdata-8', 'unlock-pdf': 'docdata-8', 'pdf-redact': 'docdata-8', 'redact-pdf': 'docdata-8',
  /* PDF 修补与扫描 */
  'repair-pdf': 'docdata-9', 'clean-scanned-pdf': 'docdata-9', 'searchable-pdf': 'docdata-9',
  /* PDF 对比与批处理 */
  'compare-pdf': 'docdata-10', 'batch-pdf': 'docdata-10', 'pdf-attachments': 'docdata-10',
  /* 表格与文件查看 */
  'csv-viewer': 'docdata-11', 'excel-viewer': 'docdata-11', 'sqlite-viewer': 'docdata-11', 'eml-viewer': 'docdata-11', 'epub-reader': 'docdata-11',
  /* 格式互转与打包 */
  'excel-to-csv': 'docdata-12', 'csv-to-excel': 'docdata-12', 'parquet-to-csv': 'docdata-12', 'epub-converter': 'docdata-12', 'zip-password': 'docdata-12',
  /* 数据处理 */
  'merge-csv-files': 'docdata-13', 'remove-duplicates-from-csv': 'docdata-13', 'split-csv-file': 'docdata-13', 'compare-csv-files': 'docdata-13',
  /* 分析与可视化 */
  'chart-from-csv': 'docdata-14', 'query-csv-with-sql': 'docdata-14', 'excel-pivot-table-online': 'docdata-14', 'data-analysis-tool': 'docdata-14',
  /* 二维码与条码 */
  'qr-code-generator': 'utility-1', 'wifi-qr-code': 'utility-1', 'qr-code-scanner': 'utility-1', 'qr-code-styled': 'utility-1', 'qr-code-batch': 'utility-1', 'qr-code-repair': 'utility-1', 'barcode-generator': 'utility-1',
  /* 密码·安全·文件 */
  'password-generator': 'utility-2', 'password-strength-checker': 'utility-2', 'random-string-generator': 'utility-2', 'uuid-generator': 'utility-2', 'id-card-validator': 'utility-2', 'phone-carrier-lookup': 'utility-2', 'pii-scrubber': 'utility-2', 'browser-fingerprint': 'utility-2', 'file-encryptor': 'utility-2', 'archive-extractor': 'utility-2',
  /* 计算器与换算 */
  'percentage-calculator': 'utility-3', 'scientific-calculator': 'utility-3', 'unit-converter': 'utility-3', 'currency-converter': 'utility-3', 'fraction-calculator': 'utility-3', 'ratio-calculator': 'utility-3', 'aspect-ratio-calculator': 'utility-3', 'statistics-calculator': 'utility-3', 'hours-calculator': 'utility-3', 'tip-calculator': 'utility-3', 'discount-calculator': 'utility-3', 'sales-tax-calculator': 'utility-3', 'fuel-cost-calculator': 'utility-3',
  /* 贷款·房贷·利息 */
  'loan-calculator': 'utility-4', 'mortgage-calculator': 'utility-4', 'amortization-calculator': 'utility-4', 'compound-interest-calculator': 'utility-4', 'simple-interest-calculator': 'utility-4',
  /* 个税与薪资 */
  'income-tax-calculator': 'utility-5', 'social-insurance-calculator': 'utility-5', 'salary-calculator': 'utility-5', 'retirement-calculator': 'utility-5',
  /* 日期·时间·计时 */
  'age-calculator': 'utility-6', 'date-difference-calculator': 'utility-6', 'business-day-calculator': 'utility-6', 'lunar-calendar': 'utility-6', 'timezone-converter': 'utility-6', 'countdown-timer': 'utility-6', 'event-countdown': 'utility-6', 'pomodoro-timer': 'utility-6', 'shelf-life-calculator': 'utility-6', 'shift-schedule-calculator': 'utility-6', 'calendar-printer': 'utility-6',
  /* 健康与健身 */
  'bmi-calculator': 'utility-7', 'period-calculator': 'utility-7', 'due-date-calculator': 'utility-7', 'sleep-cycle-calculator': 'utility-7', 'body-fat-calculator': 'utility-7', 'ideal-weight-calculator': 'utility-7', 'tdee-calculator': 'utility-7', 'one-rep-max-calculator': 'utility-7', 'pace-calculator': 'utility-7', 'blood-type-inheritance': 'utility-7',
  /* 中文工具 */
  'pinyin-converter': 'utility-8', 'chinese-variant-converter': 'utility-8', 'number-to-words': 'utility-8', 'kinship-calculator': 'utility-8',
  /* 文本工具 */
  'word-counter': 'utility-9', 'text-extractor': 'utility-9', 'text-cleaner': 'utility-9', 'find-and-replace': 'utility-9', 'remove-duplicate-lines': 'utility-9', 'sort-lines': 'utility-9', 'remove-line-breaks': 'utility-9', 'reverse-text': 'utility-9', 'text-repeater': 'utility-9', 'case-converter': 'utility-9', 'fullwidth-converter': 'utility-9', 'text-set-operations': 'utility-9', 'morse-code-translator': 'utility-9', 'binary-text-converter': 'utility-9', 'caesar-cipher': 'utility-9', 'roman-numeral-converter': 'utility-9',
  /* 文案与符号 */
  'banned-words-checker': 'utility-10', 'word-frequency-counter': 'utility-10', 'reading-time-calculator': 'utility-10', 'special-symbols': 'utility-10', 'lorem-ipsum-generator': 'utility-10', 'fancy-text-generator': 'utility-10', 'ascii-banner': 'utility-10', 'palindrome-checker': 'utility-10',
  /* 教育学习 */
  'latex-editor': 'utility-11', 'citation-generator': 'utility-11', 'gpa-calculator': 'utility-11', 'grade-calculator': 'utility-11', 'phonetic-lookup': 'utility-11', 'copybook-generator': 'utility-11',
  /* 文化查询 */
  'idiom-dictionary': 'utility-12', 'xiehouyu-lookup': 'utility-12', 'hanzi-stroke-order': 'utility-12', 'poem-search': 'utility-12', 'dynasty-timeline': 'utility-12', 'university-lookup': 'utility-12', 'periodic-table': 'utility-12',
  /* 生活服务 */
  'garbage-classifier': 'utility-13', 'food-calorie-lookup': 'utility-13', 'invoice-assistant': 'utility-13', 'invoice-generator': 'utility-13', 'vcard-generator': 'utility-13', 'address-parser': 'utility-13', 'clothing-size-chart': 'utility-13', 'shoe-size-converter': 'utility-13',
  /* 互动·娱乐·检测 */
  'lucky-wheel': 'utility-14', 'typing-test': 'utility-14', 'mbti-personality-test': 'utility-14', 'random-group-splitter': 'utility-14', 'random-number': 'utility-14', 'dice-roller': 'utility-14', 'digital-muyu': 'utility-14', 'handheld-marquee': 'utility-14', 'online-piano': 'utility-14', 'name-generator': 'utility-14', 'avatar-generator': 'utility-14', 'screen-dead-pixel-test': 'utility-14', 'keyboard-test': 'utility-14',
  /* 创作与设计 */
  'whiteboard': 'utility-15', 'er-diagram-editor': 'utility-15', 'teleprompter': 'utility-15', 'ephemeral-notepad': 'utility-15', 'screen-recorder': 'utility-15', 'text-to-handwriting': 'utility-15', 'text-behind-image': 'utility-15', 'seal-generator': 'utility-15', 'kids-coloring': 'utility-15',
  /* 编辑器工作室 */
  'pdf-studio': 'utility-16', 'video-studio': 'utility-16', 'photo-studio': 'utility-16', 'data-studio': 'utility-16',
  /* 贷款与分期 */
  'installment-rate-calculator': 'utility-17', 'auto-loan-calculator': 'utility-17', 'renovation-loan-calculator': 'utility-17', 'balloon-loan-calculator': 'utility-17',
  /* 投资与收益 */
  'stock-average-calculator': 'utility-18', 'crypto-profit-calculator': 'utility-18', 'sip-calculator': 'utility-18', 'cagr-calculator': 'utility-18', 'dividend-calculator': 'utility-18', 'fire-calculator': 'utility-18', 'irr-npv-calculator': 'utility-18', 'bond-ytm-calculator': 'utility-18', 'portfolio-rebalance-calculator': 'utility-18',
  /* 指标与风险 */
  'position-size-calculator': 'utility-19', 'kelly-criterion-calculator': 'utility-19', 'sharpe-ratio-calculator': 'utility-19', 'risk-reward-calculator': 'utility-19', 'forex-pip-calculator': 'utility-19',
  /* 期权与衍生品 */
  'black-scholes-calculator': 'utility-20', 'options-payoff-calculator': 'utility-20',
  /* 职场与个人 */
  'resume-builder': 'utility-21', 'email-signature-generator': 'utility-21', 'freelance-rate-calculator': 'utility-21',
  /* 经营与利润 */
  'roi-calculator': 'utility-22', 'profit-margin-calculator': 'utility-22', 'break-even-calculator': 'utility-22', 'cash-flow-calculator': 'utility-22', 'burn-rate-calculator': 'utility-22', 'saas-pricing-calculator': 'utility-22', 'rule-of-40-calculator': 'utility-22',
  /* 增长指标 */
  'ltv-calculator': 'utility-23', 'cac-calculator': 'utility-23', 'churn-rate-calculator': 'utility-23', 'mrr-calculator': 'utility-23', 'cohort-retention-calculator': 'utility-23',
  /* 技术 SEO 与链接 */
  'sitemap-generator': 'utility-24', 'hreflang-generator': 'utility-24', 'utm-builder': 'utility-24',
  /* 结构化数据 Schema */
  'schema-faq-generator': 'utility-25', 'schema-article-generator': 'utility-25', 'schema-product-generator': 'utility-25', 'schema-localbusiness-generator': 'utility-25', 'schema-event-generator': 'utility-25', 'schema-breadcrumb-generator': 'utility-25',
  /* 内容与 SERP 分析 */
  'keyword-density-checker': 'utility-26', 'serp-snippet-preview': 'utility-26', 'readability-checker': 'utility-26', 'heading-structure-checker': 'utility-26',
  /* JSON 族 */
  'json-formatter': 'dev-1', 'json-visualizer': 'dev-1', 'json-diff': 'dev-1', 'json-escape': 'dev-1', 'jsonpath-tester': 'dev-1', 'csv-to-json': 'dev-1', 'json-to-csv': 'dev-1', 'json-to-excel': 'dev-1', 'json-to-yaml': 'dev-1', 'yaml-to-json': 'dev-1', 'json-to-xml': 'dev-1', 'xml-to-json': 'dev-1', 'toml-to-json': 'dev-1', 'env-to-json': 'dev-1', 'json-to-typescript': 'dev-1', 'json-schema-generator': 'dev-1', 'json-to-java-entity': 'dev-1',
  /* 编解码 */
  'base64-encoder': 'dev-2', 'url-encoder': 'dev-2', 'base32-converter': 'dev-2', 'html-entity-encoder': 'dev-2', 'gzip-compress': 'dev-2', 'encoding-converter': 'dev-2', 'base64-to-image': 'dev-2',
  /* 哈希·加密·JWT */
  'hash-generator': 'dev-3', 'jwt-decoder': 'dev-3', 'jwt-generator': 'dev-3', 'hmac-generator': 'dev-3', 'bcrypt-hash': 'dev-3', 'totp-generator': 'dev-3', 'rsa-key-generator': 'dev-3', 'pgp-encrypt': 'dev-3',
  /* 代码格式化 */
  'sql-formatter': 'dev-4', 'javascript-formatter': 'dev-4', 'css-formatter': 'dev-4', 'html-formatter': 'dev-4', 'xml-formatter': 'dev-4', 'graphql-formatter': 'dev-4', 'code-minifier': 'dev-4',
  /* Markdown 全家桶 */
  'markdown-preview': 'dev-5', 'markdown-to-wechat': 'dev-5', 'docx-to-markdown': 'dev-5', 'markdown-to-docx': 'dev-5', 'html-to-markdown': 'dev-5', 'markdown-formatter': 'dev-5', 'markdown-toc': 'dev-5', 'markdown-to-image': 'dev-5', 'markdown-to-slides': 'dev-5', 'markdown-table-generator': 'dev-5', 'csv-to-markdown': 'dev-5',
  /* 正则 */
  'regex-tester': 'dev-6', 'regex-visualizer': 'dev-6',
  /* 时间·进制·位运算 */
  'timestamp-converter': 'dev-7', 'number-base-converter': 'dev-7', 'bitwise-calculator': 'dev-7',
  /* 网络与协议 */
  'url-parser': 'dev-8', 'cookie-parser': 'dev-8', 'curl-to-fetch': 'dev-8', 'user-agent-parser': 'dev-8', 'http-status-codes': 'dev-8', 'subnet-calculator': 'dev-8', 'mac-oui-lookup': 'dev-8', 'punycode-converter': 'dev-8', 'map-coordinate-converter': 'dev-8',
  /* 前端设计 */
  'color-converter': 'dev-9', 'css-gradient-generator': 'dev-9', 'box-shadow-generator': 'dev-9', 'border-radius-generator': 'dev-9', 'px-to-rem-converter': 'dev-9', 'color-contrast-checker': 'dev-9', 'svg-optimizer': 'dev-9',
  /* 建站小件 */
  'meta-tag-generator': 'dev-10', 'open-graph-generator': 'dev-10', 'robots-txt-generator': 'dev-10', 'placeholder-image': 'dev-10', 'slugify': 'dev-10',
  /* 运行·测试·数据 */
  'code-playground': 'dev-11', 'code-screenshot': 'dev-11', 'mock-json-generator': 'dev-11', 'fake-data-generator': 'dev-11', 'snowflake-id-generator': 'dev-11', 'file-type-detector': 'dev-11',
  /* 运维与配置 */
  'cron-explainer': 'dev-12', 'crontab-builder': 'dev-12', 'docker-run-to-compose': 'dev-12', 'chmod-calculator': 'dev-12',
  /* 对比与查询杂项 */
  'text-diff': 'dev-13', 'unicode-lookup': 'dev-13', 'keycode-lookup': 'dev-13', 'case-style-converter': 'dev-13', 'function-plotter': 'dev-13',
  /* 摘要·提取·问答 */
  'text-summarizer': 'ai-1', 'keyword-extractor': 'ai-1', 'entity-extractor': 'ai-1', 'question-answering': 'ai-1', 'chat-with-pdf': 'ai-1',
  /* 分析与改写 */
  'sentiment-analyzer': 'ai-2', 'emotion-detector': 'ai-2', 'grammar-corrector': 'ai-2', 'paraphraser': 'ai-2', 'translator': 'ai-2', 'text-similarity': 'ai-2', 'zero-shot-classifier': 'ai-2',
  /* 图像 AI */
  'image-classifier': 'ai-3', 'object-detector': 'ai-3', 'image-caption': 'ai-3',
  /* 休闲游戏 */
  'sudoku-solver': 'games-1', 'gomoku': 'games-1', 'snake': 'games-1', '2048': 'games-1', 'minesweeper': 'games-1', 'sliding-puzzle': 'games-1',
}
