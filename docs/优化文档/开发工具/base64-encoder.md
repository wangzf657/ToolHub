# Base64 编解码（base64-encoder）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef 家族）｜组件：`src/components/common/TextTool.vue`（195 行，42 工具共用）｜引擎：`src/lib/textEngine.ts`（b64encode/b64decode :199-218）｜注册：`src/tools/developer/registry.ts:13-23`｜家族共性参见 `docs/优化文档/实用工具/pinyin-converter.md`
> 对标标杆：CyberChef（基准库）＋ base64.guru（经 WebSearch 核实）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 双向+UTF-8 中文正确（TextEncoder/TextDecoder，`textEngine.ts:200,217`）；**缺 URL-safe 变体（RFC 4648 §5 的 -_ 无填充）**、76 字符换行（MIME）、data URI 前缀模式、填充符开关 |
| 可用性 | 20 | 10 | 10 | 家族共性：双 textarea 各钉 180px（`base.css:164-168`；M-06，共性-根因 2），长 Base64 串在小窗内滚且两窗不同步 |
| 实用价值 | 15 | 13 | 13 | Base64 是调试 JWT/Cookie/数据 URI 的第一高频编解码，引擎分块转串防栈溢出（`textEngine.ts:203-206`）质量合格 |
| 交互便捷性 | 15 | 11 | 11 | 输入即自动转换免按钮（`TextTool.vue:47-48`）、互换/清空小图标（:116-119）、复制一键；解码侧自动剔除空白换行（`textEngine.ts:213`）可直贴 MIME 折行串，是隐藏加分项 |
| UI 美观性 | 10 | 7 | 7 | 全站统一双栏样式工整；方向选项"编码/解码"切换无视觉权重提示，双向工具常见误贴（贴解码内容时方向还在编码） |
| 灵魂度 | 20 | 7 | 7 | 自动转换+字符计数是家族底子；无示例填充、无"检测到 -_ 自动切 URL-safe"这类懂我细节，placeholder 为通用文案（registry.ts 未配） |
| **加权总分** | 100 | | **58** | 引擎正确但选项面薄，且简介承诺的能力未兑现（见扣分 1） |
| 附加：大文件性能 | 10 | 6 | — | 编码分块防栈溢出（:203-206）但全同步主线程，MB 级输入有冻结感且 pending 态不渲染（`TextTool.vue:15` 定义、模板未引用） |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列堆叠（`TextTool.vue:156-159`），输出区在约 1.5 屏外（M-06 同构） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：注册表简介明写"也可编码文件"（`registry.ts:15`）而 TextTool 壳根本没有文件入口，承诺与实现不符属疑似功能缺陷；URL-safe 变体等开发场景选项缺位，对 base64.guru 功能面差距明确。

## 扣分点明细

1. 【功能-疑似功能缺陷】简介承诺"也可编码文件"（`registry.ts:15`），但 textDef 走 TextTool 壳，**全组件无任何文件输入**（`TextTool.vue` 全文无 input[type=file]/FileDrop）——用户按文案找文件入口会落空。图片有 image-to-base64（`src/tools/image/registry.ts:54`）与 base64-to-image（`src/tools/developer/registry.ts:132`）兜底，但**任意文件（PDF/zip/字体）转 Base64 全站无路径**
2. 【功能】无 URL-safe Base64：`atob` 遇 `-`/`_` 直接抛错（`textEngine.ts:213` 仅剔空白），JWT 的 payload 段正是 URL-safe 编码，开发者最常撞的场景反而不支持
3. 【功能】无输出换行选项：超长 Base64 单行输出，粘进配置/邮件需手工折行；76 字符 MIME 折行是 base64.guru 标配
4. 【功能】无 data URI 模式（`data:text/plain;base64,` 前缀一键拼接），与 base64-to-image 的输入格式形成"能解不能造"的不对称
5. 【可用性-硬伤】180px 钉高（家族共性-根因 2；硬伤属 textDef 家族级，P0 挂整改样板 `pinyin-converter.md`）：Base64 输出通常比输入长 33%，长文本场景输出窗溢出感比一般 textDef 更重
6. 【灵魂】无"解码失败时检测是否为 URL-safe/Hex 字符并提示"的纠偏引导——`包含无效的 Base64 字符`（`textEngine.ts:215`）报错后用户不知往哪个方向试
7. 【交互】方向选错了（贴着密文却选编码）不报错也不提示，输出一串更长的密文，用户需自己察觉；双向工具缺"输入疑似已是 Base64"的智能提示
8. 【交互】超长结果无法下载存档：TextTool 壳仅有复制按钮（`TextTool.vue:130-133`），MB 级 Base64（如内嵌文件）靠剪贴板搬运易截断，base64.guru 与站内 ResultBox（`ResultBox.vue:49-62`）均支持下载

## 行业对标与差距

- **base64.guru**：文本/文件/URL-safe/data URI 全分支覆盖、编码解码自动检测、输出格式（含换行宽度）可选。差距：**文件与变体两条支线整体缺位**，当前只覆盖其"纯文本"一条分支。
- **CyberChef**：Base64 配方可串联（decode→gunzip→正则提取），Encoding 区一字排开全变体。差距：管道能力是架构级，单工具不必追；但 URL-safe 检测属单工具可及。
- 借鉴优先级：**修文件承诺（或补文件入口）> URL-safe 变体 > 输出换行宽度 > data URI 前缀 > 失败纠偏提示**。

## 可拓展性

- 短期（1 周）：简介与实现对齐（删"也可编码文件"或改文案指向 image-to-base64）；URL-safe 编解码选项（选择替换 -_ 与去填充）
- 中期（1 月）：输出 76/64 字符折行选项；data URI 模式；解码失败时字符特征检测提示
- 远期：升级为独立组件（模式 D）承载"文本/文件双入口 + 图片预览"，与 base64-to-image 合并成 Base64 工作台

## 优化处方（验收标准）

1. **兑现或修正文件承诺**：二选一——补"文件 → Base64"入口（FileDrop + FileReader，输出 data URI 与纯 Base64 两档），或将简介改为"任意文件可用图片转 Base64 工具"。→ **验收：拖入一个 .pdf 不再出现"文案有入口无"的死路；若补入口，1MB 文件 3s 内出结果且字符数与文件大小 ×4/3 偏差 <1%**
2. **URL-safe 变体**：编码加"标准/URL-safe"选项，解码自动兼容 -_（先归一化再 atob）。→ **验收：对 `PDw_Pz8-Pg` 与 `PDw_Pz8-Pg==` 均解码出同一结果；编码 ` subjects?<>` 生成不含 + / = 的串**
3. **换行宽度**：输出选项"不换行 / 76 字符（MIME）/ 64 字符"，换行符可复制回解码（解码已剔空白，天然闭环）。→ **验收：1000 字符文本按 76 折行后复制解码，还原与原文一致**
4. **失败纠偏**：解码抛错时检测输入含 -_ 或纯 hex 特征，toast 追加"疑似 URL-safe Base64，请切换变体"或"疑似 Hex，请用十六进制查看工具"。→ **验收：粘贴 JWT payload 段解码成功且 toast 无错误**
5. **家族钉高修复**（随 textDef 家族整改）：→ **验收：1366×768 下粘贴 40 行密文，同屏可见 ≥20 行（M-06 口径）**
