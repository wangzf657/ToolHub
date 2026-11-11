# 大小写转换（case-converter）

> 分类：实用工具｜模式：A（TextTool 双栏，textDef 家族）｜注册：`src/tools/utility/registry.ts:380-399`｜引擎：`src/lib/textEngine.ts`（toCase，:32-77）｜组件：`src/components/common/TextTool.vue`（195 行，42 工具共用，家族共性见 `pinyin-converter.md`）
> 对标标杆：convertcase.net ＋ textmechanic.com

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 11 种格式全覆盖（含 alternating/inverse 玩法）；但 title/sentence/snake 口径有缺陷（扣分 2~4），缺全格式同屏一览与源格式自动识别 |
| 可用性 | 20 | 10 | 10 | 家族共性：双窗各钉 180px（`base.css:164-168`，M-06）；单 select 选项本身无额外痛点 |
| 实用价值 | 15 | 11 | 11 | 整段文本转格式高频；但 5 种开发者格式与 case-style-converter（`src/tools/developer/registry.ts:394-403`）语义重叠，双入口无分工指引 |
| 交互便捷性 | 15 | 10 | 10 | 输入即自动转换（`TextTool.vue:48` watch，家族加分项）；免按钮，但目标格式选择不记忆、无模式快捷跳转 |
| UI 美观性 | 10 | 7 | 7 | 家族统一双栏样式工整；11 种模式收进单个 select，模式发现性一般 |
| 灵魂度 | 20 | 7 | 7 | 无全格式一览（convertcase.net 一页平铺即点即换）、无口径说明（title 对 iPhone 怎么处理？）、placeholder 无示例 |
| **加权总分** | 100 | | **57** | 家族基线水平：功能面广，口径细节伤实用性 |
| 附加：大文件性能 | 10 | 6 | — | 纯字符串操作主线程同步，万字级可感知卡顿 |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列堆叠（TextTool.vue:156-159），家族共性 |

## 结论与优先级

**交互优化** · P1（个性问题为主；180px 钉高家族 P0 由 TextTool 一处整改统一覆盖，见 `pinyin-converter.md`）

判据：可用性 10/20 落家族共性硬伤区间；title/sentence 口径缺陷属"结果不可信"级功能问题。

## 扣分点明细

1. 【可用性-硬伤·家族】双 textarea 各钉 180px、两窗无同步滚动（`base.css:164-168`；M-06），详见 `pinyin-converter.md` 扣分 1
2. 【功能·疑似问题】title 模式破坏词内大写："iPhone"→"Iphone"、"JavaScript"→"Javascript"（`textEngine.ts:39` 对首字母以外的部分写死 toLowerCase）
3. 【功能】sentence 模式仅识别 ASCII 句标 `[.!?]`（`textEngine.ts:43`），中文"。！？"后的英文句首不大写，中英混排失效
4. 【功能】缩写词边界处理差：snake/kebab 把 "JSONData"→"jsondata"（`textEngine.ts:53-60` 正则 `[a-z0-9])([A-Z]` 不含双大写边界）；camel 把 "JSON data"→"jSONData"（`textEngine.ts:44-47`）
5. 【实用】与 developer 分类 case-style-converter 5 种模式语义重叠（camel/pascal/snake/kebab/constant），一个面向整段文本、一个面向逐行变量名，但两页无互链无分工文案
6. 【灵魂】convertcase.net 一页平铺全部风格结果可即点即换，本工具一次只见一种；无口径说明、无示例引导
7. 【交互】目标格式不记忆（刷新回 default 'upper'，`registry.ts:386`；TextTool.vue:19-24 initOpts 无持久化），高频用户每次重选
8. 【功能】无行级批量口径（textmechanic 支持每行独立转换），多行标识符批量场景被 developer 分类独占但本页无跳转提示

## 行业对标与差距

- **convertcase.net**：大小写转换流量王——upper/lower/title/sentence/camel/snake 等一页平铺、粘贴即全部转换、每种结果一键复制。差距：模式发现性与对比效率（对方"一览"，我们"盲选"）。
- **textmechanic.com**：行级批量口径（每行独立转换+编号），与 case-style-converter 对位更准，佐证站内双工具应显性分工互链。
- 借鉴优先级：全格式一览 > title/sentence 口径修复 > 双工具互链 > 选择记忆。

## 可拓展性

- 短期（1 周）：修复 title 内部大写与 sentence 中文句标（`textEngine.ts:39,43` 两处正则）
- 中期（1 月）：输出区下加 11 种格式一览卡（逐行结果+复制按钮）；与 case-style-converter 页脚互链
- 远期：源格式自动识别（检测 snake/camel/kebab 混合输入一键归一）

## 优化处方（验收标准）

1. **title/sentence 口径修复**：title 保留词内连续大写（iPhone/JSON/URL 不破坏）；sentence 认中文句标 → **验收：输入 "iPhone OK。hello world"，title 输出含 "iPhone"，sentence 输出中 Hello 句首大写生效**
2. **全格式一览**：输出区加"单格式｜全格式一览"切换，一览模式 11 行结果各带复制按钮 → **验收：粘贴一段文本后 11 种结果同屏渲染，逐行复制互不影响**
3. **双工具互链**：与 case-style-converter 互挂"相关工具"并补分工文案 → **验收：两页页脚互链可见，文案区分"整段文本/逐行变量名"场景**
4. **模式记忆**：目标格式写入 localStorage（toolhub 前缀） → **验收：选 camel 后刷新页面仍为 camel**
5. **缩写词正则升级**：snake/kebab 兼容连续大写边界 → **验收：输入 "JSONData" 输出 "json_data"（kebab 同理 "json-data"）**
