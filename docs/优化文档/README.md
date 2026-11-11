# ToolHub 全站 520 工具 UX 评估与优化处方（总纲）

> 目标：**赋予每个工具"灵魂"。标准不是"能用"，而是"好用"——愿景是每个工具都向相关领域最强产品看齐。**
> 本目录为 2026-11-11 启动的全站体验评估工程产出。只评估、只开处方，不改任何业务代码。
> 每个工具一份独立档案：`<分类>/<slug>.md`；每个分类一份共性汇总：`<分类>/_汇总.md`。

---

## 一、背景：全站结构性痛点（为什么 JSON 格式化"没法看"）

2026-11 代码审计已定位五条**全局性根因**（详见 `_布局审计底稿.md`，评估每个工具时都要对照它判断"病灶是个性的还是共性的"）：

1. **竖向预算被装饰层吃掉**：sticky 页头 60px + 面包屑/H1/隐私徽章/间距 ≈185px + 面板 padding 22px，**工具第一个控件出现在视口顶下约 266px**，768px 笔记本首屏被消耗约 35%。
2. **高度策略普遍"固定值 + 内部滚动"**：`ResultBox.vue` 把 `height` 钉死在 `minHeight`（默认 180px）；全站 60+ 处 `max-height`（96px~560px）；除 4 个工作室（52~74vh）外**没有任何一处结果区用弹性高度**。用户点名的 JSON 格式化结果区只有 320px。
3. **右侧常驻 300px TrustSidebar**：工具面板被压掉 1/4 宽度，工作室画布中栏实际仅剩 400~500px。
4. **全站无 sticky 操作条**：执行按钮一律在内容流底部，叠加根因 1，"先下滑才能点执行"是结构性的。
5. **响应式断点碎片化**：520/560/760/860/900/960/1100 七种并存，跨工具体验不一致。

全站 6 种布局模式（A TextTool 双栏×42｜B CalcTool 表单×67｜C 单列堆叠文件流｜D grid-2+ResultBox｜E 三栏工作室×4｜F notice 条即结果）各自的典型风险见 `_布局审计底稿.md`。

## 二、七维评分口径（沿用 docs/测试要求.md 阶段六，满分 100）

| 维度 | 权重 | 评什么（锚点提示） |
|---|---|---|
| 功能完善性 | 20 | 对标同类 top 的功能面：子功能/选项/批量/导入导出/历史记录/边界覆盖 |
| 可用性 | 20 | **结果/预览区足够大且可读；主功能区占视口主体；核心控件无需下滑即可触达；错误可理解可恢复**——这是本轮最高权重红线，用户点名的问题都算这里 |
| 实用价值 | 15 | 输出质量、真实场景价值、与站内其他工具重复度 |
| 交互便捷性 | 15 | 步骤数、默认值合理、实时预览、一键复制/下载、偏好记忆 |
| UI 美观性 | 10 | 对齐/间距/层次/全站一致性/响应式/暗色 |
| 灵魂度 | 20 | 粘贴即处理、空态引导、快捷键、骨架/进度反馈、贴心文案、"懂我"的小细节 |
| 结论 | — | 保持现状 / 交互优化 / 需拓展 / 阉割（可组合，如"交互优化 + 拓展"） |

**附加 2 维**（记录分数、不计入加权总分，用于全站模式分析）：大文件与性能体验（10）、移动端适配（10）。

### 分数锚点

- **90~100** 行业第一梯队，与领域最强无感差距
- **75~89** 良好，有明确可追的差距
- **60~74** 及格但存在明显体验硬伤（可用性硬伤基本落在这段以下）
- **40~59** 差，勉强能完成任务但劝退
- **<40** 不可用级

### 结论判据

- ≥85 且无可用性硬伤 → **保持现状**
- 70~84，或有可用性扣分 → **交互优化**
- 相比标杆子功能缺失悬殊 → **需拓展**（可与交互优化组合）
- 高度重复或实用价值 <40 → **阉割**（下架或并入其他工具）

### 优先级

- **P0**：可用性硬伤（结果区不可读/核心控件下滑才可达/主功能区过小），用户点名问题属此类
- **P1**：交互摩擦明显、与对标差距大的单点改造
- **P2**：锦上添花、拓展功能

## 三、评分纪律（红线）

1. **证据必须具体**：每个扣分点挂 `file:line`（组件源码）或 `_实测锚点.md` 编号（实测），不得凭印象。
2. **对标产品必须真实存在**，写入下面对标库或经 WebSearch 核实，不得虚构。
3. **区分两类天花板**：
   - *纯浏览器可实现*（Squoosh、JSON Crack、Photopea、regex101 这类）——**这是对齐目标**，"达不到"就是真差距；
   - *依赖云端/大模型*（remove.bg 级抠图、DeepL 级翻译、Grammarly 级纠错）——标注"架构天花板"，但**要给出纯前端能逼近的最佳实践**（如 transformers.js 模型、更好的启发式算法、UI 上诚实标注能力边界）。
4. **只评估不修复**：发现的功能 Bug 记入该工具档案"扣分点"并注明疑似功能问题，交用户决定；本工程不改任何业务代码。
5. 已知功能缺陷（BUG-30 编辑器重复卡、REG-01 数据集列表压扁等）已于 df29be8 修复——评估时验证修复质量，不要重报旧账。
6. 评分分布应近似正态：全站中位预期 55~75。若某批大面积 85+ 或 40-，视为口径漂移，回炉。

## 四、行业对标库（按领域，均为真实可查产品）

> 评估时先查本库；未覆盖的工具用 WebSearch 找领域 top 并回填本库。标注（云）的为云端 SaaS，标注天花板时按第三节规则 3 处理。

### 图片
- **Squoosh**（squoosh.app，纯前端压缩天花板）：拖图即压、左右分屏对比滑块、多编码器（mozjpeg/avif/webp）、质量实时可调可看体积
- **TinyPNG/TinyJPG**（云）：极致简单、批量 20 张、体积压缩率标杆
- **remove.bg**（云 AI）：3 秒出图、前景/背景选择、API；PhotoRoom（云 AI）
- **ezgif**：GIF 全能站（逐帧/裁剪/压缩/转格式），功能全但 UI 老旧——"功能完整性超过它 + UI 好于它"是合理愿景
- **Photopea**（纯前端 PhotoShop 天花板）：全图层、全格式（含 PSD）
- **PhotoRoom / 稿定设计**：证件照、抠图换背景的商业标杆
- **Coolors.co / Adobe Color**：配色提取与方案生成标杆
- **shots.so / Screenshot.rocks**（纯前端）：截图套壳美化标杆
- **exif.tools / The Exif Tool**：EXIF 查看/清除
- **favicon.io / realfavicongenerator.net**：favicon 生成全套
- **text-image.com / picascii**：ASCII 字符画
- **CloudConvert**（云）：格式转换全能王（300+ 格式）

### PDF
- **iLovePDF**：行业流量王，全家桶+UI 流畅，批量、页缩略图、拖拽排序是标配
- **SmallPDF**：体验最精致的 PDF 全家桶
- **PDF24 Tools**：免费全能（30+ 工具），桌面级功能在线化
- **Sejda**：编辑/签名/表单能力强，工作台交互好
- **Stirling PDF**（开源自托管）：功能最全的开源标杆
- **ocrmypdf**（开源 CLI）：扫描件 OCR 可搜索化标杆
- **Adobe Acrobat Pro**：贝茨编号/红条遮盖/表单的专业标准
- **DocuSign / Smallpdf eSign**：签名流程标杆

### 实用
- **草料二维码**（cli.im）：国内二维码王者——活码、批量、艺术码、扫码统计
- **QRCode Monkey**：艺术二维码（logo 融入、形状渐变）
- **ConvertLive / unitconversion.io**：单位换算标杆（数百单位、双向即时）
- **Desmos / GeoGebra**：科学计算/函数绘图天花板
- **pomofocus.io**：番茄钟标杆（任务列表+统计）
- **monkeytype**（纯前端标杆）：打字测试的体验天花板（即时反馈、细分统计、主题）
- **Excalidraw / tldraw**（纯前端标杆）：白板手绘风、无限画布、协作
- **latexlive.com / Overleaf**：LaTeX 公式编辑与实时预览
- **16personalities**：MBTI 测试体验标杆
- **wordcounter.net**：字数统计标杆（关键词密度/阅读等级）
- **sudoku.com / sudoku-solver.com**：数独
- **中华万年历 / 51 万年历**：农历黄历
- **Online Tone Generator / tuner-online.com**：发生器/调音

### 开发
- **regex101.com**：正则测试天花板——右侧实时解释每一段 token、匹配高亮、调试器、社区库
- **Regulex / debuggex**：正则可视化铁路图
- **jwt.io**：JWT 解析天花板——解码着色、签名校验区、debugger
- **JSON Crack / jsonhero.io**：JSON 可视化树天花板（图谱视图、搜索、路径复制）
- **jsonformatter.org / JSONLint**：JSON 格式化+校验+Tree 视图
- **CyberChef**（GCHQ）：编码/加密瑞士军刀（200+ 配方拖拽管道）
- **diffchecker.com**：diff 对比标杆（文本/图片/PDF，行内高亮+行号）
- **convertcsv.com / csvjson.com**：CSV↔JSON 转换全家桶
- **quicktype.io**：JSON→TS/Java/Go 类型生成天花板
- **curlconverter.com**：cURL→fetch/python/JS 多语言
- **composerize.com**：docker run→compose 标杆
- **crontab.guru**：Cron 解读天花板（秒级实时预览下次执行时间）
- **codebeautify.org / prettier playground**：代码格式化
- **playcode.io / StackBlitz / CodeSandbox**：在线运行器天花板（NPM、热更新）
- **ray.so / carbon.now.sh**：代码截图天花板（主题/窗口框/导出）
- **SVGOMG**（纯前端）：SVG 优化标杆（实时预览+压缩率）
- **WebAIM Contrast Checker**：对比度检查标杆（AA/AAA 判定）
- **cssgradient.io / shadows.brumm.af / 9elements fancy border-radius**：CSS 生成器三件套标杆（可视化曲线拖拽）
- **metatags.io**：Meta/OG 预览标杆（Google/Twitter/Facebook 三视图）
- **quicktype / Mockaroo / faker.js**：假数据/Mock 标杆
- **unicode-table.com**：Unicode 速查
- **httpstatuses.io / MDN**：状态码速查
- **totp.app / 2fa.live**：TOTP
- **Desmos**：函数绘图天花板

### 视频（多数为云端架构，注意天花板标注）
- **Clideo / Kapwing / VEED.io**（云）：在线视频全家桶，预览+时间轴+实时渲染
- **ezgif**：video-to-gif/裁剪/变速/倒放的流量王（功能全 UI 旧）
- **headliner.app / Kapwing**：audiogram 波形视频标杆
- **剪映专业版 / CapCut Web**：字幕/防抖/绿幕的国民标杆（云+端）
- **FFmpeg 命令行**：能力上限参照（本项目 ffmpeg.wasm 同源）

### 音频
- **mp3cut.net / 123apps**（在线音频全家桶）：裁剪/合并/转换的流量王，波形可视化操作
- **vocalremover.org**（部分纯前端）：人声消除/变调/剪裁免费标杆
- **ttsmaker.com / Edge-TTS demo**：免费 TTS 标杆；**讯飞配音**（中文标杆）
- **飞书妙记 / 通义听悟**（云）：中文转写天花板
- **whisper.cpp WASM**（纯前端）：转写天花板参照
- **mynoise.net / Noisli**：白噪音标杆（频段自定义、混合器）
- **metronomeonline.com / tuner-online.com**：节拍器/调音器
- **audioalter.com**：音频效果全家桶
- **MP3Tag**（桌面）：标签编辑功能参照
- **Adobe Podcast Enhance**（云）：降噪天花板

### 数据
- **convertcsv.com**：CSV 全家桶
- **LiveGap Charts / Datawrapper**（纯前端可用）：图表生成标杆（实时预览+美化导出）
- **PivotTable.js demo**：透视表标杆
- **DuckDB WASM shell / sqlime.org**：SQL 查 CSV/Parquet 标杆
- **sqliteviewer.app**：SQLite 预览
- **thorium / readium**：EPUB 阅读器标杆；**epub.js demo**（纯前端）
- **Google Sheets / Rows**：表格协作天花板
- **Modern CSV / CSV Editor**：大文件 CSV 体验

### AI（纯前端 = transformers.js/WebGPU 模型，标注能力边界）
- **QuillBot / TLDRthis**：摘要/改写标杆（云）
- **DeepL / 彩云小译 / Firefox Translations（Bergamot，纯前端标杆）**：翻译
- **Grammarly / LanguageTool**：语法纠错标杆（云）
- **ChatPDF / Humata**：与 PDF 对话标杆（云）
- **Hugging Face Spaces 官方 demo**：NER/QA/零样本/图像描述/检测/分类的天花板参照（transformers.js 同源）

### 金融
- **OptionStrat**：期权损益可视化天花板
- **portfoliovisualizer.com**：组合回测/再平衡标杆
- **firecalc.com**：FIRE 计算标杆（蒙特卡洛）
- **东方财富/同花顺内置计算器**：摊薄成本/定投的国民参照
- **babypips.com**：外汇点值教学+计算
- **CoinGecko / CoinMarketCap 计算器**：币圈盈亏
- **TradingView**：仓位/风控计算参照

### 商业 SaaS
- **ResumeWorded / FlowCV / 超级简历（wondercv）**：简历生成与评分标杆
- **51 个税 / 个税管家**：税后工资国民参照
- **baremetrics / ProfitWell**：MRR/流失/LTV 的 SaaS 指标标杆
- **HubSpot Email Signature Generator / WiseStamp**：邮件签名标杆
- **Omnicalculator**：专业计算器聚合（2000+，口径严谨）

### SEO
- **xml-sitemaps.com**：sitemap 标杆（爬站+分段+图片）
- **Google Campaign URL Builder / utm.io**：UTM 标杆
- **portent.com SERP preview / sistrix**：SERP 预览标杆
- **technicalseo.com（Merkle）Schema 生成器**：结构化数据标杆（12+ 类型+验证）
- **readable.com / Hemingway Editor**：可读性标杆
- **ahrefs hreflang generator**：hreflang

### 工作室（4 个）
- **Photopea**：照片工作台天花板（纯前端）
- **PDF24 / Sejda Workbench / Stirling PDF**：PDF 工作台
- **Clipchamp / CapCut Web / Kapwing**：视频工作台（时间轴多轨）
- **Rows / Airtable / Google Sheets**：数据工作台

## 五、目录结构与文档规范

```
docs/优化文档/
├── README.md            ← 本文件（口径 + 对标库 + 总览路线图）
├── _模板.md             ← 逐工具档案模板（含填写规约，唯一格式来源）
├── _布局审计底稿.md      ← 6 种布局模式风险表 + 60 处高度清单 + 全局根因（证据底稿）
├── _实测锚点.md          ← 浏览器实测抽样结果（编号 M-xx，全部档案可引用）
├── <分类>/<slug>.md     ← 520 份工具档案（slug 与 URL /t/<slug> 一致）
└── <分类>/_汇总.md      ← 12 份分类共性汇总
```

分类目录：图片工具（73）｜PDF工具（54）｜实用工具（135）｜开发工具（92）｜视频工具（42）｜音频工具（38）｜数据工具（18）｜AI工具（15）｜金融交易（20）｜商业SaaS（16）｜SEO工具（13）｜编辑器工作室（4）

**注意**：本目录在 AGENTS.md 文档白名单之外，系用户 2026-11-11 特别指定，不入版本管理可再议。

## 六、全站总览与优化路线图

（待全部 520 份完成后回填：评分分布直方图、P0 快赢清单、模式级改造路线、与"领域最强"的差距地图。）

---

*方法论版本 v1.0 · 2026-11-11 · 证据基线：main @ df29be8*
