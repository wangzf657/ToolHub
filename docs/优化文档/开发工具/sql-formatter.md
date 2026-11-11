# SQL 格式化（sql-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/SqlFormatter.vue`（110 行）＋ `src/components/common/ResultBox.vue`｜引擎：sql-formatter 懒加载（`SqlFormatter.vue:53`）＋内置 lightFormat 兜底（:14-47）｜注册：`src/tools/developer/registry.ts:69`
> 对标标杆：sql-formatter.org（同一引擎的官方在线 demo）＋ codebeautify.org SQL Formatter

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 3 方言（PG/MySQL/SQLite）＋关键字大小写；缺 PLSQL/T-SQL/BigQuery 等库本身支持的 12+ 方言、缩进档位（tabWidth 写死 2，`SqlFormatter.vue:54`）、indentStyle/logicalOperatorNewline 风格选项、语法校验 |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 300px**（`SqlFormatter.vue:94,96`，共性-根因 2；面板几何同 M-01：top=250px、右栏 300px），长查询小窗内滚 |
| 实用价值 | 15 | 13 | 13 | 高频刚需；sql-formatter 真库引擎质量与官方 demo 同源，可复制可下载 |
| 交互便捷性 | 15 | 10 | 10 | 方言/关键字选项与按钮置顶✓、busy spinner✓；但粘贴后需手动点格式化、输入输出独立滚动 |
| UI 美观性 | 10 | 7 | 7 | 布局工整；≤560px 才堆叠（共性-根因 5），平板双栏过挤 |
| 灵魂度 | 20 | 7 | 7 | 预填示例 SQL✓、库加载失败降级有提示（:59）；但语法错误静默降级、无错误定位、无快捷键 |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 6 | — | format 主线程同步，千行 SQL 无进度反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区在约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 8/20 触发钉高硬伤（共性-根因 2）；方言面与官方 demo 差距悬殊（3/12+）。

## 扣分点明细

1. 【可用性-硬伤】ResultBox `height:minHeight` 双重钉高 300px（`ResultBox.vue:69`、`SqlFormatter.vue:96`；面板几何同 M-01 实测：装饰层吃掉首屏 32%）
2. 【功能】方言仅 3 种（`SqlFormatter.vue:73-77`）：所用库本身支持 plsql/tsql/bigquery/mariadb/hive/spark 等，属未暴露能力
3. 【功能】缩进固定 2 空格（`SqlFormatter.vue:54` tabWidth:2 硬编码），无 indentStyle/每子句换行策略等风格选项
4. 【灵魂-疑似问题】catch 分支把一切异常（含语法错误）静默降级为 lightFormat（`SqlFormatter.vue:56-59`），错误 SQL 也提示"已格式化"，无校验无定位
5. 【功能-疑似问题】lightFormat 兜底先 `replace(/\s+/g,' ')` 再按空格切词（`SqlFormatter.vue:18`）：字符串字面量被拆词，内部关键字（如 `'please group by hand'`）会被大写并强插换行，破坏 SQL 语义
6. 【交互】粘贴/修改后不自动格式化，无"即改即格式化"（sql-formatter.org 为输入即出）
7. 【灵魂】无快捷键、无风格预设、错误提示仅 toast 瞬时
8. 【美观】首用动态加载 sql-formatter 库期间只有按钮 spinner，无"解析库首次加载"说明（对照 CodeFormatter 有 notice 文案，`CodeFormatter.vue:90-92`）

## 行业对标与差距

- **sql-formatter.org**：同库官方 demo，12+ 方言、关键字大小写/缩进风格/运算符换行全选项、输入即格式化。差距：方言数与风格配置面是代差；即改即格式化缺失。
- **codebeautify.org**：文件上传入口＋URL 拉取＋示例库。差距：本工具无文件入口，大 SQL 只能粘贴。
- 借鉴优先级：输出区弹性高度 > 即改即格式化 > 方言扩充 > 缩进风格选项。

## 可拓展性

- 短期（1 周）：输出区弹性高度；粘贴即格式化开关；首用加载提示
- 中期（1 月）：方言扩至 plsql/tsql/bigquery/mariadb ≥8 种；缩进档位与关键字风格 localStorage 持久化
- 远期：与数据工具 SqlQuery 组成"SQL 工作台"；基于解析器的语法校验与错误定位

## 优化处方（验收标准）

1. **输出区弹性高度**：ResultBox expand 模式 `calc(100vh - 330px)`、下限 480px、可全屏。→ **验收：1366×768 下 300 行格式化 SQL 同屏可见 ≥25 行且无需滚页面**
2. **即改即格式化**：监听 paste 自动执行（800ms 防抖，选项默认开）。→ **验收：粘贴合法 SQL 后 1s 内输出区出现结果，无需点击**
3. **方言扩充**：select 增至 ≥8 种并分组展示。→ **验收：Oracle PL/SQL 块（declare/begin/end）缩进层级正确**
4. **缩进与风格选项**：tabWidth 2/4/8 暴露并持久保存。→ **验收：改 4 空格后刷新页面设置仍生效**
5. **降级诚实化**：lightFormat 兜底时输出区顶部显示"简化排版（离线兜底），未做语法校验"横幅。→ **验收：断网首访格式化时横幅可见且说明兜底原因**
