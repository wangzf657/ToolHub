# 变量命名风格转换（case-style-converter）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef 家族）｜组件：`src/components/common/TextTool.vue`（195 行，42 工具共用）｜引擎：`src/lib/devExt.ts` wordsOfIdentifier/convertIdentifier（:488-512，lodash words 口径）｜注册：`src/tools/developer/registry.ts:394-402`｜家族共性参见 `docs/优化文档/实用工具/pinyin-converter.md`
> 对标标杆：convertcase.net（一页平铺全风格，含开发者风格区）＋ textmechanic.com（行级批量口径，均已在库经 `case-converter.md` 引用）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 5 风格逐行批量互转+任意风格混输（lodash 词切分含数字/连续大写边界 `devExt.ts:492-494`）；缺全风格同屏一览、缺前缀保留（m_/str 匈牙利口径）、缺源风格检测 |
| 可用性 | 20 | 9 | 9 | 家族共性：双窗各钉 180px（`base.css:164-168`，M-06，共性-根因 2）；逐行变量名场景 180px 偏高但无碍主链路 |
| 实用价值 | 15 | 11 | 11 | 命名重构高频；但与实用分类 case-converter 的 camel/pascal/snake/kebab/constant 五模式语义重叠（`case-converter.md` 扣分 5 已确认），两页无分工指引 |
| 交互便捷性 | 15 | 10 | 10 | 输入即自动转换（watch `TextTool.vue:48`）、逐行输出；无"复制全部"、目标风格不记忆（刷新回 camel） |
| UI 美观性 | 10 | 7 | 7 | 家族统一双栏工整；select 选项自带示例（"camelCase 小驼峰（如 userName）" registry.ts:398）降低理解成本 |
| 灵魂度 | 20 | 10 | 10 | placeholder 四风格混举例（registry.ts:400）+词切分守口径（getHTTPResponseCode2 正确拆四段）是懂我的；但无源风格摘要、无拆分口径文档化说明 |
| **加权总分** | 100 | | **56** | 引擎口径准、上手零门槛；一览缺失与双入口重叠限制上限 |
| 附加：大文件性能 | 10 | 7 | — | 纯正则词切分万行级毫秒完成；watch 无防抖（家族共性） |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列堆叠（`TextTool.vue:156-159`），家族共性 |

## 结论与优先级

**交互优化** · P2

判据：无独立硬伤（可用性 9/20 为家族共性，整改归 TextTool 家族样板 `pinyin-converter.md`）；一览视图与双工具分工是个性主项。

## 扣分点明细

1. 【功能】无全风格一览：一次只见一种目标（convertcase.net 一页平铺五风格结果即点即换），对比选择成本高
2. 【实用-分工】与 case-converter（`src/tools/utility/registry.ts:380-399`）五模式重叠：本工具逐行+标识符口径、对方整段+11 模式，但两页无互链无分工文案（相关工具仅分类级 `ToolPage.vue:44`），用户需试错才知道用哪个
3. 【功能】不保留命名前缀：`m_userName` 按分隔符拆尚可，但 `strName`/`bValid` 匈牙利前缀被并进单词（→str_name），重构旧代码场景需要"保留首段缩写"选项
4. 【交互】目标风格不记忆：刷新回 camel 默认（registry.ts:398 default，TextTool initOpts :19-24 无持久化），高频用户每次重选
5. 【灵魂】无源风格检测提示：混合风格批量输入时不告知"检测到 snake×3/camel×2"，归一结果不可预览（textmechanic 行级口径参照）
6. 【功能】拆分口径无文档化：`user2Name` 拆为 user/2/name（`devExt.ts:494` 数字独立成词）口径正确但无说明，用户遇到意外拆分无处查证
7. 【交互】无逐行对照模式：批量改名时"原↔新"两列对照缺失，只能上下窗肉眼对齐（长列表易错位）
8. 【可用性-家族】首控件在 266px 装饰层下（共性-根因 1）+输出窗约 1.5 屏外（M-06 同构）

## 行业对标与差距

- **convertcase.net**：全风格一页平铺、粘贴即全部转换、逐格复制；开发者风格（camel/Pascal/snake/kebab/constant）与文本风格同站分列。差距：**一览式对比选择**（本工具 select 盲选）。
- **textmechanic.com**：行级批量口径（每行独立转换+行号），与本工具逐行场景对位。差距：行号对照显示；其批量删重等辅助操作不必追。
- 借鉴优先级：**五风格一览 > 双工具互链分工 > 前缀保留选项 > 风格记忆 > 逐行对照**。

## 可拓展性

- 短期（1 周）：输出区加"单风格｜五风格一览"切换（一览 5 行各带复制）；目标风格 localStorage 记忆（toolhub 前缀）
- 中期（1 月）：与 case-converter 页脚互链+分工文案（"整段文本→实用分类；逐行变量名→本工具"）；源风格检测摘要行
- 远期：前缀保留选项（识别下划线/连字符首段与常见匈牙利前缀）；浏览器扩展"选中即转"场景

## 优化处方（验收标准）

1. **五风格一览**：输出区上方加 Tab"单风格｜一览"，一览模式 5 行结果各带复制按钮。→ **验收：粘贴 3 行混合风格后 5 种结果同屏渲染，逐行复制互不影响**
2. **风格记忆**：目标风格写入 localStorage（toolhub 前缀）。→ **验收：选 snake_case 后刷新页面仍为 snake_case**
3. **双工具互链**：与 case-converter 互挂相关工具+分工文案。→ **验收：两页页脚互链可见，文案区分"整段文本/逐行变量名"场景**
4. **源风格摘要**：输入非空时输出区上方显示"检测：snake_case ×2、camelCase ×1"。→ **验收：粘贴 user_name、userName、UserName 各一行时计数正确**
5. **前缀保留**：选项加"保留首段前缀"开关（按 _/- 分隔的首段原样保留）。→ **验收：开关开启时 m_userName→m_user_name 且 userName 不受影响**
