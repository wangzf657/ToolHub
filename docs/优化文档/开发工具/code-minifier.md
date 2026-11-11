# JS/CSS 压缩混淆（code-minifier）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef 壳）｜组件：`src/components/common/TextTool.vue`（195 行，42 工具共用）｜引擎：textDef transform 直调真 terser（mangle+compress）+ 真 csso（`src/tools/developer/registry.ts:287-309`）｜注册：`registry.ts:280`
> 对标标杆：javascript-minifier.com / css-minifier.com（BeautifyTools 系列）＋ terser CLI 口径

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | **真 terser（compress+mangle+module）+真 csso**（`registry.ts:298-300,295-296`），比 javascript-formatter 的正则假压缩强一代；压缩率统计✓（:305-308）；缺 mangle 档位（toplevel/reserved）、ES 版本选项、HTML 不支持、语言自动识别为启发式可误判（:289-291） |
| 可用性 | 20 | 8 | 8 | **硬伤：textDef 双窗各钉 180px**（`base.css:164-168`，M-06，共性-根因 2）；压缩输出为超长单行，180px 窄窗横向滚动极差 |
| 实用价值 | 15 | 13 | 13 | terser/csso 生产级质量，产物可直接部署（但统计注释混入需手动删除）；站内唯一真压缩入口 |
| 交互便捷性 | 15 | 9 | 9 | 输入即自动执行✓复制一键✓；但自动执行无防抖——**每敲一键跑一次 terser**（`TextTool.vue:47-48` watch 直连，大 JS 逐键卡顿）；无文件拖入 |
| UI 美观性 | 10 | 6 | 6 | textDef 壳最简陋：双 180px 窗+单选项条（家族共性）；输出含统计注释破坏"纯净产物"观感 |
| 灵魂度 | 20 | 8 | 8 | 语言自动识别+字节数/百分比统计是"懂我"细节✓（`registry.ts:305-308`）；失败提示含自查建议✓（:303）；但粘贴大文件瞬间主线程阻塞且无进度提示 |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 4 | — | 全站最重灾区：无防抖 watch 直连 terser，100KB JS 粘贴即冻结输入框（`TextTool.vue:47-48`） |
| 附加：移动端 | 10 | 6 | — | textDef ≤760px 单列堆叠可用（TextTool 家族共性） |

## 结论与优先级

**交互优化** · P1

判据：可用性 8/20（180px 钉高+超长单行产物）＋大文件逐键 terser 属交互硬伤；引擎质量本身站内领先，无需拓展功能面。

## 扣分点明细

1. 【可用性-硬伤】textDef 双窗钉 180px（`base.css:164-168`；M-06 实测几何）；压缩产物是数 KB 超长单行，180px 高窗内横向阅读几乎不可行
2. 【性能-硬伤】TextTool `watch([input, opts], run)` 无防抖（`TextTool.vue:47-48`）× terser 同步压缩（`registry.ts:298-300`）：编辑已粘贴代码时每键触发完整 minify，大文件输入框冻结
3. 【功能-疑似问题】产物被统计注释污染：`\n\n/* 压缩统计…*/` 直接拼进输出（`registry.ts:308`），用户整段复制即把注释带上（JS 版还抵消压缩收益），统计应放输出区外
4. 【功能】"混淆"名实差距：terser mangle 仅重命名变量/参数（`registry.ts:299`），无字符串加密/控制流扁平化/反调试——对"混淆"期待是轻度防读，UI 无能力边界说明
5. 【功能】语言自动识别为正则计数启发式（`registry.ts:289-291`）：CSS 变量密集的 JS 或含内联样式的模板字符串可能误判，且误判无提示
6. 【功能】无 mangle 配置（toplevel/reservedNames）、无 compress 档位、不支持 HTML/JSON
7. 【交互】无文件拖放入口；首用动态加载 terser/csso 期间输出区静默（TextTool pending 态不渲染，家族共性，`TextTool.vue:15`）
8. 【美观】180px 双窗与全站 300px 级工具高度不一致（共性-根因 2 高度清单随机取值的又一例）

## 行业对标与差距

- **javascript-minifier.com / css-minifier.com**：文件上传/URL 拉取、"最高/正常"压缩级别档、压缩率即时展示。差距：档位概念与结果反馈形态。
- **terser CLI 口径**：toplevel mangle、source map、保留关键字配置。差距：浏览器场景 source map 无法提供（可诚实标注），但 toplevel/reserved 完全可暴露。
- 借鉴优先级：防抖+进度反馈 > 统计外置 > mangle 档位 > 混淆能力边界文案 > 文件入口。

## 可拓展性

- 短期（1 周）：输入防抖（500ms）+pending 态渲染；统计信息移出产物（放结果区头部/附加 Tab）
- 中期（1 月）：mangle toplevel/reserved 选项；压缩级别档位；文件拖入；混淆能力边界文案（"变量重命名级防读，非强混淆"）
- 远期：与 javascript-formatter 合并压缩路径（单入口真 terser）；source map 说明区；HTML 压缩接入

## 优化处方（验收标准）

1. **防抖+加载反馈**：transform 前 500ms 防抖，pending 渲染"压缩引擎加载中/计算中"骨架。→ **验收：连续输入 10 字符仅触发 ≤2 次 terser 调用；首用加载期间输出区有提示**
2. **统计外置**：压缩率信息移至结果区头部"原始 X B → Y B（-Z%）"，产物本体纯净。→ **验收：复制结果到剪贴板不含"压缩统计"注释**
3. **180px 弹性化**：textDef 结果区支持调用方传 vh 级高度或 field-sizing。→ **验收：1366×768 下结果窗 ≥400px 高**
4. **mangle 档位**：暴露"常规/激进（toplevel）"两档。→ **验收：激进档压缩模块代码后顶层变量被重命名且行为不变（示例自测）**
5. **混淆边界文案**：说明区标注"mangle 仅重命名标识符"。→ **验收：文案可见且含"非强混淆"字样**
