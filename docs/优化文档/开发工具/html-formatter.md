# HTML 格式化（html-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/CodeFormatter.vue`（105 行，js/css/html 四口共用）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` formatCode（prettier html 插件懒加载 :285-292）＋ minifyHtml 正则（:329-335）｜注册：`src/tools/developer/registry.ts:186`
> 对标标杆：Prettier Playground＋codebeautify.org HTML Formatter

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 真 prettier（html 插件，babel+postcss 同载）**支持内联 JS/CSS 嵌入格式化**✓（`jsEngine.ts:287-292` 全量预载是亮点）；缺缩进档位/行内元素换行策略选项；压缩为正则假压缩且会破坏 `<pre>` |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 320px**（`CodeFormatter.vue:85,87`，共性-根因 2；几何同 M-01），整页 HTML 小窗内滚 |
| 实用价值 | 15 | 12 | 12 | HTML 整理高频；嵌入脚本/样式一并格式化是真实加分；压缩被 html-minifier 入口（同组件）与 code-minifier 分薄 |
| 交互便捷性 | 15 | 10 | 10 | 按钮置顶✓复制下载齐；粘贴后需手动点、无文件上传入口 |
| UI 美观性 | 10 | 7 | 7 | 工整一致；JS/CSS chip 对 HTML 用户是干扰；≤560px 才堆叠（共性-根因 5） |
| 灵魂度 | 20 | 7 | 7 | 预填示例✓、notice 诚实说明压缩本质✓（`CodeFormatter.vue:90-92`）；prettier 错误仅 toast 瞬闪（:50-52），HTML 标签未闭合报错信息一闪即逝 |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 5 | — | prettier html 解析主线程同步，大页面冻结无反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化** · P1

判据：可用性 8/20 钉高硬伤；格式化引擎合格（含嵌入格式化），主要欠账在高度与交互模式。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 320px（`ResultBox.vue:69`、`CodeFormatter.vue:87`；同构几何 M-01/M-02）
2. 【功能-疑似问题】压缩路径 minifyHtml 先 `replace(/\n\s*/g,'')` 再 `>\s+</`（`jsEngine.ts:332-333`）：`<pre>/<textarea>` 内空白被抹，格式化产物用于压缩会改变页面渲染——无"跳过 pre"保护
3. 【功能】无内联 JS/CSS 处理开关（压缩时脚本/样式原样保留，未提供"压缩内联脚本"选项——对标 html-minifier 库的 minifyJS/minifyCSS 能力）
4. 【功能】缩进固定 2 空格（`CodeFormatter.vue:48` 未传 indent，`jsEngine.ts:296` 默认），无行宽/引号风格选项
5. 【交互】粘贴后需手动点格式化；无文件上传入口（整页 HTML 粘贴易超限）
6. 【交互-疑似问题】prettier 对非法 HTML 的报错仅 toast.err 瞬时（`CodeFormatter.vue:50-52`），复现困难
7. 【灵魂】无快捷键、无格式化前后 diff、示例只有 2 行片段不足以展示嵌入格式化能力（`CodeFormatter.vue:16`）
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **Prettier Playground**：即改即格式化、html-whitespace-sensitivity 等嵌入格式化配置可调、错误行内红标。差距：本工具引擎同源但配置面为零、交互要按钮。
- **codebeautify.org HTML Formatter**：文件上传/URL 拉取/树形查看器联动。差距：无文件入口、无结构视图。
- 借鉴优先级：输出区弹性高度 > pre 保护（压缩正确性）> 即改即格式化 > 缩进选项 > 文件入口。

## 可拓展性

- 短期（1 周）：输出区弹性高度；压缩加 pre/textarea 保护；错误持久展示
- 中期（1 月）：缩进档位与 htmlWhitespaceSensitivity 选项；文件拖放入口；HTML 专属面板裁剪无关语言 chip
- 远期：格式化前后 diff；与 meta/OG 生成器、html-minifier 整合为"HTML 工作台"单一入口

## 优化处方（验收标准）

1. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 400 行格式化 HTML 同屏可见 ≥25 行**
2. **pre 保护**：压缩时跳过 `<pre>…</pre>` 与 `<textarea>…</textarea>` 内容。→ **验收：压缩含 `<pre>` 缩进诗文的页面，pre 内换行与空格逐字符不变**
3. **嵌入格式化示例引导**：空态示例含 `<style>`+`<script>` 片段并标注"内联样式/脚本一并格式化"。→ **验收：默认示例格式化后 script 内语句有缩进与分号**
4. **即改即格式化**：paste 自动执行（1.5s 防抖可关）。→ **验收：粘贴合法 HTML 2s 内出结果**
5. **缩进选项**：2/4 空格可选并持久化。→ **验收：选 4 空格后刷新仍生效**
