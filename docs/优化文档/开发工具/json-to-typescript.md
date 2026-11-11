# JSON 生成 TS 类型（json-to-typescript）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/JsonToTypescript.vue`（62 行）｜引擎：`src/lib/jsEngine.ts:459-489`（jsonToTs）｜下载：`src/lib/download.ts`（saveText）
> 对标标杆：quicktype.io（JSON→TS 类型生成天花板）＋ jsonformatter.org（Tree 视图参照）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | interface 生成、嵌套拆分并按键签名去重（`jsEngine.ts:472-474`）、null→可选（:477）、根类型别名（:487）；缺 union/enum 字面量推断、数组多样本合并、命名风格切换、unknown 兜底 |
| 可用性 | 20 | 10 | 10 | 双窗 300px inline（`JsonToTypescript.vue:47,49`）高于家族默认但仍是钉死（`ResultBox.vue:69`），接口多时小窗内滚；错误仅截断 120 字符（:23） |
| 实用价值 | 15 | 13 | 13 | 前端对接 API 的刚需，去重拆接口产出干净、可直接下载 .ts（:27-31） |
| 交互便捷性 | 15 | 10 | 10 | 手动点"生成接口"（:41）；复制/下载齐；无粘贴即生成、无根类名实时生效（改完要再点一次） |
| UI 美观性 | 10 | 7 | 7 | 布局工整与金标准同构；grid-2 ≤560px 堆叠导致平板双栏过窄（共性-根因 5） |
| 灵魂度 | 20 | 7 | 7 | **默认示例 JSON 预填订单结构**（`JsonToTypescript.vue:10-11`）是全站少有的好空态；缺推断规则速查、无快捷键 |
| **加权总分** | 100 | | **58** | |
| 附加：大文件性能 | 10 | 6 | — | 同步主线程递归（:20），MB 级 JSON 冻结 UI 无 worker（同金标准扣分 7） |
| 附加：移动端 | 10 | 5 | — | 堆叠后输出区约 2 屏外（模式 D 共性，同构 M-03） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 10/20（钉死 300px 未到硬伤红线但明显憋屈）；推断能力与 quicktype 存在单代差距（无 union/enum/多样本）。

## 扣分点明细

1. 【功能】数组只取首元素推断（`jsEngine.ts:467`）——`tags: ["a", 1, null]` 全按首元素 `string[]` 输出，无多元素 union 合并；quicktype 会对数组全样本做类型归并
2. 【功能】可选字段仅认 null（:477）——数组内多对象字段不齐时（`[{a:1},{b:2}]`）不会把 a/b 标为可选，产出错误精确度的类型
3. 【功能】无字面量 union 推断：同类字段稳定出现 2~3 个固定值时 quicktype 生成 `type: "a" | "b"`，本工具一律 string
4. 【可用性-家族共性】ResultBox height=minHeight 钉死 300px（`ResultBox.vue:69`、`JsonToTypescript.vue:49`），接口树长时需手动拖拽
5. 【交互】根类名改动不触发重新生成（`generate()` 仅按钮触发，:15-25），需二次点击
6. 【功能】嵌套键名 pascal 化可能冲突：`user_info` 与 `userInfo` 生成同名 interface（:463 归一化后同键），无冲突检测（与 json-to-java-entity 扣分 2 同源）
7. 【性能】同步主线程，大 JSON 无进度反馈（家族共性）

## 行业对标与差距

- **quicktype.io**：多语言输出、命名风格（camel/snake/pascal）切换、enum 与 union 智能推断、多样本粘贴合并推断可选性、渲染前类型树预览。差距：**推断深度代差**——对方生成"防御性类型"，本工具生成"示例复述"。
- **jsonformatter.org**：格式化+Tree 双视图，接口生成结果可折叠浏览。差距：本工具输出为纯文本，深层级接口不可折叠。
- 借鉴优先级：数组多样本 union/可选推断 > 字面量 enum > 命名风格选项 > 折叠视图。

## 可拓展性

- 短期（1 周）：根类名输入回车即重新生成；粘贴即生成开关（同金标准处方 2）
- 中期（1 月）：数组多元素类型归并 + 字段可选性合并推断；`as const` 字面量推断；输出区加折叠树 Tab
- 远期：接 quicktype-core WASM（懒加载纪律内）补齐多语言；并入"JSON 工作台"（金标准 `docs/优化文档/开发工具/json-formatter.md` 远期档）与 json-to-java-entity 共用类型推断内核

## 优化处方（验收标准）

1. **多样本推断**：数组取全部元素做类型归并，字段在某元素缺失或为 null 时标 `?`。→ **验收：粘贴 `[{"a":1},{"b":2}]` 生成含 `a?: number; b?: number` 的 interface**
2. **字面量 union**：字符串字段值域 ≤5 个且重复出现 ≥2 次时生成 `type X = "a" | "b"`（可开关）。→ **验收：status 字段出现 "paid"/"unpaid" 各 ≥2 次时输出 union 类型**
3. **根类名实时生效**：rootName 输入 300ms 防抖自动重新生成。→ **验收：改根类名后不点击按钮输出首行 interface 名称随之更新**
4. **输出弹性高度**：ResultBox expand 模式下限 480px 可全屏（同金标准处方 1 口径）。→ **验收：1366×768 下 200 行 interface 无需滚动页面可见 ≥28 行**
