# RSA 密钥对生成（rsa-key-generator）

> 分类：开发工具｜模式：C 变体（单列：选项条→生成→双 PEM 结果）｜组件：`src/tools/developer/components/RsaKeyGenerator.vue`（全文 116 行）｜引擎：node-forge 懒加载 rsa.generateKeyPair（:24-25，**同步阻塞**）｜注册：`src/tools/developer/registry.ts:229`
> 对标标杆：ArcaneUtils RSA Key Generator（PEM/JWK/DER，WebCrypto 客户端生成）＋ cuuduongthancong.com RSA 工具（PKCS#8/PKCS#1/JWK+SHA-256 指纹，均经 WebSearch 核实）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 2048/4096 双档+PKCS#1 PEM 复制/下载；缺 PKCS#8 私钥格式（openssl 现默认）、缺 JWK（JWT/JWKS 场景）、缺指纹回显、缺口令保护、缺 OpenSSH 格式 |
| 可用性 | 20 | 9 | 9 | **forge 同步生成阻塞主线程**（:25）：4096 位 10 秒+期间计时文案（:61）、按钮、输入全部冻结；PEM 结果区钉 260px（:111，审计底稿 developer 清单） |
| 实用价值 | 15 | 12 | 12 | 本地生成密钥是 HTTPS/JWT/SSH 前置刚需，PKCS#1 PEM openssl 兼容真实可用 |
| 交互便捷性 | 15 | 10 | 10 | 私钥/公钥各自复制+下载双出口（:69-80）；生成中 select 禁用防误触（:54 busy）；无格式选项、无私钥口令选项 |
| UI 美观性 | 10 | 7 | 7 | 选项条卡片+双 PEM 块工整；两段 PEM 纵向等宽排列拉长页面，4096 位私钥在小窗内滚 |
| 灵魂度 | 20 | 10 | 10 | "4096 位可能超过 10 秒，请耐心等待"预期管理（:61）+ssh-keygen 转换提示（:86）+"密钥不会离开设备"（:62）三处文案用心；但计时器冻结让等待体验与文案承诺相悖 |
| **加权总分** | 100 | | **58** | 文案层面懂我、实现层面阻塞——预期管理与实际反馈脱节是核心病灶 |
| 附加：大文件性能 | 10 | 3 | — | 主线程同步素数搜索，2048 位已卡顿、4096 位全页冻结 10 秒+（WebCrypto generateKey 原生异步可零成本化解） |
| 附加：移动端 | 10 | 6 | — | 单列堆叠可用；生成期间移动端同样整页冻结 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 9/20 逼近硬伤线（10 秒级全页冻结且进度反馈失真）；格式面（PKCS#8/JWK/指纹）是对 ArcaneUtils 的可追差距。

## 扣分点明细

1. 【可用性-重】同步阻塞+进度失真：`forge.pki.rsa.generateKeyPair`（:25）纯 JS 同步运算，`setInterval` 计时（:20）在阻塞期间无法触发——"正在生成，已进行 Xs"（:61）实际全程停在 0.2s，4096 位时用户面对死页 10 秒+；WebCrypto `subtle.generateKey` 原生异步非阻塞且更快（ArcaneUtils/DailyTool 均走此路），纯前端可实现
2. 【功能】无 PKCS#8 私钥输出：现代 openssl 默认 `BEGIN PRIVATE KEY`，工具只出 PKCS#1（:27），底部提示还让用户自己跑 `ssh-keygen -i -m PKCS8`（:86）——把格式转换推给用户
3. 【功能】无 JWK 格式：JWT RS256 调试、JWKS 发布场景需要 JWK（对标工具均支持），与 jwt-generator 也无法联动
4. 【可用性】PEM 结果区钉 260px（:111），4096 位私钥约 50 行需内部滚动且无行号定位
5. 【功能】无指纹/位数回显：生成后不展示 SHA-256 指纹，比对两把密钥是否相同只能肉眼对 PEM
6. 【功能】无私钥口令保护选项：下载的 private.pem 明文落盘（:44-47）
7. 【交互】无生成历史：误覆盖后只能重新生成（密钥不可找回，4096 位重生成成本 10 秒+）

## 行业对标与差距

- **ArcaneUtils RSA Key Generator**：PEM/JWK/DER 三格式、WebCrypto 生成不卡页面、2048/4096。差距：**非阻塞生成+多格式出口**——两者均为纯前端可及项。
- **cuuduongthancong.com**：PKCS#8/PKCS#1 双私钥格式+JWK+SHA-256 指纹展示。差距：指纹回显与格式自由度。
- 借鉴优先级：**WebCrypto 迁移（顺手解决冻结）> PKCS#8 选项 > 指纹显示 > JWK 导出 > 260px 弹性化**。

## 可拓展性

- 短期（1 周）：迁移 WebCrypto（RSASSA-PKCS1-v1_5/OAEP，JWK→PEM 转换保留 forge 或手写 DER 编码）；去掉假计时改为完成时一次性显示真实耗时
- 中期（1 月）：PKCS#1/PKCS#8/JWK 三格式 Tab；SHA-256 指纹行；PEM 区弹性高度
- 远期：与 jwt-generator（RS256）、pgp-encrypt（RSA 密钥）组成"密钥工作台"互跳；口令保护导出（PKCS#8 加密）

## 优化处方（验收标准）

1. **非阻塞生成**：改用 WebCrypto generateKey+异步导出。→ **验收：4096 位生成期间输入框可聚焦、页面无冻结，完成后显示的真实耗时与秒表实测误差 ≤0.5s**
2. **PKCS#8 选项**：私钥区加"PKCS#1 / PKCS#8"切换。→ **验收：PKCS#8 档输出 `BEGIN PRIVATE KEY` 且 `openssl pkey -in private.pem -text` 可正确解析**
3. **指纹回显**：生成后显示公钥 SHA-256 指纹（冒号分组）。→ **验收：指纹与 `ssh-keygen -lf public.pem` 输出一致**
4. **JWK 导出**：公私钥各加"导出 JWK"按钮。→ **验收：公钥 JWK 填入 jwt.io RS256 验证本工具 jwt-generator 签发的令牌为 Valid**
5. **PEM 区弹性**：260px 改 `max-height: calc(100vh - 420px)`、下限 260px。→ **验收：1366×768 下 4096 位私钥同屏可见 ≥28 行**
6. **口令保护导出**：私钥下载前可选"设置保护口令"（PKCS#8 加密导出）。→ **验收：设置口令导出的私钥可被 `openssl pkey -in x.pem -passin pass:口令` 正确读取，无口令则读取被拒**
