# JSON 转义 / 反转义（json-escape）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef）｜组件：`src/components/common/TextTool.vue`｜引擎：`src/lib/textEngine.ts:281-291`（jsonEscapeEncode/Decode）｜注册：`src/tools/developer/registry.ts:114-122`
> 对标标杆：CyberChef（Strings/Escape 模块）＋ freeformatter.com escape

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 方向选项（escape/unescape，registry.ts:118-121）+ `JSON.stringify(text).slice(1,-1)` 标准编码（textEngine.ts:281-283）；缺 Unicode `\uXXXX` 输出档、仅 ASCII 档、单引号上下文（嵌 JS 字符串）档 |
| 可用性 | 20 | 9 | 9 | **家族共性-硬伤**：180px 钉高+pending 不渲染（M-06）；转义后长串在小窗滚且无法换行查看 |
| 实用价值 | 15 | 12 | 12 | 日志分析（转义的 JSON 行）/SQL 注入排查/嵌入字符串是高频小场景 |
| 交互便捷性 | 15 | 10 | 10 | 方向即改即转（watch）；无自动方向检测（粘贴 `"a\nb"` 应建议 unescape） |
| UI 美观性 | 10 | 7 | 7 | 家族统一 |
| 灵魂度 | 20 | 7 | 7 | 反转义容错链合理（JSON.parse 失败回落正则，textEngine.ts:285-291）是亮点；但 fallback 会把字面 `\n`（反斜杠+n）误转真换行、`\uXXXX` 无法还原，无任何口径披露 |
| **加权总分** | 100 | | **56** | 编码路径标准，解码 fallback 有隐性边界 |
| 附加：大文件性能 | 10 | 7 | — | 字符串操作快；超长文本 toast 无进度但可接受 |
| 附加：移动端 | 10 | 6 | — | 家族同构（M-06） |

## 结论与优先级

**交互优化** · P2（家族处方覆盖；个性问题轻但值得披露口径）

判据：可用性 9/20 家族硬伤为主；个性缺陷（fallback 误转）影响面窄但违反"诚实边界"原则。

## 扣分点明细

1. 【灵魂·口径】unescape fallback（`JSON.parse` 失败时正则替换，`textEngine.ts:287-290`）会把输入中的**字面反斜杠+n**（如 Windows 路径 `C:\new`）误转为换行符，且 `\uXXXX` 序列不处理——含糊 fallback 无任何提示，输出可能静默失真
2. 【可用性-家族】180px 钉高 + pending 不渲染（M-06；共性-根因 2，引用 pinyin-converter.md 处方 1-2）
3. 【功能】无自动方向检测：粘贴以 `"…"` 包裹且含 `\n` 的串时应建议反转义，现需手动切方向
4. 【功能】无 Unicode 输出选项：中文默认原样输出（`JSON.stringify` 行为），需要 `\uXXXX` 纯 ASCII 场景（老系统）无开关
5. 【灵魂】无空态示例（"Hello\n"世界 一例即懂）

## 行业对标与差距

- **CyberChef**：Escape/Unescape 字符串模块带转义类型选择（\\n/\\x/\\u{...}）、预览高亮。差距：转义粒度可控性。
- **freeformatter**：输入输出对照 + 特殊字符表格。差距：教学式呈现。
- 借鉴优先级：**方向自动检测 > Unicode 档位 > fallback 口径提示**。

## 可拓展性

- 短期：家族整改；unescape 走 fallback 时输出顶部提示"宽松模式：按 \n \t \" \\\\ 简单还原"
- 中期：方向自动检测（正则嗅探 `\\n|\\u[0-9a-f]{4}`）；Unicode 档选项
- 远期：并入 CyberChef 式"转义工作台"（JSON/URL/HTML/正则转义统一入口，与 url-encoder/html-entity-encoder 合流）

## 优化处方（验收标准）

1. **fallback 披露**：unescape 命中 fallback 分支时提示"严格解析失败，已用宽松还原（\\u 序列不处理）"。→ **验收：输入 `C:\new` 走 fallback 时顶部出现提示条**
2. **方向自动检测**：输入首字符为 `"` 且含 `\\` 时方向 select 自动切 unescape 并 toast 一次。→ **验收：粘贴 `"a\\nb"` 后输出区直接出现两行文本**
3. **Unicode 档**：新增"非 ASCII 转 \\uXXXX"开关。→ **验收：开关开启时"中"输出 `\u4e2d`**
4. **家族整改**：引用 pinyin-converter.md 处方 1-2
