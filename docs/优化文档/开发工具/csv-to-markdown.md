# CSV 转 Markdown 表格（csv-to-markdown）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef）｜组件：**无独立组件**——`src/tools/developer/registry.ts:161-178` textDef 注册（transform 内联解析）＋共用 `src/components/common/TextTool.vue`（195 行）｜引擎：registry 内联 split 正则（:170）——**未复用站内 csvEngine papaparse（`src/lib/csvEngine.ts:24-35`）**｜注册：`src/tools/developer/registry.ts:161`
> 对标标杆：convertcsv.com（CSV 全家桶，对标库）＋ 站内 markdown-table-generator（registry.ts:159，可编辑网格生成对齐表格）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 三分隔符+三对齐✓；**解析器为朴素逐行 split + 仅剥首尾引号**（`registry.ts:170`）——引号包裹含分隔符字段（`"a,b"`）直接碎裂、`""` 转义不还原、跨行单元格不支持；无列宽对齐填充、无首行表头开关、无 ragged 行补齐 |
| 可用性 | 20 | 10 | 10 | TextTool 双 textarea 各钉 180px（`base.css:164-168`，共性-根因 2；几何同 M-06），几百行 CSV 在 180px 小窗内滚；输出表格同高 |
| 实用价值 | 15 | 12 | 12 | CSV→GFM 表格高频（README/issue/评论场景）；产物 GitHub 可渲染，但真实数据（含引号/逗号）一转就错，可靠性打折 |
| 交互便捷性 | 15 | 12 | 12 | **watch 自动执行✓**（`TextTool.vue:47-48`，改分隔符/对齐即时重算，textDef 家族红利）；swap 互换✓字符数✓；无文件拖入/上传 |
| UI 美观性 | 10 | 7 | 7 | TextTool 工整统一、选项条置顶✓ |
| 灵魂度 | 20 | 6 | 6 | placeholder 仅"粘贴 CSV…"（`registry.ts:177`）无示例预填；解析出错零提示、静默产出错表（错得无声）；自动执行是主要灵魂分 |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 6 | — | 纯字符串 split 主线程，MB 级 CSV 可感卡顿；TextTool pending 状态模板从未渲染（审计底稿§三） |
| 附加：移动端 | 10 | 5 | — | ≤760px 单列后输出区 1~2 屏外（横向结论 6） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：解析正确性是本工具的生命线，朴素 split 在含引号/逗号的真实 CSV 上直接产出错表（功能 9/20 触发拓展判据）；站内 csvEngine 已有 papaparse 正确实现，一处 transform 改动即可修复。

## 扣分点明细

1. 【功能-硬伤】朴素 split 解析：`l.split(String(o.delim))` + `replace(/^"|"$/g,'')`（`registry.ts:170`）不处理引号内分隔符/换行/引号转义——`"a,b",c` 被切成 3 列、`"say ""hi"""` 输出 `say ""hi""`；站内已有 papaparse 引擎（`csvEngine.ts:24-35` parseCsvSync）与 miniParse 兜底（:79）未复用，属"有轮子不用"
2. 【功能】无列宽对齐：输出 `| ${r.join(' | ')} |` 按原始长度拼接（`registry.ts:174-175`），中英混排时源码列错位（GitHub 渲染正常但源码可读性差）；兄弟工具 markdown-table-generator 已有"实时生成对齐的 GFM 表格"能力（registry.ts:159）
3. 【功能】无首行表头开关与 ragged 行补齐：第一行永远当表头；行字段数不一致时产出缺列/多列表格，GitHub 渲染错位
4. 【可用性-硬伤】双 textarea 各钉 180px（`base.css:164-168`；TextTool 无独立高度覆写，共性-根因 2；实测几何同 M-06 pinyin-converter）
5. 【交互】无文件拖入/上传入口（TextTool 仅 textarea；convertcsv.com 支持上传/URL 入口）
6. 【灵魂】无示例 CSV 预填；含引号 CSV 解析出错无任何警示（静默产出错表而非报错——错得无声是最伤信任的失败模式）
7. 【交互】对齐全局单选（registry.ts:167），不支持"第一列左对齐其余居中"的列级对齐
8. 【性能】TextTool pending 状态模板从未渲染（审计底稿§三 TextTool.vue:15），大输入无处理反馈

## 行业对标与差距

- **convertcsv.com/csv-to-markdown**：文件/粘贴/URL 三入口、RFC4180 完整解析（引号/换行）、首行表头开关、列宽对齐输出。差距：解析正确性与入口形态。
- **站内 markdown-table-generator**：可编辑网格+实时对齐表格。差距：两工具应形成"粘贴源→编辑→产物"链路，现各自为战。
- 借鉴优先级：transform 改调 parseCsvSync（一处改动修正确性）> 列宽对齐 > 表头开关+ragged 补齐 > 文件上传。

## 可拓展性

- 短期（1 周）：transform 内改调 csvEngine.parseCsvSync 修复引号/换行/转义；示例预填
- 中期（1 月）：列宽对齐填充（按各列最长 cell pad 空格）；表头开关+ragged 补齐；列级对齐
- 远期：并入"Markdown 工作台"表格链（csv-to-markdown→markdown-table-generator→csv-to-excel 互链）

## 优化处方（验收标准）

1. **引擎替换**：transform 内改用 parseCsvSync(text, { delimiter })，引号/换行/转义全兼容。→ **验收：`"a,b",c` 转出 2 列表格且首列单元格为 `a,b`；`"say ""hi"""` 输出 `say "hi"`**
2. **列宽对齐**：输出按各列最长宽度 pad 空格。→ **验收：产物每列的 `|` 上下对齐，源码视觉成表**
3. **表头开关+ragged 补齐**：缺列补空、多列裁齐。→ **验收：4 列表头+3 列数据行转出后数据行自动补空至 4 列**
4. **文件入口**：支持 .csv 拖入填充输入区（textDef 无 FileDrop，需加拖放监听）。→ **验收：拖入 1MB CSV 3s 内解析出表**
5. **示例预填**：含引号字段与中英文混排的示例 CSV。→ **验收：清空后占位符可一键填充，示例转出为列对齐 4 列表格**
