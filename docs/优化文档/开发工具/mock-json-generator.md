# Mock 数据生成（mock-json-generator）

> 分类：开发工具｜模式：D（模板输入 + Token chips + grid-2 结果）｜组件：`src/tools/developer/components/MockJsonGenerator.vue`（全文 71 行）｜注册：`src/tools/developer/registry.ts`（special）
> 对标标杆：Mockaroo（schema 驱动标杆）＋ faker.js playground

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 模板+Token 替换生成、1~500 条限制（`MockJsonGenerator.vue:25`）、下载 json（ResultBox）；缺 schema 驱动（给 TS 类型/JSON Schema 生成）、嵌套数组模板、token 清单完整披露、导出格式（仅 JSON 无 CSV/SQL） |
| 可用性 | 20 | 12 | 12 | 模板/结果双栏 300px（:55,:57）高于家族基线；数量输入 min/max 属性+校验（:25）；结果一键下载 |
| 实用价值 | 15 | 12 | 12 | 前端联调造数高频；token 化模板上手快 |
| 交互便捷性 | 15 | 11 | 11 | Token chips 点击插入（:63 insert）、"重新生成"按钮（:53）一键换批；但 token 逐个点击无拖拽、模板错误无提示（token 拼错静默原样输出） |
| UI 美观性 | 10 | 7 | 7 | chips 面板排列可扫读；无 token 分类分组（名字/手机/日期混排一排） |
| 灵魂度 | 20 | 4 | 4 | 无中文场景默认模板（placeholder 是否中文友好待验证）、生成结果无统计（ gender 分布？重复率？）、token 拼错静默失败是产出级隐患 |
| **加权总分** | 100 | | **57** | 骨架健全，灵魂与错误反馈缺位 |
| 附加：大文件性能 | 10 | 7 | — | 500 条同步生成毫秒级，无压力 |
| 附加：移动端 | 10 | 6 | — | 双栏堆叠家族共性 |

## 结论与优先级

**交互优化 + 需拓展** · P2（可用性达标，错误反馈与 schema 能力是差距）

判据：无硬伤；token 拼错静默输出 + 与 fake-data-generator/json-to-typescript 的家族整合是主要差距。

## 扣分点明细

1. 【灵魂·产出隐患】模板中拼错 token（`{{naem}}`）静默原样输出不报错——用户拿到 500 条数据后才发现字段全错；token 清单（TOKENS）无"识别未知 {{…}} 并提示"守卫
2. 【功能】无 schema 驱动模式：给一段 TS 类型/JSON Schema 直接生成 mock（Mockaroo 核心）——与 json-to-typescript（有档案）天然衔接却零联动
3. 【交互】Token chips 无分类分组（:63 平铺一行），20+ token 时找目标靠肉眼
4. 【功能】嵌套数组/对象模板能力未披露（示例模板是否演示嵌套？）；数量上限 500 对压力测试偏小
5. 【灵魂】结果无统计摘要（N 条 × M 字段、含哪些 token）；重新生成无种子机制（无法复现同一批数据）

## 行业对标与差距

- **Mockaroo**：schema 可视化编辑（字段/类型/分布）、CSV/SQL/JSON 多格式、API 直连。差距：schema 驱动与格式矩阵。
- **faker.js playground**：全量 token 文档化+locale 切换（zh_CN）。差距：中文 locale 与 token 文档。
- 借鉴优先级：**未知 token 警告 > token 分组 > schema 驱动（复用 json-to-typescript）> 种子复现**。

## 可拓展性

- 短期：未知 `{{…}}` 生成前校验并列出；token chips 按类别分组（文本/网络/日期/ID）
- 中期：粘贴 TS 类型→自动填模板（调 json-to-typescript 引擎反向）；种子（seed）输入复现批次
- 远期：与 fake-data-generator 合并"造数工作台"（模板模式+字段勾选模式双 Tab，共享引擎）

## 优化处方（验收标准）

1. **未知 token 守卫**：generate 前正则提取模板中全部 `{{key}}`，不在 TOKENS 内的列出并阻断。→ **验收：模板含 `{{naem}}` 时 toast.err 列出该 token 且不生成**
2. **token 分组**：chips 按 4 类分组展示并加组标题。→ **验收：面板出现"个人信息/网络/日期/系统"四组**
3. **种子复现**：新增可选 seed 输入，同 seed 同模板产出完全一致。→ **验收：seed=42 连续生成两次输出逐字符相等**
4. **类型反推**：加"从 TS 类型生成"Tab（复用 json-to-typescript 解析），自动填模板。→ **验收：粘贴 `interface User{name:string,age:number}` 模板自动含姓名/年龄 token**
