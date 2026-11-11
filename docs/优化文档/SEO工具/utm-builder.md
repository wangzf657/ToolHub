# UTM 链接构建器（utm-builder）

> 分类：SEO工具｜模式：B 变体（表单＋ResultBox＋二维码区）｜组件：`src/tools/seo/components/UtmBuilder.vue`（140 行）｜注册：`src/tools/seo/registry.ts:26`
> 对标标杆：Google Campaign URL Builder（ga-dev-tools，对标库）＋ utm.io（云 SaaS 批量管理标杆，天花板标注）

## 七维评分：64 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 5 参数＋URLSearchParams 正确编码中文（:27-43）✓＋4 个 medium 快捷 chip（:17-22）；**无批量**（source×content 矩阵一次一条）、**无历史记录**、无 source 预设（google/wechat 要手敲）、无已有 UTM 参数冲突检测（set() 静默覆盖 :33-37） |
| 可用性 | 20 | 12 | 12 | 单列短表单一屏内、实时产出✓；非法 URL 红框＋中文错误文案（:86-88）可理解可恢复；ResultBox 钉 70px 但单行链接刚好够用（:103；ResultBox.vue:69 家族） |
| 实用价值 | 15 | 13 | 13 | UTM 是投放/运营日频操作；**二维码本地生成**（qrEngine 动态 import，:50-67）直击"线下物料扫码带参"场景，Google 官方 Builder 都没有——差异化实打实 |
| 交互便捷性 | 15 | 11 | 11 | 实时生成＋一键复制（ResultBox）✓＋二维码下载 saveBlob✓（:69-78）；但二维码需手动点按钮（可自动生成）、参数改后已生成二维码不自动刷新、无历史一键重发 |
| UI 美观性 | 10 | 8 | 8 | 表单 grid 工整、二维码区 flex 右置带虚线舞台（:105-114,:129-138）；medium chip 与 term/content 输入并存，新手分不清 chip 是选项还是示例 |
| 灵魂度 | 20 | 8 | 8 | "二维码在本地生成，扫码即打开带参数链接"提示诚实✓（:111）、非法 URL 即时红框✓；但无命名规范提示（GA 对 utm 大小写敏感、推荐小写连字符）、无示例值与真实值区分（默认 wechat/spring-sale 易被原样带上线） |
| **加权总分** | 100 | | **64** | |
| 附加：大文件性能 | 10 | 8 | — | 单 URL 拼接即时，无风险 |
| 附加：移动端 | 10 | 8 | — | qr-row flex-wrap（:123-128）窄屏二维码换行到按钮下方，244px 舞台在 340px 面板内可容纳✓ |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：单条构建链路质量高于 Google 官方 Builder（编码正确＋二维码差异化），但批量与历史（utm.io 的核心价值）缺失使它停在"一次性工具"；补历史与冲突检测属拓展项。

## SEO 家族关系与整合机会

本工具是 SEO 分类里离"营销"最近的成员，与 serp-snippet-preview（title/description 共享录入）、schema 六件套（落地页结构化）同属"SEO 工作台"愿景（DEV-5b 整合路径，meta-tag-generator.md 已立）；短期互链成本最低的动作是结果区挂"预览这条链接的 SERP 展示"跳 serp-snippet-preview。二维码能力与实用工具 qr-code-generator 系列同引擎（qrEngine），家族内已是最小化复用。

## 扣分点明细

1. 【功能】无批量：utm.io/部分竞品支持 source×medium×content 组合矩阵一次产出多条，投放多渠道场景（同一落地页×5 渠道）要手动重复 5 次
2. 【功能】无历史记录：每次建完的链接关页即失，运营周报复盘"上次给公众号配的什么参数"无处可查——localStorage 存最近 20 条即可解
3. 【功能】UTM 参数静默覆盖：基础 URL 自带 utm_source 时 `sp.set()` 直接顶掉旧值（:33-37）无任何警示，埋点冲突无从察觉
4. 【交互】二维码不自动生成也不自动刷新：改参数后旧二维码仍挂在舞台（genQr 仅按钮触发 :50-67），拿错码扫错链是真实事故路径
5. 【功能】无命名规范引导：GA 对 utm_* 值大小写敏感（Spring_Sale≠spring_sale 会拆成两个 campaign），业界惯例全小写＋连字符，工具无提示无归一化选项
6. 【灵魂-轻】默认值 wechat/social/spring-sale/banner-top（:10-15）与真实值无视觉区分，新手易原样上线；无"清空示例"按钮
7. 【交互】source 无 datalist 预设：medium 有 4 个 chip 而 source（google/facebook/wechat/邮件…）全手敲，高频值反而没预设

## 行业对标与差距

- **Google Campaign URL Builder**：官方口径、5 参数一致；无二维码无历史。本工具编码正确性与它持平，二维码是净超越。
- **utm.io**（云 SaaS，架构天花板）：链接库、团队协作、点击统计。差距：**批量矩阵与历史库**；纯前端可逼近的最佳实践是 localStorage 历史＋CSV 批量导出（不需云端）。
- 借鉴优先级：**历史记录 > 参数覆盖警示 > source 预设＋小写归一化 > 二维码自动刷新 > 批量矩阵导出 CSV**。

## 可拓展性

- 短期（1 周）：source 挂 datalist（google/facebook/wechat/xiaohongshu/newsletter）；base URL 已含 utm_* 时黄条警示"将覆盖已有参数"；"清空示例"按钮
- 中期（1 月）：localStorage 最近 20 条历史（域名＋参数＋时间，点击回填）；参数变更自动重生成二维码（防拿错码）；小写归一化开关
- 远期：批量矩阵 Tab（勾选多 source×medium 产出表格＋CSV 导出）；并入"SEO 工作台"与 serp-preview 互链

## 优化处方（验收标准）

1. **覆盖警示**：builtUrl 计算时检测原 URL 已有 utm_*，黄条提示"原链接已含 utm_source=xxx，将被覆盖"。→ **验收：粘贴带 utm_source 的 URL 出现黄条且列出被覆盖的键名**
2. **历史记录**：每次生成（复制或下载动作触发）自动存档，结果区下方"最近使用"列表点击回填全部字段。→ **验收：建两条链接后历史区显示两条，点击第一条各输入框恢复当时值**
3. **source 预设**：source 输入挂 datalist。→ **验收：聚焦 source 出现 6+ 常用来源可选**
4. **二维码自动刷新**：参数变化后 500ms 自动重生成二维码（保留手动按钮）。→ **验收：改 utm_content 后无需点击，二维码自动更新且扫码内容随之变化**
5. **命名规范提示**：任一 utm 字段含大写/空格时黄条建议小写连字符。→ **验收：campaign 填"Spring Sale"出现提示；改 spring-sale 后提示消失**
