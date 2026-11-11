# Office 转 PDF（office-to-pdf）

> 分类：PDF工具｜模式：C（单列文件流，裸 FileDrop 载体）｜组件：`src/tools/pdf/components/OfficeToPdf.vue`（108 行）｜引擎：`src/lib/officeEngine.ts` docxToHtml（mammoth，:53-58）/ readXlsx（:10-27）/ pptxToHtml（组件内 :20-42）→ htmlToPdfBlob（officeEngine.ts:108-141，jsPDF 纯文本重排）
> 对标标杆：Stirling PDF（开源自托管，LibreOffice 渲染）＋ Smallpdf / iLovePDF（云，Office 原生渲染）

## 七维评分：50 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 8 | 8 | docx 仅剩标题/段落/列表文本骨架（htmlToPdfBlob 只取块级文本，officeEngine.ts:148-175，图片/颜色/对齐全丢）；xlsx 仅首个工作表（OfficeToPdf.vue:57-61，其余 sheet 静默丢弃）；pptx 仅抽 <a:t> 文本（:33），版式/图片零保留 |
| 可用性 | 20 | 10 | 10 | 三格式 stage 文案+错误 toast 明确（:55-66）；但产物直接 saveBlob（:71）无预览、无页数确认；中文字体风险无任何提示（见扣分 1） |
| 实用价值 | 15 | 10 | 10 | "无 Office 转 PDF"场景真实，但文本大纲级产物与用户对"转 PDF"的预期（所见即所得）差距过大；xlsx 多 sheet 用户需改走 csv-to-pdf 类路径 |
| 交互便捷性 | 15 | 9 | 9 | 输出名跟随源文件（:71，家族少有的正确做法）；一键转换；但无文件替换后自动清理 stage、不支持 .doc/.xls/.ppt 旧格式（FileDrop accept 仅新格式，:84） |
| UI 美观性 | 10 | 7 | 7 | 布局与家族一致；notice 诚实说明 pptx 不做整页截图、docx 图片复杂样式被简化（:94） |
| 灵魂度 | 20 | 6 | 6 | 诚实 notice 是底线式灵魂；但"字体 helvetica"对中文的致命性只字未提、无页数/结果预览、无格式支持范围说明（.doc 不支持） |
| **加权总分** | 100 | | **50** | 三条转换链路全部为"文本抽取重排"下限实现，保真度是本批工具中最弱 |
| 附加：大文件性能 | 10 | 5 | — | docx→HTML→DOM 解析→逐行 splitTextToSize 全主线程；无进度百分比（仅 3 条 stage 文案） |
| 附加：移动端 | 10 | 6 | — | 单列可用；产物验证同样依赖下载后打开 |

## 结论与优先级

**交互优化 + 需拓展** · P1（附疑似功能问题：中文字体）

判据：50 分；保真度天花板如实承认（浏览器无 Office 排版引擎），但"xlsx 只转首表静默丢页""中文渲染风险零提示"是纯前端可修的诚实性与功能缺口；需拓展方向 = LibreOffice-wasm/云渲染之外的保真兜底策略。

## 扣分点明细

1. 【功能-疑似问题】中文渲染风险未披露且很可能乱码：htmlToPdfBlob 固定 `doc.setFont('helvetica', …)`（`officeEngine.ts:128`），jsPDF 标准 14 字体不含 CJK 字形，中文 docx/xlsx/pptx 转 PDF 大概率输出乱码或空白——本工具核心受众恰是中文文档，属疑似功能性缺陷（待浏览器实测确认），UI 三处 notice（OfficeToPdf.vue:84,:93-95）均未提及
2. 【功能】xlsx 仅转换第一个工作表：`sheets[0]` 硬编码（`OfficeToPdf.vue:57-61`），多 sheet 工作簿其余页静默丢弃，notice（:84 hint"xlsx 输出首个工作表"）藏在拖放区小字里
3. 【功能】docx 图片与表格样式丢失：mammoth 产出的 <img> 在 extractBlocks 中被 walk 跳过（`officeEngine.ts:150-168` 无 img 分支），插图无声消失；表格降级为"cell | cell"竖线文本（:159-162）
4. 【可用性】产物零预览：无页数、无首页缩略图，用户不知道转换"成了什么样"（:71 直接 saveBlob，模式 F 家族共性）
5. 【灵魂】不支持 .doc/.xls/.ppt 旧格式且失败话术不区分："仅支持 .docx/.xlsx/.pptx"（:66）在用户拖入 .doc 时才以 toast 出现，拖放区 accept 属性已排除但无前置说明
6. 【交互】pptxToHtml 幻灯片序号按文件名数字排序（:24-29），幻灯片重排过的 pptx（slide 文件名与演示顺序不一致时依赖 presentation.xml rels 顺序）可能乱序——边缘但真实
7. 【交互】大文件无进度百分比：docx 解析→排版两阶段各一条静态文案（:55-70），100 页 Word 卡在"正在排版生成 PDF…"时无法判断进度
8. 【美观】文件行渲染 GripVertical 手柄图标（`FileDrop.vue:98`）单文件模式下亦显示，暗示可拖拽实为装饰——家族共性（merge-pdf.md 扣分 3），裸 FileDrop 载体均携带

## 行业对标与差距

- **Stirling PDF（开源）**：Office→PDF 走 LibreOffice headless 真实排版渲染，字体/表格/图片保真。差距：浏览器端无 LibreOffice；**但中文字体可通过嵌入思源黑体子集（@cantoo/pdf-lib 支持 embedFont + fontkit）解决乱码**，这是纯前端可达的底线。
- **Smallpdf / iLovePDF（云）**：Office 原生级渲染。差距：架构天花板，如实标注；其"转换后在线预览"是可借鉴的确认环节。
- 借鉴优先级：**中文字体嵌入修复 > xlsx 多 sheet 选择 > docx 图片抽取嵌入 > 结果预览**。

## 可拓展性

- 短期（1 周）：notice 明示三格式各自的降级规则与旧格式不支持；xlsx 转 PDF 提供 sheet 多选（readXlsx 已返回全部 sheet）
- 中期（1 月）：docx 图片抽取（mammoth 可配 convertImage 输出 base64）按段落位置重排嵌入；中文场景嵌入思源黑体子集修复乱码
- 远期：接入 ffmpeg.wasm 之外的第二条保真管线评估（如 LibreOffice-wasm 是否成熟）；与 pdf-to-word 组成"Office↔PDF 双向"入口共享文件队列

## 优化处方（验收标准）

1. **中文乱码修复或披露**：嵌入 CJK 字体子集（doc.text 前检测含 CJK 字符时切字体），若短期无法实现则 notice 首行警示"当前版本中文文档转换可能出现乱码" → **验收：中文 docx 转出后 PDF 文字可读（或页面首行出现警示且转换前即可见）**
2. **xlsx sheet 多选**：解析后展示 sheet 勾选列表，默认全选 → **验收：3 sheet 工作簿勾选 2 个，PDF 含对应 2 张表格且标题为 sheet 名**
3. **docx 图片保留**：mammoth convertImage 输出 dataURL，pdf 端 addImage 按段落顺序嵌入 → **验收：含 3 张插图的 docx 转出后插图均在且顺序正确**
4. **结果确认**：转换完成显示"共 N 页"+首页文本摘要预览，点下载落盘 → **验收：预览首行与源文档首段一致**
5. **旧格式前置说明**：拖放区 hint 明示"不支持 .doc/.xls/.ppt，请先另存为新格式" → **验收：拖入 .doc 时提示文案与 hint 一致且不进入解析流程**
