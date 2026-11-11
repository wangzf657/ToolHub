# Open Graph 生成（open-graph-generator）

> 分类：开发工具｜模式：B 变体（表单＋ResultBox 实时输出）｜组件：`src/tools/developer/components/OpenGraphGenerator.vue`（127 行）｜注册：`src/tools/developer/registry.ts:197`
> 对标标杆：metatags.io（Meta/OG 预览标杆：Google/Twitter/Facebook 三视图，对标库）

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | og: 六字段＋twitter:card/title/desc/image 镜像输出（:16-31）✓；缺 twitter:site/@creator、twitter:image:alt、og:image:width/height/alt、og:locale；og:type=article 时无 published_time/author 附加字段（:61-66 选后输出不变） |
| 可用性 | 20 | 12 | 12 | 表单 7 字段 grid-2 一屏内、实时输出✓；但**零预览**是本工具类的功能性可用性缺陷：卡片效果全凭想象（见扣分 1）；ResultBox 钉 230px（:77，共性-根因 2） |
| 实用价值 | 15 | 13 | 13 | og:image 建议 1200×630 写进字段标签（:56）✓；三张平台提示卡（微信 300KB/5:4、X 回退 og:、调试器建议，:79-92）直接回答国内分享高频问题，实用性超同类生成器 |
| 交互便捷性 | 15 | 10 | 10 | 实时生成＋一键复制✓；og:image 无绝对地址/可公开访问校验（相对路径照单全收，:22 仅拼串）；无逐平台调试器直达链接（提示卡只有文字） |
| UI 美观性 | 10 | 8 | 8 | 三提示卡带图标分栏（:79-92）是全站少有的知识卡设计，860px 收单列（:122-126）；表单与提示卡之间缺视觉主次（提示卡抢戏） |
| 灵魂度 | 20 | 9 | 9 | 引号自动 esc（:17）✓、微信/X/Telegram 平话差异沉淀（:79-92）是"懂行"的证明；但知识停在文字层，没做成可点的调试器外链 |
| **加权总分** | 100 | | **62** | |
| 附加：大文件性能 | 10 | 8 | — | 纯字符串拼接即时 |
| 附加：移动端 | 10 | 8 | — | 表单堆叠顺畅，提示卡单列阅读体验好 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：字段层是合格生成器＋平台知识卡是差异化亮点；但相比 metatags.io 缺整层"卡片预览"能力——纯 CSS 模拟即可实现（无需抓取服务），属必须补的代差。

## SEO 家族关系与整合机会

与 meta-tag-generator（registry.ts:196）共享 title/description/image 四个语义字段却各填各的、零共享零互链；本工具已输出 twitter 镜像标签，meta 工具的 canonical/robots 又是 OG 页不覆盖的——两工具合并度天然最高。建议：短期字段共享（localStorage 双向同步）＋互链；远期与 serp-preview、meta 工具合并"SEO 头部工作台"，一次录入同时产出基础 meta＋OG＋Twitter 三份标签，配 SERP＋社交卡片双预览（metatags.io 即此形态）。

## 扣分点明细

1. 【功能】零预览是代差级缺失：metatags.io 编辑即渲染 Facebook/X/LinkedIn 三平台卡片模拟，本工具只有标签源码（ResultBox :77）——og:image 比例对不对、标题会不会截断全靠用户贴到真实平台试错；纯 CSS 模拟卡片无需任何网络请求，属纯前端可及项而非架构天花板
2. 【功能】Twitter 侧只有 card/title/desc/image 四件（:26-29）：缺 twitter:site（@账号，X 展示归属）、twitter:image:alt（无障碍＋平台推荐）；og:image:width/height/alt 同缺
3. 【功能】og:type=article 无附加字段：选 article（:64）后输出与 website 完全相同，published_time/author/section 一概没有——博客文章场景是 OG 最高频场景之一
4. 【交互】og:image 无校验：相对路径 `/cover.png`、非图片 URL 照样输出且无警告（:22 仅拼串），而提示卡自己都写着"必须是绝对地址且可公开访问"（:90）——规则在提示里不在校验里
5. 【可用性-轻】ResultBox 230px 双重钉死（:77；ResultBox.vue:69），13 行标签勉强够用，属家族共享病灶
6. 【交互】与 meta-tag-generator 字段重复录入：title/description/image 各填一遍，改一处须手工同步两页
7. 【灵魂-轻】调试器建议（:89-91）只有文字没给 Facebook Sharing Debugger/X Card Validator 直达链接，用户还得自己搜

## 行业对标与差距

- **metatags.io**：三平台实时卡片预览、逐字段所见即所得、一键复制、调试器直达。差距：**预览可视化代差**——"看着填"vs"盲填"。
- **本工具独有优势**：微信/Telegram 的国内语境提示（:80-87）是 metatags.io 不覆盖的盲区，应保留并升级为可交互卡片。
- 借鉴优先级：**X/FB 卡片 CSS 模拟预览 > og:image 绝对地址校验 > twitter:site/image:alt 字段 > article 附加字段 > 与 meta 工具字段共享**。

## 可拓展性

- 短期（1 周）：X 大图卡片 CSS 模拟预览（图占位＋title/desc 截断样式）；og:image 非 http(s) 开头黄条警告；提示卡加调试器外链
- 中期（1 月）：twitter:site/twitter:image:alt/og:image:alt 三字段（空则不输出）；og:type=article 追加 published_time/author；与 meta-tag-generator 字段共享＋互链
- 远期：并入"SEO 头部工作台"（含 serp-preview 的 SERP 预览、meta 工具的基础标签），对齐 metatags.io 完整形态

## 优化处方（验收标准）

1. **卡片预览**：输出上方加"X 卡片"模拟视图（summary_large_image：1200×630 图占位＋标题/描述截断样式）。→ **验收：填 80 字符标题时预览出现省略号截断；切换 summary 后缩略图变方形**
2. **og:image 校验**：非 `https?://` 开头时黄条警告"须为绝对地址且公开可访问"。→ **验收：填 `/cover.png` 出现警告且输出照常生成**
3. **字段补全**：twitter:site、twitter:image:alt、og:image:alt 三输入，留空不输出。→ **验收：填 `@toolhub` 后输出含 `<meta name="twitter:site" content="@toolhub">`，留空时无此行**
4. **article 模式**：og:type 选 article 时追加"发布时间/作者"两输入。→ **验收：切换后输出多 `og:article:published_time` 与 `og:article:author` 两行**
5. **调试器直达**：提示卡"调试建议"加 Facebook Sharing Debugger 与 X Card Validator 外链。→ **验收：两链接可点击且在新标签打开**
6. **家族字段共享**：title/description 与 meta-tag-generator 双向同步。→ **验收：本页改标题后跳 meta 页字段已同步，反向亦然**
