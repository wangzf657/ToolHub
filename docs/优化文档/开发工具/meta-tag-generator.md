# Meta 标签生成（meta-tag-generator）

> 分类：开发工具｜模式：B 变体（表单＋ResultBox 实时输出，无 CalcTool 壳）｜组件：`src/tools/developer/components/MetaTagGenerator.vue`（97 行）｜注册：`src/tools/developer/registry.ts:196`
> 对标标杆：metatags.io（Meta/OG 预览标杆，对标库）＋ 站内 SEO 分类 serp-preview（同字段已有更严口径，见家族节）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 8 字段＋charset/viewport 开关（:17-28）覆盖基础 head；robots 仅 4 组合（:71-76）缺 max-image-preview/max-snippet 现代指令；无 OG/Twitter、favicon/theme-color、JSON-LD；keywords 已被 Google 忽略却无提示 |
| 可用性 | 20 | 11 | 11 | ResultBox 钉 200px（:89；ResultBox.vue:69 height 同值钉死，共性-根因 2）；输出区在表单之后，768 视口下底缘压折叠线；标签行数少尚可读 |
| 实用价值 | 15 | 11 | 11 | canonical＋robots＋viewport 是真实配置面；但 keywords 字段占主位（2009 年起 Google 已忽略）、无 og 需另开姊妹工具，单工具产出覆盖不了 2026 年 head 的最低完备集 |
| 交互便捷性 | 15 | 11 | 11 | computed 实时输出（:17-30）✓、title/description 字符计数（:51,:56）✓、ResultBox 一键复制/下载✓＋独立 .html 下载（:32-42）；但计数无判级不红显、无 SERP 预览 |
| UI 美观性 | 10 | 7 | 7 | grid-2 表单工整；长度提示中性灰无警示态（对照 SerpPreview.vue:43-46 有红/黄判级），两工具视觉语言分裂 |
| 灵魂度 | 20 | 7 | 7 | 预填示例可开箱✓、字数提示贴心雏形✓；但默认值是 ToolHub 自家品牌文案（:8-11），用户忘改就把"百宝工具箱"贴进自己网站；引号不转义让用户"自行避免"（:95 notice） |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 8 | — | 字符串拼接即时，无性能风险 |
| 附加：移动端 | 10 | 7 | — | grid-2 ≤560px 堆叠（共性-根因 5），表单流程竖屏顺畅 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：基础功能正确无硬伤，但相对 metatags.io 缺"所见即所得"反馈层，相对自家 serp-preview 缺长度判级——两处都是可追差距；keywords 时代错位与引号不转义拉低专业可信度。

## SEO 家族关系与整合机会（meta / OG / robots 三兄弟）

developer 分类三个 SEO 生成器（本工具 :196、open-graph-generator :197、robots-txt-generator :198）＋ SEO 分类 serp-preview/sitemap-generator，家族现状：**title/description 三处重复录入、互链为零、标准分裂**（本工具 title"建议 ≤30 汉字"vs SerpPreview"有效长度 60＋像素估算"，SerpPreview.vue:21-22）；robots 指令在本工具是 4 组下拉、在 robots-txt-generator 是站点级文件，用户分不清页面级 noindex 与站点级 Disallow 该用哪个。整合机会：字段层共享状态（localStorage 同步 title/description/canonical）＋三页互链＋远期合并"SEO 头部工作台"（meta＋OG＋Twitter 一次录入三份输出，SERP/社交双预览）。

## 扣分点明细

1. 【可用性】输出 ResultBox min-height 200px 双重钉死（`MetaTagGenerator.vue:89`；`ResultBox.vue:69`），共性-根因 2 标准病例；表单 8 字段把输出压到首屏底缘
2. 【功能】长度提示无判级：计数永远中性灰（:51,:56），超长不红显不提示截断——同字段在 serp-preview 有 effLen＋像素估算＋红黄判级（SerpPreview.vue:43-46），同一产品两套标准
3. 【功能】keywords 字段无时代提示：Google 2009 年起忽略该 meta，字段仍排主位无任何说明，专业生成器普遍标注"仅部分引擎参考"
4. 【可用性】输出不转义引号且要求用户"自行避免直接写入"（:95）：description 带引号产出破损 HTML 而工具不预警；姊妹工具 open-graph-generator 反而做了 esc（OpenGraphGenerator.vue:17）——同家族一个转义一个不转义
5. 【功能】robots 仅 index/follow 四组合（:71-76），缺 max-snippet/max-image-preview/noarchive 等现代指令；author 字段对 SEO 无效却占一整格
6. 【交互】无 SERP 预览：填完看不到 Google 展示效果，须另开 serp-preview 全部重填——家族字段重复录入的典型代价
7. 【灵魂】默认值是 ToolHub 品牌文案（:8-15），既是示例也是误贴陷阱，无"重置为空白"按钮
8. 【风格-轻】下载为组件内自实现 blob（:32-42）而非 lib/download saveText 统一通道（功能正常，工程口径不一）

## 行业对标与差距

- **metatags.io**：编辑即见 Google/Twitter/Facebook 三视图、一键复制全部、字段与预览左右联动。差距：**反馈可视化代差**——对方"看着填"，本工具"盲填"。
- **SerpPreview（站内 SEO 分类）**：effLen（全角折半）＋像素宽估算＋超长/过短双警示＋桌面/移动双视图。差距：本工具的字段质量基线应直接对齐它。
- 借鉴优先级：**SERP 联动预览 > 长度红黄判级 > 引号转义 > keywords 时代提示 > 家族字段共享**。

## 可拓展性

- 短期（1 周）：计数加红/黄判级（口径抄 SerpPreview）；输出转义引号（esc 同 OG 工具）；keywords 字段下加"Google 已忽略"小字
- 中期（1 月）：与 open-graph-generator 共享 title/description/canonical（localStorage 同步）＋两页互链；robots 下拉加现代指令组合；"重置示例"按钮
- 远期：与 serp-preview、open-graph-generator 合并"SEO 头部工作台"：一次录入产出 meta＋OG＋Twitter 三份标签＋SERP/社交双预览

## 优化处方（验收标准）

1. **长度判级**：title 有效长度 >60 或 description >155 时计数变红＋"搜索引擎会截断"提示（口径与 serp-preview 一致）。→ **验收：输入 80 字符 description 计数变红且提示出现；40 字符时黄色"偏短"提示**
2. **引号转义**：输出对 `"` 做 `&quot;`。→ **验收：description 含引号时输出 HTML 可被浏览器完整解析不破损**
3. **keywords 提示**：字段下常驻小字"Google 已忽略 keywords，仅部分中文引擎参考"。→ **验收：文案渲染且不随输入变化**
4. **家族字段共享**：与 open-graph-generator 双向同步 title/description（localStorage），顶部互挂跳转按钮。→ **验收：本页改标题后跳 OG 页标题已同步，反向亦然**
5. **现代 robots 指令**：select 增 `index, follow, max-image-preview:large, max-snippet:-1` 组合。→ **验收：选中后输出行含该完整串**
6. **重置空白**：工具行加"清空示例"按钮恢复全空表单。→ **验收：点击后 8 字段全空、输出仅剩 charset/viewport 两行**
