# robots.txt 生成（robots-txt-generator）

> 分类：开发工具｜模式：B 变体（策略行＋规则行列表＋ResultBox 实时预览）｜组件：`src/tools/developer/components/RobotsTxtGenerator.vue`（120 行）｜注册：`src/tools/developer/registry.ts:198`
> 对标标杆：xml-sitemaps.com（SEO 站点工具标杆，robots/sitemap 成对）＋ ai-robots-txt 类开源预设集合（AI 爬虫屏蔽名单事实标准）

## 七维评分：60 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 默认策略两态＋自定义规则（UA×Allow/Disallow×路径）＋Crawl-delay＋Sitemap（:19-41）骨架对；**无爬虫预设库**（Googlebot/Baiduspider/GPTBot 要手敲）、无语法校验、Sitemap 仅单值、Crawl-delay 固定挂 * 不能给特定 UA（:33-36） |
| 可用性 | 20 | 12 | 12 | 规则行三控件一行式＋删除按钮（:68-77）直观、实时预览✓；但生成文件把同一 `User-agent: *` 拆成最多三个独立组段（:21-25 基础策略、:26-32 规则、:33-36 delay），严格解析器语义存疑 |
| 实用价值 | 15 | 12 | 12 | robots.txt 低频但出错代价高（误 Disallow 全站被拔），生成器免记忆语法；与 sitemap-generator 是天然成对工具却零打通 |
| 交互便捷性 | 15 | 11 | 11 | 实时生成＋一键下载✓；但"禁止/允许目录"预设只是塞中文占位行（:43-45 path='/目录/'），用户还得手动改路径——预设是半成品 |
| UI 美观性 | 10 | 8 | 8 | 规则行控件等宽对齐、删除按钮 hover 变红（:116-119）；无 UA 下拉/数据列表，纯手敲显原始 |
| 灵魂度 | 20 | 8 | 8 | 诚实 notice（"Disallow 只对遵守协议的爬虫生效…Google 已忽略 Crawl-delay"，:93-95）＋默认给 /admin/ /private/ 示例（:11-14）✓；但 deny-all 与自定义规则并存时的组段语义无任何解释 |
| **加权总分** | 100 | | **60** | |
| 附加：大文件性能 | 10 | 8 | — | 规则数十条内即时，无风险 |
| 附加：移动端 | 10 | 7 | — | 规则行 4 控件 flex（:100-104），340px 屏上 UA/path 输入被压窄需横滑调焦 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：主链路正确、诚实提示加分，但"无预设库＋无校验＋组段拆裂"让它停在语法备忘录层面，离"放心部署的 robots 管理器"差一层，需拓展补预设与校验。

## SEO 家族关系与整合机会

与 SEO 分类 sitemap-generator（`src/tools/seo/registry.ts:8`）是协议层成对工具：本工具的 Sitemap 字段要手填 URL，sitemap-generator 产出 URL 后还得手工复制过来——应互链＋带域名 query 传递。另一层家族关系是页面级 vs 站点级：meta-tag-generator 的 robots 元指令（noindex）与本工具的 Disallow 解决不同层的问题，两页应互相解释引导（"单页不收录→meta robots；整站/目录→本工具"），目前用户两头都得不到指引。

## 扣分点明细

1. 【功能】无爬虫预设：UA 输入是裸 text input（`RobotsTxtGenerator.vue:69`），无 datalist、无常用 UA 一键组——"屏蔽 AI 爬虫"（GPTBot/ClaudeBot/Bytespider 等）是 2026 年站长高频刚需，业界已有成熟名单可直接内置
2. 【可用性】生成文件组段拆裂：基础策略、自定义规则、Crawl-delay 各自输出独立 `User-agent: *` 组（:21-25,:26-32,:33-36），默认配置即可产出 2~3 个 * 组段——多数引擎按 REP 合并语义能容，但严格解析器/教学范本不会这么写，且 Crawl-delay 永远挂 * 无法给特定爬虫设速
3. 【功能】无语法校验与提示：路径通配符 `*`/`$` 语义、中文/空格路径应 URL 编码、Disallow 空值含义，全部依赖用户已有知识，输出"所见"但"是否合法"无从判断
4. 【交互】预设半成品："禁止目录/允许目录"按钮只添加 path 为 `/目录/`、`/公开目录/` 的中文占位行（:43-45），不是真预设；应给 /admin/ /wp-admin/ /tmp/ 等常见组合
5. 【功能】Sitemap 单值（:10,:37-39）：robots.txt 允许多条 Sitemap 指令（多域名/分片站点场景），输入框只吃一条
6. 【可用性-轻】ResultBox 220px 双重钉死（:85；ResultBox.vue:69，共性-根因 2）；十余行规则即触发内部滚动
7. 【灵魂】deny-all 模式下自定义规则仍照常输出（:21-25 与 :26-32 并存），"全局禁抓＋例外允许"到底生效与否无一句解释——恰好是 robots 协议最易误读的点，提示卡缺席

## 行业对标与差距

- **xml-sitemaps.com**：sitemap/robots 成对产出、爬站后自动建议 Disallow 路径、多 Sitemap 支持。差距：**预设库与站内工具联动**。
- **ai-robots-txt 开源集合**：主流 AI 爬虫 UA 名单＋一键屏蔽模板，社区维护持续更新。差距：预设数据面（纯前端静态数据即可内置，无需网络）。
- 借鉴优先级：**爬虫预设（含 AI 爬虫一键屏蔽）> 组段合并输出 > 路径语法提示 > 多 Sitemap > 与 sitemap-generator 互链**。

## 可拓展性

- 短期（1 周）：UA 输入挂 datalist（Googlebot/Baiduspider/Bingbot/GPTBot/ClaudeBot/Bytespider）；预设按钮改真实目录组合；"屏蔽全部 AI 爬虫"一键按钮
- 中期（1 月）：同一 UA 规则合并组段输出；路径含空格/非 ASCII 时黄条提示 URL 编码；Sitemap 多行输入；与 sitemap-generator 互链传域名
- 远期：语法 lint（通配符/空值/冲突规则检测）；"站点体检"形态：贴域名→爬站建议（纯前端受 CORS 限制，退化为手填 URL 列表校验）；并入 SEO 工作台

## 优化处方（验收标准）

1. **爬虫预设库**：UA 输入挂 datalist＋工具行加"屏蔽 AI 爬虫"按钮（注入 GPTBot/ClaudeBot/Bytespider 等 5 组 User-agent×`Disallow: /`）。→ **验收：点击后输出含 `User-agent: GPTBot` 段**
2. **组段合并**：同一 UA 的多条规则合并为一个组段（User-agent 行连写后跟规则），仅 * 组与具名组分开。→ **验收：默认配置输出恰一个 `User-agent: *` 段＋独立 Sitemap 行**
3. **路径语法提示**：path 含空格或非 ASCII 字符时黄条警告"建议 URL 编码"。→ **验收：填 `/目录/` 触发警告，编码后警告消失**
4. **Crawl-delay 挂指定 UA**：规则行支持"延迟"列或 delay 输入旁加 UA 选择。→ **验收：给 Baiduspider 设 2 秒后，输出其组段内含 `Crawl-delay: 2`**
5. **多 Sitemap**：Sitemap 改多行输入（每行一条）。→ **验收：填两行 URL 输出两条 `Sitemap:` 行**
6. **家族互链**：结果区挂"去生成 sitemap.xml"链接（带当前站点域名）。→ **验收：跳转 /t/sitemap-generator 且 URL 列表预填同域名**
