# PDF 转 Word（pdf-to-word）

> 分类：PDF工具｜模式：C（单列文件流，PdfToolBase 载体）｜组件：`src/tools/pdf/components/PdfToWord.vue`（94 行）｜引擎：`src/lib/pdfEngine.ts` pdfPageTexts（pdfEngine.ts:663-687）＋ `src/lib/officeEngine.ts` paragraphsToDocx（officeEngine.ts:61-79，纯段落 docx）
> 对标标杆：iLovePDF（云，Solid Documents 引擎，版式级还原）＋ pdf2docx（开源 Python，表格/图片级重建天花板参照）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 仅"文本→段落"一种重建；无表格保留、无图片嵌入（paragraphsToDocx 只支持文本段落，officeEngine.ts:61-79）、无字体/缩进/分栏；iLovePDF 版式级还原是代差 |
| 可用性 | 20 | 11 | 11 | 按钮+选项首屏可达（M-13 同构，top≈453）；但产物直接 saveBlob 下载（PdfToWord.vue:56），无段落预览——重组质量好坏只能下载后开 Word 才知道（模式 F 无预览，家族共性，同 merge-pdf.md 扣分 4） |
| 实用价值 | 15 | 13 | 13 | 高频刚需；CJK 行拼接免空格（:30）是懂中文的细节；扫描件引导去 OCR 工具（:51）形成站内闭环 |
| 交互便捷性 | 15 | 10 | 10 | 一个选项+一个按钮，零学习成本；但大文档只有"正在提取文本…/正在生成 .docx…"两条静态文案（:42,:54），无百分比进度（pdfPageTexts 无 onProgress 回调） |
| UI 美观性 | 10 | 7 | 7 | 选项行紧凑；诚实 notice 说明"排版不会 1:1 还原"（:79-81）降低预期错配；单列布局无多余装饰 |
| 灵魂度 | 20 | 7 | 7 | 扫描件失败时给出去向（"请先使用扫描件 OCR"，:51）是好灵魂；但"第 n 页"人工标题（:47）混进文档正文、产物无预览、固定输出名"文档.docx"（家族共性，同 merge-pdf.md 扣分 7） |
| **加权总分** | 100 | | **57** | 诚实但能力单薄：纯文本段落级重建是架构内务实的下限 |
| 附加：大文件性能 | 10 | 5 | — | 逐页 getTextContent 后整册驻留内存再生成 docx，无分批/Worker；大 PDF 只有两条 stage 文案，卡住时无反馈 |
| 附加：移动端 | 10 | 6 | — | 单列堆叠可用；结果无预览在移动端更依赖"下载后用 Word 打开" |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：57 分；纯前端无法企及 iLovePDF 云端版式还原属架构天花板（如实标注），但"段落预览确认 + 表格降级为 Word 表格"是纯浏览器可及的，功能面与结果确认环节均有明确可追差距。

## 扣分点明细

1. 【可用性】转换结果零预览：段落重组质量、分页标题位置全靠下载后打开验证，重组错了（如标题被并进正文）只能盲改参数重跑（`PdfToWord.vue:56` 直接 saveBlob；模式 F 家族共性）
2. 【功能】表格彻底降维：PDF 表格行被 toParagraphs 当普通段落拼接成一行串（`PdfToWord.vue:24-33` 无任何表格识别），而开源 pdf2docx 可重建 Word 表格线与合并单元格——纯前端可达但未做
3. 【功能】图片零嵌入：paragraphsToDocx 仅输出文本段落（`officeEngine.ts:66-72` 只造 Paragraph/TextRun），PDF 内插图全部丢失，even 页面级截图兜底都没有
4. 【交互】无逐页进度：pdfPageTexts 未暴露 onProgress（`pdfEngine.ts:663-687`），100 页文档转换期间仅两条静态文案，用户无法判断卡死还是正常
5. 【灵魂】"第 n 页"标题是人工注入而非文档结构（`PdfToWord.vue:47` withTitles 分支），关掉后多页文档连分页痕迹都没有；无"保留页码原文位置"的折中选项
6. 【交互】输出名固定"文档.docx"（`PdfToWord.vue:56`）——家族共性（merge-pdf.md 扣分 7），多份转换互相覆盖
7. 【功能】标题层级推断缺失：对 pdfjs 的 transform 可拿字号做 H1/H2/H3 判级（pdfPageTexts 已取 transform 但只用了 y 坐标，`pdfEngine.ts:673-679`），现在所有段落一律正文样式
8. 【灵魂】空态无示例：未选文件时只有按钮置灰，无"试试这个样例 PDF"引导，首次用户不知道"段落重组"意味着什么

## 行业对标与差距

- **iLovePDF（云）**：版式级还原（栏位、页眉页脚、字号字体、图片原位嵌入），转换出的 docx 与原 PDF 视觉近乎一致。差距：**架构天花板**——云端跑 Solid Documents 引擎；纯前端对齐目标是 pdf2docx 级：表格重建 + 字号判级 + 图片抽取嵌入。
- **pdf2docx（开源 Python）**：基于 PyMuPDF 读版面几何，可重建表格边框、合并单元格、浮动图片。启示：pdfjs 的 getTextContent 同样携带每段坐标与字号，纯浏览器可复刻其 60~70% 能力。
- 借鉴优先级：**表格行识别转 Word 表 > 字号标题判级 > 图片抽取嵌入 > 转换前段落预览**。

## 可拓展性

- 短期（1 周）：转换完成后在页面内预览前 10 个段落（复用 ResultBox）+ 显示"共 N 段 · 预计 X 页"；进度条接入逐页回调
- 中期（1 月）：表格启发式识别（同行 2+ 空格分列 ≥2 行判表格，复用 PdfToMarkdown 的 gfmTable 思路）转 docx 表格；字号判级（transform[0] 相对正文 ≥1.5 倍→H1）
- 远期：抽取内嵌图片按页面位置嵌入 docx（复用 extractImages）；与 pdf-to-text/markdown 共享"版面解析层"，一次解析三格式输出

## 优化处方（验收标准）

1. **转换前预览**：点击执行后先显示段落重组预览（前 10 段+总段数）与"下载 .docx"确认按钮 → **验收：拖入 5 页 PDF，预览区出现且段落数与最终 stat 一致；点下载才落盘**
2. **逐页进度条**：pdfPageTexts 增加 onProgress，UI 复用 PdfToPowerpoint 的进度条样式 → **验收：100 页 PDF 转换中进度条从 0% 连续走到 100%，无 >5s 静止无反馈**
3. **表格降级保留**：识别为表格的行组转 docx Table（docx 库支持 TableRow/TableCell）→ **验收：3×3 表格 PDF 转出后在 Word 中可见真实表格而非一行串**
4. **字号判级**：字号 ≥ 正文 1.5 倍判 H1、1.2~1.5 倍判 H2 → **验收：含大标题的 PDF 转出后 Word 导航窗格可见标题层级**
5. **输出名跟随源文件**：saveBlob 使用 `源文件名.docx` → **验收：拖入 报告.pdf，产物名 报告.docx**
