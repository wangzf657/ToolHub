# 本地商家 Schema 生成（schema-localbusiness-generator）

> 分类：SEO工具｜模式：B 变体（Tab 表单×6＋双 ResultBox）｜组件：`src/tools/seo/components/SchemaGenerators.vue`（220 行，六件套共用）｜注册：`src/tools/seo/registry.ts:58`
> 对标标杆：technicalseo.com（Merkle Schema 生成器，对标库）＋ Google 商家资料（Business Profile）字段口径

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 13 字段：名称/电话/四行地址/国家/价位/经纬度/营业时间/图片/官网（:20,:143-158）＋PostalAddress/GeoCoordinates 包装（:65-69）✓；**营业时间要手写 schema 字符串**（"Mo-Sa 09:00-19:00"，:156）、addressCountry 是自由文本非下拉、无 aggregateRating/department/@id、无 OpeningHoursSpecification 结构化输出 |
| 可用性 | 20 | 11 | 11 | **落地即 Article Tab**（tab=ref('article')，:7，路由不注入）；13 字段 grid-2 一屏半＋实时输出✓；双 ResultBox 钉 190/150px（:193-194；ResultBox.vue:69，共性-根因 2） |
| 实用价值 | 15 | 12 | 12 | 本地商家是中小企业 SEO 刚需（地图/本地包展示）；address 恒输出 PostalAddress 空壳（:65-68 无条件展开，全空也输出空地址节点）——产出含空壳节点，验证器会告警 |
| 交互便捷性 | 15 | 10 | 10 | 实时生成✓；但营业时间无逐日构建器（最高频字段反而门槛最高）、经纬度要用户自己去地图工具查坐标无引导、无验证直达（:195） |
| UI 美观性 | 10 | 7 | 7 | 13 字段 grid-2 排布整齐但无分组（联系/地址/地理/营业四组混排）；placeholder 示例（:146-154）是亮点 |
| 灵魂度 | 20 | 7 | 7 | 营业时间 placeholder 给出格式样例（:156）＋价位 ¥¥ 示例（:152）有诚意；但"Mo-Sa"格式对小白仍是一道墙，无实时格式校验（填"周一到周六 9 点"照样输出） |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 8 | — | 单对象拼接即时 |
| 附加：移动端 | 10 | 7 | — | grid-2 ≤560px 堆叠后表单长达 3 屏，结果区更远 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：字段面最宽的六件套成员，但最高频的营业时间字段停留在"手写格式字符串"，地址空壳节点是输出质量问题，均属可修的明确差距。

## Schema 六件套家族共性（六 slug 共用本组件，证据一致）

- **家族-1**：六 slug 共用组件且 `tab` 恒为 `'article'`（:7，无 useRoute）——本 slug 首屏错位；
- **家族-2**：校验只有 name 非空门（:61），无字段级校验、无 Rich Results Test 直达（:195）；
- **家族-3**：双 ResultBox 钉高（:193-194）；空字段省略（:31-35）＋转义防注入（:89）为共同加分项。

## 扣分点明细

1. 【功能-核心】营业时间手写门槛：openingHours 是单行 text input（:156），要求用户掌握 "Mo-Sa 09:00-19:00" 的缩写语法；technicalseo 用逐日×开关时间构建器；填错格式（中文/无空格）无校验照常输出——本地商家最核心字段的可信度全凭用户语法水平
2. 【功能】地址空壳节点：address 节点无条件展开（:65-68，不在 clean() 省略逻辑内），只填商家名时输出 `"address":{"@type":"PostalAddress"}` 全空节点，Rich Results Test 会报告警——与家族"空字段自动省略"的自身优点相悖
3. 【功能】缺 aggregateRating：本地商家富摘要的评分星展示依赖 aggregateRating（需配合评价来源合规），字段缺席
4. 【交互】经纬度无引导：lat/lng 裸文本（:153-154），无"从高德/百度地图坐标拾取器获取"指引链接，普通店主不可能手填坐标
5. 【功能-轻】addressCountry 自由文本（:151）：应为国家代码下拉（CN/TW/US…），ISO 3166 校验缺失；@type 恒为 LocalBusiness，无 Restaurant/Store/Hotel 子类型（Google 按子类型给不同展示）
6. 【可用性】落地 Tab 错位（家族-1）；13 字段无分组视觉，表单是一整块
7. 【交互】无验证直达（家族-2）；双 ResultBox 钉高（家族-3）

## 行业对标与差距

- **technicalseo.com**：LocalBusiness 生成器带子类型选择（Restaurant/Store…）＋逐日营业时间构建器＋GeoCoordinates 帮助。差距：**子类型与营业时间构建器**，均为纯前端可及。
- **Google 本地商家文档**：OpeningHoursSpecification 结构化写法（按天多时段）与 LocalBusiness 子类型树明确。差距：结构化与校验；本工具输出的是简单字符串形态（schema.org 兼容但表达力弱）。
- 借鉴优先级：**逐日营业时间构建器 > address 空壳修复 > @type 子类型选择 > 国家下拉＋坐标指引 > 落地 Tab 路由化**。

## 可拓展性

- 短期（1 周）：address 纳入空值省略（全空不输出 address 节点）；addressCountry 改下拉；营业时间旁加格式说明＋非法格式黄条；hint 挂验证器外链
- 中期（1 月）：营业时间逐日构建器（勾选星期＋起止时间→输出 OpeningHoursSpecification 数组）；@type 子类型下拉（LocalBusiness/Restaurant/Store/Hotel/MedicalClinic…）；aggregateRating 可选节
- 远期：路由化初始 Tab（家族-1）；六件套合并"结构化数据工作台"

## 优化处方（验收标准）

1. **空壳修复**：仅填商家名时输出不含 address 节点。→ **验收：name 填、地址五项全空时 JSON 无 "address" 键且验证器无空节点告警**
2. **营业时间构建器**：七日勾选＋每日起止时间，输出 OpeningHoursSpecification 数组。→ **验收：勾选周一至周六 09:00-19:00 输出 6 组 Specification；周六加 10:00-14:00 第二时段时该日输出两组**
3. **格式校验兜底**：构建器关闭（手写模式）时，值不含英文星期缩写即黄条警告。→ **验收：填"周一到周六"黄条出现；改 Mo-Sa 后消失**
4. **子类型**：@type 下拉含 8+ 常见子类型。→ **验收：选 Restaurant 后输出 `"@type": "Restaurant"`**
5. **坐标指引**：lat/lng 标签旁挂"如何获取坐标"帮助链接。→ **验收：链接指向坐标拾取工具说明且新标签打开**
