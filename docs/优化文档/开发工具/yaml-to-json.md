# YAML 转 JSON（yaml-to-json）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef）｜组件：`src/components/common/TextTool.vue`（42 工具共用）｜引擎：`src/lib/jsEngine.ts:104-107`（yamlToJson→yamlParse，js-yaml 懒加载）｜注册：`src/tools/developer/registry.ts:91-98`
> 对标标杆：onlineyamltools.com ＋ Code Beautify YAML Converter

## 七维评分：55 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 嵌套映射/序列/标量类型全覆盖（js-yaml）；缺多文档（--- 分隔只取首档）、YAML 锚点/合并键提示、缩进风格选项、格式校验报告 |
| 可用性 | 20 | 9 | 9 | **家族共性-硬伤**：双 textarea 各钉 180px（`base.css:164-168`，M-06）；长 YAML 在小窗内滚；js-yaml 词库异步加载期间 pending 不渲染（`TextTool.vue:15`）首用"点了没反应" |
| 实用价值 | 15 | 12 | 12 | K8s/CI 配置 → JSON 是后端高频场景，js-yaml 转换质量可靠 |
| 交互便捷性 | 15 | 10 | 10 | 粘贴即自动转换（watch，TextTool 家族加分项）；但无双向互换快捷键、无错误行定位 |
| UI 美观性 | 10 | 7 | 7 | 家族统一双栏工整；180px 小窗与下方大留白失衡 |
| 灵魂度 | 20 | 6 | 6 | 无 YAML 语法错误行号（js-yaml 异常只透出 message）、无示例配置空态、无 K8s 场景预设（Deployment/Service 模板一键填入） |
| **加权总分** | 100 | | **55** | 引擎合格，体验被共用壳钉高拖累且无 YAML 特有灵魂 |
| 附加：大文件性能 | 10 | 6 | — | js-yaml 同步主线程解析，千行配置可感知卡顿无进度 |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列堆叠后输出区约 1.5 屏外（M-06 同构） |

## 结论与优先级

**交互优化** · P1（textDef 家族整改样板 pinyin-converter.md 的家族处方覆盖本工具；无个性 P0）

判据：可用性 9/20 触发家族级硬伤（180px 钉高+首用无 loading），个性上无超出家族的独立病灶。

## 扣分点明细

1. 【可用性-硬伤·家族】双窗各钉 180px + pending 不渲染（`base.css:164-168`、`TextTool.vue:15`；M-06；共性-根因 2）——处方可一次性复用 pinyin-converter.md 处方 1-2，惠及 42 工具
2. 【功能】多文档 YAML（`---` 分隔的 ConfigList 场景）静默只转首档无提示（`yamlParse` 默认行为，`jsEngine.ts:104`）
3. 【功能】YAML 锚点/合并键（`<<: *base`）转换结果是否符合预期无任何提示——K8s ConfigMap 常用
4. 【灵魂】无错误行号：js-yaml 抛出的 YAMLException 含 mark（行:列），TextTool 的 catch 只 toast message（`TextTool.vue:41`），行号信息被丢弃
5. 【灵魂】无 K8s/CI 常用配置示例一键填入；placeholder 一句"粘贴 YAML…"过于冷淡

## 行业对标与差距

- **onlineyamltools.com**：YAML↔JSON↔XML 五互转 + 行号错误高亮 + 缩进选择。差距：错误定位与家族互转入口。
- **Code Beautify**：多文档切换 Tab。差距：多文档支持。
- 借鉴优先级：**错误行号透传（引擎已有，接线成本极低）> 示例模板 > 多文档提示**。

## 可拓展性

- 短期：随 TextTool 家族整改获得 pending 态+弹性高度；js-yaml 的 mark.line/col 拼进 toast
- 中期：多文档 Tab 转换；K8s 模板空态（Deployment/ConfigMap/Ingress 各一个）
- 远期：与 json-to-yaml（姊妹工具，registry.ts:85-89）合并 YAML 工作台双向页

## 优化处方（验收标准）

1. **错误行号透传**：catch 分支解析 YAMLException mark，toast 显示"第 3 行第 7 列：映射值缺失"。→ **验收：构造缩进错误的 YAML，提示含正确行列号**
2. **家族整改**：引用 pinyin-converter.md 处方 1-2（pending 渲染+弹性高度），验收标准同源
3. **多文档披露**：检测输入含 `---` 时输出区顶部提示"检测到 N 个文档，仅转换第 1 个"
4. **K8s 示例空态**：无输入时输出区显示 3 个 chip（Deployment/ConfigMap/CronJob），点击填入示例 YAML
