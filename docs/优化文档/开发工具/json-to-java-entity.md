# JSON 转 Java 实体类（json-to-java-entity）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef 家族）｜注册：`src/tools/developer/registry.ts:213-225`（选项：根类名/Lombok 开关）｜引擎：`src/lib/jsEngine.ts:926-987`（jsonToJava）｜壳：`src/components/common/TextTool.vue`（42 工具共用）
> 对标标杆：quicktype.io（JSON→多语言类型生成天花板）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | POJO + Lombok @Data/无 Lombok 补 getter/setter（`jsEngine.ts:958-975`）、嵌套拆 XxxDto、List<T>（:937-939）；缺 package 声明、@JsonProperty/@Format 注解、日期类型识别、顶层类名冲突保护 |
| 可用性 | 20 | 9 | 9 | **textDef 家族共性硬伤：双窗各钉 180px**（`base.css:164-168`；实测锚点 M-06），多类输出在两小窗内滚 |
| 实用价值 | 15 | 13 | 13 | 后端对接接口文档的高频刚需，Integer/Double/Boolean 推断正确，生成即贴即用（小对象） |
| 交互便捷性 | 15 | 11 | 11 | 输入即自动生成免按钮（TextTool watch，`TextTool.vue:47-48`，textDef 家族加分项）；互换/清空/复制齐全 |
| UI 美观性 | 10 | 7 | 7 | 全站统一双栏样式；≤760px 单列堆叠后输出窗更矮（TextTool.vue:156-159，共性-根因 5） |
| 灵魂度 | 20 | 6 | 6 | placeholder 给了方向（registry:222）；无包名/注解风格选项、无"嵌套类生成方式"说明、无示例库（Spring Boot/JPA 场景模板） |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 6 | — | 同步主线程递归，深嵌套大 JSON 卡输入无进度（textDef 共性） |
| 附加：移动端 | 10 | 6 | — | 单列堆叠后输出区约 1.5 屏外（M-06 同构） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 9/20 落在 textDef 家族 180px 硬伤段（共性-根因 2）；生成物正确性有一处编译级问题（扣分 1），功能面距 quicktype 有代差。

## 扣分点明细

1. 【功能-疑似缺陷】嵌套对象生成的多个**平级 public class 拼在同一个输出文件**（`jsEngine.ts:959` 每类都 emit `public class`，:984 根类在前、子类依次追加）——Java 一个 .java 文件只允许一个 public class，含嵌套 DTO 的输出直接复制编译必报错；应改内部 static class 或提示拆文件
2. 【功能】同名嵌套键跨层级复用同一类：`seen` 只按 pascal+Dto 类名去重（`jsEngine.ts:943-947`），`a.user` 与 `b.user` 结构不同时会错误复用先注册的类定义
3. 【功能】无 package 声明、无 @JsonProperty/@JsonFormat（日期仍是 String，:934）、无 Jackson/Gson 注解风格选项——quicktype 对 Java 可输出 Jackson 注解与 java.time 类型
4. 【可用性-家族共性】TextTool 双窗 180px 钉死（`base.css:164-168`；M-06），输出多类时需在 180px 窗内滚 10+ 屏（同金标准 M-01 的 10.8 屏问题）
5. 【灵魂】顶层数组静默取首元素（`jsEngine.ts:980`）无任何提示——用户不知道 List<根类> 语义被隐含了
6. 【功能】空数组 → `List<Object>`（:938）不尝试按字段名/上下文推断元素类型

## 行业对标与差距

- **quicktype.io**：Java/C#/Go/Kotlin/TS 一键切换、Jackson 注解开关、日期/enum 智能推断、多样本合并推断可选字段、自定义根类名实时生效。差距：**多语言+注解生态代差**；本工具只覆盖 Java 单语言与 2 个选项。
- 借鉴优先级：嵌套类编译级修复 > Jackson 注解开关 > 包名/日期类型 > 多样本合并推断。

## 可拓展性

- 短期（1 周）：修嵌套类编译问题（内部 static class 或"每类一个代码块"分隔提示）；输出头部加 `// TODO: 每个类一个 .java 文件` 提示
- 中期（1 月）：包名输入 + Jackson 注解开关 + java.time 识别；Lombok @Builder/@NoArgsConstructor 附加开关
- 远期：接入 quicktype-core WASM 或自研多语言后端（TS/Java/Kotlin/Go），并入"JSON 工作台"（金标准 `docs/优化文档/开发工具/json-formatter.md` 远期档）作"类型生成"分支

## 优化处方（验收标准）

1. **嵌套类编译可过**：嵌套对象改为根类内部 `public static class` 或输出按类分块并标注文件名。→ **验收：含两层嵌套的 JSON 生成的代码贴入 IDE 编译无 duplicate class 错误**
2. **同名嵌套键各自成类**：`seen` 去重键改为"类名+字段签名"（同 jsonToTs 的 `ifaceKey` 做法，`jsEngine.ts:472-474`）。→ **验收：a.user 与 b.user 结构不同时生成两个类，字段互不污染**
3. **包名与注解选项**：textDef options 增加 `pkg`（package 声明）与 `jackson`（@JsonProperty("原键名")）开关。→ **验收：填 `com.example.dto` 后输出首行 package 正确；下划线键字段带 @JsonProperty**
4. **数组顶层提示**：顶层数组输入时输出头部注释"检测到对象数组，已按首元素生成根类，接口返回用 List<根类> 包裹"。→ **验收：粘贴 `[{"id":1}]` 输出含该提示行**
