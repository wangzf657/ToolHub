# Markdown 预览（markdown-preview）

> 分类：开发工具｜模式：D（grid-2 双栏 + 预览盒）｜组件：`src/tools/developer/components/MarkdownPreview.vue`（111 行）｜引擎：`src/lib/mdEngine.ts` mdToHtml（marked gfm + KaTeX + Mermaid + DOMPurify，`mdEngine.ts:14-22`）｜注册：`src/tools/developer/registry.ts:158`
> 对标标杆：StackEdit（stackedit.io）＋ Dillinger（dillinger.io）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 14 | 14 | GFM 表格/任务列表✓（`mdEngine.ts:17`）+ KaTeX 行内/块级公式（:25-44）+ Mermaid 图表（:47-77）+ DOMPurify 净化（:21）+ 独立 HTML 导出（含 KaTeX CDN）——渲染功能面全站最全；缺代码高亮、导出 PDF、frontmatter |
| 可用性 | 20 | 8 | 8 | **硬伤：预览区 max-height 520px 钉死**（`MarkdownPreview.vue:91`，审计底稿钉高清单点名）、输入区 380px（:71）；长文两侧小窗各自内滚，无滚动同步，同屏对不齐 |
| 实用价值 | 15 | 13 | 13 | CMS/文档站取 HTML 真场景；导出 HTML 自带排版样式可独立打开 |
| 交互便捷性 | 15 | 8 | 8 | **desc 承诺"实时渲染预览"但 render 仅挂载时执行一次（:35 void render()），输入改动不重渲**——必须手动点"渲染预览"（:60）；无滚动同步、无防抖实时 |
| UI 美观性 | 10 | 7 | 7 | prose 排版统一、KaTeX/Mermaid 深度样式齐（:97-110）；预览窗 520px 钉死；≤560px 堆叠（共性-根因 5） |
| 灵魂度 | 20 | 8 | 8 | 预填示例覆盖数学+Mermaid（:9）引导性强✓"追加表格示例"增量演示✓（:51-54）复制提示"公式/图表为静态结果"诚实✓（:40）；但"实时"缺失违背预览工具灵魂 |
| **加权总分** | 100 | | **58** | |
| 附加：大文件性能 | 10 | 6 | — | 每次全量 marked+KaTeX+Mermaid 主线程执行，长文无分片/防抖 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后预览区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化** · P1

判据：desc 与实现不符（"实时渲染"承诺未兑现，`registry.ts:158`）+ 预览区钉高硬伤（:91）；功能面（数学/图表）领先 Markdown 家族，但交互模式落后 StackEdit 一个代际。

## 扣分点明细

1. 【可用性-硬伤】预览盒 `max-height:520px` 钉死（`MarkdownPreview.vue:91`；审计底稿 developer 系钉高清单点名），无弹性高度、无全屏切换
2. 【交互-疑似问题】desc 宣称"输入 Markdown 实时渲染预览"（`registry.ts:158`），实际 render() 仅在挂载（`MarkdownPreview.vue:35`）、勾选框（:64-65）与按钮（:60）触发，输入无 watch——粘贴长文后预览仍是旧内容，与文案直接矛盾
3. 【可用性】无滚动同步：输入与预览独立滚动（无 scroll 联动），对照长文档两侧永远对不齐——StackEdit/Dillinger 的核心体验
4. 【功能】代码块无语法高亮：mdToHtml 未接 highlight（`mdEngine.ts:14-22` 仅 marked gfm），技术文档预览黑白菜
5. 【功能】导出 HTML 数学依赖 jsdelivr CDN（`MarkdownPreview.vue:45`），离线打开公式失效；无导出 PDF/长图路径
6. 【灵魂】长文预览无大纲导航（markdown-toc 的能力未联动）；无字数/行数统计
7. 【美观】520px 内滚让"长文读不完"成为错觉；≤560px 堆叠（共性-根因 5）
8. 【环境】Cookie 横幅首访遮挡底部 notice（M-01 截图证据）

## 行业对标与差距

- **StackEdit**：左右实时渲染+双向滚动同步（锚点算法）、代码高亮、TOC 侧栏、导出带样式 HTML/PDF。差距：实时性与滚动同步是代差——对方让 Markdown"边写边看"，本工具是"写完点一下再看"。
- **Dillinger**：即改即渲（防抖）、导出 PDF/HTML/MD 三态、主题切换。差距：免按钮交互与导出矩阵。
- 借鉴优先级：输入防抖实时渲染 > 双向滚动同步 > 预览弹性高度 > 代码高亮 > 导出 PDF。

## 可拓展性

- 短期（1 周）：watch input + 500ms 防抖实时渲染；预览盒弹性高度
- 中期（1 月）：行号比例滚动同步（可开关）；highlight.js 懒加载接入；导出 HTML 可选内联 KaTeX 字体
- 远期：与 markdown-toc/markdown-formatter 合并"Markdown 工作台"（预览+目录+排版单页三 Tab）；打印样式导出 PDF

## 优化处方（验收标准）

1. **实时渲染**：watch(input) 500ms 防抖调 render，渲染中 busy 指示。→ **验收：粘贴 Markdown 后 1s 内预览更新，无需点击"渲染预览"**
2. **预览盒弹性高度**：默认 `calc(100vh - 330px)` 下限 480px，提供全屏切换。→ **验收：1366×768 下 400 行文档预览无需滚动页面即可通读 ≥28 行**
3. **滚动同步**：按行号比例联动（预览区可开关）。→ **验收：输入区滚至 50% 位置时预览区跟随至约 50%**
4. **代码高亮**：懒加载 highlight.js 处理围栏代码块。→ **验收：```js 块预览中关键字/字符串/注释有配色区分**
5. **文案对齐**：若维持手动渲染模式，修改 `registry.ts:158` desc 去掉"实时"字样。→ **验收：工具页描述与实际交互一致，无"实时"承诺**
