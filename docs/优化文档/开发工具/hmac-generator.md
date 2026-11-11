# HMAC 签名生成（hmac-generator）

> 分类：开发工具｜模式：B/D 混合（表单＋按钮＋ResultBox 结果区）｜组件：`src/tools/developer/components/HmacGenerator.vue`（全文 89 行）｜引擎：`src/lib/hashEngine.ts`（hmac :41-52，Web Crypto importKey+sign）｜注册：`src/tools/developer/registry.ts:155`
> 对标标杆：emn178/online-tools（HMAC 计算器，经 WebSearch 核实）＋ CyberChef（基准库 HMAC 配方）

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | HMAC-SHA1/256/384/512 四算法（`HmacGenerator.vue:9,36-41`）+ Hex/Base64 双输出（:44-49）；缺 HMAC-MD5（Web Crypto 无 MD5 但站内已有本地 md5 引擎可组，`hashEngine.ts:14-17`）、密钥不支持 Hex/Base64 字节输入（仅 UTF-8 文本，`hashEngine.ts:48`） |
| 可用性 | 20 | 12 | 12 | 表单三段+按钮+结果自上而下单屏完成，隐私说明到位；结果 ResultBox 默认 180px 钉高（`ResultBox.vue:18,69`，共性-根因 2）——单行签名场景够用但超出 180px 的 Base64 长串仍需内滚 |
| 实用价值 | 15 | 13 | 13 | API 签名调试（对接 OSS/支付/云厂商回调验签）高频刚需，Web Crypto 计算质量可靠，本地不出密钥 |
| 交互便捷性 | 15 | 9 | 9 | 仅手动点"生成签名"（:16-28），改一个字符需重按；密钥框 autocomplete="off"（:54）防误存是细节；无期望签名比对（姊妹 hash-generator 有 matchOf，体验不一致） |
| UI 美观性 | 10 | 8 | 8 | 双列算法/输出格式排布工整（:74-79），busy spinner（:64）反馈明确；整体与站内表单规范一致 |
| 灵魂度 | 20 | 8 | 8 | "密钥不会离开设备"安全声明（:70）+ Loader2 转圈是好底子；但无示例一键填充、无弱密钥提醒、无算法/输出联动说明，签名场景的"防呆"（粘贴错方向）全无提示 |
| **加权总分** | 100 | | **61** | 引擎正确、隐私诚实，交互自动化与防呆设计是主要失分 |
| 附加：大文件性能 | 10 | 8 | — | 纯文本消息体量小；消息 textarea 固定 110px（:59）塞不下长 payload，大 JSON 需手动折叠粘贴 |
| 附加：移动端 | 10 | 6 | — | 单列堆叠可用；长签名串在 340px 面板折行，复制依赖 ResultBox 复制按钮尚可 |

## 结论与优先级

**交互优化 + 需拓展** · P2

判据：手动触发与无比对是明显交互摩擦但非硬伤；密钥字节格式与 HMAC-MD5 缺位对 emn178 有可追差距，属拓展项。

## 扣分点明细

1. 【交互】无自动计算：消息或密钥任何改动都要重新点按钮（`HmacGenerator.vue:16-28` 仅 run 绑定），对照站内 number-base-converter 的 computed 实时（`NumberBase.vue:69-79`）与 textDef 家族 watch 自动（`TextTool.vue:47-48`），同为本地毫秒级运算却退化为手动
2. 【功能】密钥仅支持 UTF-8 文本（`hashEngine.ts:48` `enc.encode(secret)`）：云厂商密钥常以 Hex/Base64 字节串给出（如二进制 16 字节密钥的 hex 形态），按文本再 UTF-8 编码会得到不同字节，签名对不上且工具无提示
3. 【功能】无 HMAC-MD5：部分老系统（存款接口/老 SDK）仍用 HMAC-MD5，站内已有本地 md5 引擎（`hashEngine.ts:14-17`）+ RFC 2202 可自行组装，属未暴露能力
4. 【交互】无期望签名比对：姊妹工具 hash-generator 有"粘贴期望值自动 ✓/✗"（`HashGenerator.vue:85-96`），此处调签名只能肉眼逐字符对，同一工程内体验倒挂
5. 【可用性-轻】结果 ResultBox 钉 180px（共性-根因 2）；消息 textarea 仅 110px（`HmacGenerator.vue:59`），长请求体粘贴需内滚编辑，体验憋屈
6. 【灵魂】无防呆：消息/密钥两个框视觉相近，粘反了照样出"合法"签名——可在密钥框加显示切换/计数徽章提示
7. 【灵魂】无示例与场景引导：没有"以 OSS 回调签名为例"的一键填充（消息=canonical 串、密钥=AccessKeySecret），新用户需自行理解字段含义
8. 【功能】与 jwt-generator（HS256 签名，`registry.ts:156`）、bcrypt-hash 同属签名家族却零互跳；emn178 的哈希页均内嵌 HMAC 开关

## 行业对标与差距

- **emn178/online-tools**：HMAC 覆盖 SHA 系+SM3、密钥支持文本/Hex/Base64 三种输入格式、输出 Hex/Base64/即复制。差距：**密钥字节格式档位**是签名对不上时最关键的排查维度，本工具完全没有。
- **CyberChef**：HMAC 配方可选 Passphrase/Hex/Base64 密钥与任意输出编码，可串联 JSON→HMAC→URL 编码管道。差距：管道不必追；密钥格式下拉可直接抄。
- 借鉴优先级：**自动重算 > 密钥 Hex/Base64 输入 > 期望签名比对 > HMAC-MD5 > 示例填充**。

## 可拓展性

- 短期（1 周）：watch 自动生成（防抖 300ms）；期望签名比对框（复用 hash-generator 的 matchOf 模式）；密钥明文/掩码切换
- 中期（1 月）：密钥输入格式下拉（文本/Hex/Base64）；HMAC-MD5（本地 md5 组装）；消息大文本折叠编辑（≥200px 弹性高度）
- 远期：与 hash-generator、jwt-generator 组成"签名工作台"；SM3-HMAC 支撑信创场景

## 优化处方（验收标准）

1. **自动重算**：算法/密钥/消息任一变化后 300ms 内自动更新签名（busy 期间防抖）。→ **验收：消息框输入一个字符，松手 300ms 内结果更新，无需点按钮**
2. **密钥格式档**：新增"密钥编码"下拉（UTF-8 文本/Hex/Base64），Hex 档输入非法字符即时行内报错。→ **验收：同一语义密钥以三种格式输入，Hex 12ab 与 Base64 档（对应字节）产出签名一致，文本档产不同签名（符合预期）**
3. **期望比对**：结果区加"期望签名"输入框，匹配行显示 ✓ 一致 / ✗ 不一致（忽略大小写与空白）。→ **验收：粘贴正确/错误期望值分别得到 ✓/✗，与 hash-generator 判定交互一致**
4. **HMAC-MD5**：算法下拉补 HMAC-MD5。→ **验收：RFC 2202 测试用例（key=Jefe，data="what do ya want for nothing?"）输出 `effcdf6ae5eb2fa2d27416d5f184df9c`（与 RFC 2202 TC2 一致）**
5. **示例填充**：空态提供"填入示例（云回调验签）"按钮。→ **验收：点击后三字段全部填充且立即产出非空签名，字段旁有中文说明**
