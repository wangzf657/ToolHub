# 网站图标生成器（favicon-generator）

> 分类：图片工具｜模式：C（单列文件流）＋ D 局部（HTML 代码走 ResultBox）｜组件：`src/tools/image/components/FaviconGenerator.vue`（171 行）｜引擎：`src/lib/imageEngine.ts:485-541`（encodeIco 多尺寸 ICO）
> 对标标杆：realfavicongenerator.net（全套 9 件+浏览器 mockup+校验清单）＋ favicon.io
> 家族说明：ResultBox 钉高（共性-根因 2）在本次只承载 7 行代码无实感；居中硬裁与源图尺寸问题与 app-icon-generator 同源，两档案互为参照。

## 七维评分：64 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | ICO(16/32/48)+PNG(16/32/180/192/512)+site.webmanifest+HTML 引用代码（FaviconGenerator.vue:64,72-80,107-118）核心齐；缺 favicon-96、mstile-150+browserconfig.xml、safari 固定标签页（pinned tab）图标——realfavicongenerator 全套 9 件缺 3 件 |
| 可用性 | 20 | 12 | 12 | 生成→打包两步清晰、HTML 代码可复制；但预览只有 64px 一档（:46-57）——favicon 的核心风险是 16px 下糊成色块，全流程无法验证最小尺寸可辨识度 |
| 实用价值 | 15 | 13 | 13 | 每个新网站都要做一次的刚需，一键打包直接丢站点根目录即可用；HTML 片段含 manifest/apple 链全（:72-80）拿来即贴 |
| 交互便捷性 | 15 | 11 | 11 | 拖入→生成→打包三步；居中自动裁方（:34-38）省事但不可调（无缩放/平移/边距/底色），构图不居中的 logo 只能自己先处理 |
| UI 美观性 | 10 | 7 | 7 | 64px 预览芯片+棋盘格底（:163-170）精致；生成前页面只有拖放区无任何"会得到什么"的预期说明 |
| 灵魂度 | 20 | 9 | 9 | 打包内容清单明示（:152）是懂用户的；但 site.webmanifest 输出空 name/short_name（:115-116）不提示——交付物自带 Lighthouse 扣分坑而无任何警告 |
| **加权总分** | 100 | | **64** | 主干健全，败在最关键验证环节（16px）缺席与 manifest 空字段 |
| 附加：大文件性能 | 10 | 8 | — | 输出均 ≤512px 小画布，毫秒级完成；512 放大自小源图时无质量提示 |
| 附加：移动端 | 10 | 7 | — | 按钮组换行正常，ResultBox 堆叠可用（M-03 同构） |

## 结论与优先级

**交互优化 + 需拓展** · P1（16px 预览是快赢，尺寸集补全是拓展主项）

判据：核心产物可用（64 分），但 16px 可辨识度无法验证属可用性缺口，尺寸集与 realfavicongenerator 差 3 件触发需拓展；manifest 空字段是疑似缺陷需修复。

整改优先序：16/32/48 三档预览（快赢）→ manifest 字段修复 → 尺寸集补全 → 裁剪微调。

## 扣分点明细

1. 【可用性】预览单档 64px（:46-57 用 64px canvas 覆盖显示）：favicon 最容易翻车的 16px 尺寸无任何预览——realfavicongenerator 提供浏览器标签页 mockup，本工具生成前完全无法判断"缩到 16px 还认得出来吗"
2. 【功能-疑似缺陷】site.webmanifest 的 name/short_name 输出空字符串（:115-116）且 UI 无提示：PWA 审计（Lighthouse）会报"manifest 未提供名称"，用户拿到的是带坑交付物
3. 【功能-需拓展】尺寸集缺口：缺 favicon-96x96（现代模板标配）、mstile-150x150+browserconfig.xml（Windows 磁贴）、safari-pinned-tab.svg——HTML 片段（:72-80）相应也没有 msapplication 与 theme-color 行
4. 【交互】居中硬裁不可调：直接取中心 min(w,h) 方块（:34-38），无缩放/平移/边距/纯色底——logo 主体偏上或需留白的场景必翻车
5. 【功能】无源图尺寸警示：<512px 源图静默放大输出 512（模糊）；对比站内 app-icon-generator 已有 <1024px 警告（AppIconGenerator.vue:67-69），同站标准不一
6. 【灵魂】无"验证你的 favicon"引导：realfavicongenerator 生成后给多环境检测链接，本工具打包完即终点

## 行业对标与差距

- **realfavicogenerator.net**：逐平台选项（iOS/Android/Windows/macOS Safari）、带文字的 site.webmanifest、生成后" Favicon 检测器"多环境验证、浏览器 mockup 预览。差距：**验证闭环**（预览 mockup+检测链接）与 Windows/macOS 两平台产物。
- **favicon.io**：文字转 favicon/emoji 转favicon 多输入源、属性即时预览。差距：本工具只收图片一种输入，无快速文字方案。
- 借鉴优先级：16/32 预览 > manifest 字段修复 > 尺寸集补全 > 裁剪微调 > 验证链接。

## 可拓展性

- 短期（1 周）：预览行加 16/32/48 实际像素渲染（image-rendering:pixelated 对照）；webmanifest name 空值警告
- 中期（1 月）：manifest 字段表单（name/theme_color/background_color）+尺寸集补全（96/mstile/browserconfig）+HTML 片段同步扩行；缩放/边距/底色裁剪选项
- 远期：文字/emoji 转 favicon 输入源；生成后多环境检测链接面板；与 app-icon-generator 共享"图标源图预处理"（裁剪+底色）组件

## 优化处方（验收标准）

1. **三档预览**：预览区显示 16/32/64 三个尺寸（16/32 以实际像素渲染并 4x 放大对照）。→ **验收：预览行出现 3 个不同尺寸图标；16px 图标与真实浏览器标签页渲染肉眼一致**
2. **manifest 修复**：生成前表单填写 name/short_name/theme_color，未填时黄条警告"Lighthouse 将扣分"。→ **验收：填"百宝工具箱"后 zip 内 webmanifest 含该 name 与 theme_color；未填时警告可见**
3. **尺寸集补全**：新增 favicon-96x96.png、mstile-150x150.png、browserconfig.xml，HTML 片段补 msapplication-TileImage 与 theme-color 行。→ **验收：zip 文件数 ≥10；HTML 代码含新增引用行且与打包文件名一一对应**
4. **裁剪微调**：源图预览上支持缩放滑杆+拖动定位+边距+透明/纯色底。→ **验收：缩放 80%+白底 20px 边距后，512 输出四周有白边且图标居中不裁切**
5. **源图警示**：源图 <512px 时警告"512/192 尺寸将放大，建议 ≥512px 源图"。→ **验收：拖入 200px 源图出现警告并列出受影响尺寸**
