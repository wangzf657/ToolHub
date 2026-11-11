# App 图标生成（app-icon-generator）

> 分类：图片工具｜模式：C（单列文件流，选项→生成→自动 ZIP）｜组件：`src/tools/image/components/AppIconGenerator.vue`（202 行）｜引擎：`src/lib/imageEngine.ts:146`（applyOps resize/round）+ `:485-541`（encodeIco 六帧 ICO）
> 对标标杆：appicon.co（iOS/Android 全尺寸+逐尺寸预览）＋ Icon Kitchen（Android 自适应图标双层）
> 家族说明：自动 ZIP 无结果列表为模式 C 家族共性（ImageConvertTool.vue:55 同构，见 png-to-jpg.md 处方 1）；源图校验三连警告是本工具独有亮点（详见扣分 5）。

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | iOS 12 尺寸+Android 6 尺寸+六帧 favicon.ico（AppIconGenerator.vue:18-39,111）按官方惯例命名；缺 iPad Pro 167、iOS Contents.json、Android 自适应图标（foreground/background 双层）——modern 双平台交付物各缺一件 |
| 可用性 | 20 | 11 | 11 | 源图校验 warnings 到位（:64-69）；但 18 个尺寸全部盲出：仅 56px 源图缩略（:133），无逐尺寸预览网格、无圆角生效预览，ZIP 落盘前对结果零确认（模式 C 家族共性） |
| 实用价值 | 15 | 12 | 12 | 独立开发打包上架的刚需，mipmap/AppIcon 命名惯例正确可直接入目录（:162-163 注明"微调配置"）；交付真实度高，但 Contents.json 缺席使 iOS 侧不能开箱即用 |
| 交互便捷性 | 15 | 10 | 10 | 三平台勾选默认全开+一键生成+进度条（:95-113）；圆角滑杆 5~50% 无锚点参考（iOS 超椭圆 ≈22% 不标注），勾选圆角无"iOS 不建议预圆角"提示（:139-142） |
| UI 美观性 | 10 | 7 | 7 | 布局紧凑清晰；完成信息是纯文字行（:161-164），无文件清单无尺寸矩阵视图，18 件产物不可视 |
| 灵魂度 | 20 | 9 | 9 | 源图三重校验（非 PNG 提醒 :57-59、非正方形 fit 说明 :64-66、<1024 放大警告 :67-69）是全家族最完整的输入防护，平台勾选带尺寸计数（:145-146）贴心；但生成后即失联（无清单无预览） |
| **加权总分** | 100 | | **61** | 输入端防呆最好，输出端最盲 |
| 附加：大文件性能 | 10 | 8 | — | 单源图+小尺寸串行生成，进度按件刷新（:108）；1024px 源 18 次缩放秒级完成 |
| 附加：移动端 | 10 | 7 | — | 选项换行可用，无移动端特有硬伤 |

## 结论与优先级

**交互优化 + 需拓展** · P1（预览网格与 Contents.json 双主项）

判据：功能矩阵基本健全（61 分）但"18 件产物盲出"是可用性缺口；自适应图标与 Contents.json 相对 appicon.co/真实交付流程是明确功能差距，需拓展与交互优化并行。

整改优先序：逐尺寸预览网格（P0）→ iOS Contents.json → Android 自适应图标 → 圆角指引 → 结果清单。

## 扣分点明细

1. 【功能-需拓展】无 Android 自适应图标：Android 8+ 要求 foreground/background 双层（108dp 网格+安全区）+ic_launcher.xml，本工具只出传统 mipmap 位图（:32-39）；圆角选项（:139-142）对 Android 也只是贴片式假圆角，系统蒙版下仍会露角
2. 【功能】iOS 交付缺两件：无 iPad Pro 167 尺寸（:18-31 清单缺）；无 Contents.json——zip 解包不能直接拖入 Xcode Assets.xcassets，要手写 imageset 清单，"全尺寸+开箱即用"差一步
3. 【可用性】产物零预览：仅 56px 源图缩略（:133），无逐尺寸预览网格（appicon.co 生成前有全尺寸预览）；圆角/fit 留边效果只能下载后开图核对
4. 【交互-反指引】iOS 图标可套圆角且无提示：Apple 自动应用超椭圆蒙版，App Store 1024 上传预圆角属违规风险——勾选圆角时若含 iOS 应提示"建议直角提交"，当前零指引
5. 【灵魂-亮点】源图三重校验齐备（:57-69）：非 PNG 软提醒、非正方形说明 fit 留透明边、<1024 指出放大风险——这套防呆应作为家族模板推广（favicon-generator 同场景就没有）
6. 【可用性（模式 C 家族共性）】自动 ZIP 后无结果清单（:114-117 直接 saveMany）：18 个文件名只在完成文字里概述，无法逐件确认

## 行业对标与差距

- **appicon.co**：拖图即时逐尺寸预览网格、iOS/Android/Electron 多目标、生成前可勾选尺寸矩阵。差距：**预览网格**（对方所见即所得，本工具全盲）。
- **Icon Kitchen**：Android 自适应双层合成（前景缩放+背景色/图+圆形/圆角方蒙版实时预览）。差距：自适应图标整套缺失，Android 交付停在 2017 年标准。
- 借鉴优先级：逐尺寸预览网格 > Contents.json > 自适应图标 > 圆角指引 > 结果清单。

## 可拓展性

- 短期（1 周）：生成前渲染关键尺寸预览网格（1024/180/120/48/29）；iOS 勾选圆角时显示直角提交提示
- 中期（1 月）：iOS 输出追加 AppIcon.appiconset/Contents.json；Android 增 foreground 432px+背景色选项+ic_launcher.xml；完成后文件清单（名称+尺寸逐行列出）
- 远期：与 favicon-generator 共享"图标源图预处理"（裁剪/底色/圆角）组件；macOS icns 与 Electron 目标拓展

## 优化处方（验收标准）

1. **逐尺寸预览网格**：生成前渲染关键尺寸缩略（1024/180/120/87/48/29，小尺寸以实际像素渲染并放大对照），圆角与 fit 变化即时反映。→ **验收：勾选 iOS+Android 后出现 ≥8 格预览；拖动圆角滑杆预览同步变化**
2. **Contents.json**：iOS 输出追加 AppIcon.appiconset/Contents.json（imageset 全映射）。→ **验收：zip 内 Contents.json 与图像文件一一对应，整体拖入 Xcode Assets.xcassets 无警告**
3. **自适应图标**：Android 增 foreground（432px，超出安全区部分 UI 提示）+背景色/背景图选项+ic_launcher.xml。→ **验收：Android Studio 识别为自适应图标；安全区外内容生成时出现提示**
4. **圆角指引**：勾选圆角且包含 iOS 时显示"Apple 会自动应用蒙版，App Store 提交建议直角"。→ **验收：勾选圆角后提示可见；取消 iOS 勾选后提示消失**
5. **结果清单**：ZIP 落盘后渲染逐行文件清单（名称+尺寸）。→ **验收：完成后可见 18 行清单，与 zip 内容逐一致（数量与命名）**
