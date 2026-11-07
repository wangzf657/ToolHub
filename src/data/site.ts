export const site = {
  name: '百宝工具箱',
  nameEn: 'ToolHub',
  slogan: '你的文件，永不离机',
  desc: '免费、纯本地的浏览器工具箱：图片、PDF、视频、音频、数据、开发与 AI，370+ 工具全部在本地运行。',
  toolCountLabel: '370+ 工具 · 100% 本地处理',
  /** GitHub 开源仓库地址（header/footer 入口共用） */
  repoUrl: 'https://github.com/wangzf657/ToolHub',
}

/** 首页四大特性卡 */
export const heroFeatures = [
  {
    icon: 'lock',
    title: '零上传',
    desc: '文件与文本只留在你的浏览器标签页里，不会传输到任何服务器。',
  },
  {
    icon: 'zap',
    title: '即时处理',
    desc: '没有排队。文件一拖进来，处理立刻开始。',
  },
  {
    icon: 'wifi-off',
    title: '离线可用',
    desc: '页面加载完成后，每个工具都能在断网状态下继续使用。',
  },
  {
    icon: 'infinity',
    title: '没有限制',
    desc: '没有文件大小上限、没有按次收费、也不会给你加水印。',
  },
]

/** 支持格式分组（首页展示） */
export const formatGroups = [
  { title: 'PDF 与文档', items: ['PDF (.pdf)', 'Markdown (.md)', '纯文本 (.txt)', 'Word (.docx)', 'Excel (.xlsx)', 'PowerPoint (.pptx)'] },
  { title: '图片', items: ['PNG (.png)', 'JPEG (.jpg)', 'WebP (.webp)', 'HEIC (.heic)', 'GIF (.gif)', 'SVG (.svg)', 'AVIF (.avif)', 'TIFF (.tif)'] },
  { title: '代码与数据', items: ['JSON (.json)', 'CSV (.csv)', 'YAML (.yaml)', 'TOML (.toml)', 'SQL (.sql)', 'XML (.xml)', 'Parquet (.parquet)'] },
  { title: '音视频', items: ['MP3 (.mp3)', 'WAV (.wav)', 'M4A (.m4a)', 'OGG (.ogg)', 'FLAC (.flac)', 'MP4 (.mp4)', 'WebM (.webm)', 'MOV (.mov)'] },
]

export const faqs = [
  {
    q: '百宝工具箱会把我的文件上传到服务器吗？',
    a: '不会。所有处理都在你的浏览器里完成：照片、PDF、文本都不会被发送到任何服务器，甚至不会短暂缓存。',
  },
  {
    q: '这些工具真的免费吗？',
    a: '是的。无需注册账号，没有按次收费，也不会给输出加水印。',
  },
  {
    q: '和一般「免费在线转换器」有什么不同？',
    a: '大多数在线转换器会先把你的文件上传到云端再处理；百宝工具箱直接在你已经打开的浏览器标签页里完成处理。对于身份证、合同、私人照片这类敏感文件，这是更强的隐私默认。',
  },
  {
    q: '可以离线使用吗？',
    a: '可以。工具页面加载完成后即可断网使用。少数重度能力（OCR、抠图、视频转码、语音转写）首次使用时会下载对应模型或编解码器，之后同样可以离线使用，页面会有明确标注。',
  },
  {
    q: '文件大小有限制吗？',
    a: '工具本身不设限制，处理能力取决于你设备的内存与算力。超大文件建议分批处理。',
  },
]
