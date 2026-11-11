# XML 站点地图生成（sitemap-generator）

> 分类：SEO工具｜模式：B 变体（textarea＋选项行＋ResultBox 单列）｜组件：`src/tools/seo/components/SitemapGenerator.vue`（141 行）｜注册：`src/tools/seo/registry.ts:8`
> 对标标杆：xml-sitemaps.com（对标库内爬站云标杆）＋ 站内 robots-txt-generator（协议层成对工具，见家族节）

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | URL 列表→sitemap 单向转换：行内 priority 覆盖（:19-37）＋全局 changefreq/lastmod（:88-103）；**无爬站**（CORS 架构天花板，只能"URL 列表→sitemap"要明说）、无 sitemap index、无 image/video/news 变体、无逐 URL lastmod |
| 可用性 | 20 | 12 | 12 | computed 实时预览零按钮✓（:54-67）；有效/无效计数 chip＋warn 横幅（:105-112）；ResultBox 钉 220px（:114；ResultBox.vue:69，共性-根因 2） |
| 实用价值 | 15 | 12 | 12 | 小站手工维护 URL 清单场景真实；XML 转义齐全（:52）、自动补 https://（:36）产出可靠；但 changefreq/priority 是 Google 已声明忽略的字段，工具不提，产出"仪式感大于实效" |
| 交互便捷性 | 15 | 11 | 11 | 一键下载 saveText✓（:69-76）＋根目录部署/搜索控制台提示✓（:119）；无 URL 去重提示、无从 robots-txt-generator 带域名跳入、无粘贴大列表的分批引导 |
| UI 美观性 | 10 | 8 | 8 | 选项三列 grid 工整、720px 收单列（:129-131）；invalid chip 红显（:108,:132）反馈清晰 |
| 灵魂度 | 20 | 8 | 8 | 行内"URL 空格 priority"语法有 notice 教学（:81-84）✓、无效条目自动跳过并计数✓；但 Google 忽略 priority/changefreq 的诚实披露缺席——word-frequency-counter 式的"口径自白"本工具该有而没有 |
| **加权总分** | 100 | | **62** | |
| 附加：大文件性能 | 10 | 6 | — | computed 无防抖（:28-47），数千行 URL 逐键全量重解析 |
| 附加：移动端 | 10 | 7 | — | 选项 720px 断点单列✓；textarea 输出区堆叠后需下滚 |

## 结论与优先级

**交互优化** · P1

判据：转换链路正确无硬伤，但"Google 忽略字段不披露＋与 robots 工具零联动"是可追的专业性差距；爬站能力受 CORS 架构天花板限制，应诚实标注而非沉默。

## SEO 家族关系与整合机会

与 developer 分类 robots-txt-generator（registry.ts:198）是协议层成对工具，对方档案处方 6 已承诺互链带域名跳转，本页目前无任何回链。另与 serp-snippet-preview/schema 六件套同属"SEO 工作台"愿景（DEV-5b 在 meta-tag-generator.md 已立整合路径）：sitemap→搜索控制台提交→结构化数据是同一条站长工作流，互链成本极低。

## 扣分点明细

1. 【功能】**实现路径是"手动贴 URL 列表→XML"**，无任何爬站能力——xml-sitemaps.com 输入域名即爬全站（云端架构，纯前端受 CORS 必墙），本工具连"这是列表编译器不是爬虫"的边界声明都没有（:81-84 notice 只讲行内语法）
2. 【功能】changefreq/priority 全局一刀切且 Google 官方已声明忽略 `<changefreq>`/`<priority>`（仅 `<lastmod>` 可验证时采用），工具照常输出六档频率选择却不披露，误导用户以为影响抓取
3. 【功能】无重复 URL 检测：同一 URL 贴两遍生成两段 `<url>`，sitemap 协议要求去重
4. 【功能】无 sitemap index：>5 万 URL 或分片站点需 index 文件，工具无此形态（列表场景低频，但缺位应写进提示）
5. 【交互】与 robots-txt-generator 零互链：两页各需填一次站点域名，无 query 传递
6. 【灵魂】lastmod 单日期全局共享（:100-102）：把全站 URL 标成同一天修改，真实站不成立，逐行支持（同 priority 行内语法）才有诚意
7. 【性能】数千行 URL 粘贴后 computed 逐键重算无防抖（:28-47），无条目数上限提示（协议上限 5 万条/50MB）

## 行业对标与差距

- **xml-sitemaps.com**：输入 URL 即爬站（免费档 500 页）→ 生成含分段（sitemap index）→ 提供 robots.txt 提示行。差距：**爬站能力为云架构天花板**；纯前端可逼近的最佳实践是"诚实标注＋去重＋index 形态＋lastmod 行内语法"。
- **Google 官方口径**（search-console 文档）：明确忽略 changefreq/priority。差距：专业诚实度——对标库规则 3 的"UI 上诚实标注能力边界"在本工具未落实。
- 借鉴优先级：**忽略字段披露 > URL 去重警示 > 与 robots 工具互链 > 行内 lastmod > sitemap index 模板**。

## 可拓展性

- 短期（1 周）：notice 加"Google 已忽略 changefreq/priority，lastmod 最重要"口径行；重复 URL 检测 chip 红显；与 robots-txt-generator 双向互链带域名
- 中期（1 月）：行内 lastmod 语法（`URL 空格 YYYY-MM-DD`）；sitemap index 生成 Tab；5 万条上限校验＋分片引导
- 远期：并入"SEO 工作台"：贴域名→（可选云服务或用户自贴 URL 列表）→ sitemap＋robots 一次产出

## 优化处方（验收标准）

1. **诚实披露**：notice 增补一行"Google 忽略 changefreq 与 priority；lastmod 持续准确才有价值"。→ **验收：文案渲染且 changefreq 下拉旁出现"（Google 已忽略）"小字**
2. **去重警示**：entries 计算后检测重复 URL，chip 显示"重复 N 条"并红显。→ **验收：同一 URL 粘贴两行后出现重复计数，XML 中该 URL 仅输出一次**
3. **家族互链**：结果区头部挂"去生成 robots.txt"链接并带第一个有效 URL 的域名。→ **验收：点击跳转 /t/robots-txt-generator 且 Sitemap 字段预填本页域名**
4. **行内 lastmod**：支持 `https://a.com 2026-01-01` 行内日期覆盖全局。→ **验收：混合行内/全局日期时各 `<url>` 输出对应 lastmod**
5. **防抖**：解析加 200ms 防抖。→ **验收：粘贴 5000 行 URL 后连续滚动无逐键卡顿（Performance 无长任务连发）**
