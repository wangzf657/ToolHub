# HTML 转 Markdown（html-to-markdown）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/HtmlToMarkdown.vue`（110 行）｜引擎：htmlToMd（turndown + turndown-plugin-gfm + td 内块级 p 拍平预处理，`src/lib/mdEngine.ts:88-119`）｜注册：`src/tools/developer/registry.ts:73`
> 对标标杆：Turndown 官方 Demo（domchristie.github.io/turndown）＋ Obsidian/Notion 导入器

## 七维评分：65 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | turndown+GFM 表格/删除线/任务列表（`mdEngine.ts:117`）+ td 内块级 p 拍平预处理（:88-105，专治 mammoth/网页富文本表格失效）+ 富文本粘贴 text/html 优先（:29-38）+.html 文件；缺转换选项（标题风格/项目符号/代码围栏）与选择性转换 |
| 可用性 | 20 | 11 | 11 | 双栏各钉 300px（`HtmlToMarkdown.vue:67,78`＋`ResultBox.vue:69` 双重钉高；几何同 M-01）；输入超限静默截断（扣分 1） |
| 实用价值 | 15 | 13 | 13 | 笔记迁移（飞书/语雀/网页复制）真场景，GFM 产出可直接入库 |
| 交互便捷性 | 15 | 12 | 12 | **粘贴即自动转换**（onPaste→convert，:29-38）全家族最佳实践✓；.html 文件入口✓手动重转✓hint-box 引导清晰✓（:60-63）；但需先点击聚焦（paste 挂局部元素，非 window 级） |
| UI 美观性 | 10 | 7 | 7 | hint-box 虚线强调区醒目专业✓；双栏 ≤560px 堆叠（共性-根因 5） |
| 灵魂度 | 20 | 9 | 9 | 粘贴即处理 + silent 参数防双 toast 的细节考量（:15 注释）是家族灵魂分样本✓；但 20 万/50 万字符静默截断（:36,:43）无提示——懂一半；空态无预填示例 |
| **加权总分** | 100 | | **65** | |
| 附加：大文件性能 | 10 | 7 | — | 20 万字符上限规避了极端卡顿；DOMParser 主线程 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化** · P2

判据：粘贴即转换已达家族最佳交互水位（65 分为 Markdown 家族最高）；欠账集中在选项缺失与静默截断的信任问题，无代差。

## 扣分点明细

1. 【灵魂-疑似问题】输入静默截断：粘贴截断 200,000 字符、文件截断 500,000 字符（`HtmlToMarkdown.vue:36,43`），UI 无任何"已截断"提示——长文用户拿到不完整产出而不自知，信任硬伤
2. 【功能】零转换选项：turndown 配置硬编码（headingStyle:atx、bullet:'-'、em:'*'，`mdEngine.ts:110-116`），标题风格/项目符号/代码围栏风格均不可选——Turndown 官方 Demo 全部可调
3. 【交互】粘贴需先点击 hint-box 或输入框聚焦（paste 事件挂局部元素 :60,:67），未挂 window——从"复制完切到本页直接 Ctrl+V"还差一步
4. 【可用性】双栏各钉 300px（`HtmlToMarkdown.vue:67,78`；`ResultBox.vue:69`；几何同 M-01）
5. 【功能】无选择性转换：不支持"忽略 img/仅转正文"；网页常含导航/页脚噪音，直接 turndown 产生大量无用链接行（Obsidian 导入器带正文提取预处理）
6. 【灵魂】空态无预填示例（对比 markdown-toc 有示例）；无 GFM 能力边界说明（iframe/video/公式等标签转不出，会静默丢失）
7. 【美观】≤560px 堆叠（共性-根因 5）；842px 面板双栏偏挤
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **Turndown 官方 Demo**：全选项面板（headingStyle/bullet/em/codeBlockStyle 等即时切换）、即时转换。差距：选项面板整体缺席。
- **Obsidian/Notion 导入器**：正文智能提取（去导航去广告）、图片批量下载重链、批量文件队列。差距：选择性转换与批处理能力。
- 借鉴优先级：截断提示 > 选项三件套（标题/项目符号/围栏）> window 级粘贴 > 正文提取（readability 系）。

## 可拓展性

- 短期（1 周）：截断 toast 警示（"已截取前 20 万字符"）；window paste 监听；预填示例
- 中期（1 月）：选项三件套；忽略标签配置（checkbox：img/script/nav）
- 远期：Readability 正文提取选项；与 docx-to-markdown 并为"转 Markdown 工作台"双入口

## 优化处方（验收标准）

1. **截断提示**：达到上限时 toast.warn 告知实际保留长度。→ **验收：粘贴 30 万字符文本出现明确警示，输入框字符数与提示一致**
2. **window 级粘贴**：进入页面无需聚焦即可 Ctrl+V 转换。→ **验收：加载页面后直接 Ctrl+V，输出区 1s 内出现结果**
3. **选项面板**：标题 ATX/Setext、项目符号 -/*/+、围栏 ~`` 三组下拉。→ **验收：切 Setext 后一级标题输出为 `===` 下划线式**
4. **忽略标签**：勾选"忽略图片"后输出无 `![]()` 行。→ **验收：含 10 张图的网页转换，勾选后输出零图片语法**
5. **输出弹性高度**：expand 模式下限 480px。→ **验收：1366×768 下转换产物同屏可见 ≥25 行**
