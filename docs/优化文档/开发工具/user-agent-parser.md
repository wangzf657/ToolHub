# UA 解析器（user-agent-parser）

> 分类：开发工具｜模式：B 变体（textarea＋按钮行＋四结果卡）｜组件：`src/tools/developer/components/UaParser.vue`（全文 113 行）｜引擎：`src/lib/jsEngine.ts` uaParse（:719-773，自研正则特征库，非 ua-parser-js）｜注册：`src/tools/developer/registry.ts:206`
> 对标标杆：ua.dev（UA-CH 全解析）＋ whatismybrowser.com

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 浏览器/引擎/系统/设备四维各一条字符串（UaParser.vue:33-38）；**国产浏览器（微信 MicroMessenger/QQ/UC/夸克/华为）零识别**，含 `Chrome/` 即误报 Chrome（jsEngine.ts:729）；引擎与设备无版本号；无批量解析、无 bot 库名（仅一个关键词正则 :771） |
| 可用性 | 20 | 13 | 13 | 四结果卡单屏可读、图标辅助（:51-57）；原始串区 `max-height:120px` 钉高内滚（`UaParser.vue:105`，审计底稿 60 处钉高清单成员，共性-根因 2），超长 UA 需小窗滚动 |
| 实用价值 | 15 | 11 | 11 | 排查爬虫/兼容性问题可用，但识别精度不足（国产浏览器与 iOS 无版本）限制排障结论的可信度 |
| 交互便捷性 | 15 | 10 | 10 | 打开即自动填当前 UA 并解析（:12-15）✓；但改串后必须手动点"解析 UA"（无 watch 实时）、四维结果与原始串均无复制按钮（全文未引 copyText） |
| UI 美观性 | 10 | 8 | 8 | 四卡栅格工整、≤860px 转 2 列（:108-112）——自用 860 断点又添一处碎片化（共性-根因 5） |
| 灵魂度 | 20 | 10 | 10 | "重新填入当前浏览器 UA"一键回填（:48）＋底部 UA-CH 时代诚实免责（:65-67）是懂我细节；但无预设示例（爬虫/微信/iPad UA 一键填入），空态可探索性差 |
| **加权总分** | 100 | | **62** | |
| 附加：大文件性能 | 10 | 9 | — | 单串正则匹配毫秒级，无风险 |
| 附加：移动端 | 10 | 8 | — | 四卡 2 列排布在 340px 面板可读，原始串换行正常 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：无可用性硬伤（四卡一眼可读），但识别库深度与 ua.dev 存在代差（UA-CH、国产浏览器、bot 库），结果不可复制是明显交互摩擦。

## 扣分点明细

1. 【功能】国产浏览器/内嵌 WebView 零识别：MicroMessenger、MQQBrowser、UCBrowser、Quark、HuaweiBrowser、Doubao 等均不在特征库（`jsEngine.ts:724-732` 仅 7 个正则），含 `Chrome/` 的国产 UA 一律报"Chrome"——中文站用户遇到的高频 UA 恰恰是这些
2. 【功能】bot 识别仅一个正则 `/Bot|bot|Spider|slurp|crawl/`（:771）且排在 Mobile 之后（:769）：Googlebot-Mobile 类 UA 会先命中"移动设备"再漏判爬虫；也不报 bot 名称与归属（ua.dev 会报 Google/Googlebot）
3. 【功能】UA Client Hints 完全未利用：`navigator.userAgentData` 与 `Sec-CH-UA` 头可精确区分 Windows 10/11 与真实版本（免责文案自己也承认此局限，`UaParser.vue:66`），ua.dev 已做双通道融合
4. 【功能】iOS/引擎/设备无版本：iPhone 只报"iOS"不带 OS 版本（`jsEngine.ts:758` 未捕获 `iPhone OS 17_5`），Gecko 引擎无版本（:741-742 有捕获但结果未用）——版本是兼容性排障的核心字段
5. 【交互】结果四卡不可复制：全文未引 copyText，把"Chrome 131 / Blink / Windows 10/11 / 桌面设备"贴进工单要手动划选
6. 【交互】非实时：改 UA 串后需再点按钮（`parse()` 仅由 :47 按钮触发），无 400ms 防抖 watch
7. 【可用性-轻】原始串 `max-height:120px` 钉死（`UaParser.vue:105`）：iOS 完整 UA 约 250 字符，在窄面板下需内部滚动才能核对尾部版本号
8. 【灵魂】无预设 UA 样例：调试场景最常需要"微信内嵌/iPad/curl/Googlebot"四类一键填入，现只能去别处复制

## 行业对标与差距

- **ua.dev**：UA-CH 与经典 UA 双通道解析、bot 数据库（含厂商归属）、每维带完整版本、结果 JSON/表格一键复制、测试用例库。差距：**特征库深度代差**（UA-CH 读取是纯浏览器 API，架构无障碍）。
- **whatismybrowser.com**：guides 按浏览器给"你的 UA 能力说明"与常见误判提示。差距：解释性内容缺席。
- 借鉴优先级：**国产浏览器特征库 > 结果复制 > UA-CH 融合 > bot 库 > 预设样例**。

## 可拓展性

- 短期（1 周）：特征库加 MicroMessenger/QQ/UC/夸克/华为 5 条正则置于 Chrome 之前；四卡加复制按钮与"复制 JSON"；watch 400ms 防抖实时解析
- 中期（1 月）：读 `navigator.userAgentData`（getHighEntropyValues）补 platformVersion/model/uaFullVersion，与正则结果合并标注数据来源；bot 特征扩为 20+ 条带名称映射
- 远期：批量解析（每行一个 UA 出表格+CSV 导出）；UA 测试用例库（一键切换 10 种典型环境）；与 keycode-lookup 同型的"开发者环境速查"家族合并入口

## 优化处方（验收标准）

1. **国产浏览器特征库**：在 Chrome 匹配前插入 MicroMessenger/QQBrowser/UCBrowser/Quark/HuaweiBrowser 等 8 条。→ **验收：粘贴含 `MicroMessenger/8.0.49` 的 UA，浏览器卡显示"微信内嵌浏览器"而非 Chrome**
2. **结果可复制**：四卡各加 hover 复制钮＋卡片行尾"复制 JSON"。→ **验收：点击复制 JSON 后剪贴板为 `{"browser":"Chrome 131",...}` 四键对象**
3. **实时解析**：watch(ua) 400ms 防抖调用 parse。→ **验收：粘贴 UA 后 0.5s 内四卡更新，无需点击**
4. **UA-CH 融合**：`userAgentData` 可用时请求 platformVersion/uaFullVersion 并在卡内标注"（来自 Client Hints）"。→ **验收：Windows 11 Chrome 显示 OS 为"Windows 11"而非"Windows 10/11"**
5. **预设样例条**：输入框下方加 6 个 chip（微信/iPadOS/Googlebot/curl/iOS Safari/Android WebView）一键填充。→ **验收：点击"Googlebot" chip 后设备卡显示"爬虫"且浏览器卡显示 Googlebot**
