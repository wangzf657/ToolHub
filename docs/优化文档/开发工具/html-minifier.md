# HTML 压缩（html-minifier）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/CodeFormatter.vue`（105 行，与 html-formatter 完全同一组件）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` minifyHtml 正则（:329-335）｜注册：`src/tools/developer/registry.ts:187`（与 :186 html-formatter 同 component）
> 对标标杆：willpeavy.com/minifier＋Toptal HTML Minifier（papaparse 系 Toptal 工具集，均真实可查）

## 七维评分：51 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 8 | 8 | 仅正则去注释去空白（`jsEngine.ts:329-335`）；不压缩内联 JS/CSS、不去属性引号/布尔属性空值、无 pre 保护、无压缩档位——html-minifier npm 库的核心能力面基本缺席 |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 320px**（`CodeFormatter.vue:85,87`，共性-根因 2；几何同 M-01） |
| 实用价值 | 15 | 10 | 10 | 与 html-formatter 100% 重复（同一组件同一按钮组，`registry.ts:186-187`）；压缩后无体积统计、产物无 pre 保护，生产可用性存疑 |
| 交互便捷性 | 15 | 11 | 11 | 按钮置顶✓复制下载齐、可"再格式化还原"（desc 属实）；但无文件上传、无压缩率即时反馈 |
| UI 美观性 | 10 | 7 | 7 | 工整一致；JS/CSS chip 对 HTML 压缩用户是干扰 |
| 灵魂度 | 20 | 7 | 7 | 预填示例✓；"压缩了多少"这一核心期待零反馈（code-minifier 有统计，`registry.ts:305-308`，本工具未复用） |
| **加权总分** | 100 | | **51** | |
| 附加：大文件性能 | 10 | 6 | — | 正则三连主线程同步，MB 级 HTML 可感知卡顿但无冻结风险（较 prettier 轻） |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**阉割（并入 html-formatter）或需拓展** · P1

判据：与 html-formatter 为同一组件的重复注册（`registry.ts:186-187`），独立工具无增量功能；若保留独立入口则必须升级真压缩引擎以兑现 slug 承诺。

## 扣分点明细

1. 【实用-硬伤】工具与 html-formatter 完全同一组件同一按钮（`registry.ts:187` component 与 :186 相同），唯一差异是文案——独立存在的理由为零，应为并入或差异化
2. 【可用性-硬伤】ResultBox 双重钉高 320px（`ResultBox.vue:69`、`CodeFormatter.vue:87`；同构几何 M-01）
3. 【功能-疑似问题】minifyHtml `replace(/\n\s*/g,'')` 无 pre/textarea 保护（`jsEngine.ts:332`）：压缩含 `<pre>` 内容的页面会改变渲染结果，产物不可直接部署
4. 【功能】内联 JS/CSS 原样保留（无 minifyJS/minifyCSS 处理，对标 html-minifier npm 的核心选项）；属性引号/空布尔值/尾部斜杠均不处理
5. 【灵魂】零压缩率披露：压完只有"HTML 已压缩"toast（`CodeFormatter.vue:49`），用户无法知道压了多少（站内 code-minifier 已有字节数统计范式可复用）
6. 【交互】无文件上传入口（HTML 压缩高频伴随整个 .html 文件，粘贴 >1MB 不现实）；无压缩前后对比
7. 【美观】JS/CSS/HTML 三 chip 冗余；≤560px 才堆叠（共性-根因 5）
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **willpeavy.com/minifier**：粘贴/上传/URL 三入口、压缩率百分比大字展示、可选项开关（去注释/去空白/压缩 JS）。差距：入口形态与结果反馈两代差。
- **html-minifier npm（terser 系）**：条件注释保护、内联脚本压缩、模板引擎感知。差距：本工具为正则近似，仅适合"去注释去空白"的入门诉求。
- 借鉴优先级：压缩率统计 > pre 保护 > 并入 html-formatter 单入口（或反向升级引擎）> 文件上传。

## 可拓展性

- 短期（1 周）：压缩率统计展示；pre/textarea 保护；与 html-formatter 的去重决策（信息架构）
- 中期（1 月）：若保留则接入 html-minifier npm（浏览器构建）或自研开关式压缩（去注释/去空白/压内联脚本三档）；文件拖放入口
- 远期：并入"HTML 工作台"（格式化/压缩/压缩率报表单页三 Tab）

## 优化处方（验收标准）

1. **信息架构决策**：与 html-formatter 合并为单入口（压缩为其 Tab/按钮）——slug 301 保留。→ **验收：站内搜索"html 压缩"直达 html-formatter 页且压缩按钮可见，无重复工具卡**
2. **压缩率统计**（若保留独立入口）：结果区显示"X B → Y B（-Z%）"。→ **验收：压缩示例 HTML 显示一致字节数，Z 与手工计算相符**
3. **pre 保护**：→ **验收：含 `<pre>` 的页面压缩后 pre 内空白逐字符不变**
4. **文件入口**：FileDrop 支持 .html 拖入填充输入区。→ **验收：拖入 500KB HTML 文件 3s 内输入区完整回填且可执行压缩**
5. **输出区弹性高度**：→ **验收：1366×768 下压缩产物同屏可见 ≥25 行**
