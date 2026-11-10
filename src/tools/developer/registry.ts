import type { ToolDef, CalcResultRow } from '@/types'
import { jsonToJava } from '@/lib/jsEngine'
import { b64encode, b64decode, urlEncode, urlDecode, htmlEntityEncode, htmlEntityDecode, jsonEscapeEncode, jsonEscapeDecode, b32encode, b32decode } from '@/lib/textEngine'
import { formatJson, minifyJson, validateJson, jsonToYaml, yamlToJson, yamlToJsonHeavy, jsonToXml, xmlToJson, jsonToTs, jsonSchemaFrom, jsonPathQuery, generateMock, fakeRows, FAKE_FIELDS, uaParse, curlToFetch, HTTP_STATUS, formatXml, chmodToSymbol, chmodFromSymbol } from '@/lib/jsEngine'
import { bytesToBase64, bytesToLatin1, base64ToBytes, latin1ToBytes, convertIdentifier, CASE_TARGETS, type CaseTarget, parseCookieInput, cookieJsonToHeader, dockerRunToCompose, dockerComposeToRun, convertCoord, COORD_LABELS, outOfChina, type CoordSys } from '@/lib/devExt'

/** 开发工具注册表（92 项） */
const tools: ToolDef[] = [
  { slug: 'json-formatter', title: 'JSON 格式化校验', category: 'developer', desc: '粘贴 JSON 即时格式化、压缩与校验，错误定位到行列。', keywords: ['json', '格式化', '校验'], component: () => import('./components/JsonFormatter.vue'), steps: ['粘贴 JSON 文本', '选择格式化或压缩', '复制或下载结果'] },
  { slug: 'timestamp-converter', title: 'Unix 时间戳转换', category: 'developer', desc: '秒/毫秒时间戳与可读日期互转，本地与 UTC 双时区显示。', keywords: ['时间戳', 'unix', 'epoch'], component: () => import('./components/TimestampConverter.vue') },
  { slug: 'regex-tester', title: '正则表达式测试', category: 'developer', desc: '输入正则与标志位，实时高亮所有匹配与捕获组，附常用正则速查。', keywords: ['正则', 'regex', '匹配'], component: () => import('./components/RegexTester.vue') },
  { slug: 'text-diff', title: '文本差异对比', category: 'developer', desc: '逐行对比两段文本，绿色新增、红色删除，适合代码与文档审阅。', keywords: ['对比', 'diff', '差异'], component: () => import('./components/TextDiff.vue') },
  {
    slug: 'base64-encoder', title: 'Base64 编解码', category: 'developer',
    desc: '文本与 Base64 双向转换，完整支持 UTF-8 中文，也可编码文件。',
    keywords: ['base64', '编码', '解码'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '编码（文本 → Base64）' }, { value: 'decode', label: '解码（Base64 → 文本）' },
      ] }],
      transform: (t, o) => (o.dir === 'decode' ? b64decode(t) : b64encode(t)),
    },
  },
  {
    slug: 'url-encoder', title: 'URL 编解码', category: 'developer',
    desc: '对 URL 组件或整个地址进行百分号编码与解码，处理中文与特殊字符。',
    keywords: ['url', '编码', 'encode'],
    textDef: {
      options: [
        { key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
          { value: 'encode', label: '编码' }, { value: 'decode', label: '解码' },
        ] },
        { key: 'scope', label: '范围', type: 'select', default: 'component', choices: [
          { value: 'component', label: 'URI 组件（常用）' }, { value: 'full', label: '整个 URI' },
        ] },
      ],
      transform: (t, o) => (o.dir === 'decode' ? urlDecode(t, o.scope === 'component') : urlEncode(t, o.scope === 'component')),
    },
  },
  { slug: 'jwt-decoder', title: 'JWT 解析器', category: 'developer', desc: '解码 JWT 的 Header 与 Payload 为可读 JSON，校验过期时间，不发送令牌。', keywords: ['jwt', 'token', '解析'], component: () => import('./components/JwtDecoder.vue') },
  { slug: 'hash-generator', title: '哈希生成器', category: 'developer', desc: 'MD5、SHA-1/256/384/512 文本与文件哈希，一次算全部算法。', keywords: ['哈希', 'md5', 'sha256'], component: () => import('./components/HashGenerator.vue') },
  { slug: 'csv-to-json', title: 'CSV 转 JSON', category: 'developer', desc: 'CSV 转 JSON，支持自定义分隔符与表头识别，引号字段处理正确。', keywords: ['csv', 'json', '转换'], component: () => import('./components/CsvToJson.vue') },
  {
    slug: 'json-to-csv', title: 'JSON 转 CSV', category: 'developer',
    desc: 'JSON 对象数组转 CSV，自动提取所有键作为表头。',
    keywords: ['json', 'csv', '转换'],
    textDef: {
      options: [{ key: 'delim', label: '分隔符', type: 'select', default: ',', choices: [
        { value: ',', label: '逗号 ,' }, { value: ';', label: '分号 ;' }, { value: '\t', label: '制表符' },
      ] }],
      transform: (t, o) => {
        if (!t.trim()) return ''
        const data = JSON.parse(t)
        const arr: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
        if (!arr.length) return ''
        const cols = [...new Set(arr.flatMap((r) => Object.keys(r ?? {})))]
        const esc = (v: unknown) => {
          const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
          return new RegExp(`["\n\r]|${o.delim === '\t' ? '\\t' : String(o.delim).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }
        const lines = [cols.join(String(o.delim))]
        for (const r of arr) lines.push(cols.map((c) => esc(r[c])).join(String(o.delim)))
        return lines.join('\n')
      },
      placeholder: '粘贴 JSON 对象数组…',
    },
  },
  { slug: 'number-base-converter', title: '进制转换', category: 'developer', desc: '二、八、十、十六进制与任意 2–36 进制互转，支持大数。', keywords: ['进制', 'hex', 'binary'], component: () => import('./components/NumberBase.vue') },
  { slug: 'sql-formatter', title: 'SQL 格式化', category: 'developer', desc: '格式化杂乱 SQL 为缩进清晰的可读查询，支持多方言关键字风格。', keywords: ['sql', '格式化', 'beautify'], component: () => import('./components/SqlFormatter.vue') },
  { slug: 'javascript-formatter', title: 'JS 格式化 / 压缩', category: 'developer', desc: '用 Prettier 规则格式化 JavaScript，也可压缩去除空白与注释。', keywords: ['javascript', '格式化', 'prettier'], component: () => import('./components/CodeFormatter.vue'), steps: ['粘贴 JS 代码', '选择格式化或压缩', '复制结果'] },
  { slug: 'docx-to-markdown', title: 'Word 转 Markdown', category: 'developer', desc: 'docx 文档转为 Markdown：保留标题层级、列表、表格与加粗斜体。', keywords: ['word', 'docx', 'markdown', 'md'], component: () => import('./components/DocxToMarkdown.vue'), steps: ['拖入 .docx 文件', '自动转换', '复制或下载 .md'] },
  { slug: 'markdown-to-docx', title: 'Markdown 转 Word', category: 'developer', desc: 'Markdown 生成排版规范的 Word 文档：标题、列表、表格、代码块样式齐全。', keywords: ['markdown', 'md', 'word', 'docx'], component: () => import('./components/MarkdownToDocx.vue'), steps: ['粘贴或拖入 .md', '点「生成 Word 文档」', '下载 .docx'] },
  { slug: 'html-to-markdown', title: 'HTML 转 Markdown', category: 'developer', desc: '粘贴网页富文本即转 Markdown，表格/删除线/任务列表全支持，笔记迁移利器。', keywords: ['html', 'markdown', 'md', '富文本'], component: () => import('./components/HtmlToMarkdown.vue'), steps: ['Ctrl+V 粘贴网页内容', '自动转换', '复制或下载 .md'] },
  { slug: 'markdown-to-wechat', title: 'Markdown 公众号排版', category: 'developer', desc: 'Markdown 一键转公众号排版：内联样式不丢失，复制后直接粘贴后台。', keywords: ['公众号', 'markdown', '排版', '微信'], component: () => import('./components/MarkdownToWechat.vue'), steps: ['输入 Markdown 并选主题', '点「复制到公众号」', '粘贴进公众号后台'] },
  /* ---- P0 新增：运行器与 Markdown 全家桶 ---- */
  { slug: 'code-playground', title: '在线代码运行器', category: 'developer', desc: 'HTML/CSS/JS 三栏编辑，iframe 沙盒即时运行，console 输出与报错回显。', keywords: ['在线运行', 'playground', 'sandbox', 'js 运行'], component: () => import('./components/CodePlayground.vue'), steps: ['编辑 HTML / CSS / JS', '点「运行」即时预览', '控制台查看输出'] },
  { slug: 'json-to-excel', title: 'JSON 转 Excel', category: 'developer', desc: '对象数组一键转 xlsx 表格，嵌套字段拍平为 a.b.c 列，多数组自动分 sheet。', keywords: ['json', 'excel', 'xlsx', '表格'], component: () => import('./components/JsonToExcel.vue'), steps: ['粘贴 JSON 数组', '选择是否拍平嵌套', '下载 xlsx'] },
  /* ---- P1 新增：生态补全 ---- */
  { slug: 'regex-visualizer', title: '正则可视化', category: 'developer', desc: '正则转铁路结构图：序列、分支、量词、分组一眼看懂，支持下载 SVG。', keywords: ['正则', '可视化', 'regex', '铁路图'], component: () => import('./components/RegexVisualizer.vue'), steps: ['输入正则表达式', '点「可视化」', '下载 SVG 或对照阅读'] },
  { slug: 'color-converter', title: '颜色转换器', category: 'developer', desc: 'HEX/RGB/HSL/OKLCH/CMYK 任意格式互转，自动识别输入，一键复制。', keywords: ['颜色', 'hex', 'rgb', 'hsl', 'oklch'], component: () => import('./components/ColorConverter.vue'), steps: ['粘贴任意颜色格式', '自动识别并全量转换', '逐行复制'] },
  { slug: 'markdown-formatter', title: 'Markdown 格式化', category: 'developer', desc: 'Prettier 规范 Markdown：表格对齐、列表符号统一、标题空行规范化。', keywords: ['markdown', '格式化', 'prettier', '规范'], component: () => import('./components/MarkdownFormatter.vue'), steps: ['粘贴 Markdown', '选换行与列表规则', '复制规范输出'] },
  { slug: 'markdown-toc', title: 'Markdown 目录生成', category: 'developer', desc: '提取标题生成带锚点的目录（GitHub 规则），长文写作与文档站必备。', keywords: ['markdown', '目录', 'toc', '锚点'], component: () => import('./components/MarkdownToc.vue'), steps: ['粘贴 Markdown', '选层级与格式', '复制目录插回文档'] },
  { slug: 'markdown-to-image', title: 'Markdown 转长图', category: 'developer', desc: 'Markdown 渲染成知识卡片长图 PNG，主题可选，社区分享利器。', keywords: ['markdown', '长图', '卡片', '分享'], component: () => import('./components/MarkdownToImage.vue'), steps: ['输入 Markdown 选主题', '选宽度/透明底', '导出 PNG 长图'] },
  {
    slug: 'json-to-yaml', title: 'JSON 转 YAML', category: 'developer',
    desc: 'JSON 转 YAML，适合编写 Docker Compose、Kubernetes 与 CI 配置。',
    keywords: ['json', 'yaml', 'k8s'],
    textDef: { transform: (t) => jsonToYaml(t), placeholder: '粘贴 JSON…' },
  },
  {
    slug: 'yaml-to-json', title: 'YAML 转 JSON', category: 'developer',
    desc: 'YAML 配置转 JSON，支持嵌套映射、序列与常见标量类型。',
    keywords: ['yaml', 'json', '配置'],
    textDef: {
      transform: (t) => yamlToJson(t),
      placeholder: '粘贴 YAML…',
    },
  },
  {
    slug: 'json-to-xml', title: 'JSON 转 XML', category: 'developer',
    desc: 'JSON 转 XML，可自定义根元素名，供仍需 XML 的系统对接。',
    keywords: ['json', 'xml', '转换'],
    textDef: {
      options: [{ key: 'root', label: '根元素名', type: 'text', default: 'root' }],
      transform: (t, o) => jsonToXml(t, String(o.root || 'root')),
      placeholder: '粘贴 JSON…',
    },
  },
  {
    slug: 'xml-to-json', title: 'XML 转 JSON', category: 'developer',
    desc: '解析 XML 为 JSON 结构，属性以 @ 前缀保留，可直接粘贴到应用中。',
    keywords: ['xml', 'json', '解析'],
    textDef: { transform: (t) => xmlToJson(t), placeholder: '粘贴 XML…' },
  },
  {
    slug: 'json-escape', title: 'JSON 转义 / 反转义', category: 'developer',
    desc: '把任意文本转成合法 JSON 字符串字面量，或反转义回原文。',
    keywords: ['json', '转义', 'escape'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'escape', choices: [
        { value: 'escape', label: '转义（文本 → JSON 字符串）' }, { value: 'unescape', label: '反转义' },
      ] }],
      transform: (t, o) => (o.dir === 'unescape' ? jsonEscapeDecode(t) : jsonEscapeEncode(t)),
    },
  },
  { slug: 'toml-to-json', title: 'TOML 与 JSON 互转', category: 'developer',
    desc: 'TOML 配置转 JSON，也可把 JSON 序列化回 TOML，支持表格与类型化值。',
    keywords: ['toml', 'json', '配置'],
    component: () => import('./components/TomlConverter.vue'),
  },
  { slug: 'env-to-json', title: 'ENV 与 JSON 互转', category: 'developer', desc: '.env 文件转 JSON 对象，或 JSON 转回 .env 行，处理注释与引号。', keywords: ['env', 'dotenv', 'json'], component: () => import('./components/EnvToJson.vue') },
  { slug: 'base64-to-image', title: 'Base64 转图片', category: 'developer', desc: '粘贴 Base64 或 data URI，预览图片并下载为真实文件。', keywords: ['base64', '图片', 'data uri'], component: () => import('./components/Base64ToImage.vue') },
  {
    slug: 'base32-converter', title: 'Base32 编解码', category: 'developer',
    desc: 'RFC 4648 Base32 编码与解码，完整 UTF-8 支持，本地即时计算。',
    keywords: ['base32', '编码'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '编码' }, { value: 'decode', label: '解码' },
      ] }],
      transform: (t, o) => (o.dir === 'decode' ? b32decode(t) : b32encode(t)),
    },
  },
  {
    slug: 'html-entity-encoder', title: 'HTML 实体编解码', category: 'developer',
    desc: '把 < > & 引号转成 HTML 实体防止转义问题，或解码实体回原文。',
    keywords: ['html', '实体', 'entity'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'encode', choices: [
        { value: 'encode', label: '编码' }, { value: 'decode', label: '解码' },
      ] }],
      transform: (t, o) => (o.dir === 'decode' ? htmlEntityDecode(t) : htmlEntityEncode(t)),
    },
  },
  { slug: 'hmac-generator', title: 'HMAC 签名生成', category: 'developer', desc: '用共享密钥生成 HMAC-SHA1/256/512 签名，支持 Hex 与 Base64 输出。', keywords: ['hmac', '签名', 'secret'], component: () => import('./components/HmacGenerator.vue') },
  { slug: 'jwt-generator', title: 'JWT 生成器', category: 'developer', desc: '在浏览器中构建并签名 HS256/384/512 JWT，编辑头部与负载，即签即得。', keywords: ['jwt', '签名', '生成'], component: () => import('./components/JwtGenerator.vue') },
  { slug: 'json-diff', title: 'JSON 结构对比', category: 'developer', desc: '深度对比两份 JSON，列出所有新增、删除与修改的路径，适合接口评审。', keywords: ['json', '对比', 'diff'], component: () => import('./components/JsonDiff.vue') },
  { slug: 'markdown-preview', title: 'Markdown 预览', category: 'developer', desc: '输入 Markdown 实时渲染预览，可复制生成的 HTML 用于 CMS 或文档。', keywords: ['markdown', '预览', 'html'], component: () => import('./components/MarkdownPreview.vue') },
  { slug: 'markdown-table-generator', title: 'Markdown 表格生成', category: 'developer', desc: '在可编辑网格里填数据，实时生成对齐的 GFM 表格并复制。', keywords: ['markdown', '表格', 'table'], component: () => import('./components/MarkdownTable.vue') },
  {
    slug: 'csv-to-markdown', title: 'CSV 转 Markdown 表格', category: 'developer',
    desc: 'CSV 转 GitHub 风格 Markdown 表格，支持自定义分隔符与对齐方式。',
    keywords: ['csv', 'markdown', '表格'],
    textDef: {
      options: [
        { key: 'delim', label: 'CSV 分隔符', type: 'select', default: ',', choices: [{ value: ',', label: '逗号' }, { value: ';', label: '分号' }, { value: '\t', label: '制表符' }] },
        { key: 'align', label: '对齐', type: 'select', default: 'left', choices: [{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }] },
      ],
      transform: (t, o) => {
        const rows = t.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim()).map((l) => l.split(String(o.delim)).map((c) => c.replace(/^"|"$/g, '').trim()))
        if (!rows.length) return ''
        const align = String(o.align)
        const sepRow = rows[0].map(() => (align === 'center' ? ':---:' : align === 'right' ? '---:' : '---'))
        const fmt = (r: string[]) => `| ${r.join(' | ')} |`
        return [fmt(rows[0]), fmt(sepRow), ...rows.slice(1).map(fmt)].join('\n')
      },
      placeholder: '粘贴 CSV…',
    },
  },
  { slug: 'cron-explainer', title: 'Cron 表达式解读', category: 'developer', desc: '把 crontab 表达式翻译成中文说明，并给出接下来几次的执行时间。', keywords: ['cron', 'crontab', '定时'], component: () => import('./components/CronExplainer.vue') },
  { slug: 'crontab-builder', title: 'Cron 表达式构建', category: 'developer', desc: '用下拉菜单选择分钟、小时、日、月、星期，实时生成 cron 表达式与说明。', keywords: ['cron', '构建', '定时'], component: () => import('./components/CrontabBuilder.vue') },
  { slug: 'bitwise-calculator', title: '位运算计算器', category: 'developer', desc: 'AND/OR/XOR/NOT 与左右移位，十进制、十六进制、二进制同时显示。', keywords: ['位运算', 'xor', 'shift'], component: () => import('./components/BitwiseCalculator.vue') },
  { slug: 'chmod-calculator', title: 'Chmod 权限计算', category: 'developer', desc: '勾选属主/组/其他的读写执行权限，实时得到八进制、符号式与命令。', keywords: ['chmod', '权限', 'linux'], component: () => import('./components/ChmodCalculator.vue') },
  { slug: 'subnet-calculator', title: '子网计算器', category: 'developer', desc: '输入 IPv4 与 CIDR，得到网络地址、广播、掩码、可用主机范围与数量。', keywords: ['子网', 'cidr', '网络'], component: () => import('./components/SubnetCalculator.vue') },
  { slug: 'css-formatter', title: 'CSS 格式化 / 压缩', category: 'developer', desc: '整理 CSS 缩进或压缩为生产版本，同一工具双向切换。', keywords: ['css', '格式化', '压缩'], component: () => import('./components/CodeFormatter.vue') },
  { slug: 'html-formatter', title: 'HTML 格式化', category: 'developer', desc: '缩进杂乱的 HTML 标记，或压缩去除注释与冗余空白。', keywords: ['html', '格式化'], component: () => import('./components/CodeFormatter.vue') },
  { slug: 'html-minifier', title: 'HTML 压缩', category: 'developer', desc: '删除注释与多余空白减小 HTML 体积，随时可再格式化还原可读性。', keywords: ['html', '压缩', 'minify'], component: () => import('./components/CodeFormatter.vue') },
  { slug: 'xml-formatter', title: 'XML 格式化', category: 'developer', desc: 'XML 美化缩进或压缩，边输入边捕获解析错误，适合 Feed 与配置。', keywords: ['xml', '格式化'], component: () => import('./components/XmlFormatter.vue') },
  { slug: 'graphql-formatter', title: 'GraphQL 格式化', category: 'developer', desc: '美化或压缩 GraphQL 查询、变更与 SDL schema，大括号自动缩进。', keywords: ['graphql', '格式化'], component: () => import('./components/GraphqlFormatter.vue') },
  { slug: 'svg-optimizer', title: 'SVG 优化器', category: 'developer', desc: '去除 SVG 元数据、注释与多余小数位，实时对比优化前后体积。', keywords: ['svg', '优化', '压缩'], component: () => import('./components/SvgOptimizer.vue') },
  { slug: 'color-contrast-checker', title: '对比度检查器', category: 'developer', desc: '检测前景与背景色对比度是否达到 WCAG AA / AAA，实时预览。', keywords: ['对比度', 'wcag', '无障碍'], component: () => import('./components/ContrastChecker.vue') },
  { slug: 'css-gradient-generator', title: 'CSS 渐变生成', category: 'developer', desc: '可视化构建线性/径向渐变，实时预览并复制 CSS 代码。', keywords: ['渐变', 'gradient', 'css'], component: () => import('./components/GradientGenerator.vue') },
  { slug: 'box-shadow-generator', title: '阴影生成器', category: 'developer', desc: '调节偏移、模糊、扩散、颜色与内阴影，实时预览并复制 box-shadow。', keywords: ['阴影', 'shadow', 'css'], component: () => import('./components/BoxShadow.vue') },
  { slug: 'border-radius-generator', title: '圆角生成器', category: 'developer', desc: '分别设置四角半径或联动调整，实时预览并复制 border-radius。', keywords: ['圆角', 'radius', 'css'], component: () => import('./components/BorderRadius.vue') },
  { slug: 'px-to-rem-converter', title: 'PX/REM 换算', category: 'developer', desc: '以任意根字号在 px 与 rem/em 之间双向换算，附常用值参考表。', keywords: ['px', 'rem', 'css'], component: () => import('./components/PxRemConverter.vue') },
  { slug: 'meta-tag-generator', title: 'Meta 标签生成', category: 'developer', desc: '填写标题、描述与 robots 生成可直接粘贴的 meta 标签组。', keywords: ['meta', 'seo', '标签'], component: () => import('./components/MetaTagGenerator.vue') },
  { slug: 'open-graph-generator', title: 'Open Graph 生成', category: 'developer', desc: '构建 og: 与 Twitter Card 标签，让分享链接展示正确的标题与图。', keywords: ['og', '分享', 'twitter'], component: () => import('./components/OpenGraphGenerator.vue') },
  { slug: 'robots-txt-generator', title: 'robots.txt 生成', category: 'developer', desc: '配置抓取规则、允许/禁止路径与站点地图，生成 robots.txt。', keywords: ['robots', '爬虫', 'seo'], component: () => import('./components/RobotsTxtGenerator.vue') },
  { slug: 'url-parser', title: 'URL 解析器', category: 'developer', desc: '拆解 URL 的协议、主机、路径、查询参数与哈希，便于调试跳转。', keywords: ['url', '解析', 'query'], component: () => import('./components/UrlParser.vue') },
  { slug: 'curl-to-fetch', title: 'cURL 转 fetch', category: 'developer', desc: '把 DevTools 或文档里的 cURL 命令转成等价的 fetch() 代码。', keywords: ['curl', 'fetch', 'api'], component: () => import('./components/CurlToFetch.vue') },
  { slug: 'json-to-typescript', title: 'JSON 生成 TS 类型', category: 'developer', desc: '从 JSON 推断 TypeScript 接口，处理嵌套对象、数组与可选字段。', keywords: ['json', 'typescript', 'interface'], component: () => import('./components/JsonToTypescript.vue') },
  { slug: 'json-schema-generator', title: 'JSON Schema 生成', category: 'developer', desc: '由示例 JSON 推断 draft-07 Schema：类型、嵌套属性、数组项与必填键。', keywords: ['schema', 'json schema', '校验'], component: () => import('./components/JsonSchemaGenerator.vue') },
  { slug: 'jsonpath-tester', title: 'JSONPath 测试器', category: 'developer', desc: '对 JSON 运行 JSONPath 查询，支持 $、点号、[i]、[*]、通配与递归 ..。', keywords: ['jsonpath', '查询', '测试'], component: () => import('./components/JsonPathTester.vue') },
  { slug: 'mock-json-generator', title: 'Mock 数据生成', category: 'developer', desc: '用 {{name}}、{{email}}、{{int:1-100}} 等令牌定义模板，批量生成模拟数据。', keywords: ['mock', '假数据', '测试'], component: () => import('./components/MockJsonGenerator.vue') },
  { slug: 'fake-data-generator', title: '假数据生成器', category: 'developer', desc: '生成姓名、邮箱、手机、地址、公司等中文假数据行，导出 JSON/CSV。', keywords: ['假数据', '测试数据', 'faker'], component: () => import('./components/FakeDataGenerator.vue') },
  { slug: 'user-agent-parser', title: 'UA 解析器', category: 'developer', desc: '解析 User-Agent 为浏览器、引擎、系统与设备类型，自动填入当前 UA。', keywords: ['user-agent', 'ua', '解析'], component: () => import('./components/UaParser.vue') },
  { slug: 'unicode-lookup', title: 'Unicode 字符查询', category: 'developer', desc: '查询字符的码点、Unicode 区块、HTML 实体与十进制值，支持反查。', keywords: ['unicode', '码点', '字符'], component: () => import('./components/UnicodeLookup.vue') },
  { slug: 'http-status-codes', title: 'HTTP 状态码速查', category: 'developer', desc: '1xx–5xx 全部状态码的可搜索速查表，含中文名与场景说明。', keywords: ['http', '状态码', '404'], component: () => import('./components/HttpStatusCodes.vue') },
  { slug: 'placeholder-image', title: '占位图生成', category: 'developer', desc: '自定义尺寸、背景与文字颜色的占位图，实时预览并下载 PNG。', keywords: ['占位图', 'placeholder', 'mock'], component: () => import('./components/PlaceholderImage.vue') },
  { slug: 'slugify', title: 'Slug 生成器', category: 'developer', desc: '把标题转成 URL 友好的 slug：去重音、转小写、自定义分隔符。', keywords: ['slug', 'url', 'seo'], component: () => import('./components/SlugGenerator.vue') },
  { slug: 'encoding-converter', title: '文本编码检测与转换', category: 'developer', desc: '自动识别 GBK/GB18030/Big5/UTF-8 等编码并互转，专治 txt/CSV 打开乱码。', keywords: ['编码', 'GBK', '乱码', 'UTF-8', '转码'], needModel: true, component: () => import('./components/EncodingConverter.vue') },
  { slug: 'code-screenshot', title: '代码截图美化', category: 'developer', desc: '粘贴代码生成 Carbon 风格卡片：主题、窗口条、渐变背景，导出高清 PNG。', keywords: ['代码截图', 'carbon', '代码图片', '分享'], component: () => import('./components/CodeScreenshot.vue') },
  {
    slug: 'json-to-java-entity', title: 'JSON 转 Java 实体类', category: 'developer',
    desc: 'JSON 生成 Java POJO（可选 Lombok），嵌套对象自动拆子类，后端开发提效。',
    keywords: ['json', 'java', 'pojo', '实体类'],
    textDef: {
      options: [
        { key: 'cls', label: '根类名', type: 'text', default: 'Demo', placeholder: '如 User' },
        { key: 'lombok', label: '使用 Lombok @Data', type: 'toggle', default: true },
      ],
      placeholder: '粘贴 JSON（顶层对象或对象数组），生成 Java 实体类…',
      transform: (t, o) => jsonToJava(t, String(o.cls || 'Demo'), o.lombok !== false),
    },
  },
  /* ---- P2 新增：开发者进阶工具 17 件 ---- */
  { slug: 'totp-generator', title: 'TOTP 动态口令', category: 'developer', desc: '粘贴 otpauth:// 链接或输入 Base32 密钥，实时生成 6/8 位两步验证码并自动倒计时换码。', keywords: ['totp', '两步验证', '动态口令', '2fa', 'otp', '验证码'], component: () => import('./components/TotpGenerator.vue'), steps: ['粘贴 otpauth:// 链接或手动填密钥', '自动生成当前口令并倒计时', '一键复制，超时自动换码'] },
  { slug: 'bcrypt-hash', title: 'Bcrypt 哈希生成验证', category: 'developer', desc: '浏览器本地生成 bcrypt 密码哈希（4–15 轮可调），并支持哈希与明文的匹配校验。', keywords: ['bcrypt', '哈希', '密码', '加密', 'salt'], component: () => import('./components/BcryptTool.vue'), steps: ['输入密码选择轮次生成哈希', '复制 $2b$ 开头的哈希入库（$2a$ 为旧变体）', '粘贴哈希验证明文是否匹配'] },
  { slug: 'rsa-key-generator', title: 'RSA 密钥对生成', category: 'developer', desc: '浏览器本地生成 2048/4096 位 RSA 密钥对，导出 PEM 公私钥，可下载保存。', keywords: ['rsa', '密钥', 'pem', '公钥', '私钥', 'ssh'], component: () => import('./components/RsaKeyGenerator.vue'), steps: ['选择密钥长度', '点击生成（4096 位需等待）', '复制或下载 PEM 文件'] },
  { slug: 'pgp-encrypt', title: 'PGP 加密解密', category: 'developer', desc: '文本 PGP 加密解密，支持密码与公钥两种模式，可生成 ECC/RSA 密钥对。', keywords: ['pgp', 'gpg', '加密', '解密', 'openpgp', '密钥'], component: () => import('./components/PgpTool.vue'), steps: ['选加密/解密/生成密钥', '首次使用自动加载 OpenPGP 引擎', '复制或下载 .asc 结果'] },
  {
    slug: 'gzip-compress', title: 'Gzip 压缩解压', category: 'developer',
    desc: '文本与 gzip/deflate 压缩串互转，输出 Base64 或 Latin1，排查压缩问题利器。',
    keywords: ['gzip', '压缩', '解压', 'deflate', 'pako', 'zlib'],
    textDef: {
      options: [
        { key: 'dir', label: '方向', type: 'select', default: 'compress', choices: [
          { value: 'compress', label: '压缩（文本 → 压缩串）' }, { value: 'decompress', label: '解压（压缩串 → 文本）' },
        ] },
        { key: 'algo', label: '算法', type: 'select', default: 'gzip', choices: [
          { value: 'gzip', label: 'gzip（带头部，最通用）' }, { value: 'deflate', label: 'deflate（zlib 头）' }, { value: 'deflateRaw', label: 'deflateRaw（纯数据流）' },
        ] },
        { key: 'enc', label: '压缩串编码', type: 'select', default: 'base64', choices: [
          { value: 'base64', label: 'Base64' }, { value: 'latin1', label: 'Latin1 二进制字符串' },
        ] },
      ],
      transform: async (t, o) => {
        const pako = await import('pako')
        try {
          if (o.dir === 'compress') {
            const bytes = new TextEncoder().encode(t)
            const out = o.algo === 'gzip' ? pako.gzip(bytes) : o.algo === 'deflate' ? pako.deflate(bytes) : pako.deflateRaw(bytes)
            return o.enc === 'base64' ? bytesToBase64(out) : bytesToLatin1(out)
          }
          const bytes = o.enc === 'base64' ? base64ToBytes(t) : latin1ToBytes(t)
          const out = o.algo === 'gzip' ? pako.ungzip(bytes) : o.algo === 'deflate' ? pako.inflate(bytes) : pako.inflateRaw(bytes)
          return new TextDecoder().decode(out)
        } catch (e) {
          throw new Error(o.dir === 'decompress'
            ? `解压失败：输入不是合法的${o.enc === 'base64' ? ' Base64' : ''}压缩串或已损坏，且需与压缩算法一致（${(e as Error).message}）`
            : `压缩失败：${(e as Error).message}`)
        }
      },
      placeholder: '输入要压缩的文本，或粘贴压缩串进行解压…',
    },
  },
  {
    slug: 'docker-run-to-compose', title: 'Docker Run 转 Compose', category: 'developer',
    desc: 'docker run 命令转 compose v3 配置，支持反向还原，端口/卷/环境变量全解析。',
    keywords: ['docker', 'compose', '容器', 'yaml', 'dockerfile'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'toCompose', choices: [
        { value: 'toCompose', label: 'docker run → compose' }, { value: 'toRun', label: 'compose → docker run' },
      ] }],
      transform: (t, o) => (o.dir === 'toCompose' ? dockerRunToCompose(t) : dockerComposeToRun(t)),
      placeholder: '粘贴完整 docker run 命令或 compose 服务配置…',
    },
  },
  {
    slug: 'code-minifier', title: 'JS/CSS 压缩混淆', category: 'developer',
    desc: 'terser 压缩 JS（mangle+compress），csso 压缩 CSS，自动识别语言并报告压缩率。',
    keywords: ['压缩', 'minify', 'terser', '混淆', 'css', 'js'],
    textDef: {
      options: [{ key: 'lang', label: '语言', type: 'select', default: 'auto', choices: [
        { value: 'auto', label: '自动识别' }, { value: 'js', label: 'JavaScript（terser）' }, { value: 'css', label: 'CSS（csso）' },
      ] }],
      transform: async (t, o) => {
        if (!t.trim()) return ''
        const cssHits = (t.match(/[{;]\s*[-\w]+\s*:\s*[^;{}]+;/g) ?? []).length + (t.match(/@(media|import|charset|font-face|keyframes|supports)\b/g) ?? []).length
        const jsHits = (t.match(/\b(function|const|let|var|return|import|export|class)\b|=>/g) ?? []).length
        const isCss = o.lang === 'css' || (o.lang === 'auto' && cssHits > jsHits)
        let out: string
        try {
          if (isCss) {
            const csso = await import('csso')
            out = csso.minify(t).css
          } else {
            const { minify } = await import('terser')
            const r = await minify(t, { module: true, compress: true, mangle: true, format: { comments: false } })
            out = r.code ?? ''
          }
        } catch (e) {
          throw new Error(`压缩失败：${(e as Error).message}（请确认代码语法正确，或手动指定语言）`)
        }
        const a = new Blob([t]).size
        const b = new Blob([out]).size
        const pct = a > 0 ? Math.round((1 - b / a) * 1000) / 10 : 0
        return `${out}\n\n/* 压缩统计（${isCss ? 'CSS/csso' : 'JS/terser'}）：${a} B → ${b} B，减小 ${pct}% */`
      },
      placeholder: '粘贴 JS 或 CSS 代码，自动压缩…',
    },
  },
  { slug: 'json-visualizer', title: 'JSON 可视化树', category: 'developer', desc: 'JSON 渲染为可折叠树：类型着色、搜索高亮、点击复制路径，超大数据懒展开。', keywords: ['json', '可视化', '树', '查看器', 'viewer', '折叠'], component: () => import('./components/JsonVisualizer.vue'), steps: ['粘贴 JSON 自动解析', '搜索键名自动展开高亮', '点击键名复制 a.b[0].c 路径'] },
  {
    slug: 'map-coordinate-converter', title: '地图坐标系转换', category: 'developer',
    desc: 'WGS84/GCJ02/BD09 经纬度互转，支持批量粘贴，公开纠偏算法本地计算。',
    keywords: ['坐标系', '火星坐标', 'gcj02', 'bd09', 'wgs84', '经纬度', '地图'],
    calcDef: {
      fields: [
        { key: 'input', label: '经纬度输入（每行一个「经度,纬度」，可批量）', type: 'text', default: '', placeholder: '如 116.404,39.915' },
        { key: 'from', label: '输入坐标系', type: 'select', default: 'wgs84', choices: [
          { value: 'wgs84', label: 'WGS84（GPS 原始坐标）' },
          { value: 'gcj02', label: 'GCJ02（火星坐标：高德/腾讯）' },
          { value: 'bd09', label: 'BD09（百度坐标）' },
        ] },
      ],
      compute: (v) => {
        const lines = String(v.input ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200)
        if (!lines.length) return [{ label: '请输入经纬度', value: '每行一个「经度,纬度」，如 116.404,39.915' }]
        const from = String(v.from) as CoordSys
        const rows: CalcResultRow[] = []
        let outOfCn = false
        lines.forEach((line, idx) => {
          const nums = line.split(/[,，\s]+/).map(Number)
          const lon = nums[0], lat = nums[1]
          if (nums.length < 2 || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat!) > 90 || Math.abs(lon!) > 180) {
            rows.push({ label: `第 ${idx + 1} 行`, value: '格式不合法：应为「经度,纬度」，纬度 ±90、经度 ±180 内' })
            return
          }
          for (const to of ['wgs84', 'gcj02', 'bd09'] as const) {
            const r = convertCoord(lon!, lat!, from, to)
            const mark = to === from ? '（原坐标系）' : ''
            rows.push({
              label: `第 ${idx + 1} 行 · ${COORD_LABELS[to].split('（')[0]}`,
              value: `${r.lon.toFixed(6)}, ${r.lat.toFixed(6)}${mark}`,
              primary: idx === 0 && to !== from,
            })
          }
          if (outOfChina(lon!, lat!)) outOfCn = true
        })
        if (outOfCn) rows.push({ label: '提示', value: '检测到中国境外坐标：纠偏算法仅对中国大陆生效，境外各坐标系结果一致' })
        return rows
      },
      note: '口径：公开纠偏算法。GCJ02 为国测局加偏的「火星坐标」（高德/腾讯地图），BD09 在 GCJ02 基础上二次加偏（百度地图），WGS84 为 GPS 原始值（海外地图/卫星影像）；WGS84↔GCJ02 反算采用迭代逼近，误差约 1 米。',
    },
  },
  {
    slug: 'punycode-converter', title: '中文域名转码', category: 'developer',
    desc: '中文域名与 xn-- Punycode 双向转换（IDN），支持批量，附 URL 合法性校验。',
    keywords: ['punycode', '中文域名', 'idn', 'xn--', '域名'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'toAscii', choices: [
        { value: 'toAscii', label: '中文域名 → xn-- 编码' }, { value: 'toUnicode', label: 'xn-- → 中文域名' },
      ] }],
      transform: async (t, o) => {
        const mod = await import('punycode.js')
        const p = mod.default ?? (mod as unknown as typeof mod.default)
        const fn = o.dir === 'toAscii' ? p.toASCII : p.toUnicode
        return t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
          try {
            const r = fn(l)
            if (o.dir === 'toAscii') {
              // 浏览器 URL API 校验：转换结果必须能构成合法 URL 才可直接用于解析
              try {
                new URL(`http://${r}`)
                return r
              } catch {
                return `${r}（未通过 URL 校验：含非法字符或格式不完整）`
              }
            }
            return r
          } catch {
            return `${l}（无法转换，请检查是否为合法域名）`
          }
        }).join('\n')
      },
      placeholder: '每行一个域名，如 百度.示例 或 xn--fsq092h…',
    },
  },
  { slug: 'mac-oui-lookup', title: 'MAC 厂商查询', category: 'developer', desc: '按 OUI 前缀查 MAC 地址厂商，支持批量与 EUI-64 展开，识别随机化地址。', keywords: ['mac', 'oui', '厂商', '网卡', 'eui64', 'ipv6'], needModel: true, component: () => import('./components/MacOuiLookup.vue'), steps: ['输入或批量粘贴 MAC 地址', '首次自动加载厂商库（约 2MB）', '查看厂商与 EUI-64 展开结果'] },
  { slug: 'file-type-detector', title: '文件真实类型检测', category: 'developer', desc: '按魔数识别文件真实 MIME 与扩展名，与文件名扩展名比对，识破伪装后缀。', keywords: ['文件类型', 'mime', '魔数', 'magic', '伪装'], component: () => import('./components/FileTypeDetector.vue'), steps: ['拖入一个或多个文件', '自动读取文件头魔数比对', '查看真实类型与扩展名是否一致'] },
  { slug: 'snowflake-id-generator', title: '雪花 ID 生成解析', category: 'developer', desc: '批量生成 64 位雪花 ID（可配机器位与 epoch），支持从 ID 反查生成时间。', keywords: ['雪花id', 'snowflake', '分布式', 'id 生成', '时间戳'], component: () => import('./components/SnowflakeTool.vue'), steps: ['配置数据中心/机器 ID 与 epoch', '批量生成并复制', '粘贴 ID 反查生成时间'] },
  {
    slug: 'case-style-converter', title: '变量命名风格转换', category: 'developer',
    desc: 'snake_case、camelCase、PascalCase、kebab-case、CONSTANT_CASE 五种风格批量互转。',
    keywords: ['命名', 'camelcase', 'snake_case', 'kebab', '变量名', '驼峰'],
    textDef: {
      options: [{ key: 'target', label: '目标风格', type: 'select', default: 'camel', choices: CASE_TARGETS.map((c) => ({ value: c.value, label: `${c.label}（如 ${c.example}）` })) }],
      transform: (t, o) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => convertIdentifier(l, o.target as CaseTarget)).join('\n'),
      placeholder: '每行一个变量名，任何风格皆可，如 user_name、userName、UserName、user-name…',
    },
  },
  {
    slug: 'cookie-parser', title: 'Cookie 解析构建', category: 'developer',
    desc: 'Cookie 字符串与 JSON 互转，Set-Cookie 属性（Domain/Expires/HttpOnly…）完整拆解。',
    keywords: ['cookie', 'set-cookie', 'httponly', 'samesite', '解析'],
    textDef: {
      options: [{ key: 'dir', label: '方向', type: 'select', default: 'parse', choices: [
        { value: 'parse', label: 'Cookie / Set-Cookie → JSON' }, { value: 'build', label: 'JSON → Cookie 字符串' },
      ] }],
      transform: (t, o) => (o.dir === 'build' ? cookieJsonToHeader(t) : parseCookieInput(t)),
      placeholder: '粘贴 document.cookie 串、Set-Cookie 响应头（可多行）或 JSON…',
    },
  },
  { slug: 'keycode-lookup', title: '按键KeyCode查询', category: 'developer', desc: '按下任意键实时显示 event.key、event.code、keyCode 三元组与修饰键，附速查表。', keywords: ['keycode', '键盘', '按键', 'event', '快捷键'], component: () => import('./components/KeycodeLookup.vue'), steps: ['点击捕获区获得焦点', '按下任意键查看三元组', '下方速查表可搜索'] },
  { slug: 'function-plotter', title: '函数图像绘制', category: 'developer', desc: '多条 y=f(x) 曲线同图绘制：滚轮缩放、悬停取值、mathjs 表达式，导出 PNG。', keywords: ['函数', '绘图', '图表', 'plot', '数学', '曲线'], component: () => import('./components/FunctionPlotter.vue'), steps: ['每行输入一条表达式如 sin(x)*x^2', '调整范围或滚轮缩放', '悬停取值，导出 PNG'] },
  { slug: 'markdown-to-slides', title: 'Markdown 转幻灯片', category: 'developer', desc: '用 --- 分页的 Markdown 导出为零依赖单文件 HTML 幻灯片，方向键翻页。', keywords: ['幻灯片', 'slides', '演示', 'ppt'], component: () => import('./components/MarkdownToSlides.vue') },
]

export default tools