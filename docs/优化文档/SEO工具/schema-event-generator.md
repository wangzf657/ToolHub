# 活动 Schema 生成（schema-event-generator）

> 分类：SEO工具｜模式：B 变体（Tab 表单×6＋双 ResultBox）｜组件：`src/tools/seo/components/SchemaGenerators.vue`（220 行，六件套共用）｜注册：`src/tools/seo/registry.ts:59`
> 对标标杆：technicalseo.com（Merkle Schema 生成器，对标库）＋ Google 活动富结果文档口径

## 七维评分：55 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 11 字段：名称/状态四态/起止时间/场地/城市/票价币种/地址/URL（:21,:162-179）＋eventStatus/Place/Offer 包装（:73-78）✓；**缺 eventAttendanceMode**（Google 线上/混合活动必备字段）、offers 无 availability/validFrom、无 performer/image/description |
| 可用性 | 20 | 11 | 11 | **落地即 Article Tab**（tab=ref('article')，:7，路由不注入）；datetime-local 控件（:171-172）是六件套里唯一精确到时分的时间输入✓；双 ResultBox 钉 190/150px（:193-194；ResultBox.vue:69，共性-根因 2） |
| 实用价值 | 15 | 12 | 12 | 活动富结果（时间/地点/票价卡片）对演出/会议/社区活动真实有效；状态四态中文化（:167-169）好；但线上活动（EventMovedOnline 状态存在）缺 attendanceMode 时 Google 明确不给线上标记，状态与能力自相矛盾 |
| 交互便捷性 | 15 | 10 | 10 | datetime-local＋状态下拉✓；但场地与地址/城市三处输入合并成逗号字符串（:76）语义含糊、无验证直达（:195）、结束时间可选无"建议必填"提示（Google 推荐提供） |
| UI 美观性 | 10 | 7 | 7 | grid-2 工整；"场地名/城市/详细地址"三字段关系（Place.name vs PostalAddress）未做视觉分组，用户不知哪项进哪个槽 |
| 灵魂度 | 20 | 6 | 6 | 状态四态中文文案（"按计划举行/延期/取消/改为线上"）是懂活动的翻译✓；但"改为线上"选项存在而对应字段缺失是功能矛盾；无虚拟活动场景引导（attendanceMode/Online 的联动） |
| **加权总分** | 100 | | **55** | |
| 附加：大文件性能 | 10 | 8 | — | 单对象拼接即时 |
| 附加：移动端 | 10 | 7 | — | grid-2 ≤560px 堆叠后表单 3 屏；datetime-local 移动端原生控件体验好 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：基础骨架可用但活动域关键字段（attendanceMode/offers 配套）缺失造成"状态能选线上、结构撑不起线上"的能力矛盾；落地 Tab 错位（家族）直接受害。

## Schema 六件套家族共性（六 slug 共用本组件，证据一致）

- **家族-1**：六 slug 共用组件且 `tab` 恒为 `'article'`（:7，无 useRoute）——本 slug 首屏错位；
- **家族-2**：校验只有 name 非空门（:72），无字段级校验、无 Rich Results Test 直达（:195）；
- **家族-3**：双 ResultBox 钉高（:193-194）；空字段省略（:31-35）＋转义防注入（:89）为共同加分项。

## 扣分点明细

1. 【功能-核心】缺 eventAttendanceMode：Google 要求线上/混合活动必须声明 OfflineEventAttendanceMode/OnlineEventAttendanceMode/MixedEventAttendanceMode，本工具无此字段（:21,:73-78 全量无 attendanceMode）——选了"改为线上"状态（:168）却输出不了对应模式，富结果验证不通过
2. 【功能】location 结构退化：venue/address/city 拼成逗号字符串 `address: [address, city].join(', ')`（:76）——schema.org Place.address 支持 Text 但 Google 推荐 PostalAddress 对象；"上海大剧院, 上海"式字符串在严格解析下丢失省市层级
3. 【功能】offers 不完整：缺 availability（InStock/SoldOut，售票场景核心）、validFrom（开售时间）、无 url 必填引导（:77 仅 price 有值才带 url）——Google 活动富结果对 offers 的 complete 性有明确要求
4. 【可用性】落地 Tab 错位（家族-1）；双 ResultBox 钉高（家族-3）
5. 【功能-轻】无 performer/image/description：演出类活动的演员/海报是常见展示要素，字段缺席；endDate 可选但 Google 建议多日活动必填，无提示
6. 【交互】无验证直达（家族-2）：活动字段错误率在各类型中最高（时间格式/时区），最需要验证闭环
7. 【灵魂】时区问题未提：datetime-local 无时区字段，跨地区活动（线上全球）输出本地时间无 TZ 标注，Google 按发布机器时区解释易错——懂活动的工具应处理这一点

## 行业对标与差距

- **technicalseo.com**：Event 生成器带 eventAttendanceMode 三态、offers 配套（availability/validFrom）、performer 数组、逐字段说明＋验证。差距：**活动域字段纵深**；全部纯前端可及。
- **Google 活动文档**（搜索中心）：attendanceMode/status/location/offers 四要素关系明确（虚拟活动示例完整）。差距：字段完整度与联动逻辑。
- 借鉴优先级：**attendanceMode 三态（与状态联动）> offers 补 availability/validFrom > location PostalAddress 化 > 时区处理 > 落地 Tab 路由化**。

## 可拓展性

- 短期（1 周）：attendanceMode 下拉（默认 Offline）并在状态选"改为线上"时自动切 Online＋提示；offers 加 availability 下拉；hint 挂验证器外链
- 中期（1 月）：location 改 PostalAddress 结构化输出；performer 多行输入；UTC 偏移或 TZ 提示；路由化初始 Tab（家族-1）
- 远期：从 URL/ICS 文件导入活动信息；六件套合并"结构化数据工作台"

## 优化处方（验收标准）

1. **attendanceMode**：新增三态下拉，默认 OfflineEventAttendanceMode。→ **验收：选"改为线上"状态时自动切 OnlineEventAttendanceMode 并黄条提示已联动；输出含该字段**
2. **offers 补全**：availability 下拉（InStock/SoldOut/PreOrder）＋validFrom 日期输入，空省略。→ **验收：选 SoldOut 后输出 `"availability": "https://schema.org/SoldOut"`**
3. **location 结构化**：有街道/城市时输出 PostalAddress 对象，仅场地名时退化为 name-only Place。→ **验收：填场地+城市+地址输出 `"address": {"@type":"PostalAddress", …}` 而非逗号字符串**
4. **落地 Tab 路由化**（家族-1）。→ **验收：直达 /t/schema-event-generator 首屏即活动表单**
5. **验证直达**（家族-2）。→ **验收：hint 外链新标签打开 Rich Results Test**
