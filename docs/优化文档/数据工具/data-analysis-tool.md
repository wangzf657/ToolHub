# 数据分析工作台（data-analysis-tool）

> 分类：数据工具｜模式：E 变体（工作室两栏：290px 侧栏 + 1fr 主区，5 Tab）｜组件：`src/tools/editors/components/DataStudio.vue`（311 行）+ studio 四面板（DataTablePanel/ChartPanel/PivotPanel/SqlPanel，合计约 608 行）｜引擎：alasql + chartEngine + csvEngine｜注册：`src/tools/data/registry.ts`（与编辑器区 data-studio 同组件双注册）
> 对标标杆：Rows / Airtable（数据工作台天花板）＋ DuckDB WASM shell（SQL 探索）

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 5 Tab：搜索/排序/行数上限的表（DataTablePanel.vue:17-49）、带 X/Y 列映射的图表（ChartPanel.vue:32-43 数值列自动识别）、透视（PivotPanel）、多表 SQL+示例+结果下载（SqlPanel.vue:121-127,112-119）、CSV/XLSX/JSON 导出；**但注册 desc 承诺的 Parquet 无法载入**（DataStudio.vue:103 accept 无 .parquet、`dataShared.ts:12-42` 无分支）——疑似功能缺陷；desc 还承诺"清洗"，实际无任何清洗能力（去重/填充/转型均无） |
| 可用性 | 20 | 11 | 11 | 工作台结构（模式 E 家族最完整的多面板 Tab 化）；但面板全是钉高：SQL 结果 380px（SqlPanel.vue:152）、透视 460px（PivotPanel.vue:115）、数据表 520px 全局值、图表 400px——无一处 vh 弹性（共性-根因 2，工作室本应是 vh 级画布） |
| 实用价值 | 15 | 14 | 14 | "载入即分析"一站式聚合真实价值高；多数据集侧栏 + 跨表 SQL（:140 datasets 全量注册）是独立工具拼不出的能力 |
| 交互便捷性 | 15 | 11 | 11 | Tab 即点即切、数据集 chip 带行数与删除（:110-124）、重复文件指纹防累加（:35-44）；但 Tab 间无联动（图表配置不进透视/SQL 结果），刷新全丢无会话记忆 |
| UI 美观性 | 10 | 7 | 7 | 步骤条+侧栏+Tab 结构全站工作室水准；空态大图标引导（:154-157） |
| 灵魂度 | 20 | 6 | 6 | 文件指纹防重、Excel 多 sheet 自动拆数据集（dataShared.ts:18-22）是懂行细节；**但空工作台无示例数据一键载入**——没文件的用户只能看空态劝退；导出"不受筛选影响"诚实披露（:150）却也没给"导出筛选结果"的出口（SQL Tab 可绕行） |
| **加权总分** | 100 | | **62** | 分类旗舰：聚合价值真实，被"承诺未兑现"（Parquet/清洗）与钉高面板拖住 |
| 附加：大文件性能 | 10 | 5 | — | 全量内存 + 主线程解析无进度；10 万行筛选排序同步卡顿 |
| 附加：移动端 | 10 | 5 | — | ≤900px 塌单列长页（:203-207），工作台意义丧失（审计底稿 §四共性问题） |

## 结论与优先级

**需拓展 + 交互优化** · P1（补齐 Parquet 兑现与清洗面板；面板弹性高度）

判据：desc 与实现不符属功能缺陷（交用户决定修 desc 还是补能力）；作为旗舰工作台，面板高度不达工作室标准（对照 PhotoStudio 68vh 画布）。

## 扣分点明细

1. 【功能-疑似缺陷】desc 承诺"打开 CSV/Excel/JSON/**Parquet**"（registry.ts:12），但 FileDrop accept 列表无 .parquet（`DataStudio.vue:103`）且 loadFilesToDatasets 无 Parquet 分支（`dataShared.ts:12-42`）——拖入 parquet 会当文本解析报错；同款问题存在于编辑器区 data-studio 注册（editors/registry.ts:8）
2. 【可用性】五个面板高度 380~520px 钉死（SqlPanel.vue:152 / PivotPanel.vue:115 / DataTablePanel.vue:65 全局 520 / ChartPanel.vue:122 400px），对照工作室画布 52~74vh 标准（审计底稿 §四），主分析区没有"工作台体量"
3. 【功能】"清洗"承诺无着落：无列级筛选（只有全文关键字搜索 DataTablePanel.vue:17-21）、无去重/空值填充/类型转换
4. 【灵魂】空态无示例数据载入按钮（:154-157）——独立工具有"载入示例"（ChartFromCsv.vue:32），旗舰工作台反而没有
5. 【功能】导出仅当前数据集全量（:150 披露诚实），筛选/排序结果无法导出（SQL 面板可绕行但路径深）
6. 【灵魂】Tab 无联动记忆：透视配好切到图表再回来配置保留✓（v-if 销毁重建实际会丢——面板用 v-if 切换 :137-139，状态随组件销毁丢失）
7. 【美观】SQL 面板 textarea 120px（SqlPanel.vue:136）+ 结果 380px，编辑体验弱于独立 query-csv-with-sql（已有档案 63 分）——同一能力两个入口质量倒挂
8. 【交互】查询结果不能"另存为新数据集"继续分析（DuckDB/Rows 的"结果即新表"），SQL→透视→图表的探索链路断在 SQL 出口
9. 【灵魂】双注册入口（data-analysis-tool 与编辑器区 data-studio，同组件两 desc 均承诺 Parquet）互不链接、文案需双处同步——本批发现后建议档案与注册文案一并修正

## 行业对标与差距

- **Rows / Airtable**：列类型识别、公式列、视图记忆、协作。差距：**会话与视图持久化**（架构级，标注天花板）。
- **DuckDB WASM shell**：Parquet 直查 + 窗口函数。差距：Parquet 至少要在载入层兑现（hyparquet 已在 parquet-to-csv 验证可行）。
- 借鉴优先级：**Parquet 兑现（复用 ParquetViewer 装载逻辑）> 面板 vh 弹性 > 示例数据 > 列级筛选**。

## 可拓展性

- 短期（1 周）：accept 与装载函数补 .parquet 分支（复用 `ParquetViewer.vue:31-45` hyparquet 路径）；空态加"载入示例数据"；面板改 v-show 保状态
- 中期（1 月）：数据表面板加列值筛选 chips；清洗 Tab（去重/填充/转数值，复用 csvEngine.dedupeRows/aggregate）；面板高度 vh 化
- 远期：与 query-csv-with-sql、excel-pivot-table-online 收敛为唯一分析入口（本工作台 SQL 面板已是 SqlQuery 简版，避免双轨维护）；localStorage 会话恢复（元数据+配置，非全量数据）

## 优化处方（验收标准）

1. **Parquet 兑现**：FileDrop accept 加 .parquet，loadFilesToDatasets 用 hyparquet 装载。→ **验收：拖入 1000 行 parquet 后侧栏出现数据集且表格可浏览**
2. **面板弹性**：数据表/SQL 结果改 `calc(100vh - 300px)` 下限 480px。→ **验收：1366×768 下数据表面板 ≥480px，100 行数据同屏 ≥25 行**
3. **示例数据**：空态加"载入示例数据"按钮（内置 3 个小数据集）。→ **验收：无文件新会话点击后即可完成一次"筛选→图表→SQL"全流程**
4. **Tab 状态保持**：面板切换改 v-show。→ **验收：透视配好 → 切图表 → 切回，透视配置未丢失**
5. **导出筛选结果**：数据表 Tab 增加"导出当前筛选排序结果"。→ **验收：筛选后导出 CSV 行数 = 徽章"匹配行数"**
6. **结果即数据集**：SQL 面板加"存为新数据集"。→ **验收：JOIN 查询结果出现在左侧数据集列表，可继续透视**
