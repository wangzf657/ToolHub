# CSS 格式化 / 压缩（css-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/CodeFormatter.vue`（105 行，js/css/html 四口共用）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` formatCode（prettier postcss 插件懒加载 :285-292）＋ minifyCss 正则（:320-327）｜注册：`src/tools/developer/registry.ts:185`
> 对标标杆：CSSO 官方在线 demo（css.github.io/csso）＋ minify.dev（CSS/JS 在线压缩套件）

## 七维评分：54 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 真 prettier（postcss）格式化✓；**压缩为正则去空白**（`jsEngine.ts:320-327`）非 csso/cssnano，且无字符串保护有破坏风险；无缩进档位/紧凑-展开以外任何选项（tabWidth 走默认 2，`CodeFormatter.vue:48` 未传 indent） |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 320px**（`CodeFormatter.vue:85,87`，共性-根因 2；几何同 M-01），长样式表小窗内滚 |
| 实用价值 | 15 | 12 | 12 | CSS 格式化中高频；生产级 CSS 压缩被站内 code-minifier（真 csso，`registry.ts:295-296`）覆盖，本入口压缩有质量风险 |
| 交互便捷性 | 15 | 10 | 10 | 语言 chip/双按钮置顶✓复制下载齐；粘贴后需手动点、无即时预览 |
| UI 美观性 | 10 | 7 | 7 | 工整一致；JS/CSS/HTML 三 chip 对只想处理 CSS 的用户是干扰项 |
| 灵魂度 | 20 | 7 | 7 | 预填 CSS 示例✓（`CodeFormatter.vue:15`）、notice 诚实披露压缩本质✓（:90-92）；无压缩率统计、无错误行内定位 |
| **加权总分** | 100 | | **54** | |
| 附加：大文件性能 | 10 | 5 | — | prettier 主线程同步，大型样式表冻结无反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 8/20 钉高硬伤；压缩质量与 CSSO 存在正确性差距（字符串值可能被改）。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 320px（`ResultBox.vue:69`、`CodeFormatter.vue:87`；同构几何 M-01/M-02 大屏零增益）
2. 【功能-疑似问题】minifyCss 的 `\s*([{}:;,>])\s*` 全局去空白无字符串保护（`jsEngine.ts:323`）：`content:"a ; b"` 值内空格被吞为 `"a;b"`、字体名 `"Helvetica Neue"` 安全但引号内含分隔符的自定义属性值会被改写——压缩可能改变渲染结果
3. 【功能】压缩非真引擎：无 csso 结构化优化（合并规则、去重、简写化），仅去注释去空白（`jsEngine.ts:320-327`）；站内 code-minifier 已有真 csso 却未复用
4. 【功能】风格选项为零：缩进固定 2 空格、无"紧凑/展开"细档（如每属性一行 vs 全展开）、无行宽控制——CSSO demo 与 Prettier Playground 均可调
5. 【交互】粘贴后需手动点，无即改即格式化；无压缩前后体积对比
6. 【灵魂】无压缩率披露（code-minifier 有，`registry.ts:305-308`）；prettier 语法错误仅 toast 瞬闪（`CodeFormatter.vue:50-52`）
7. 【美观】≤560px 才堆叠（共性-根因 5）；三语言 chip 冗余
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **CSSO 官方 demo（css.github.io/csso）**：结构化压缩（规则合并/去重/简写重构）+ 即时输出 + 压缩前后体积。差距：对方压缩后可直接部署，本工具产物需复查字符串完整性。
- **minify.dev**：CSS/JS/HTML/JSON 一站式，文件上传 + 拖放 + 结果一键复制统计。差距：无文件入口、无统计。
- 借鉴优先级：压缩换真引擎（复用 csso）> 输出区弹性高度 > 压缩率统计 > 即改即格式化。

## 可拓展性

- 短期（1 周）：输出区弹性高度；压缩率统计（输入/输出字节数）；错误持久展示
- 中期（1 月）：压缩路径切换 csso（与 code-minifier 同源）；缩进档位选项；CSS 专属面板（隐藏无关语言 chip）
- 远期：CSS 兼容性提示（如压缩时警告 -webkit- 前缀丢失风险）；与 css-generator 家族（Gradient/BoxShadow/BorderRadius）组成"CSS 工作台"

## 优化处方（验收标准）

1. **压缩换真引擎**：压缩按钮改走 csso（懒加载）。→ **验收：压缩含 `content:"a ; b"` 的 CSS，输出中该字符串值保持不变且统计显示减小率**
2. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 400 行格式化 CSS 同屏可见 ≥25 行**
3. **压缩率统计**：结果区头部显示"原始 X B → 压缩后 Y B（-Z%）"。→ **验收：对示例 CSS 显示一致的字节数且 Z 与手工计算相符**
4. **缩进选项**：暴露 2/4 空格并持久化。→ **验收：选 4 空格格式化后刷新页面输出仍为 4 空格**
5. **即改即格式化**：paste 自动执行（1s 防抖可关）。→ **验收：粘贴合法 CSS 1.5s 内出结果无需点击**
