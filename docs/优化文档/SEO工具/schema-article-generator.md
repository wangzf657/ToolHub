# 文章 Schema 生成（schema-article-generator）

> 分类：SEO工具｜模式：B 变体（Tab 表单×6＋双 ResultBox）｜组件：`src/tools/seo/components/SchemaGenerators.vue`（220 行，六件套共用）｜注册：`src/tools/seo/registry.ts:52-56`
> 对标标杆：technicalseo.com（Merkle Schema 生成器，对标库：12+ 类型＋验证标杆）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 8 字段：headline/作者/发布方/时间×2/URL/头图/摘要（:17,:99-109）＋author/publisher 包装成 Person/Organization（:42-43）、URL 转 mainEntityOfPage（:44）✓；**缺 publisher.logo**（Google Article 富结果推荐项）、author 无 url 字段、时间仅 date 无 datetime |
| 可用性 | 20 | 11 | 11 | 本 slug 是六件套唯一"落地即对表单"的（tab 默认 article，:7）；8 字段一屏＋双 ResultBox 实时✓；双输出区钉 190/150px（:193-194；ResultBox.vue:69，共性-根因 2） |
| 实用价值 | 15 | 12 | 12 | Article 是博客/资讯站最高频 schema；空字段自动省略（:31-35）＋`<`转义防注入（:89）产出可靠；但缺 logo/image 时 Google 富结果成功率打折，工具无"哪些字段影响展示"分级提示 |
| 交互便捷性 | 15 | 10 | 10 | 实时生成＋双份输出（嵌入 HTML/纯 JSON 分离，:193-194 设计好）✓；无 Rich Results Test 直达（:195 仅文字）、无"从页面 URL 一键推断发布方"（mainEntityOfPage 与 url 分开填两次） |
| UI 美观性 | 10 | 7 | 7 | grid-2 表单工整；必填星号只标 headline（:101），Google 建议的 image/publisher 无任何视觉分级 |
| 灵魂度 | 20 | 7 | 7 | 空值省略＋防注入是家族共同加分✓；但"发布/更新时间对时效性展示的影响""author E-E-A-T 信号"这类懂行提示缺席，工具不懂文章场景的痛点 |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 8 | — | 单对象拼接即时 |
| 附加：移动端 | 10 | 7 | — | grid-2 ≤560px 堆叠（共性-根因 5）；Tab chips 折行 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：产出正确可用，但相对 Google Article 富结果的实际要求（image/publisher.logo/datePublished）缺字段分级与完整度提示，验证闭环缺失；均为可追差距。

## Schema 六件套家族共性（六 slug 共用本组件，证据一致）

- **家族-1**：六个 slug 全部打开同一组件且 `tab` 恒为 `'article'`（:7，无 useRoute）——本 slug 是唯一不受害者，反而是路由化改造后其他五 slug 的受益参照；
- **家族-2**：校验只有 headline 非空门（:38），无字段级校验、无 Rich Results Test 直达（:195）；
- **家族-3**：双 ResultBox 钉高（:193-194）；空字段省略（:31-35）＋转义防注入（:89）为共同加分项。

## 扣分点明细

1. 【功能】缺 publisher.logo 字段：Google Article 富结果文档明确建议 publisher 附 logo（Organization.logo），本工具 publisher 只收名字（:43）——有发布方无 logo 的输出在富结果竞争中先天不足
2. 【功能】author 仅 Person.name（:42）：无 url/sameAs（作者主页/E-E-A-T 信号）；现代实践普遍带 author.url
3. 【功能】无字段影响分级：image/datePublished 是 Google 推荐项、headline 是必备项，UI 星号只标 headline（:101），"填哪些才值得"无引导——technicalseo 每字段带说明文字
4. 【交互】mainEntityOfPage 与页面 URL 场景重复：填一次 url 即可同时推两处，现要求用户理解 schema 语义才知道填 :106 的"页面 URL"会同时生成 @id（:44）——反向问题：想只填其一做不到
5. 【交互】无验证直达（家族-2）：hint 只说"可用 Google 富媒体测试工具验证"（:195）无链接
6. 【可用性-轻】双 ResultBox 钉高（家族-3）：Article JSON 约 12 行在 190px 内勉强，字多即内滚
7. 【灵魂】时间仅 type=date（:103-104）：无 datetime，时效性内容（news）精确到时分才是实践口径

## 行业对标与差距

- **technicalseo.com**：Article 生成器逐字段说明（必填/推荐/可选三档）＋内置校验＋验证器直达。差距：**字段分级说明与验证闭环**；纯前端逐字段 tooltip 可及。
- **Google 搜索中心文档**（Article 结构化数据页）：必备（author/datePublished/headline/image）/推荐（publisher+logo/mainEntityOfPage）分级明确。差距：字段完整度对齐。
- 借鉴优先级：**字段三级分级标注 > publisher.logo/author.url 字段 > 验证器直达 > datetime 支持**。

## 可拓展性

- 短期（1 周）：publisher.logo/author.url 两输入（空省略）；hint 挂 Rich Results Test 外链；字段标签加"必填/推荐/可选"小徽章
- 中期（1 月）：datetime-local 替换 date；"完整度仪表"（必填 3 项全绿即显示达标 chip）；路由化初始 Tab（家族-1 统一修复）
- 远期：NewsArticle/BlogPosting 子类型切换；六件套合并"结构化数据工作台"

## 优化处方（验收标准）

1. **字段补全**：新增 publisher logo URL 与 author url 输入，空则省略。→ **验收：填 logo 后输出 publisher 节点含 `"logo": {"@type":"ImageObject","url":…}`；留空时无此节点**
2. **分级标注**：headline 标"必填"、image/datePublished/publisher 标"推荐"、其余标"可选"。→ **验收：三类徽章渲染且与 Google 文档分级一致**
3. **验证直达**：hint 中"Google 富媒体测试工具"变可点外链。→ **验收：新标签打开 search.google.com/test/rich-results**
4. **datetime**：发布/更新时间改 datetime-local。→ **验收：输出形如 `2026-01-01T09:30:00+08:00`（含时区或本地时间提示）**
5. **家族路由化**（家族-1）：本 slug 不受影响但需回归。→ **验收：改造后本 slug 首屏仍为 Article 表单且其余五 slug 各自命中**
