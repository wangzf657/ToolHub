# Word 转 Markdown（docx-to-markdown）

> 分类：开发工具｜模式：C（FileDrop→自动转换→ResultBox）｜组件：`src/tools/developer/components/DocxToMarkdown.vue`（56 行）｜引擎：docxToHtml（mammoth，`src/lib/officeEngine.ts:53-58`）→ htmlToMd（turndown GFM，`src/lib/mdEngine.ts:107-119`）｜注册：`src/tools/developer/registry.ts:71`
> 对标标杆：word-to-markdown.com（Ben Balter 开源服务）＋ Pandoc（--extract-media，CLI 天花板参照）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | mammoth 语义 HTML（标题层级/列表/表格/加粗斜体）+ turndown GFM（表格/删除线）✓；无 mammoth styleMap 配置（样式映射不可调）、无图片策略选项、不支持旧版 .doc（诚实提示另存 :20） |
| 可用性 | 20 | 11 | 11 | 拖入即自动转换零按钮✓；ResultBox 钉高 300px（`DocxToMarkdown.vue:42`＋`ResultBox.vue:69` 双重钉高）；无原文对照视图 |
| 实用价值 | 15 | 11 | 11 | Word→MD 迁移真场景；但带图文档输出内嵌巨型 base64（扣分 1），产出不可直接入库，可靠性打折 |
| 交互便捷性 | 15 | 11 | 11 | 拖入自动转✓复制/下载✓busy 显示文件名✓；无批量、无图片策略选择、无转换选项 |
| UI 美观性 | 10 | 7 | 7 | 极简单列清爽；≤560px 无碍（本就单列） |
| 灵魂度 | 20 | 7 | 7 | busy 文案带文件名（:41）✓错误提示含"请确认文件未加密"排查方向（:30）✓；notice 文案与实际图片行为不符（扣分 1）伤信任 |
| **加权总分** | 100 | | **58** | |
| 附加：大文件性能 | 10 | 6 | — | mammoth+turndown 主线程，大 docx（10MB+）仅 spinner 无进度百分比 |
| 附加：移动端 | 10 | 6 | — | 单列布局移动端尚可，输出 300px 内滚 |

## 结论与优先级

**交互优化** · P2

判据：拖入即转的交互闭环已达本家族良好水位；欠账集中在图片处理策略失实与钉高，无代差。

## 扣分点明细

1. 【功能-疑似问题】图片文案失实：notice 称"图片默认以原链接保留，可手动下载后替换"（`DocxToMarkdown.vue:43`），但 mammoth 未配置 imageConverter（`officeEngine.ts:53-58`），Word 内嵌图片默认转为 base64 data URI，经 turndown 输出为超长 `![](data:image/png;base64,...)`——带图文档 MD 输出膨胀数 MB 且多数编辑器不可用，与"原链接保留"表述直接矛盾
2. 【功能】无图片策略选项：无"忽略图片/提取为文件/保留 base64"三选（word-to-markdown 支持图片导出）；mammoth styleMap 未暴露——删除线等在 mammoth 默认映射中丢失为普通文本，居中/高亮同理
3. 【可用性】ResultBox 钉高 300px（`DocxToMarkdown.vue:42`；`ResultBox.vue:69`；几何同 M-01）——长文档输出小窗内滚
4. 【功能】旧版 .doc 不支持仅靠提示"另存为 docx"（:20），未给站内/站外兜底路径
5. 【灵魂】无原文/输出对照视图（双栏或 Tab），校对转换保真度需来回开文件
6. 【交互】无批量队列：跨团队 wiki 搬家场景需逐个拖（word-to-markdown/Pandoc 均可批）
7. 【性能】大 docx 解析无进度百分比（仅 spinner+文件名），完成前无法预估耗时
8. 【环境】Cookie 横幅首访遮挡底部（M-01 截图证据）

## 行业对标与差距

- **word-to-markdown.com**（turndown 系开源）：图片导出为独立文件并以相对链接引用、删除线等 styleMap 语义保留、GitHub REST 兜底。差距：图片策略是核心代差。
- **Pandoc**：--extract-media 图片抽取目录、完整样式映射表。差距：架构天花板（CLI）；纯前端 mammoth+JSZip 可逼近图片提取（JSZip 已在依赖内）。
- 借鉴优先级：图片策略三选 > styleMap 预置（删除线/居中）> 输出弹性高度 > 原文对照视图。

## 可拓展性

- 短期（1 周）：图片策略选项（忽略/base64 两态）；notice 文案如实化；输出弹性高度
- 中期（1 月）：mammoth styleMap 预置集（删除线/居中/高亮）；图片提取 zip 下载（JSZip 现成）；完成 toast 报图片数量
- 远期：并入"Markdown 工作台"导入 Tab（docx/html 双入口）；批量队列

## 优化处方（验收标准）

1. **文案如实化**：notice 改为"Word 内嵌图片将转为 base64 内嵌文本（可两态切换）"。→ **验收：文案与含图 docx 的实际输出行为一致**
2. **图片策略选项**："忽略/base64"两态 checkbox。→ **验收：选"忽略"后输出无 data URI，含 10 张图的文档输出体积缩小 90% 以上**
3. **输出弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 500 行 MD 同屏可见 ≥25 行**
4. **删除线映射**：styleMap 预置 strikethrough。→ **验收：含删除线文字的 docx 转出 `~~文本~~` 语法**
5. **图片数量披露**：完成 toast 报"已内嵌 N 张图片"。→ **验收：toast 数字与输出中 data URI 出现次数一致**
