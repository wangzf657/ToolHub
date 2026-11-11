# hreflang 标签生成（hreflang-generator）

> 分类：SEO工具｜模式：B 变体（行编辑网格＋ResultBox 实时输出）｜组件：`src/tools/seo/components/HreflangGenerator.vue`（123 行）｜注册：`src/tools/seo/registry.ts:61`
> 对标标杆：ahrefs hreflang tags generator（对标库）＋ Google hreflang 文档口径

## 七维评分：63 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 语言 20 选×地区 27 选双下拉（:7-9）＋行增删（:24-25）＋组合码实时预览（:28,:65）＋LANG_RE 校验（:29-30）＋x-default 开关＋独立 URL（:21-22,:70-76）✓；**缺 BCP47 文字子标签**（zh-Hant/zh-Hans 对中文站是刚需，:29 正则不支持）、语言库 20 种不可扩展（sr/hr/uk…不在册）、无重复组合检测 |
| 可用性 | 20 | 12 | 12 | 行式网格＋组合码 chip 即时验证反馈（:65 bad 红显）✓；汇总错误 notice 中文可理解（:78）；ResultBox 钉 170px（:80；ResultBox.vue:69，共性-根因 2），标签行多时内滚 |
| 实用价值 | 15 | 12 | 12 | 多语言站 hreflang 是硬协议（写错即弃用），生成器免除手写错误；zh-Hant 缺失使繁体中文站（港台市场高频场景）无法正确表达——对本站受众是实打实的坑 |
| 交互便捷性 | 15 | 11 | 11 | 实时生成＋一键复制✓；但无 URL 模式推导（填首页与路径规则批量生成 /en/ /ja/ 各行）、无重复组合黄条、行多时无批量导入导出 |
| UI 美观性 | 10 | 8 | 8 | 五列网格表头对齐（:87-92）、组合码 mono 高亮＋bad 红显（:101-109）好；640px 断点优雅降级隐藏 code 列（:119-122）✓ |
| 灵魂度 | 20 | 8 | 8 | 底部 hint 讲透互指原则（"每个语言版本页面都应包含全部互指标签（含自身）；x-default 指向语言选择页"，:81）是懂行文案✓✓；但校验错误只有一条汇总 notice（:78）不指明哪行错 |
| **加权总分** | 100 | | **63** | |
| 附加：大文件性能 | 10 | 8 | — | 十余行即时 |
| 附加：移动端 | 10 | 8 | — | 640px 四列降级（:119-122）是本分类少见的移动端专门处理；URL 输入仍偏窄 |

## 结论与优先级

**交互优化** · P1

判据：协议实现正确、互指文案是分类最佳；扣分集中在"zh-Hant 缺位＋错误定位＋无推导"三个单点，无结构性硬伤，属于补齐型改造。

## SEO 家族关系与整合机会

与 sitemap-generator 是天然搭档：hreflang 除 head 标签形态外还有 sitemap `xhtml:link` 形态（多语言大站官方推荐），两工具互链后可在 sitemap 侧提示该形态；与 serp-snippet-preview/schema 六件套同属"SEO 工作台"愿景（DEV-5b）。低成本动作：结果区挂"多语言站还差 sitemap.xml→去生成"互链（robots-txt-generator.md 处方 6 的反向同款）。

## 扣分点明细

1. 【功能-核心】不支持文字子标签：LANG_RE `^[a-z]{2,3}(-[A-Z]{2})?$`（:29）拒绝 `zh-Hant`/`zh-Hans`——Google hreflang 文档明确支持 BCP47 文字子标签，且"简繁中文互指"（zh-Hans-CN/zh-Hant-TW）正是中文多语言站最高频的 hreflang 场景，本工具做不到
2. 【功能】语言库封闭：20 种语言（:7）下拉无 sr/hr/uk/cs/da/fi/no/el/he/fa/bn 等，LANG_RE 本身允许 2-3 位小写但 UI 只能从下拉选——校验能力和选择能力不一致
3. 【交互】错误不定位：hasError 汇总一条 notice（:31,:78），多行时不知道哪行错；行内组合码 chip 虽红显（:65）但 URL 错误（非 http(s)）只红 input 边框（:62）无文字
4. 【功能】无重复组合检测：两行都选 zh-CN 时输出两条相同 hreflang 标签（:33-43 去重逻辑不存在），Google 视为配置错误
5. 【交互】无 URL 规则推导：填首页 URL＋路径模板（`/{lang}-{region}/`）一键生成全部行，多语言站 5+ 版本时要手填 5 行 URL
6. 【功能-轻】无 sitemap xhtml:link 形态输出：head 标签之外的第二种官方形态（多语言大站推荐），Tab 化可补
7. 【可用性-轻】ResultBox 钉 170px（:80），10+ 语言版本时标签区过矮内滚

## 行业对标与差距

- **ahrefs hreflang generator**（对标库）：语言/地区自由输入＋ISO 校验＋x-default＋生成后可直接下载。差距：**输入自由度（任意 ISO 码）与 zh-Hant 类文字子标签支持**。
- **Google hreflang 文档**：三种形态（head link/HTTP header/sitemap xhtml:link）＋BCP47 组合说明＋"互指自含"原则。差距：形态覆盖（本工具仅 head link）与文字子标签。
- 借鉴优先级：**文字子标签支持（zh-Hant/zh-Hans）> 重复组合检测 > 错误行定位 > URL 规则推导 > sitemap 形态 Tab**。

## 可拓展性

- 短期（1 周）：LANG_RE 扩为 `^[a-z]{2,3}(-[A-Za-z]{4}(-[A-Z]{2})?)?$` 并在下拉加"zh-Hant/zh-Hans 快捷项"；重复组合红显＋汇总计数；错误 notice 列出具体行号
- 中期（1 月）：URL 规则推导（模板 `/{code}/` 批量填充）；语言下拉加"自定义"输入项（沿用 LANG_RE 校验）；与 sitemap-generator 互链
- 远期：sitemap xhtml:link 输出 Tab；HTTP header 形态输出；并入 SEO 工作台

## 优化处方（验收标准）

1. **文字子标签**：语言列支持 zh-Hant/zh-Hans（下拉直接可选项＋手输兼容）。→ **验收：选 zh-Hant＋地区 TW 输出 `hreflang="zh-Hant-TW"`；组合码 chip 绿显不报错**
2. **重复检测**：同一 lang-region 组合出现两次时该行红显＋汇总"重复 1 组"。→ **验收：两行 zh-CN 触发红显与计数；删一行后消失**
3. **错误定位**：汇总 notice 改为逐行列出（"第 2 行：URL 需以 http(s) 开头"）。→ **验收：三行中两行非法时 notice 恰好两条且行号正确**
4. **URL 推导**：加"路径模板"输入（如 `https://a.com/{code}/`），点击按已有语言行批量填充 URL。→ **验收：5 行语言点一次后各 URL 分别为 /zh-cn/ /en-us/ 等（code 全小写连字符）**
5. **家族互链**：结果区挂"多语言站还需要 sitemap.xml→sitemap-generator"链接。→ **验收：跳转 /t/sitemap-generator**
