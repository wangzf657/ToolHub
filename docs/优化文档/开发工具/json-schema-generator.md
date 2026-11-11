# JSON Schema 生成（json-schema-generator）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/JsonSchemaGenerator.vue`（51 行）｜引擎：`src/lib/jsEngine.ts:493-515`（jsonSchemaFrom）
> 对标标杆：jsonschema.net（即时 Schema 推断＋选项面板）＋ quicktype.io（推断深度参照）

## 七维评分：53 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | draft-07 固定（`jsEngine.ts:495`）、integer/number 区分（:510）、properties/required/items 递归（:501-509）；缺 Draft 2020-12 切换、format 推断、minItems/maxItems、enum、description、$id |
| 可用性 | 20 | 10 | 10 | 双窗 300px inline（`JsonSchemaGenerator.vue:40,42`）高于家族默认但仍钉死（`ResultBox.vue:69`）；错误截断 120 字符（:22-23） |
| 实用价值 | 15 | 12 | 12 | schema 是接口文档/校验的真实刚需，additionalProperties:false 默认严格符合后端校验习惯 |
| 交互便捷性 | 15 | 9 | 9 | 手动点"生成 Schema"（:34）；标题可改；无版本选择联动、无 required 收紧策略开关、无粘贴即生成 |
| UI 美观性 | 10 | 7 | 7 | 与 json-to-typescript 同构工整；`type: null` 输出未加高亮，长 schema 纯文本难浏览 |
| 灵魂度 | 20 | 6 | 6 | 默认示例预填商品结构（:9）+ 推断规则说明 notice（:47-49）是亮点；无"required 策略"解释、无校验回路（生成的 schema 不能回验原 JSON） |
| **加权总分** | 100 | | **53** | |
| 附加：大文件性能 | 10 | 6 | — | 同步递归无 worker，深嵌套大 JSON 冻结 UI（家族共性） |
| 附加：移动端 | 10 | 5 | — | 堆叠后输出区约 2 屏外（模式 D 共性，同构 M-03） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：功能面单薄（仅 draft-07 单版本 + 最简推断），与 jsonschema.net 的选项面板和 quicktype 的推断深度均有明显差距；无硬伤但拓展空间最大。

## 扣分点明细

1. 【功能】required 一律"非 null 即必填"（`jsEngine.ts:506`）——数组多元素字段不齐时产出过严 schema，直接用于校验会误杀合法数据（与 json-to-typescript 扣分 2 同源，推断内核应共享）
2. 【功能】draft-07 写死（:495）：无 2020-12/2019-09 版本选择；`type: "null"`（:497）在部分旧校验器（draft-04）不被支持，无降级提示
3. 【功能】无 format 推断：email/url/date-time 值按样例明显可判，却只输出 `type: "string"`（:511）——format 是 schema 校验价值的一半
4. 【功能】数组 items 只取首元素（:499），空数组输出空 items（:499）无 anyOf 兜底或提示
5. 【功能】additionalProperties:false 写死（:508）无开关——宽松场景（配置合并）用户被迫手改输出
6. 【可用性-家族共性】ResultBox 钉死 300px（`ResultBox.vue:69`），深 schema 小窗内滚
7. 【灵魂】生成后无"回验"回路：拿 schema 校验原 JSON（或粘贴另一份样例验证）是 schema 工具的闭环动作，本工具生成即终点

## 行业对标与差距

- **jsonschema.net**：即时推断 + 逐字段选项面板（required/format/枚举可点改）+ 多 Draft 版本 + 校验 Tab。差距：**"生成后可编辑可校验"的闭环**——本工具是一次性黑盒输出。
- **quicktype.io**：多样本合并推断可选字段。差距：required 过严误杀（扣分 1）。
- 借鉴优先级：format 推断 > required 策略开关（多元素归并）> Draft 版本选择 > 回验 Tab。

## 可拓展性

- 短期（1 周）：required 策略开关（严格=现状/宽松=数组元素并集非 null）；additionalProperties 开关
- 中期（1 月）：format 启发式推断（正则识别 email/uri/date-time/uuid）；Draft 2020-12 输出；minItems/maxItems 可调
- 远期：内嵌 Ajv 校验 Tab（懒加载）形成"生成→编辑→校验"闭环；并入"JSON 工作台"（金标准 `docs/优化文档/开发工具/json-formatter.md` 远期档）作校验分支

## 优化处方（验收标准）

1. **required 策略开关**：新增"宽松模式"——数组元素字段并集，仅所有元素都存在的键进 required。→ **验收：`[{"a":1},{"a":2,"b":3}]` 宽松模式 required 仅含 a，严格模式含 a、b**
2. **format 推断**：值匹配 email/URL/ISO 日期/UUID 正则时输出对应 format。→ **验收：示例含 `zhang@example.com` 时该字段输出 `"format": "email"`**
3. **Draft 版本选择**：顶部下拉 draft-07/2020-12。→ **验收：选 2020-12 后 $schema 字段切换为 `https://json-schema.org/draft/2020-12/schema`**
4. **回验 Tab**：输出区上方加"生成 | 校验"Tab，校验 Tab 粘贴 JSON 用生成的 schema 跑 Ajv 并列错误路径。→ **验收：对默认示例生成 schema 后回验原 JSON 显示"通过"；删掉一个 required 字段后显示含路径的错误**
