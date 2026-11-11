# CSV 转 JSON（csv-to-json）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox，带 FileDrop）｜组件：`src/tools/developer/components/CsvToJson.vue`（95 行）｜引擎：`src/lib/csvEngine.ts`（parseCsvAsync:57-65，Papa 懒加载）｜注册：`src/tools/developer/registry.ts:42`
> 对标标杆：convertcsv.com（CSV 全家桶）＋ csvjson.com（csv2json）

## 七维评分：63 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 分隔符 3 选 + 首行表头开关 + 数字/布尔类型推断（CsvToJson.vue:32-37）+ 引号字段 Papa 解析 + 拖文件；缺分隔符自动嗅探、`|` 分隔符、a.b 列名嵌套展开、输出模式（对象数组/二维数组）选择、缩进选择 |
| 可用性 | 20 | 10 | 10 | 输出 ResultBox 钉死 240px（`ResultBox.vue:69` height=minHeight；`CsvToJson.vue:79`），千行 JSON 小窗内滚；CSV 解析错误只有 toast 无行列定位（CsvToJson.vue:47） |
| 实用价值 | 15 | 13 | 13 | 高频刚需，类型推断默认开、引号处理交给 Papa 质量可靠，全本地 |
| 交互便捷性 | 15 | 11 | 11 | 拖文件自动转换（:18-23）、填入示例一键（:51-54）、ResultBox 复制/下载齐全；但粘贴文本仍需手动点按钮（:83），两态不一致 |
| UI 美观性 | 10 | 7 | 7 | 选项行/双栏工整；面板底部残留装饰图标 `<FileSpreadsheet v-if="!text">`（:85）语义不明 |
| 灵魂度 | 20 | 9 | 9 | 示例按钮 + 文件名回显（:76）+ 行数反馈（:84）是亮点；无 GBK 编码处理、无解析统计（列数/类型分布）、无快捷键 |
| **加权总分** | 100 | | **63** | 家族里工程最完整的转换工具之一，被 240px 钉高与静默解析拖后腿 |
| 附加：大文件性能 | 10 | 5 | — | parseCsvAsync 异步但单次全量解析（csvEngine.ts:61-64），无进度/Worker，MB 级 CSV 卡 UI |
| 附加：移动端 | 10 | 6 | — | grid-2 ≤560px 堆叠（base.css:329-335），双 240px 窗上下排后输出区约 1.5 屏外 |

## 结论与优先级

**交互优化** · P1

判据：可用性 10/20（钉高 240px + 错误无定位），功能面距 convertcsv/csvjson 有可追差距但核心质量合格。

## 扣分点明细

1. 【可用性】输出 ResultBox `height:minHeight` 钉死 240px（`ResultBox.vue:69`、`CsvToJson.vue:79`；家族共性-根因 2），大数组只能小窗内滚
2. 【可用性-疑似功能缺陷】Papa 的 errors 数组被完全忽略（`csvEngine.ts:63-64` 只取 r.data）——引号不闭合、列数不齐时**静默输出错位数据**，比报错更危险
3. 【功能】无分隔符自动嗅探：csvEngine 已有 sniffDelimiter（`csvEngine.ts:121-130`）却未被组件使用，组件总是传显式 delim（`CsvToJson.vue:31`）；`|` 分隔符选项缺失
4. 【功能】无 a.b 列名 → 嵌套对象展开（`CsvToJson.vue:38-42` 列名原样作 key），对标 csvjson.com 的属性路径选项
5. 【功能】编码只走 UTF-8（`CsvToJson.vue:21` files[0].text()）——Excel 中文版导出的 GBK CSV 直接乱码，无任何提示
6. 【交互】粘贴文本后必须手动点"转换为 JSON"（:83），拖文件却自动转（:22），行为不一致
7. 【灵魂】无输出样式选择（缩进写死 2 空格，:43）、无"列数 × 行数"解析摘要
8. 【美观】底部 `<FileSpreadsheet v-if="!text">` 图标（:85）无文字无交互，疑似残留装饰

## 行业对标与差距

- **convertcsv.com（CSV to JSON）**：输出模式多选（对象数组/二维数组/仅表头）、分隔符/引号字符自定义、CSV 转录规范化。差距：输出形态单一代。
- **csvjson.com（csv2json）**：分隔符自动嗅探、键名规范化（去空格/大小写）、解析错误按行报告、垂直输出模式。差距：**错误可定位性**——本工具连"有没有错"都不告知。
- 借鉴优先级：**Papa errors 行级报告 > 分隔符嗅探 > GBK 编码检测 > 输出模式多选 > 键名规范化**。

## 可拓展性

- 短期（1 周）：ResultBox 弹性高度；接通 sniffDelimiter 做自动模式 + 补 `|` 选项；粘贴即转换开关
- 中期（1 月）：Papa errors 行级上报；a.b 列名嵌套展开开关；TextDecoder 按字节嗅探 GBK/UTF-8
- 远期：与 csv-viewer/csv-to-excel 整合为"CSV 工作台"（解析一次，多形态输出）；大文件流式解析（Papa chunked）

## 优化处方（验收标准）

1. **ResultBox 弹性高度**：输出区默认 `calc(100vh - 330px)`、下限 480px。→ **验收：1366×768 下 200 条记录的 JSON 输出同屏可见 ≥20 行**
2. **解析错误行级上报**：parseCsvAsync 透传 Papa errors，组件逐条展示"第 N 行：引号未闭合"。→ **验收：输入 `a,"b\nc,d` 类引号不闭合样例，结果区顶警示条含行号，而非静默出数**
3. **分隔符自动嗅探**：新增"自动"默认档（复用 `csvEngine.ts:121-130`），并补 `|` 选项。→ **验收：粘贴 `a|b` 分隔文本无需手工选择即正确分列**
4. **GBK 检测**：拖入文件先按字节判断编码（BOM/GBK 特征），非 UTF-8 用 TextDecoder('gbk') 解码。→ **验收：Excel 中文版导出的 GBK CSV 中文显示正常**
5. **嵌套展开开关**：列名含 `.` 时可选展开为嵌套对象。→ **验收：列 `user.name` 输出 `{"user":{"name":…}}`**
6. **粘贴即转换**：监听 paste 自动执行（默认开，可关）。→ **验收：粘贴合法 CSV 后 300ms 内输出区出现结果，无需点击**
