# 数据工作台（data-studio）

> 分类：编辑器工作室｜模式：E 变体（290px 数据集栏 + 1fr 主区——`DataStudio.vue:197-207`，五 Tab 面板矩阵）｜组件：`src/tools/editors/components/DataStudio.vue`（全文 311 行）＋ `studio/` 四面板（DataTablePanel 118 / ChartPanel 128 / PivotPanel 158 / SqlPanel 177 行）＋ `studio/dataShared.ts`（53 行）｜引擎：alasql + chartEngine + csvEngine + officeEngine｜受 ToolPage 300px 侧栏挤压（家族共性见 photo-studio.md 不展开）；空态实测 M-20
> 对标标杆：Rows / Airtable（数据工作台天花板）＋ DuckDB WASM shell（SQL 探索）
> 互认：组件在数据分类另有登记 data-analysis-tool（`src/tools/data/registry.ts:12`，62 分档案已留底）；desc 承诺的 Parquet 未实现两处同病（互认其扣 1）；本档案聚焦**四面板整合度**与工作台个性证据

## 七维评分：63 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 面板矩阵 breadth 全站分析类第一：搜索/排序/行数上限的表（DataTablePanel:17-49）+ 4 图型×数值列自动识别（ChartPanel:15-20,:32-43）+ 6 聚合透视含行列合计（PivotPanel:13-20）+ 跨表 SQL 示例生成（SqlPanel:121-127）+ CSV/XLSX/JSON 导出；但 Parquet 承诺未兑现（accept :103 无 .parquet、dataShared.ts:33-35 兜底当 CSV 解析必炸，互认 data-analysis-tool.md 扣 1）、无列级筛选 |
| 可用性 | 20 | 11 | 11 | **模式 E 唯一没有一个 vh 级视区的工作室**：数据表 520px（DataTablePanel.vue:65 全局值）/透视 460px（PivotPanel.vue:115）/图表 400px（ChartPanel.vue:122）/SQL 结果 380px（SqlPanel.vue:152）全部钉高（共性-根因 2）——工作室本应有 52~74vh 画布的家族标准在此缺席 |
| 实用价值 | 15 | 14 | 14 | 多数据集侧栏+跨表 JOIN（SqlPanel :31-40 全量注册 alasql）是独立单工具拼不出的能力；Excel 多 sheet 自动拆数据集（dataShared.ts:18-22）；导出口径诚实披露"不受筛选影响"（:150） |
| 交互便捷性 | 15 | 10 | 10 | Tab 即点即切、数据集 chip 带行数与删除（:110-124）、示例 SQL 一键填充（:121-127）；但四面板全 v-if 切换（:137-139）**搜索/排序/图表/透视/SQL 配置随 Tab 全部重置**，换数据集再重置一次（ChartPanel watch :23-30），面板间零联动 |
| UI 美观性 | 10 | 7 | 7 | 步骤条+侧栏+Tab 结构全站工作室水准；空态大图标引导（:154-157）；家族性侧栏挤压与 ≤900px 塌单列（:203-207） |
| 灵魂度 | 20 | 8 | 8 | 文件指纹防重（:35-44）、中文标识符自动补方括号（SqlPanel :43-83，真懂 alasql 解析器的坑）、导出口径披露诚实；但空态无示例数据一键载入（:154-157）、**SQL 结果 500 行静默截断且下载同截**（:102,:112-118，个性发现）、图表 NaN 静默归 0（ChartPanel :55-58） |
| **加权总分** | 100 | | **63** | 总分 = 13+11+14+10+7+8 |
| 附加：大文件性能 | 10 | 5 | — | 全量内存+主线程解析无进度，10 万行筛选排序同步卡顿（互认 data-analysis-tool.md 附加维） |
| 附加：移动端 | 10 | 5 | — | ≤900px 塌单列长页（:203-207），工作台意义丧失（家族共性） |

## 结论与优先级

**需拓展 + 交互优化** · P1（Parquet 兑现或 desc 除名；Tab 状态保持与面板 vh 化并进）

判据：63 分——聚合分析价值真实（分类旗舰），但"工作台健忘"（v-if 全重置）+全钉高面板+desc 超前承诺，与 Rows 级"探索链路"存在代差；互认 data-analysis-tool.md 处方，修复一处双入口同受益。

## 扣分点明细（四面板整合度视角）

1. 【交互-硬伤边缘】**面板状态随 Tab 销毁**：DataTablePanel 关键字/排序、ChartPanel 图型/XY、PivotPanel 行列值字段、SqlPanel 已写 SQL，切 Tab 后全部清零（v-if :137-139）；透视配好→看图表→切回配置归零——"多面板并行探索"这一工作台基本盘不成立（data-analysis-tool.md 扣 6 已登记，本档案确认为主扣分项）
2. 【功能-个性发现】**SQL 结果 500 行静默截断污染下载**：resultRows 切片 500（:102），toast 报真实行数（:104）而徽章与"下载 CSV"均用截断数组（:149,:112-118）——2000 行查询下载只得 500 行且无"仅前 500 行"提示，数据完整性缺陷
3. 【功能-个性】图表/透视 NaN 静默归 0：ChartPanel 非数值填 0（:55-58）、PivotPanel 同（:55-56）——脏数据列的折线被凭空拉平，无警告无排除选项
4. 【功能-个性】透视行列键按出现序不排序（PivotPanel :41-57）：乱序数据透视出行键顺序随机感强（PivotTable.js 默认排序维度键）
5. 【可用性】家族唯一无 vh 视区（四面板 380~520px 钉高，见评分表）：1366×768 下 520px 数据表同屏仅 ~13 行（对照实测 M-16 csv-viewer 同款表现）
6. 【功能】desc 承诺 Parquet 未兑现（editors/registry.ts:8）：accept 无 .parquet（:103）、装载无分支（dataShared.ts:12-42），拖入后走 CSV 兜底（:33-35）报解析错误——互认 data-analysis-tool.md 扣 1，两处 desc 需一并修
7. 【灵魂】空态无示例数据（:154-157）：没带文件的用户面对空工作台劝退；独立工具 chart-from-csv 反而有"载入示例"——旗舰不如单工具
8. 【交互】探索链路断在出口：SQL 结果不能存为新数据集（JOIN→透视→图表断链）、数据表筛选结果不能导出（仅全量 :150）——互认 data-analysis-tool.md 扣 5/8
9. 【SEO/验证】BUG-30 修复验证合格（HomePage.vue:42-44，首页仅 editors 四卡）；data-analysis-tool 双注册仍在，收敛方向以其档案远期项为准（本页为工作台正身候选）

## 行业对标与差距

- **Rows / Airtable**：视图记忆、公式列、结果即新视图。差距：**状态持久化与面板联动代差**（会话级持久化标注架构天花板；v-show 保状态纯前端即可）。
- **DuckDB WASM shell / PivotTable.js**：Parquet 直查、透视维度默认排序。差距：两者均为可落地单点（hyparquet 已在 parquet-to-csv 验证可行）。
- 家族愿景：四面板已具"多工具一站"雏形（SQL/透视/图表三合一），联动+状态保持的整合度提升比加新面板更能拉开与单工具页的差距。
- 借鉴优先级：**Parquet 兑现 > 面板 v-show 保状态 > vh 弹性 > SQL 结果即数据集 > 示例数据**。

## 可拓展性

- 短期（1 周）：四面板 v-if 改 v-show（保状态）；结果 >500 行时披露截断；空态加"载入示例数据"
- 中期（1 月）：accept/装载补 .parquet 分支（复用 ParquetViewer 的 hyparquet 路径）；数据表/SQL 结果 vh 化；SQL 结果"存为新数据集"；图表 NaN 列警告
- 远期：与 query-csv-with-sql、excel-pivot-table-online 收敛为唯一分析入口（data-analysis-tool.md 远期同判）；localStorage 会话恢复（配置+数据集元信息）

## 优化处方（验收标准）

1. **Tab 状态保持**：面板改 v-show。→ **验收：透视配好→切图表→切回，行列值字段与聚合函数原样保留；SQL 文本内容保留**
2. **截断披露**：结果 >500 行时徽章显示"500 / 实际 N 行"并在下载旁提示截断。→ **验收：2000 行查询下载 CSV 恰为披露的行数，界面有截断说明**
3. **Parquet 兑现或除名**：accept+装载补 .parquet，或两处 desc 删"Parquet"。→ **验收：拖入 1000 行 parquet 出现数据集可浏览；registry 文案无超前承诺**
4. **面板 vh 化**：数据表/SQL 结果改 `calc(100vh - 300px)` 下限 480px。→ **验收：1366×768 下 100 行数据同屏 ≥25 行**
5. **NaN 警告**：Y 列含非数值单元格时图表上方黄条提示"已忽略 X 个非数值"。→ **验收：混入文本的数值列出图出现计数提示**
6. **示例数据**：空态加"载入示例数据"（内置 2~3 个小数据集）。→ **验收：新会话一键完成"筛选→图表→SQL"全流程**
7. **结果即数据集**：SQL 面板加"存为新数据集"。→ **验收：JOIN 结果出现在左侧数据集列表并可继续透视**
