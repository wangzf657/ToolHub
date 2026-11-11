# JSON 转 CSV（json-to-csv）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef）｜组件：`src/components/common/TextTool.vue`（195 行，42 工具共用）｜逻辑：registry 内联 transform `src/tools/developer/registry.ts:43-67`（esc :58）｜注册：`registry.ts:44`
> 对标标杆：convertcsv.com（JSON to CSV）＋ csvjson.com（json2csv）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 仅分隔符 3 选（registry.ts:48-50）；嵌套对象/数组直接 JSON.stringify 塞单元格（:58）无拍平选项；无列选择/重排、无值格式化、无"仅数据行"模式、无 .csv 下载 |
| 可用性 | 20 | 10 | 10 | 双 textarea 各钉 180px（`base.css:164-168`，实测锚点 M-06，家族共性-根因 2）；JSON 错误有行列号 toast（TextTool.vue:41 localizeJsonError）但输出区被清空不保留上次结果 |
| 实用价值 | 15 | 12 | 12 | 对象数组转 CSV 高频；转义正确（分隔符/引号/换行检测 + `""` 翻倍，registry.ts:58-59）；但输出无 UTF-8 BOM，贴进 Excel 中文乱码 |
| 交互便捷性 | 15 | 11 | 11 | 输入即自动转换（TextTool.vue:47-48 watch，textDef 加分项）、一键复制、互换按钮可回灌；无下载按钮（TextTool.vue:130-133 仅复制） |
| UI 美观性 | 10 | 7 | 7 | 家族统一双栏工整；≤760px 单列（TextTool.vue:156-159）后输出更矮 |
| 灵魂度 | 20 | 7 | 7 | 自动转换是家族亮点；但嵌套对象变 JSON 字符串的行为零披露零选项——用户看到 `"{""a"":1}"` 一脸懵；无示例、无字符外的行列统计 |
| **加权总分** | 100 | | **56** | 核心转换正确，功能面与"家族内不一致"是主要失分 |
| 附加：大文件性能 | 10 | 5 | — | JSON.parse + 逐行字符串拼接全在主线程同步（registry.ts:52-62），MB 级数组冻结 UI 无反馈 |
| 附加：移动端 | 10 | 6 | — | 单列堆叠后 180px 双窗上下排，输出区约 1.5 屏外（M-06 同构） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 10/20（家族钉高）；功能面与 convertcsv 拍平/列控制差距明显，且与站内 json-to-excel 行为分裂。

## 扣分点明细

1. 【功能】嵌套对象/数组不做拍平，直接 `JSON.stringify` 塞进单元格（`registry.ts:58`）——同站 json-to-excel 有 a.b.c 拍平开关（`JsonToExcel.vue:41-48`），**同族工具两套行为**
2. 【功能-可用性】无文件下载：TextTool 输出仅复制（`TextTool.vue:130-133`），千行 CSV 手工粘贴易出事；且复制内容无 BOM 选项，Excel 打开中文乱码（convertcsv 有 UTF-8 BOM 开关）
3. 【功能】列顺序 = 首个出现顺序的 Set（`registry.ts:57`），无选列/重排/删列能力
4. 【可用性】双窗 180px 钉高（家族共性-根因 2，M-06），大数组输出小窗内滚
5. 【可用性】出错时输出区清空（`TextTool.vue:39`），对照排查丢失上次结果
6. 【交互】与 csv-to-json 非严格双向一致：csv-to-json 会把 "028" cast 成 28（`CsvToJson.vue:34`），json-to-csv 回转后 28——前导零/字符串数字往返漂移，无口径说明
7. 【灵魂】无示例数组一键填充；无嵌套行为说明文案；placeholder 仅"粘贴 JSON 对象数组…"一个词

## 行业对标与差距

- **convertcsv.com（JSON to CSV）**：嵌套节点拍平（join 属性路径）、列选择与排序、分隔符/引号/换行符自定义、直接下载 .csv。差距：**拍平策略与列控制**代差。
- **csvjson.com（json2csv）**：属性路径拍平深度选项、键名排序开关、UTF-8 BOM 开关、结果行数预览。差距：Excel 兼容性与行为可解释性。
- 借鉴优先级：**拍平选项（复用 JsonToExcel flattenRow）> .csv 下载+BOM > 列勾选重排 > 嵌套行为说明**。

## 可拓展性

- 短期（1 周）：加下载按钮（saveText 带 BOM 开关）；嵌套拍平开关（复用 flattenRow，registry 内联改 lib 化）；示例填充
- 中期（1 月）：输出预览表格（复用 csv-viewer 渲染，先看后取）；列勾选与拖拽重排；大文件 Web Worker 化
- 远期：与 csv-to-json 合并为"CSV↔JSON 工作台"双向页，统一类型推断与拍平口径

## 优化处方（验收标准）

1. **拍平开关**：默认关，开启后嵌套对象按 a.b.c 展开为列。→ **验收：`[{"a":{"b":1}},{"a":{"c":2}}]` 输出表头 `a.b,a.c` 两列**
2. **下载 .csv**：输出区下方加"下载 CSV"，可选"带 UTF-8 BOM"。→ **验收：下载文件 Excel 双击打开中文不乱码；BOM 关闭时无 EF BB BF 头**
3. **嵌套行为披露**：未拍平时输出区顶部提示"N 个单元格含嵌套对象（已转 JSON 字符串）"。→ **验收：含嵌套字段的输入出现该提示行**
4. **弹性高度**：双窗改 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 500 行 CSV 输出同屏 ≥20 行**
5. **往返口径说明**：结果区附一行"数字列按 JSON 数值输出；如需保留前导零请在 csv-to-json 关闭类型推断"。→ **验收：文案可见且链接可跳转**
