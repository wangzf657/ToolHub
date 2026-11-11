# 数字转中文大写（number-to-words）

> 分类：实用工具｜模式：A（TextTool 双栏，textDef 家族，singleLine 单值型）｜组件：`src/components/common/TextTool.vue`（195 行共用壳，输入 44px 单行 `TextTool.vue:190-194`）｜引擎：`src/lib/textEngine.ts:407-482`（numberToChinese，numberToEnglish :709 已实现未暴露）｜注册：`src/tools/utility/registry.ts:564-573`
> 对标标杆：codebeautify.org Numbers to Words ＋ 站内姊妹工具 rmb-uppercase（同引擎 numberToChinese，其档案指定本工具为"金额文字化工作台"合并去处）

## 七维评分：60 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 财务大写（默认开）＋普通汉字双模式、小数"点"式逐字、负数、千分位容错 ✓；**slug 是 number-to-words 却只有中文**——英文引擎 numberToEnglish 已躺在 textEngine.ts:709 未暴露；缺批量、缺超 2^53 上限拦截 |
| 可用性 | 20 | 12 | 12 | ".5"这类合法输入显示"（请输入有效数字）"（textEngine.ts:414-416 intPart 为空致 NaN）；finance 超 2 位小数静默四舍五入（:462）；输出单行塞 180px 窗 |
| 实用价值 | 15 | 13 | 13 | 合同/单据/教学读数双场景真实刚需；跨位补零与元角分规则经 rmb-uppercase.md 核实符合票据规范 ✓ |
| 交互便捷性 | 15 | 10 | 10 | 输入即转（TextTool.vue:47-48 ✓）、输出 textarea 可整体复制（比姊妹 rmb-uppercase 结果行不可复制强）；singleLine 无 inputmode、无历史 |
| UI 美观性 | 10 | 7 | 7 | 44px 输入配 180px 输出比例失衡；大写长串 word-break 正常（CalcTool 家族同源样式）；全站一致 ✓ |
| 灵魂度 | 20 | 8 | 8 | placeholder 带"如 1234.56"示例 ✓（registry.ts:571）；财务/汉字双开关理解成本低；无"切换模式结果对照"、无金额元角分读法口播引导 |
| **加权总分** | 100 | | **60** | 转换质量过硬、比姊妹工具多一层"可复制"优势；输在英文缺位与口径边缘 |
| 附加：大文件性能 | 10 | 9 | — | 单值瞬时完成 |
| 附加：移动端 | 10 | 7 | — | 单行场景一屏内 ✓；text 字段未配 inputmode=decimal，唤起全键盘 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 12/20 无硬伤但".5"报错口径与静默取整需修；对 codebeautify 的英文转写差距属"引擎已实现、暴露即得"的功能拓展。

## 扣分点明细

1. 【功能-拓展】英文名不副实：slug 与标题是 number-to-words（数字转文字），实际只支持中文——`numberToEnglish`（textEngine.ts:709-726）已在引擎层实现却未暴露选项，codebeautify 支持到 nonillion 级英文转写，本工具一个开关就能补齐
2. 【可用性-边缘】".5"输入显示"（请输入有效数字）"（textEngine.ts:414-416：split('.') 后 intPart 为空串→NaN）：数学上合法的小数被拒，姊妹 rmb-uppercase.md 扣分 4 同源问题在本工具同样存在
3. 【可用性-边界】超大数静默失真：整数部分超 MAX_SAFE_INTEGER（约 9007 万亿）后 parseInt 丢精度（textEngine.ts:415），万亿位以上转换结果错误且无上限拦截；finance 超 2 位小数 Math.round 静默进位（:462）无提示
4. 【功能】无批量多行：财务/教学一次多值需反复输入（rmb-uppercase.md 扣分 2 同源，两工具合并后该需求仍悬空）
5. 【功能】两模式无对照：财务大写与普通汉字各转一次需切换开关看两遍，无法同屏对照（"1234.56 → 壹仟贰佰… / 一千二百三十四点五六"）
6. 【家族共性】输出区钉 180px（M-06、base.css:164-168）：单行大写串与 44px 输入失衡，面板下方大量留白
7. 【交互】singleLine 输入框未配 inputmode=decimal（TextTool.vue:190-194 无相关属性），移动端填金额唤起全键盘
8. 【灵魂】负数"负"字前缀（textEngine.ts:475,481）与 finance 进位口径未在 note 披露（rmb-uppercase.md 扣分 6 同源，本工具连 note 都没有）

## 行业对标与差距

- **codebeautify.org Numbers to Words**：英文转写到 10^33 级、多语言、复制即用。差距：**语言覆盖**——对方中英双持，本工具空有英文名与已实现的英文引擎。
- **站内 rmb-uppercase**（registry.ts:1052-1082，档案 59 分）：金额场景专精（元角分＋日期大写＋规范化金额），但结果行不可复制；本工具是可复制版却无日期大写。两工具同引擎（textEngine.ts:407）分裂：金额用户不知道该用哪个，rmb-uppercase.md 远期处方已指定合并为"金额文字化工作台"。
- 借鉴优先级：**暴露英文转写 > .5 口径修复 > 批量多行 > 双模式对照 > 与 rmb-uppercase 合并**。

## 可拓展性

- 短期（1 周）：选项加"输出语言：中文/英文"（接 numberToEnglish）；".5"按 0.5 解析；输入 inputmode=decimal
- 中期（1 月）：批量多行对照（每行独立复制）；双模式同屏对照；超 2^53 上限拦截提示
- 远期：与 rmb-uppercase 合并"金额文字化工作台"（中文大写＋英文＋日期大写＋规范化金额四行同出），落实其档案远期处方

## 优化处方（验收标准）

1. **英文转写开关**：新增"输出语言"选项（中文/英文），英文走 numberToEnglish。→ **验收：输入 1234.56 选英文输出"one thousand two hundred thirty-four point five six"式转写**
2. **".5"口径**：空整数部分按 0 处理。→ **验收：输入 .5 财务模式输出"零元伍角"、普通模式输出"零点五"**
3. **批量对照**：支持多行输入逐行转换，行号对齐。→ **验收：粘贴 3 行数字输出 3 行大写，顺序一一对应**
4. **上限守卫**：绝对值 ≥1e15 显示"超出精确转换范围请分笔处理"。→ **验收：输入 1e16 不再出现错误结果而是明确提示**
5. **合并落地**：落实 rmb-uppercase.md 处方 6 指定的合并。→ **验收：两 slug 互链或 301，合并页同屏可见大写金额/日期/英文/普通汉字四行输出**
