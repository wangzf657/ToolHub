# Markdown 格式化（markdown-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/MarkdownFormatter.vue`（97 行）＋ `src/components/common/ResultBox.vue`｜引擎：prettier standalone + markdown 插件懒加载（`MarkdownFormatter.vue:20-21`）＋列表符号正则补丁（:29-31）｜注册：`src/tools/developer/registry.ts:81`
> 对标标杆：Prettier Playground（markdown parser）＋ markdownlint（DavidAnson，VS Code/CLI 事实标准）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 真 prettier markdown 插件：表格对齐/标题空行规范化✓；proseWrap 三态＋useTabs＋列表符号统一是格式化家族选项最全（:43-63）；缺嵌入代码块格式化、printWidth 未暴露（proseWrap=always 时按默认 80 列）、bullet 不支持 `+` |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 300px**（`MarkdownFormatter.vue:69,71`，共性-根因 2；几何同 M-01），长文档小窗内滚 |
| 实用价值 | 15 | 13 | 13 | "入库前跑一遍"真实痛点（notice 直接点明，:74），仓库 diff 干净；与 markdown-preview（渲染预览）、markdown-to-docx（导出）边界清晰不重复 |
| 交互便捷性 | 15 | 10 | 10 | 选项+按钮置顶✓busy spinner✓；粘贴后需手动点；无渲染效果对照（格式化对错只能凭想象） |
| UI 美观性 | 10 | 7 | 7 | 工整一致；≤560px 才堆叠（共性-根因 5） |
| 灵魂度 | 20 | 6 | 6 | 预填示例✓场景文案✓；但列表符号是正则补丁（:29-31）只覆盖 `*`→`-`、`+` 列表不处理且可能误伤行首星号强调，属"懂一半" |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 6 | — | prettier 主线程同步，万字文档无进度反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化** · P2

判据：可用性 8/20 钉高硬伤（共性-根因 2）；引擎为真 prettier 质量可靠，欠账集中在高度与交互模式，无代差。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 300px（`ResultBox.vue:69`、`MarkdownFormatter.vue:71`；同构几何 M-01）
2. 【功能】嵌入代码块不格式化：Prettier Playground 可对 ```js 围栏内代码同步排版，本工具插件仅载 markdown（`MarkdownFormatter.vue:21`），代码块原样保留——README/技术文档场景核心能力缺席
3. 【功能-疑似问题】bullet 正则补丁 `/^(\s*)\*\s/gm`（`MarkdownFormatter.vue:30`）：仅处理 `*` 列表且无字符串保护，行首形如 `* 强调` 的内容会被误转列表符号；`+` 列表完全不在册（desc 宣称"列表符号统一"名不副实）
4. 【功能】printWidth 未暴露：proseWrap=always 时按 prettier 默认 80 列折行（`MarkdownFormatter.vue:22-27` 未传 printWidth），中文文档按 80 列折行会断句突兀且不可调
5. 【交互】粘贴后需手动点格式化；无"格式化前后 diff"或渲染对照，用户无法确认表格对齐结果是否正确
6. 【灵魂】无快捷键、无 lint 能力边界说明（不检查标题层级/死链/裸链接——这是排版工具不是校验工具，但 UI 未交代，易被误当 markdownlint 用）
7. 【美观】≤560px 才堆叠（共性-根因 5）
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **Prettier Playground**：即改即格式化、全选项（proseWrap/printWidth/嵌入代码格式化）、配置可导出。差距：嵌入格式化与行宽配置是代差；免按钮交互缺失。
- **markdownlint**：MD 规则集逐条检查并可自动修复（标题层级跳级、重复标题、死链）。差距：本工具定位纯排版，与 lint 互补而非竞争——但需在 UI 诚实标注"仅排版规范化，不做内容校验"。
- 借鉴优先级：输出区弹性高度 > 即改即格式化 > 嵌入代码块格式化 > 行宽选项 > lint 边界文案。

## 可拓展性

- 短期（1 周）：输出区弹性高度；粘贴即格式化开关；"仅排版，不含内容校验"边界文案
- 中期（1 月）：printWidth 选项（60/80/100/120）；bullet 补丁改AST 级或支持 `-`/`*`/`+` 三态；嵌入代码块格式化（babel+markdown 插件同载即可）
- 远期：格式化前后 diff 视图；与 markdown-preview/md-toc 组成"Markdown 工作台"（排版+预览+目录单页三 Tab）

## 优化处方（验收标准）

1. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 400 行格式化 Markdown 同屏可见 ≥25 行**
2. **即改即格式化**：paste 自动执行（1s 防抖可关）。→ **验收：粘贴合法 Markdown 1.5s 内输出区出现规范化结果**
3. **行宽选项**：暴露 printWidth 60/80/100/120。→ **验收：proseWrap=always + 行宽 120 时段落折行位置较 80 列明显右移**
4. **bullet 三态**：`-`/`*`/`+` 全支持且不误伤行首强调。→ **验收：输入 `+ 列表` 选 `-` 后转为 `- 列表`；输入 `* 强调 *` 语句不被改写**
5. **嵌入代码格式化**：围栏代码块内 JS 同步排版。→ **验收：```js 块内压缩代码格式化后有缩进与分号**
