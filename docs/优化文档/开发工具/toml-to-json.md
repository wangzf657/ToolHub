# TOML 与 JSON 互转（toml-to-json）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox，独立组件）｜组件：`src/tools/developer/components/TomlConverter.vue`（全文 83 行）｜注册：`src/tools/developer/registry.ts:126-131`
> 对标标杆：toml.io 官方试金石 ＋ Code Beautify TOML Converter

## 七维评分：60 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | TOML→JSON 与 JSON→TOML 双向、表格与类型化值（desc 明示）；缺数组表 `[[items]]` 深度验证披露、注释保留（JSON→TOML 必然丢注释，无提示）、日期/时间字面量选项 |
| 可用性 | 20 | 13 | 13 | 双栏 min-height 300px（`TomlConverter.vue:63,65`）——**高于 TextTool 家族 180px 与多数开发工具 260px**，可拖拽扩高；错误中文截断 120 字符（:20,:34）；空输入守卫（:14,:27） |
| 实用价值 | 15 | 12 | 12 | Rust/Python(pyproject.toml)/Go 配置场景真实；与 env-to-json 构成配置文件家族 |
| 交互便捷性 | 15 | 12 | 12 | "交换输入输出"按钮一键反向转换（:44 复制结果到输入框并提示可继续）是双向工具的正确形态；首用 toast 预告"首次需加载解析库"（:18）——**全站 textDef pending 缺陷在这里被正确处理** |
| UI 美观性 | 10 | 7 | 7 | grid-2 双栏工整；无 TOML 语法着色 |
| 灵魂度 | 20 | 4 | 4 | 无示例 TOML 空态、双向时 JSON→TOML 丢注释无警示、与 env-to-json（registry.ts:133）零互链——配置家族三兄弟（toml/env/yaml）各孤岛 |
| **加权总分** | 100 | | **60** | 交互骨架是家族样板级（300px+swap+首用提示），输在灵魂细节 |
| 附加：大文件性能 | 10 | 6 | — | TOML 解析懒加载同步主线程，大配置无进度 |
| 附加：移动端 | 10 | 6 | — | ≤560px 单列堆叠（base.css:329-335 家族共性） |

## 结论与优先级

**交互优化** · P2（结构健全，补灵魂细节即可）

判据：无可用性硬伤（300px 双窗+可扩高），扣分集中在口径披露与空态；作为配置家族交互形态的正面参照。

## 扣分点明细

1. 【灵魂】JSON→TOML 方向**必然丢失注释**（TOML 注释无 JSON 载体），无任何警示——用户反向保存后注释蒸发
2. 【灵魂】无 TOML 示例空态（placeholder 有三行示例 :63 是亮点，但输出区无对应示例结果）
3. 【功能】`[[array-of-tables]]`（TOML 数组表语法）转换质量未验证未披露；TOML 1.0 的多行字符串/字面量字符串支持度无说明
4. 【灵魂】与 env-to-json、yaml-to-json 组成配置家族三兄弟却零互链（ToolPage 相关位按注册序前 3 基本不可达）——"配置格式统一转换"整合机会
5. 【交互】busy 态按钮 disabled（:51,:54 :disabled）但无 spinner 视觉，慢解析期间无反馈

## 行业对标与差距

- **toml.io / toml-test**：官方合规用例集。差距：可用它做引擎自检（站内无测试披露）。
- **Code Beautify**：TOML↔JSON↔YAML 三向面板。差距：家族整合入口。
- 借鉴优先级：**丢注释警示 > 配置家族工作台 > busy spinner**。

## 可拓展性

- 短期：JSON→TOML 时检测源文本含 `#` 注释并 toast"注释无法保留"；busy 态加 spinner
- 中期：与 env-to-json/yaml-to-json 合成"配置工作台"（一键多格式互转，模式 E 雏形）
- 远期：TOML 1.0 全量合规自检页（跑 toml-test 子集并展示通过率——诚实工程卖点）

## 优化处方（验收标准）

1. **丢注释警示**：JSON→TOML 输入含 `#` 时 toast.warn"JSON 无注释语义，原注释已丢失"。→ **验收：含注释 TOML→JSON→TOML 全程触发警示**
2. **busy spinner**：toJson/toToml 的 busy 态按钮内显示 Loader2 旋转图标。→ **验收：首次转换（库加载 1~2s）期间按钮呈 spinner 态**
3. **配置家族互链**：结果区加"转 ENV | 转 YAML"直达按钮（预填当前结果）。→ **验收：点击后目标工具输入区已填入当前输出**
4. **示例空态**：输出区空态显示与 placeholder 对应的示例 JSON 结果。→ **验收：进页即见示例 TOML 与其 JSON 结果对照**
