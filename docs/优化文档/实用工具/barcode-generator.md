# 条形码生成器（barcode-generator）

> 分类：实用工具｜模式：C（grid-2 表单 → 选项行 → 预览 → 下载）｜组件：`src/tools/utility/components/BarcodeGenerator.vue`（全文 126 行）｜引擎：`src/lib/qrEngine.ts`（makeBarcode :49-66，BARCODE_FORMATS :68-77，jsbarcode 懒加载）｜注册：`src/tools/utility/registry.ts:359`
> 对标标杆：Tec-It Barcode（barcode.tec-it.com，20+ 制式免费在线生成）＋ 草料二维码

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 8 制式（CODE128/CODE39/EAN13/EAN8/UPC/ITF14/MSI/pharmacode，qrEngine.ts:68-77）；tec-it 有 20+（缺 Codabar/Code93/ISBN/GS1 DataBar/EAN-14/PZN）；无批量、无 SVG/高 DPI、无字体字号、quiet zone 锁死 8（qrEngine.ts:62） |
| 可用性 | 20 | 13 | 13 | 全部控件+预览首屏可达（grid-2+选项行在面板上部）、watch 即时渲染（BarcodeGenerator.vue:42）；错误提示含制式位数/字符集示例（:38）是全站少有的好错误文案 |
| 实用价值 | 15 | 12 | 12 | 常用零售/物流制式覆盖到位（EAN-13 商品码+ITF-14 物流箱码）；批量缺失让打印标签场景要逐个生成 |
| 交互便捷性 | 15 | 12 | 12 | 输入即渲染+条宽/条高滑杆实时（:71-84）、下载名含内容（:49）；但切换制式不自动填合法示例（EAN-13 需数字，用户要自己撞错误提示才知道）、无复制图片 |
| UI 美观性 | 10 | 7 | 7 | 预览白底 min 160px 干净（:112-119）；opt-row 三控件 flex 排布在窄屏参差；家族共性断点碎片化 |
| 灵魂度 | 20 | 7 | 7 | 错误文案惊艳（:38 给出"EAN-13 需 12–13 位数字，CODE39 仅支持字母数字与 - . $ / + % 空格"）；但 EAN-13 12 位自动补校验位是 JsBarcode 行为（UI 不说明）、无"这串内容适合哪种码制"引导 |
| **加权总分** | 100 | | **61** | 单码链路顺滑、错误教育好；制式矩阵与批量是与 tec-it 的真差距 |
| 附加：大文件性能 | 10 | 9 | — | JsBarcode 同步渲染毫秒级 |
| 附加：移动端 | 10 | 7 | — | 单列堆叠可用；宽码（ITF-14）canvas max-width 100% 缩放（:122-125）可读 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性 13/20 无硬伤；制式数（8 vs 20+）与批量能力差距明显，且 **JsBarcode 引擎本身支持 codabar/code93/itf 等，属"引擎能力未暴露"**（与 QR 家族病灶同源），拓展成本低。

## 扣分点明细

1. 【功能】制式矩阵窄：8 制式（qrEngine.ts:68-77）vs barcode.tec-it.com 20+；缺 Codabar（物流/图书馆）、Code93、ISBN（书背码，可由 EAN-13 派生）、GS1 DataBar、ITF 非定长——**jsbarcode 库本身支持 codabar/code93/itf39 等，BARCODE_FORMATS 白名单未暴露**，拓展零新依赖
2. 【功能】无批量：标签打印场景（一版多码/CSV 逐行）缺失，tec-it 支持批量 URL、草料有批量入口；站内 qr-code-batch 骨架可复用却无打通
3. 【功能】无 SVG/高分辨率导出：仅 PNG canvas 位图（:44-53），印刷要 300dpi 或矢量时不够；JsBarcode 支持 SVG 渲染器（引擎未暴露）
4. 【交互】制式切换无示例引导：换 EAN-13 后文本框还是 "HELLO-2024"，用户只能靠报错文案自学（:38）——tec-it 切制式自动填合法示例
5. 【功能】quiet zone/边距锁死 8px（qrEngine.ts:62 margin: 8）：扫码枪对静区有最小宽度要求，印刷用户不可调
6. 【灵魂】EAN-13 校验位自动补算不说明：输 12 位 JsBarcode 自动算第 13 位（库行为），UI 既不提示也不显示"已自动补 X"，用户以为输错了或输对了无从判断
7. 【交互】无生成后验证：条码能否被扫码枪识别无自检（站内 qr-code-scanner 只认 QR，也无法反扫条码——两工具互为缺口）
8. 【功能】MSI/pharmacode 无场景说明：下拉只有码名（qrEngine.ts:75-76），新用户不知道 MSI 用于库存标签、pharmacode 用于药品单码（仅数字且范围有限）——tec-it 每个制式都有场景注释
9. 【环境】家族共性：面板 top≈250px（共性-根因 1）、下载按钮在流内底部（共性-根因 4，但本工具内容短未出屏）、兄弟工具互链靠注册表前 3 不可达（ToolPage.vue:44-46）

## 行业对标与差距

- **Tec-It Barcode**：20+ 线性码制+2D、切制式自动填示例、批量 URL 生成、SVG/EPS 矢量导出、参数（静区/高度/字体）全可调。差距：**制式矩阵与导出规格代差**——但其中 Codabar/Code93/ITF/SVG 均是 jsbarcode 现成能力，属低成本可补；GS1 系（DataBar/EAN-14）需校验逻辑自研，成本中。
- **草料**：条码批量+活码+扫码统计。差距：批量与统计（统计属云天花板，批量纯前端可做）。
- 借鉴优先级：**暴露引擎制式（codabar/code93/itf）> 切制式自动示例 > SVG 导出 > 批量（复用 qr-code-batch 骨架）> 校验位说明 > 静区可调**。

## 可拓展性

- 短期（1 周）：BARCODE_FORMATS 增加 codabar/code93/itf 三项（引擎零改动）；切制式自动填一位合法示例；EAN-13 自动补位提示
- 中期（1 月）：SVG 导出（JsBarcode svg 渲染器）；静区/高度/显示文本字号选项；CSV 批量（复用 qr-code-batch 的 FileDrop+ZIP 骨架）
- 远期：ISBN 派生（EAN-13 前缀 978 + 连字符排版显示）；GS1 DataBar/EAN-14 校验自研；与 qr-code-generator 家族合并为"码制工作台"（QR+条码一个入口）

## 优化处方（验收标准）

1. **暴露引擎制式**：BARCODE_FORMATS 增至 ≥11 项（加 Codabar/Code93/ITF）。→ **验收：制式下拉出现三项新选项，输入合法内容各出正确码形（Codabar A12345A 等）**
2. **切制式自动示例**：切换码制时文本框为空或非法则填入该制式合法示例。→ **验收：从 CODE128 切到 EAN-13，输入框自动变 590123412345 并立即出码**
3. **校验位透明**：EAN-13 输 12 位时显示"已自动计算校验位 X"。→ **验收：输入 690102818001（12 位）后提示含第 13 位数字且与标准校验算法一致**
4. **SVG 导出**：下载区加"下载 SVG"。→ **验收：导出 SVG 在浏览器/AI 中无损缩放且码形与 PNG 一致**
5. **批量**：CSV（内容,码制）→ ZIP，复用 qr-code-batch 骨架。→ **验收：50 行 CSV 一键生成 zip，失败行清单含行号（与 qr-code-batch 同规格）**
6. **制式场景注释**：下拉选项附一句用途说明（MSI=库存标签等）。→ **验收：8+ 制式每个选项的说明与 tec-it 用途描述一致，新手可按场景选码**
