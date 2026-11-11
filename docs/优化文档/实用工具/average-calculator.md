# 平均数计算器（average-calculator）

> 分类：实用工具｜模式：B（CalcTool 表单 + 结果行，calcDef 家族）｜组件：`src/components/common/CalcTool.vue`（117 行，67 工具共用）｜注册：`src/tools/utility/registry.ts:871-904`
> 对标标杆：Calculator.net Mean/Median/Mode Calculator ＋ Omnicalculator（Weighted Average）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 一框粘贴即得均值/中位数/众数/总和/标准差/极差六行（registry.ts:894-901）覆盖面不错；但无加权平均、无样本/总体口径切换、无方差与分位数（站内 statistics-calculator 全有） |
| 可用性 | 20 | 11 | 11 | 逗号/空格/换行/中文标点分隔均解析（registry.ts:880）；但**空 token 会变幻影 0 混入统计**（registry.ts:880-882 未滤空串，末尾逗号/首行空行即拉低均值），且站内 statistics-calculator 已修同一 bug 并留注释（registry.ts:1221-1222） |
| 实用价值 | 15 | 9 | 9 | 与 statistics-calculator（registry.ts:1213-1252）输入同构且统计项是其子集，站内同质重复；独立价值仅剩"更少字段更快进入" |
| 交互便捷性 | 15 | 10 | 10 | 粘贴即算、placeholder 带示例（registry.ts:876）✓；无输入记忆、无单值复制（家族共性，loan-calculator.md 已证）；数字列表无法可视化（无排序展示/分布条） |
| UI 美观性 | 10 | 7 | 7 | 六行结果 primary 高亮均值✓（CalcTool.vue:91-94）；单字段表单紧凑✓；"最大 / 最小 / 极差"三值挤一行（registry.ts:900）小屏可读性一般 |
| 灵魂度 | 20 | 8 | 8 | 无 note 口径说明（registry.ts:874-903 无 note）：标准差按总体口径 ÷n（registry.ts:893）与 statistics-calculator 的样本口径 ÷(n−1)（registry.ts:1229）**同站不一致且均无披露**；开屏空串也会解析出 [0] 的全套假统计 |
| **加权总分** | 100 | | **56** | 粘贴即算的轻快体验成立，但口径 bug、同质重复、无加权三处硬伤拉低价值 |
| 附加：大文件性能 | 10 | 8 | — | 单次 reduce/sort 同步执行，万级数字尚可；十万级无 worker 无分片提示 |
| 附加：移动端 | 10 | 8 | — | 单 textarea + 六行结果移动端约一屏半（同族 M-08） |

## 结论与优先级

**阉割（并入 statistics-calculator）+ 交互修复** · P1（口径 bug 应先修）

判据：输入解析与 statistics-calculator 完全同构、统计项为其子集且口径还不一致——符合 README"高度重复→阉割（并入其他工具）"判据；但幻影 0 属数据正确性 bug，无论合并与否都须先修。

## 扣分点明细

1. 【可用性-疑似功能 bug】幻影 0 混入：split 后未滤空 token，`Number('')=0` 通过 `!Number.isNaN` 过滤（registry.ts:880-882）——输入"3, 5, 7, "（末尾逗号）按 4 个数计得均值 3.75（真值 5）；statistics-calculator 已显式修复并留注释"先剔除空 token…会混入幻影统计"（registry.ts:1221-1222），本工具未同步
2. 【可用性-假结果】开屏即出 [0] 的全套假统计：初始 nums='' 时 split 得 ['']→[0]，守卫 `if (!arr.length)`（registry.ts:883）永远不触发，页面一打开显示"平均值 0/中位数 0/总和 0/数量 1"
3. 【灵魂-口径】标准差总体口径 ÷n（registry.ts:893）且无 note：statistics-calculator 用样本口径 ÷(n−1) 并在 note 披露（registry.ts:1229,1250）——同站两个统计工具口径相反且都不提示，n 小时差异显著
4. 【功能】无加权平均：成绩（学分加权）、投资（金额加权）场景无权重字段，Omnicalculator Weighted Average 为标配
5. 【实用价值-同质重复】与 statistics-calculator 输入同构、输出为其子集（缺方差/Q1/Q3/CV/变异系数，registry.ts:1238-1247），两页无任何互链或差异化说明
6. 【交互】数字列表无回显：输入 50 个数字后无法看到"解析到了哪些数、共几个"（除一行"总和 / 数量"），解析失败（如混入文字被丢弃）用户无感知
7. 【功能】无小数精度控制与四舍五入提示：均值按 fmtN 两位截断（registry.ts:19-22），金额统计场景无"保留 4 位"选项（statistics-calculator 反而有 4 位，registry.ts:1237）

## 行业对标与差距

- **Calculator.net Mean/Median/Mode Calculator**：粘贴多行数据 + 均值/中位数/众数/方差/标准差一表 + 样本/总体口径切换。差距：**口径切换与解析回显**。
- **Omnicalculator（Weighted Average）**：数值+权重成对输入、权重归一化校验。差距：加权维度为零。
- 借鉴优先级：修幻影 0（对齐 statistics-calculator 写法）> 口径 note 或样本/总体切换 > 加权平均 > 解析回显；长期建议直接并入 statistics-calculator。

## 可拓展性

- 短期（1 周）：修空 token 幻影 0（照抄 statistics-calculator registry.ts:1222 的过滤）；补口径 note；空串时显示引导行
- 中期（1 月）：加权平均（数值+权重两栏）；解析回显（"已解析 N 个数字"）+ 丢弃项警告
- 远期：并入 statistics-calculator 成"统计工作台"（本页 301/重定向或保留为精简入口并互链），消除同质分裂

## 优化处方（验收标准）

1. **修幻影 0**：解析前过滤空 token（`filter(s => s.trim() !== '')`）。→ **验收：输入"3, 5, 7, "时均值显示 5、数量显示 3；空输入显示"请输入数字列表"**
2. **口径披露**：note 注明"标准差为总体口径（÷n）"，或增加样本/总体切换。→ **验收：页面底部口径行可见，或切换后 2,4,4,4,5,5,7,9 的标准差在 2（样本）与 2（总体差异可见）两档间变化**
3. **解析回显**：结果区加一行"已解析 N 个数字（丢弃 M 个无法识别项）"。→ **验收：粘贴"3, abc, 5"时显示已解析 2 个、丢弃 1 个**
4. **加权平均**：新增可选"权重列表（与数字一一对应）"字段。→ **验收：数值 80/90、权重 3/2 时加权均值 84（与 statistics 口径一致）**
5. **合并或互链**：至少在两页间互链说明分工；理想状态本 slug 301 至 statistics-calculator。→ **验收：两页面底部可见对方入口链接**
6. **整套结果复制**：结果区右上角"复制全部"按钮，输出键值对文本。→ **验收：点击后剪贴板含"平均值：5"等全部六行键值对，可贴进聊天/表格**
