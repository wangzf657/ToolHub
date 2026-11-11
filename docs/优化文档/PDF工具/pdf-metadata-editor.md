# PDF 元数据编辑（pdf-metadata-editor）

> 分类：PDF工具｜模式：C（单列文件流 + 表单编辑区）｜组件：`src/tools/pdf/components/MetadataEditor.vue`（119 行）＋ `PdfToolBase.vue`（91 行）｜引擎：`pdfEngine.ts` getMetadata（:394-405）/ setMetadata（:381-392，经 savePdf 统一盖章）
> 对标标杆：PDF24（Set PDF metadata）＋ Sejda（Edit PDF Metadata）；ExifTool 作字段完备度参照
> 家族共性（无缩略图/假拖拽手柄/自动下载）见 `merge-pdf.md`，本档案只记个性差异。

## 七维评分：64 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 标题/作者/主题/关键词/创建程序 5 字段可编（MetadataEditor.vue:14-20）；Producer 与创建/修改日期不可见不可编，无 XMP 清理——Adobe 属性面板 9 项、ExifTool 全量 |
| 可用性 | 20 | 14 | 14 | 表单即全部内容、按钮必在首屏（M-13 家族锚点）；但保存即下载零验证回路，改没改成功只能靠外部阅读器复核 |
| 实用价值 | 15 | 13 | 13 | 发布前抹作者/纠标题是高频刚需；载入自动回填让"查看"开箱即用 |
| 交互便捷性 | 15 | 11 | 11 | 自动回填（:22-40）＋一键清空（:42-45）是好的默认；但误清空后无"还原原始值"，须重新拖文件 |
| UI 美观性 | 10 | 8 | 8 | grid-2 字段排布工整；"创建程序"对小白不如 Adobe 的"应用程序"直白 |
| 灵魂度 | 20 | 7 | 7 | notice 讲清清空的用途（:104-106）有意识；但"抹去软件信息"的文案与实际盖 ToolHub 章的行为背离（见扣分 4） |
| **加权总分** | 100 | | **64** | |
| 附加：大文件性能 | 10 | 7 | — | 单次 load+save 秒级完成；仅 spinner 无进度，百 MB 档案无预警（家族共性） |
| 附加：移动端 | 10 | 6 | — | 单列表单可用，无适配问题也无亮点 |

## 结论与优先级

**交互优化** · P2（扣分 1/2 两条疑似 Bug 若实测坐实，修复升 P1）

判据：64 分无可用性硬伤；差距集中在字段完备度、XMP 隐私清理深度与验证闭环，属增量改造。

## 扣分点明细

1. 【功能-疑似 Bug】创建程序回填可能被 pdf-lib 盖章污染：getMetadata 加载未传 updateMetadata:false（`pdfEngine.ts:396`），@cantoo/pdf-lib 在 load 构造时即无条件 setProducer('pdf-lib…') 并在 Creator 缺失时补 pdf-lib 字样（引擎注释已记录此坑，`pdfEngine.ts:66-69`）→ 无 Creator 的文档表单里回填出"pdf-lib (https://…"，一键保存即写入
2. 【功能-疑似 Bug】数组型关键词让元数据读取整体失败：Acrobat 常把 Keywords 写成 PDFArray，getKeywords 断言字符串抛错而 pdfEngine.ts:401 强转无容错 → onFiles 落 catch（MetadataEditor.vue:35-37），整表清空并报"读取元数据失败"
3. 【功能】Producer 完全不可见：getMetadata 不返回 producer（`pdfEngine.ts:397-404`），"查看创建程序等属性"的承诺少一半——审计"这 PDF 谁做的"恰恰最需要 Producer
4. 【灵魂/诚信】"一键清空…抹去作者与软件信息"（MetadataEditor.vue:105）与实际不符：setMetadata 固定 setProducer('ToolHub')（`pdfEngine.ts:389`），savePdf 再把空 Creator 回填 ToolHub（`pdfEngine.ts:75-76`）——抹的是原软件，写入的是 ToolHub 处理痕迹
5. 【功能-合规级】XMP 元数据流不清理：pdf-lib 只写 Info 字典，现代 PDF 的 /Metadata XMP 常驻原 title/author——清空保存后用任何 XMP 读取器一查作者仍在，"对外发布"场景属隐私清空不彻底
6. 【可用性】无验证回路：保存即 saveBlob 下载（MetadataEditor.vue:55-57），不回读输出核对字段
7. 【交互】关键词的逗号拆分规则（中英文逗号皆可，`pdfEngine.ts:387`）未在 placeholder/hint 说明；清空后无撤销

## 行业对标与差距

- **PDF24 / Sejda 元数据编辑**：字段含 Producer 与创建/修改日期，保存后就地回显新属性。差距：字段完备度 + 验证闭环。
- **Adobe Acrobat 属性面板**：额外暴露 PDF 版本、页数等只读事实；Remove Hidden Information 覆盖 XMP 与隐藏数据。差距：隐私清理深度。
- 借鉴优先级：**保存后回读回显 > Producer/日期字段 > XMP 残留检测或披露 > 关键词容错**。

## 可拓展性

- 短期（1 周）：getMetadata 加载补 updateMetadata:false、getKeywords 加 try-catch 单字段兜底；保存后回读输出回显"已写入 ✓"
- 中期（1 月）：Producer/日期只读展示；读 /Metadata 流粗查原字段残留并提示"XMP 可能仍有作者信息"
- 远期：与 batch-pdf 的"元数据清理"动作合并为"隐私清洗"专项（Info+XMP+附件名），输出清洗报告

## 优化处方（验收标准）

1. **加载容错**：元数据逐字段 try-catch。→ **验收：Acrobat 数组型关键词 PDF 回填不再整体报错，关键词显示空或首值**
2. **盖章修正**：getMetadata 加载传 updateMetadata:false。→ **验收：无 Creator 的 PDF 回填"创建程序"为空串而非 pdf-lib 字样**
3. **验证回路**：保存后立即回读输出并显示各字段新值。→ **验收：改标题保存后，页面出现回读结果且与输入一致**
4. **文案对齐**：notice 改为"清空会写入 ToolHub 标识；XMP 流可能残留原信息"。→ **验收：文案与实际行为一致**
5. **Producer/日期展示**：只读区显示 Producer 与两个日期。→ **验收：数值与 Acrobat 属性面板一致**
