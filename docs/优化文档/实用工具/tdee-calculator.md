# 基础代谢 TDEE 计算器（tdee-calculator）

> 分类：实用工具｜模式：B（CalcTool 表单 + 结果行，calcDef 家族）｜组件：`src/components/common/CalcTool.vue`（117 行，67 工具共用）｜引擎：无（compute 内联 Mifflin-St Jeor）｜注册：`src/tools/utility/registry.ts:1363-1395`
> 对标标杆：Omnicalculator Calorie Calculator ＋ Calculator.net Calorie Calculator

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | Mifflin-St Jeor+五档活动系数+±300 千卡三方案+宏量分配（registry.ts:1381-1390）；缺 Katch-McArdle（体脂率口径）、按周减重速率反推、单位切换、年龄拦截 |
| 可用性 | 20 | 13 | 13 | 即时计算、活动标签带频次说明 ✓（registry.ts:1373-1375）、TDEE 行带"BMR × 活动系数" hint ✓（:1386）、守卫文案明确（:1380）；但 primary 行给了 BMR（:1385），工具使命的 TDEE 屈居第二 |
| 实用价值 | 15 | 8 | 8 | 与 calorie-calculator（registry.ts:906-940）同公式同输入高度重复且零互链，两页宏量配比还不一致——同站两个"权威答案"互相拆台 |
| 交互便捷性 | 15 | 11 | 11 | 年龄默认 30 ✓（registry.ts:1369）、身高/体重带 cm/kg suffix ✓（CalcFieldInput.vue:49）；无输入记忆（家族共性，CalcTool.vue:10）、无活动水平滑杆 |
| UI 美观性 | 10 | 7 | 7 | primary 高亮+千分位格式化 ✓（registry.ts:1383）；五字段 auto-fill 宽屏拉散（CalcTool.vue:45，家族共性） |
| 灵魂度 | 20 | 8 | 8 | 三方案（减脂/维持/增肌）比 calorie 页的百分比档更直观 ✓（registry.ts:1387-1389）、note 披露 ±10% 个体差异 ✓（:1393）；宏量配比 30/25/45 无出处无依据行 |
| **加权总分** | 100 | | **57** | 单工具质量尚可，但站内重复+口径打架是价值层的实质性损伤 |
| 附加：大文件性能 | 10 | 9 | — | 纯公式瞬时完成 |
| 附加：移动端 | 10 | 8 | — | 五字段竖排+六行结果约一屏半（家族同构 M-08）；数字键盘未细分 step |

## 结论与优先级

**阉割（与 calorie-calculator 二选一合并）+ 交互优化** · P1（重复判定与 average-calculator.md 同款判据；合并前先修 primary 错位）

判据：两工具同公式（registry.ts:1381 vs :925）、同五档活动系数（:1372-1376 vs :915-918）、同输入骨架，符合 README"高度重复→阉割（并入其他工具）"；本工具字段体验更完整（suffix/描述性标签/默认值），建议保留本 slug 承接合并。

## 扣分点明细

1. 【实用价值-站内重复】与 calorie-calculator 双工具分裂：同 Mifflin-St Jeor 公式（registry.ts:1381 vs :925）、同五档活动水平（:1372-1376 vs :915-918）、同性别/年龄/身高/体重输入——两页零互链零分工说明，用户不知道该用哪个
2. 【灵魂-口径打架】宏量配比两页不一致：本工具蛋白 30%/脂肪 25%/碳水 45%（registry.ts:1390），calorie-calculator 蛋白 30%/碳水 40%/脂肪 30%（:933-935）——同一用户两页得到两套"权威建议"，均无出处说明，比不给更伤信任
3. 【可用性-主次颠倒】primary 行是 BMR（registry.ts:1385），标题使命"TDEE"排第二行（:1386）——减脂用户要的目标消耗不是视觉焦点；且标题"基础代谢 TDEE 计算器"（:1363）术语混用（基础代谢=BMR，TDEE=每日总消耗，两概念并列易误读为一个东西）
4. 【功能】目标只有固定 ±300 千卡三档（registry.ts:1387-1389）：无按周减重速率（0.25/0.5/1 kg/周）反推热量的行业标配路径（7700 千卡/kg 折算，Omnicalculator/Calculator.net 均有）；calorie 页的 ±20%/±15% 百分比档（:919-921）又是另一套目标逻辑，合并时应统一
5. 【功能】公式单一：无 Katch-McArdle（有体脂数据人群误差更小）、无 Harris-Benedict 对照——Omnicalculator 提供多公式并列，note 的"个体差异 ±10%"（:1393）本可由多公式对照具象化
6. 【可用性】无输入范围校验：年龄 3 岁、体重 300kg 照算出 TDEE（fields 无 min/max，registry.ts:1368-1371；CalcFieldInput.vue:44-46 支持 min/max 未配置）——未成年人套成人公式无拦截（对照 bmi-calculator.md 扣分点 3）
7. 【交互】无输入记忆：减脂是按周复测场景，身高体重每次重输（家族共性，CalcTool.vue:10 无 localStorage）——健康家族应共享一份身体档案

## 行业对标与差距

- **Omnicalculator Calorie Calculator**：Mifflin/Katch-McArdle/Harris 多公式对照、按周减重速率反推、蛋白按 g/kg 体重给。差距：公式与目标自由度。
- **Calculator.net Calorie Calculator**：活动分级细至 7 档、减重时间线（周数预期表）。差距：目标路径的"什么时候达成"维度。
- **薄荷健康/MyFitnessPal**（云）：目标-饮食记录闭环，架构天花板（需账号/食物库）；纯前端可逼近的是"目标热量+宏量+常见食物当量换算"静态展示。
- 借鉴优先级：与 calorie 二选一合并 > 宏量口径统一并注明出处 > primary 改 TDEE > 周速率目标 > 体脂率可选字段。

## 可拓展性

- 短期（1 周）：primary 改 TDEE；标题改"每日总消耗（TDEE）计算器"或结果区分列 BMR/TDEE；宏量行注明配比出处
- 中期（1 月）：与 calorie-calculator 合并落地（保留本 slug，另一 slug 重定向），目标改"周减重速率"反推；体脂率可选字段→Katch-McArdle
- 远期：健康计算中心（BMI→BMR→TDEE→宏量一条链，身体档案共享），承接 bmi-calculator.md 远期处方

## 优化处方（验收标准）

1. **合并二选一**：以本工具为保留方吸收 calorie 页目标档位，另一 slug 301 或页面顶部声明去向。→ **验收：两 slug 仅存一个独立计算器，另一页可见重定向/去向声明；全站宏量建议只剩一套口径且注明依据**
2. **primary 调整**：主结果行改为"每日总消耗 TDEE"。→ **验收：primary 高亮行为 TDEE 数值，BMR 降为普通行**
3. **周速率目标**：目标选择改为"维持/每周减 0.25/0.5/1kg/每周增 0.25kg"式。→ **验收：选"每周减 0.5kg"后目标热量=TDEE−约 550 千卡（按 7700 千卡/kg 折算）且行文案可见折算依据**
4. **年龄拦截**：年龄 <18 时输出提示行。→ **验收：年龄填 10 时结果区出现"未成年人不适用成人 BMR 公式"提示且主结果带此 hint**
5. **输入记忆**：身高/体重/年龄 localStorage 持久化（key 前缀 toolhub）。→ **验收：填写后刷新页面字段保留，与 BMI 页共享后可互链透传**
