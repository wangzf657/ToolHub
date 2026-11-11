# JS 格式化 / 压缩（javascript-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/CodeFormatter.vue`（105 行，与 css-formatter/html-formatter/html-minifier 四口共用）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` formatCode（prettier standalone 懒加载 :285-292）＋ minifyJs 正则兜底（:337-344）｜注册：`src/tools/developer/registry.ts:70`
> 对标标杆：Prettier Playground（prettier.io/playground，即改即格式化天花板）＋ javascript-minifier.com

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 真 prettier（babel+estree）格式化✓；但配置面为零：semi 强制 true（`jsEngine.ts:297`）、无单引号/行宽/trailingComma/箭头括号选项；**压缩是正则去空白假压缩**（`jsEngine.ts:337-344`），非 terser（真 terser 在 code-minifier，`registry.ts:298-300`） |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 320px**（`CodeFormatter.vue:85,87`，共性-根因 2；几何同 M-01），长文件小窗内滚 |
| 实用价值 | 15 | 13 | 13 | JS 格式化高频刚需，prettier 输出权威；压缩能力被站内 code-minifier 更好覆盖，定位重复 |
| 交互便捷性 | 15 | 10 | 10 | 语言 chip/格式化/压缩按钮置顶✓、复制下载齐全；粘贴后需手动点、输入输出独立滚动 |
| UI 美观性 | 10 | 7 | 7 | 操作行置顶是全站好实践；四口共用组件在非 JS 入口仍显示三语言 chip 略显冗余 |
| 灵魂度 | 20 | 7 | 7 | 预填示例代码✓（`CodeFormatter.vue:14`）、notice 诚实说明压缩仅为去空白✓（:90-92）；但 prettier 报错只在 toast 瞬闪（:51），行列号信息随 toast 消失 |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 5 | — | prettier 主线程同步执行，MB 级输入 UI 冻结无进度反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区在约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 8/20 钉高硬伤；对标 Prettier Playground 配置面与"即改即格式化"均为空白；压缩路径名不副实。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 320px（`ResultBox.vue:69`、`CodeFormatter.vue:87`；同构几何 M-01/M-02：1920 大屏依旧 320px）
2. 【功能】**压缩为假压缩**：minifyJs 仅正则去注释去空白（`jsEngine.ts:337-344`），不改名不优化；desc 宣称"压缩"易让用户误以为 terser 级（站内 code-minifier 才是真 terser，`registry.ts:298-300`，双入口能力不一致）
3. 【功能-疑似问题】minifyJs 无字符串/模板字面量保护：模板字符串中行首 `//` 会被当注释整行删除（`jsEngine.ts:340`），压缩可能改变代码语义
4. 【功能】配置面为零：semi:true 写死（`jsEngine.ts:297`）、tabWidth 走默认 2（`CodeFormatter.vue:48` 未传 indent），无 printWidth/singleQuote/trailingComma——Prettier Playground 全部可调
5. 【交互-疑似问题】prettier 语法错误信息（含行列号与代码帧）仅 toast.err 且 slice(0,120)（`CodeFormatter.vue:50-52`），toast 瞬时消失后用户无从复查
6. 【交互】粘贴后需手动点"格式化"，无即改即格式化开关
7. 【灵魂】无快捷键（Ctrl+Enter）、无格式化前后 diff 对照
8. 【美观】≤560px 才堆叠（共性-根因 5），768 平板双栏各约 250px

## 行业对标与差距

- **Prettier Playground**：左侧代码右侧即改即格式化、全量配置面板（行宽/分号/引号/尾逗号/箭头括号）+ 配置可复制为 JSON、错误行内红标。差距：配置面代差＋交互模式代差（对方免按钮）。
- **javascript-minifier.com**：真压缩＋"压缩级别"档位。差距：本工具压缩档位概念不存在。
- 借鉴优先级：输出区弹性高度 > 配置面板 > 即改即格式化 > 错误行内持久展示 > 压缩换真引擎。

## 可拓展性

- 短期（1 周）：输出区弹性高度；粘贴即格式化开关；错误改持久 notice 展示行列号
- 中期（1 月）：JS 配置面板（printWidth/semi/singleQuote/trailingComma）并持久化；压缩按钮切换为复用 code-minifier 的 terser 路径
- 远期：格式化前后 diff 预览（与站内 TextDiff 引擎联动）；四入口（js/css/html/minifier）按语言裁剪选项的专属面板

## 优化处方（验收标准）

1. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 500 行 JS 同屏可见 ≥25 行**
2. **压缩换真引擎**：压缩路径改为 terser（与 code-minifier 同源），输出附压缩率统计。→ **验收：压缩 1KB 带注释示例 JS，变量名被 mangle 且统计显示减小率 >30%**
3. **配置面板**：JS 语言下暴露行宽/分号/单引号/尾逗号 4 项。→ **验收：关闭分号后输出无 `;`，刷新后配置保留**
4. **即改即格式化**：paste 事件自动执行（1s 防抖，默认开可关）。→ **验收：粘贴合法 JS 1.5s 内输出区出现结果**
5. **错误持久化**：prettier 报错改为 ResultBox 上方常驻 notice-error，含行列号。→ **验收：构造语法错误，toast 消失后错误条仍在且显示 line/col**
