import type { ToolDef } from '@/types'
import { b64encode, b64decode, urlEncode, urlDecode, htmlEntityEncode, htmlEntityDecode, jsonEscapeEncode, jsonEscapeDecode, b32encode, b32decode } from '@/lib/textEngine'
import { formatJson, minifyJson, validateJson, jsonToYaml, yamlToJson, yamlToJsonHeavy, jsonToXml, xmlToJson, jsonToTs, jsonSchemaFrom, jsonPathQuery, generateMock, fakeRows, FAKE_FIELDS, uaParse, curlToFetch, HTTP_STATUS, formatXml, chmodToSymbol, chmodFromSymbol } from '@/lib/jsEngine'

/** 开发工具注册表（60 项） */
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
]

export default tools
void validateJson
void minifyJson
void formatJson
void jsonSchemaFrom
void jsonPathQuery
void generateMock
void fakeRows
void uaParse
void curlToFetch
void HTTP_STATUS
void formatXml
void chmodToSymbol
void chmodFromSymbol
