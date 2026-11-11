# JSON 转 Excel（json-to-excel）

> 分类：开发工具｜模式：C（单列堆叠文件流：FileDrop→选项→按钮→textarea，纯下载无预览）｜组件：`src/tools/developer/components/JsonToExcel.vue`（137 行）｜引擎：`src/lib/officeEngine.ts`（rowsToXlsx:30-44，xlsx 懒加载）｜注册：`src/tools/developer/registry.ts:77`
> 对标标杆：convertcsv.com（JSON to Excel）＋ Table Convert（tableconvert.com）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 嵌套拍平 a.b.c（JsonToExcel.vue:41-48）+ 多数组分 sheet（:30-36）+ 包装键智能识别 + 数值类型保留（:75 原样传入 aoa）；缺 sheet 勾选、列宽/冻结表头（rowsToXlsx 仅 aoa_to_sheet，officeEngine.ts:36-40）、Excel→JSON 反向 |
| 可用性 | 20 | 8 | 8 | **硬伤：盲盒下载**——点"生成 Excel"直接 saveBlob 自动下载（:78-91），全程无表格预览，列顺序/拍平结果对不对只能下载后开 Excel 才知道；sheetInfo 只有一行文本（:82,92） |
| 实用价值 | 15 | 12 | 12 | 接口数据→Excel 报表真实高频；数值类型保留是站内唯一正确路径（csv-to-excel 的 JSON 分支把数值 String() 成文本，`data/components/CsvToExcel.vue:38-42`），但两工具入口重复未整合 |
| 交互便捷性 | 15 | 10 | 10 | busy spinner（:111）+ 按钮位于输入区上方首屏可达；无示例一键填充（仅 placeholder :118）、无"复制为 CSV"降级出口 |
| UI 美观性 | 10 | 7 | 7 | FileDrop+选项+按钮+输入堆叠清晰；但页面无任何结果区，成功与否只剩 toast |
| 灵魂度 | 20 | 8 | 8 | 包装键识别 list/data/items/rows/records/result（:28）是"懂我"细节；文件载入 toast 确认；但 2MB 静默截断（:19）是反灵魂行为 |
| **加权总分** | 100 | | **57** | 能力强于 csv-to-excel 的 JSON 分支，体验败给"看不见结果" |
| 附加：大文件性能 | 10 | 5 | — | 输入静默截断 2MB（JsonToExcel.vue:19 slice）+ JSON.parse 主线程同步 + xlsx 全量写出，无进度反馈 |
| 附加：移动端 | 10 | 6 | — | 下载型流程手机可用；textarea 220px 输入尚可，但结果不可见导致移动端更无法验证 |

## 结论与优先级

**交互优化 + 需拓展** · P0（盲盒下载 = 结果完全不可见，属"结果区没法看"可用性硬伤红线）

判据：可用性 8/20 触发硬伤红线——唯一输出通道是无预览自动下载，用户无法在下载前确认任何输出质量。

## 扣分点明细

1. 【可用性-硬伤】盲盒下载：run() 校验后直接 saveBlob 自动下载（`JsonToExcel.vue:78-91`），无表格预览、无下载前确认——拍平列名对不对、列顺序如何、null 填了什么，全部下载后才能发现（模式 F"notice 条即结果"变体，共性-根因 2 的高度问题在此表现为"结果区根本不存在"）
2. 【可用性-疑似功能缺陷】文件载入静默截断 200 万字符（`JsonToExcel.vue:19` `.slice(0, 2000000)`）无任何提示——大 JSON 被砍尾后 JSON.parse 必失败，报"JSON 无效"把用户引向完全错误的排查方向
3. 【功能-疑似功能缺陷】关闭拍平时嵌套对象/数组原样传入 aoa_to_sheet（`JsonToExcel.vue:66,75`）——SheetJS 不接受任意对象作单元格，此类列疑似空白或损坏
4. 【功能】多数组场景无 sheet 勾选/改名预览，全量导出不可挑拣（:63-93）
5. 【功能】无列宽自适应、无表头冻结、无样式（rowsToXlsx 仅 `aoa_to_sheet`，officeEngine.ts:36-40）
6. 【交互】无示例一键填充按钮；sheet 名重复时静默改名 `-2`（:70-71）无提示
7. 【实用-重复度】data 分类 csv-to-excel 也接受 JSON 文件（`data/registry.ts:7`、`CsvToExcel.vue:33-44`），两入口无互相指引；本工具数值保型更正确却名不带 JSON（入口词"json excel"可同时搜到两者）

## 行业对标与差距

- **convertcsv.com（JSON to Excel）**：转换前表格预览、列选择、分隔/嵌套选项逐项可调、xlsx 直下。差距：**预览环节整体缺失**。
- **Table Convert（tableconvert.com）**：JSON/CSV/Excel/Markdown 统一输入输出，转换后即见表格，可在线微调再导出。差距：本工具"转换即离场"，无微调可能。
- 借鉴优先级：**生成前表格预览 > 截断提示 > sheet 勾选 > 列宽/冻结 > 与 csv-to-excel 入口整合**。

## 可拓展性

- 短期（1 周）：生成前先渲染预览表（复用 table-wrap，参考 csv-viewer），下载按钮移到预览后；截断 toast
- 中期（1 月）：sheet 勾选与命名编辑；关闭拍平时对象 JSON.stringify 兜底；列宽自适应（xlsx !cols）；复制为 CSV 出口
- 远期：与 csv-to-excel/excel-viewer 整合"表格转换工作台"（JSON/CSV/xlsx 三态互转统一预览）；列样式（日期/货币格式）

## 优化处方（验收标准）

1. **生成前预览**：点击"生成 Excel"先渲染首个 sheet 的表格预览（max-height 用弹性高度），下方出"下载 xlsx"确认按钮。→ **验收：1366×768 下粘贴 50 行对象数组，预览同屏 ≥12 行 × 全部列可见，下载按钮位于预览区正下方**
2. **截断提示**：文件 >2MB 时 toast 明示"已截断至前 200 万字符（截断后 JSON 可能非法）"。→ **验收：拖入 3MB JSON 出现该提示；截断导致的解析失败文案包含"文件被截断"字样**
3. **关闭拍平兜底**：对象/数组值统一 JSON.stringify 进单元格。→ **验收：`[{"addr":{"city":"北京"}}]` 关闭拍平后预览单元格显示 `{"city":"北京"}` 而非空白**
4. **sheet 勾选**：多数组时列出各数组（名+行数）复选框，默认全选。→ **验收：取消勾选任一 sheet 后导出工作簿不含该表**
5. **示例按钮**：选项行加"填入示例"（含嵌套+多数组样例）。→ **验收：点击后输入区填充样例且可一键生成 2 个 sheet 的工作簿**
