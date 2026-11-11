# Markdown 目录生成（markdown-toc）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/MarkdownToc.vue`（158 行）＋ `src/components/common/ResultBox.vue`｜引擎：marked.lexer 真解析 + 自实现 GitHub slugify（`MarkdownToc.vue:23-33`）｜注册：`src/tools/developer/registry.ts:82`
> 对标标杆：VS Code「Markdown All in One」插件（TOC 命令，yzhang）＋ AlanWalk/markdown-toc（Atom 插件）

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | marked.lexer 真解析非正则（:36-37）、GitHub 锚点含中文保留/重复标题 -1（:23-33）、深度 2~4 可选、MD 列表与嵌套 HTML nav 双输出（:68-90）；缺 h5/h6、"锚点规则"选项无实效（扣分 1）、无 TOC 插回/更新已有区块 |
| 可用性 | 20 | 12 | 12 | 双栏各钉 280px（`MarkdownToc.vue:136,138`＋`ResultBox.vue:69` 双重钉高），比家族均值（300~320px）更紧；TOC 目标场景恰是长文，输入窗憋屈，但输出（目录）行数少、280px 够看，未触发硬伤 |
| 实用价值 | 15 | 13 | 13 | 写作/文档站真痛点，锚点规则对齐 GitHub 渲染行为，产物即拿即贴 |
| 交互便捷性 | 15 | 10 | 10 | 选项+按钮置顶✓busy spinner✓；但改层级/格式/编辑标题后必须手动再点"生成目录"（run 仅按钮触发），对比 TextTool 家族 watch 自动执行（`TextTool.vue:47-48`）是倒退 |
| UI 美观性 | 10 | 7 | 7 | 工整一致；grid-2 ≤560px 才堆叠（共性-根因 5），842px 面板双栏各 ~390px |
| 灵魂度 | 20 | 7 | 7 | 预填示例自带重复标题演示 -1 规则（:9）是懂行细节✓；但"VuePress 风格"选项形同虚设属假功能伤信任，无示例追加、无快捷键 |
| **加权总分** | 100 | | **61** | |
| 附加：大文件性能 | 10 | 6 | — | lexer 主线程同步，万字文档无进度反馈（转换较轻） |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（实测锚点横向结论 6） |

## 结论与优先级

**交互优化** · P2

判据：可用性 12/20 未触发硬伤红线（输出短、280px 可读）；欠账集中在"死选项"与手动刷新两处，属交互摩擦而非功能代差。

## 扣分点明细

1. 【功能-疑似问题】"锚点规则"下拉有 GitHub/VuePress 两项（`MarkdownToc.vue:113-118`），但 slugify 全程只按 GitHub 规则执行（:23-33），`linkStyle` 从未参与任何分支——选 VuePress 与选 GitHub 输出完全相同，属死选项；底部 notice（:141）自认"VuePress 场景下 GitHub 规则同样适用"，却未解释为何仍提供该选项
2. 【功能】深度上限 h4：选项仅 2/3/4（:107-110），h5/h6 无法收录——长技术文档场景缺角；且深度语义只有"从 h1 数到 N"，无法"只要 h2~h3"（跳过 h1）
3. 【可用性】双栏各钉 280px（`MarkdownToc.vue:136,138`；`ResultBox.vue:69` height=minHeight 双重钉高），长文输入需大量内滚（共性-根因 2；几何同 M-01）
4. 【交互】无实时重算：run 仅由按钮触发（:127-130），粘贴/改选项后需再点一次——TextTool 家族 watch 自动执行（`TextTool.vue:47-48`）证明站内已有免按钮范式
5. 【灵魂】无"插回文档"工作流：TOC 的归宿是粘回 Markdown 开头，本工具止步于复制输出；未提供"替换已有 TOC 区块"能力（Markdown All in One 可按 `<!-- TOC -->` 注释定位更新）
6. 【灵魂】无示例文档追加按钮（对比 markdown-preview 的"追加表格示例"）、无快捷键
7. 【美观】≤560px 才堆叠（共性-根因 5）；768px 平板双栏近乎不可读
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **VS Code Markdown All in One**：TOC 支持 h1~h6 全深度、`<!-- TOC -->` 区块更新式工作流、锚点规则可选。差距：更新式工作流与全深度。
- **AlanWalk/markdown-toc**：depthFrom/depthTo 独立上下限（可跳过 h1 只取 h2~h4）、--bullets 自定义、--update 更新。差距：深度区间语义与更新能力。
- 借鉴优先级：删死选项或真实现 VuePress 规则 > depthFrom/depthTo 区间 > 实时重算 > TOC 区块更新。

## 可拓展性

- 短期（1 周）：linkStyle 实装（VuePress slugify 变体）或移除该选项；双栏弹性高度
- 中期（1 月）：depthFrom/depthTo 双下拉；实时重算（300ms 防抖）；h5/h6 支持
- 远期：并入"Markdown 工作台"（与 markdown-formatter/markdown-preview 三 Tab：排版+预览+目录）

## 优化处方（验收标准）

1. **锚点规则二选一**：实装 VuePress slugify 变体或删除该下拉。→ **验收：切换"VuePress 风格"后含空格/标点标题的输出与 GitHub 模式不同（或页面上已无该选项）**
2. **深度区间**：depthFrom/depthTo 两个下拉替代 maxDepth。→ **验收：选 h2~h3 后 h1 与 h4~h6 均不出现在输出**
3. **实时重算**：watch(input/maxDepth/linkStyle/outFmt) 300ms 防抖自动生成。→ **验收：粘贴文档 500ms 内输出区自动出现目录，无需点击**
4. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 300 行文档同屏可见 ≥25 行**
5. **TOC 区块更新**：识别 `<!-- TOC -->` 注释，提供"仅复制区块间内容"。→ **验收：文档含该注释时，可一键复制待替换区间内容**
