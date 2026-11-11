# GraphQL 格式化（graphql-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/GraphqlFormatter.vue`（55 行）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` prettyGraphql/minifyGraphql 正则（:362-386）｜注册：`src/tools/developer/registry.ts:189`
> 对标标杆：GraphiQL 内置 Prettify＋Prettier（graphql 插件，prettier.io/playground）

## 七维评分：51 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 8 | 8 | 纯正则缩进/压缩（`jsEngine.ts:362-386`）；无语法校验（非法输入静默产出错排版本）、缩进写死 2（`GraphqlFormatter.vue:15` 默认参数未暴露）、无 schema/query 模式区分、无字符串保护 |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 300px**（`GraphqlFormatter.vue:48,50`，共性-根因 2；几何同 M-01） |
| 实用价值 | 15 | 11 | 11 | 客户端查询/SDL schema 美化与压缩（贴日志、贴分享）场景真实但受众较窄；错排风险压低信任度 |
| 交互便捷性 | 15 | 11 | 11 | 美化/压缩/**填入示例**三按钮置顶✓（示例按钮是格式化家族唯一显式示例入口，`GraphqlFormatter.vue:32-34`）；同步正则秒出无需 loading |
| UI 美观性 | 10 | 7 | 7 | 工整一致；≤560px 才堆叠（共性-根因 5） |
| 灵魂度 | 20 | 6 | 6 | 示例按钮＋场景说明 notice✓（:53）；但错误静默是负项——输入缺大括号时输出照样生成，用户不知道结果已错 |
| **加权总分** | 100 | | **51** | |
| 附加：大文件性能 | 10 | 6 | — | 正则同步执行，超大 SDL 可感知卡顿但无冻结 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 8/20 钉高硬伤；引擎为正则近似，正确性（字符串内 `#`/花括号）与校验能力相比 GraphiQL/Prettier 是代差。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 300px（`ResultBox.vue:69`、`GraphqlFormatter.vue:50`；同构几何 M-01）
2. 【功能-疑似问题】minifyGraphql 先全局删 `#` 注释（`jsEngine.ts:382`）：字符串字面量内的 `#` 一并删除（如 `query { user(name: "issue#1") }` 压缩后变 `"issue`），产物语法损坏
3. 【功能-疑似问题】prettyGraphql 先 `\s+`→空格全局折叠（`jsEngine.ts:365`）：`"""` 块描述的排版被压平、描述文本内多空格丢失、字符串内 `{}` 会被当作层级缩进依据
4. 【功能】零校验：大括号不配对、非法 token 照样"美化成功"（`GraphqlFormatter.vue:12-20` 仅 catch 异常，正则永不抛错），无错误定位
5. 【功能】缩进写死 2 空格（`GraphqlFormatter.vue:15` prettyGraphql 默认参数）、无缩进/行宽选项；schema（SDL）与 query 未区分处理（desc 宣称两者皆可，实为同一正则）
6. 【交互】无快捷键；输入输出独立滚动，长查询对照困难
7. 【灵魂】示例按钮是亮点但仅一个；无 fragment/变量定义的专项美化说明，能力边界无文案交代（对照 notice 只说了大括号缩进）
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **GraphiQL（内置 Prettify 按钮）**：基于 graphql-language-service 解析器，真实 AST 缩进、语法错误红色波浪线+行列报告。差距：引擎代差——对方"格式化即校验"，本工具格式化与校验双缺。
- **Prettier graphql 插件**：与 JS/CSS 统一风格、选项化（行宽）、字符串字面量保护。差距：本工具未复用 prettier 生态（站内 formatCode 已支持 graphql 分支但走的是自家正则，`jsEngine.ts:278-280`）。
- 借鉴优先级：压缩字符串保护（紧急）> 校验+错误定位 > 缩进选项 > 换 AST 解析器。

## 可拓展性

- 短期（1 周）：minifyGraphql 跳过字符串字面量内的 `#`；输出区弹性高度；结果区加"已按大括号近似缩进，未做语法校验"诚实横幅
- 中期（1 月）：接入 graphql-language-service 或 prettier graphql 插件做真 AST 格式化与校验；缩进选项；错误行列持久展示
- 远期：与 CodePlayground 组成"GraphQL 工作台"（格式化+假数据预览）；SDL/query 双模式差异化排版

## 优化处方（验收标准）

1. **压缩字符串保护**：→ **验收：压缩 `query { t(name: "a#b") { x } }` 输出含完整 `"a#b"` 且为合法 GraphQL**
2. **块描述保护**：→ **验收：含 `"""多行描述"""` 的 SDL 美化后描述内部换行保留**
3. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 300 行格式化 SDL 同屏可见 ≥25 行**
4. **诚实横幅**：首次输出时结果区顶部显示"按大括号层级近似缩进，未做语法校验"。→ **验收：横幅可见且措辞含"未做语法校验"**
5. **校验接入**（中期）：→ **验收：输入缺闭合大括号时，输出区上方显示含行列号的错误条而非静默输出**
