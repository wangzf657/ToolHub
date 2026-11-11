# 商品 Schema 生成（schema-product-generator）

> 分类：SEO工具｜模式：B 变体（Tab 表单×6＋双 ResultBox）｜组件：`src/tools/seo/components/SchemaGenerators.vue`（220 行，六件套共用）｜注册：`src/tools/seo/registry.ts:57`
> 对标标杆：technicalseo.com（Merkle Schema 生成器，对标库）＋ Google Merchant Center 免费列表文档口径

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 9 字段：name/brand/price/币种/库存三态/评分＋评论数/图片/描述（:18,:113-128），offers/aggregateRating/brand 包装正确（:50-53）✓；**缺 sku/gtin/mpn 标识符**（Google 商品富结果关键推荐项）、无 review 数组、无 shippingDetails/hasMerchantReturnPolicy（2024 后 Google 商家建议） |
| 可用性 | 20 | 11 | 11 | **落地即 Article Tab**（tab=ref('article')，:7，路由不注入）——搜"商品 schema"进来第一屏是文章表单；双 ResultBox 钉 190/150px（:193-194；ResultBox.vue:69，共性-根因 2） |
| 实用价值 | 15 | 12 | 12 | Product 是富结果价值最高的类型之一；库存三态中文标签（:120）＋币种默认 CNY（:18）本土化好；但缺标识符与退货/运费字段时，Google 商品富摘要与"免费列表"通过率打折，工具无提示 |
| 交互便捷性 | 15 | 10 | 10 | 实时生成✓、评分/评论数同格双输入（:122-124）紧凑✓；无验证直达（:195 仅文字）、评分单填（只有评分无评论数）时 aggregateRating 整体消失（:53 && 条件）无提示 |
| UI 美观性 | 10 | 7 | 7 | grid-2 工整、库存下拉中文清晰；"评分/评论数"合占一格在窄屏挤成两个半宽 input（:123 row） |
| 灵魂度 | 20 | 7 | 7 | 币种默认 CNY＋库存中文化是"懂国内电商"的细节✓；但商品场景的坑（缺 gtin 被判"标识符缺失"、评分虚高被手动处罚）无任何情境提示 |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 8 | — | 单对象拼接即时 |
| 附加：移动端 | 10 | 7 | — | grid-2 ≤560px 堆叠；评分双 input 在 340px 下面积过小 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：字段骨架正确但商品域的专业纵深（标识符/退货/运费/单评分提示）与验证闭环缺失；落地 Tab 错位是家族结构问题，本 slug 直接受害。

## Schema 六件套家族共性（六 slug 共用本组件，证据一致）

- **家族-1**：六 slug 共用组件且 `tab` 恒为 `'article'`（:7，无 useRoute）——本 slug 首屏与工具名不符；
- **家族-2**：校验只有主字段非空门（:47），无字段级校验、无 Rich Results Test 直达（:195）；
- **家族-3**：双 ResultBox 钉高（:193-194）；空字段省略（:31-35）＋转义防注入（:89）为共同加分项。

## 扣分点明细

1. 【功能】缺商品标识符字段：sku/gtin/mpn 是 Google 商品富结果与免费列表的强推荐项（购物类搜索几乎必查），本工具一概没有（:18 product 全量）——产出"能过验证但拿不到完整富摘要"的次品
2. 【功能】评分逻辑黑洞：rating 与 reviews 必须双填才输出 aggregateRating（:53 `&&`），只填评分时静默消失且无提示——用户以为带了评分，实际没带
3. 【功能】无 shippingDetails/hasMerchantReturnPolicy：Google 2024 起在商家文档反复强调退货与运费结构化数据影响展示，纯前端生成器也应提供可选字段
4. 【可用性】落地 Tab 错位（家族-1）：URL/标题说"商品"，第一屏是 headline/作者/发布时间
5. 【交互】无验证直达（家族-2）：商品类恰恰最需要 Rich Results Test（字段错误率高），hint 无链接（:195）
6. 【功能-轻】price 用 type=number（:117）：无法表达区间价/老价格（priceValidUntil 缺位）；币种是自由文本（:118）无 ISO 4217 下拉校验
7. 【可用性-轻】双 ResultBox 钉高（家族-3）：商品 JSON 约 15 行，190px 窗口内滚

## 行业对标与差距

- **technicalseo.com**：Product 生成器带 sku/gtin/condition/priceValidUntil 全家桶＋逐字段说明＋验证。差距：**商品域字段纵深与验证闭环**。
- **Google 商品文档**（搜索中心）：标识符（gtin/mpn/sku）、运费/退货、评分审核政策分级明确。差距：专业完整度；纯前端补字段即可，非天花板。
- 借鉴优先级：**标识符三字段 > 单评分提示（配对填写引导）> 退货/运费可选节 > 验证器直达 > 落地 Tab 路由化**。

## 可拓展性

- 短期（1 周）：sku/gtin/mpn 三输入（空省略）；rating 单填时黄条"需同时填评论数才会输出评分"；hint 挂验证器外链
- 中期（1 月）：priceValidUntil/condition 字段；币种改 ISO 4217 常用下拉；shippingDetails/returns 折叠面板（可选展开）；路由化初始 Tab
- 远期：与 Merchant Center CSV 字段对照视图；六件套合并"结构化数据工作台"

## 优化处方（验收标准）

1. **标识符字段**：新增 sku/gtin/mpn 三输入，空则省略。→ **验收：填 gtin 后输出含 `"gtin13": …`；留空三个都不出现**
2. **评分配对提示**：rating 有值而 reviews 为空（或反之）时黄条提示。→ **验收：只填 4.6 时出现"评论数必填才会输出评分"提示；补 128 后提示消失且 JSON 含 aggregateRating**
3. **落地 Tab 路由化**（家族-1）：按 slug 预设 product。→ **验收：直达 /t/schema-product-generator 首屏即商品表单**
4. **验证直达**：hint 外链 Rich Results Test。→ **验收：新标签打开且旁边有"复制纯 JSON"按钮**
5. **字段说明**：gtin 等新字段带一行小字说明（"条码/出厂号，购物搜索强推荐"）。→ **验收：说明文案渲染且不随输入变化**
