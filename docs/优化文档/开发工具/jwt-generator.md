# JWT 生成器（jwt-generator）

> 分类：开发工具｜模式：B 变体（表单：算法/密钥/双 JSON 编辑→签名→ResultBox）｜组件：`src/tools/developer/components/JwtGenerator.vue`（全文 82 行）｜引擎：`src/lib/hashEngine.ts` hmac（:41）+ 组件内 b64url（:15-20）｜注册：`src/tools/developer/registry.ts:156`
> 对标标杆：jwt.io 调试器（编辑即重签）＋ CyberChef JWT Sign（HS\*/RS\* 全算法）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | HS256/384/512 三算法真实签名（hmac 非摆设）；仅 HMAC 对称系，无 RS256/ES256（WebCrypto importKey 纯前端可做）；无 claims 模板、无批量、无签发历史 |
| 可用性 | 20 | 11 | 11 | 算法+密钥+双 textarea 表单首屏收纳，生成按钮可见；结果 ResultBox 钉 140px（:79），长令牌换行后底部受挤 |
| 实用价值 | 15 | 12 | 12 | 本地签发测试令牌是前后端联调刚需，与站内 hashEngine 共享实现质量可信 |
| 交互便捷性 | 15 | 9 | 9 | exp 要用户手算 Unix 秒自维护（:76 文案自述"请自行维护"），无 15min/1h/7d 快捷档、无 iat=now 一键、每次改字段都要重新点签名 |
| UI 美观性 | 10 | 7 | 7 | 双栏 JSON 编辑工整；密钥 type=text 明文回显（:59）无遮罩，投屏/旁观场景泄密 |
| 灵魂度 | 20 | 8 | 8 | HS-only 边界诚实标注（:80）是好实践；无随机密钥生成器、与 jwt-decoder 无闭环互跳、payload 无字段提示 |
| **加权总分** | 100 | | **57** | 签名引擎可靠，但"造令牌"的周边配套（exp/密钥/闭环）全是手工活 |
| 附加：大文件性能 | 10 | 8 | — | SHA-HMAC 毫秒级，无风险场景 |
| 附加：移动端 | 10 | 6 | — | grid-2 ≤560px 堆叠（`base.css:329-335`），双 JSON 编辑区移动端纵向可用 |

## 结论与优先级

**交互优化 + 需拓展** · P2

判据：无可用性硬伤（可用性 11/20）；exp 手动维护与无 decoder 闭环是对 jwt.io 调试器最痛的可追差距。

## 扣分点明细

1. 【交互】exp 无辅助：默认 payload 里 exp=1893456000 是写死的 2030 年（`JwtGenerator.vue:10`），签出的测试令牌"永不过期"误导联调；无相对时间快捷档也无 iat=now（:76 只有一句提醒文案）
2. 【功能】仅 HS\*：RS256/ES256 非对称签名缺失（jwt.io/CyberChef JWT Sign 均支持，WebCrypto importKey PEM 纯前端可及）
3. 【灵魂】无随机密钥生成：HS256 要求 ≥256bit 密钥，工具让用户自己想一个（placeholder "your-256-bit-secret" :59），"生成随机密钥"按钮是零成本加分项
4. 【交互】与 jwt-decoder 无闭环：签完想验签要手动复制→跳页→再粘贴，两页无互链无参数传递
5. 【可用性】密钥输入框 type=text 明文回显（:59），无"隐藏"切换
6. 【功能】payload 无字段模板/联想（iss/sub/aud/jti 常用 claims 速填缺失），新手对"该写什么"零引导
7. 【可用性】结果 ResultBox 钉 140px（:79），长令牌可视范围小且输入输出高度不成比例
8. 【交互】改 payload 任意字符后旧 token 仍展示（generate 手动触发 :22-43），无"结果已过期不匹配当前输入"提示，易复制错版本

## 行业对标与差距

- **jwt.io 调试器**：编辑 header/payload 即时自动重签（HS 系填 secret 即可）、library 一键载入常见方案、算法下拉覆盖 RS/ES/PS 全家。差距：**"改字段→立即拿到新令牌"的即时性**（本工具每次手动点签名）与算法覆盖面。
- **CyberChef JWT Sign**：HS/RS 全算法、密钥多格式、可串 JWT Verify 配方自证。差距：算法覆盖与"生成后即验"的自证闭环。
- 借鉴优先级：**exp 快捷档 > 随机密钥按钮 > decoder 闭环互跳 > RS256 > claims 模板**。

## 可拓展性

- 短期（1 周）：exp/iat 快捷档（选时长自动写回 payload）；随机密钥生成按钮；密钥显隐切换
- 中期（1 月）：RS256/ES256（WebCrypto importKey，注意懒加载纪律）；claims 常用字段速填 chips；"去解码器验证"按钮带参跳转
- 远期：与 jwt-decoder 合并为 JWT 工作台（生成/解码/验签三 Tab）；签发历史（localStorage 最近 10 条）

## 优化处方（验收标准）

1. **exp 快捷档**：payload 区下加"过期时间：15 分钟/1 小时/1 天/7 天"下拉，选择后自动把 exp=当前 Unix+时长 写回 payload。→ **验收：选"1 小时"后 payload 文本出现 exp=当前 Unix+3600，与 timestamp-converter 换算一致**
2. **iat=now 按钮**：一键把 iat 覆写为当前 Unix 秒。→ **验收：点击后 payload 中 iat 与本地时间误差 ≤2 秒**
3. **随机密钥**：密钥框旁加骰子按钮，生成 43 字符 base64url（256bit 熵）。→ **验收：连点两次值不同且长度 43，用该密钥签出的 JWT 可被 jwt-decoder 校验通过**
4. **decoder 闭环**：结果区加"去解析验证"跳 `/t/jwt-decoder`（query 带令牌自动解码）。→ **验收：跳转后解码页无需粘贴直接显示三段结果**
5. **输入变更提示**：token 生成后再次编辑 header/payload/secret 时结果区顶部出现"内容已变更，令牌为旧版本"。→ **验收：编辑 payload 后提示出现，重新签名后消失**
