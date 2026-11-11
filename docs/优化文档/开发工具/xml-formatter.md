# XML 格式化（xml-formatter）

> 分类：开发工具｜模式：D（grid-2 双栏 + ResultBox）｜组件：`src/tools/developer/components/XmlFormatter.vue`（81 行）＋ `src/components/common/ResultBox.vue`｜引擎：`src/lib/jsEngine.ts` formatXml 正则缩进（:346-360）＋组件内 DOMParser 校验（`XmlFormatter.vue:15-27`）｜注册：`src/tools/developer/registry.ts:188`
> 对标标杆：codebeautify.org XML Formatter＋freeformatter.com XML Formatter（含校验报告）

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 美化/压缩双动作＋DOMParser 语法校验✓；缺缩进档位（formatXml 调用写死 2，`XmlFormatter.vue:40`）、属性每行/CDATA 处理模式、压缩去注释开关、命名空间感知选项 |
| 可用性 | 20 | 8 | 8 | **硬伤：双栏各钉 300px**（`XmlFormatter.vue:63,65`，共性-根因 2；几何同 M-01）；但解析错误持久展示在 notice-err（:68）是家族内最好的错误可恢复性 |
| 实用价值 | 15 | 12 | 12 | Feed/Android 布局/配置文件场景真实高频；DOMParser 校验为真浏览器解析器（非正则模拟） |
| 交互便捷性 | 15 | 10 | 10 | 双按钮置顶✓复制下载齐；错误条不可点击跳转到出错行、粘贴不自动处理 |
| UI 美观性 | 10 | 7 | 7 | 工整一致；≤560px 才堆叠（共性-根因 5） |
| 灵魂度 | 20 | 8 | 8 | 预填示例✓、中文错误提示"请检查标签闭合与转义"✓、错误横幅常驻✓；但错误信息无行列定位跳转（DOMParser 文本本含行号，`XmlFormatter.vue:20` 仅截断展示） |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 6 | — | 正则缩进＋DOMParser 双主线程同步，MB 级 Feed 冻结无反馈 |
| 附加：移动端 | 10 | 5 | — | 双栏堆叠后输出区约 2 屏外（横向结论 6） |

## 结论与优先级

**交互优化** · P2

判据：可用性 8/20 钉高硬伤（共性-根因 2）；错误闭环已有雏形，主要欠账在高度与选项面，功能面无代差。

## 扣分点明细

1. 【可用性-硬伤】ResultBox 双重钉高 300px（`ResultBox.vue:69`、`XmlFormatter.vue:65`；同构几何 M-01）
2. 【交互】错误定位半途而废：Chrome DOMParser 的 parsererror 文本自带 "error on line X at column Y"（`XmlFormatter.vue:20` 原样截取 160 字），但仅展示不可点击、不跳转输入区对应行
3. 【功能-疑似问题】formatXml 以 `/^<[^!?/][^>]*[^/]>$/` 判开标签（`jsEngine.ts:357`）：属性值以 `/` 结尾的标签（如 `<a href="/">`）被误判自闭合，后续兄弟节点整体少缩进一级
4. 【功能-疑似问题】压缩路径仅 `>\s+</`（`jsEngine.ts:347`）：不去注释、CDATA 内空白保护缺失，`<![CDATA[x > y]]>` 若含 `> <` 序列会被破坏
5. 【功能】无任何选项：缩进写死 2 空格（`XmlFormatter.vue:40`）、无属性每行模式（SOAP/Android 布局场景刚需）、无"保留文本节点空白"开关（XHTML 混排内容会被重排）
6. 【交互】粘贴合法 XML 不自动美化；无文件上传入口（Feed 场景多整文件）
7. 【灵魂】无快捷键、无美化前后体积对比；与 xml-to-json（`jsEngine.ts:395` 同族函数）无入口联动，用户需自行找工具
8. 【环境】Cookie 横幅首访遮挡底部结果区（M-01 截图证据）

## 行业对标与差距

- **codebeautify.org XML Formatter**：文件上传/URL 拉取、缩进选项、XML 查看树联动、一键 minify 对比。差距：选项面与文件入口。
- **freeformatter.com**：格式化+严格 XSD 校验+错误报告（行列号+原因分类）。差距：本工具校验为 well-formed 级，无 schema 校验与行列跳转。
- 借鉴优先级：输出区弹性高度 > 错误行跳转 > 缩进选项 > 文件入口 > xml-to-json 联动。

## 可拓展性

- 短期（1 周）：输出区弹性高度；错误条加"跳转到第 X 行"按钮（按 \n 计数滚动输入区）；粘贴即美化开关
- 中期（1 月）：缩进 2/4/8 与属性每行选项；压缩去注释开关；文件拖入
- 远期：与 xml-to-json/xml-to-table 组成"XML 工作台"；XSD 校验（纯前端 xsd 解析器或诚实标注不支持）

## 优化处方（验收标准）

1. **输出区弹性高度**：expand 模式 `calc(100vh - 330px)` 下限 480px。→ **验收：1366×768 下 500 行格式化 XML 同屏可见 ≥25 行**
2. **错误行跳转**：解析错误条附"定位到第 X 行"，点击滚动输入区使该行可见。→ **验收：构造缺闭合标签的 XML，点击后错误行进入输入区视口**
3. **自闭合误判修复校验**（疑似问题 3 的验收探针）：→ **验收：格式化 `<gallery><img src="/"/><img src="/b/"/></gallery>`，两个 img 行缩进一致**
4. **缩进选项**：2/4 空格暴露并持久化。→ **验收：选 4 空格刷新后仍生效**
5. **粘贴即美化**：paste 自动执行（800ms 防抖可关）。→ **验收：粘贴合法 XML 1s 内输出区出现缩进结果**
