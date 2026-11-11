# Cookie 解析构建（cookie-parser）

> 分类：开发工具｜模式：A（TextTool 双栏，textDef）｜组件：`src/components/common/TextTool.vue`（全文 195 行，42 工具共用壳）｜引擎：`src/lib/devExt.ts` parseCookieInput（:555-602）＋ cookieJsonToHeader（:605-627）｜注册：`src/tools/developer/registry.ts:403-414`
> 对标标杆：DevTools Application 面板 ＋ cookie-editor（浏览器扩展标杆）；textDef 家族基线见 pinyin-converter.md（57 分）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 双向（解析/构建，registry.ts:408-410）＋自动嗅探 document.cookie 串与 Set-Cookie 行（devExt.ts:569-571 ATTR_KEYS 检测、:562 剥前缀）＋多行 Set-Cookie 出数组；缺 Expires 相对时间解读、缺 SameSite/Secure 组合合法性告警、构建方向无表单 |
| 可用性 | 20 | 9 | 9 | **双 textarea 各钉 180px**（base.css:164-168，textDef 家族共性-根因 2，M-06 同款）；多 Set-Cookie 的 JSON 数组输出在 180px 窗内长距离滚动；输入即自动转换✓（TextTool.vue:47-48） |
| 实用价值 | 15 | 12 | 12 | 从 DevTools 复制 Set-Cookie 头粘贴即得 JSON 是联调真实流；普通串/Set-Cookie 双模式自动识别免去手动选方向的心智 |
| 交互便捷性 | 15 | 11 | 11 | 自动执行＋一键复制✓方向切换走选项下拉✓；构建方向要手写 JSON 字段名（name/value/domain…），无模板无字段提示，写错键名静默丢属性 |
| UI 美观性 | 10 | 7 | 7 | 家族默认双栏样式工整；JSON 输出无着色无行号，长数组纯文本观感差 |
| 灵魂度 | 20 | 7 | 7 | Set-Cookie 自动嗅探是聪明设计✓placeholder 三场景引导✓（registry.ts:412）；但 Expires 只回显原串（devExt.ts:579）不解读"还有 3 天/已过期"，SameSite=None 缺 Secure 这类规范错误静默通过 |
| **加权总分** | 100 | | **57** | |
| 附加：大文件性能 | 10 | 9 | — | 纯字符串解析同步毫秒级，百行 Cookie 无压力 |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列堆叠（TextTool.vue:156-159）后输出区在约 1.5 屏外（家族共性，M-06 同源） |

## 结论与优先级

**交互优化** · P0（textDef 家族 180px 钉高共性硬伤延续，判据同 pinyin-converter.md）

判据：可用性 9/20 触发硬伤红线（家族钉高＋长 JSON 输出叠加受害最重）；引擎质量合格，短板在壳与解读层。

## 扣分点明细

1. 【可用性-硬伤】双 textarea 各钉 180px（`base.css:164-168`；家族实测锚点 M-06）——多行 Set-Cookie 输出的缩进 JSON 数组动辄 30+ 行，窗内滚 3 屏起步（textDef 家族共性-根因 2，本工具因输出含缩进 JSON 受害最重）
2. 【功能】Expires/Max-Age 无相对解读：解析结果只有原串（`devExt.ts:579`），"这 cookie 什么时候过期"是解析的第一动机，GMT 串要人肉换算
3. 【功能】无规范合法性告警：SameSite=None 缺 Secure、Expires 与 Max-Age 并存（Max-Age 优先）均静默通过（:573-588 只收集不校验）
4. 【交互】构建方向无表单：JSON→Set-Cookie 要求用户记得 name/value/domain/path/expires/maxAge/sameSite/secure/httpOnly 精确字段名（:607-618），写错即静默丢属性
5. 【灵魂】无场景示例一键填充：placeholder 说明三场景但空态仍要自己找样例（textDef 家族空态短板，pinyin-converter.md 扣分 7 同款）
6. 【功能-轻】Partitioned 在 ATTR_KEYS（:552）仅用于嗅探命中，输出落入 other 桶（:584-587）变普通键值，属性语义未单列
7. 【交互】输出 JSON 无着色/折叠，与站内 json-visualizer 的树视图能力零联动
8. 【交互】解析输出键名 camelCase（maxAge/httpOnly/sameSite，`devExt.ts:580-583`）与 HTTP 头惯例（Max-Age/HttpOnly）是两套命名且无字段对照说明——构建方向手写 JSON 时最容易错的就是这套命名
9. 【灵魂】无解析结果摘要（几条 Cookie、几条会话级、几条已过期），多行粘贴后只有裸 JSON 数组，概览要自己数

## 行业对标与差距

- **DevTools Application 面板 / cookie-editor 扩展**：属性表格化＋Expires 倒计时＋SameSite/Secure/HttpOnly 徽章化、单属性编辑即时生效。差距：**解读层（相对时间/徽章）代差**；表单化构建为可追差距。
- 借鉴优先级：**Expires 相对时间 > SameSite 规范告警 > 构建表单 > 示例一键填充 > JSON 树视图联动**。

## 可拓展性

- 短期（1 周）：textDef 壳钉高修复（家族级处方，见 pinyin-converter.md 处方 2）；Expires 行附相对时间注解
- 中期（1 月）：构建方向表单化（字段下拉防错）；SameSite=None→Secure 联动校验告警；两枚示例按钮（请求 Cookie/Set-Cookie）
- 远期：输出区"JSON｜属性表"双视图；与 json-visualizer 联动树渲染；同名不同 Domain 的 Cookie 对比去重

## 优化处方（验收标准）

1. **钉高修复（家族级）**：textDef 双窗改弹性高度。→ **验收：1366×768 下粘贴 4 行 Set-Cookie，输出 JSON 无需滚动页面即可通读（同 pinyin-converter.md 处方 2 口径）**
2. **相对时间**：Expires 属性值后附中文注解。→ **验收：粘贴含 `Expires=Wed, 21 Oct 2026 07:28:00 GMT` 的行，输出出现"（约 11 个月后过期）"类注解；会话 Cookie 标注"会话级"**
3. **规范告警**：SameSite=None 且无 Secure 时输出区头部黄条提示。→ **验收：构造该输入必现"SameSite=None 需搭配 Secure，现代浏览器将拒绝"黄条；补 Secure 后消失**
4. **构建模板**：构建方向输入区上方加"插入 JSON 模板"按钮。→ **验收：点击后输入区出现含全部合法字段名的 JSON 骨架，直接转换得合法 Set-Cookie 头**
5. **示例一键填充**：选项区加"示例：请求 Cookie / 示例：Set-Cookie"两枚按钮。→ **验收：点击即填充样例并自动输出解析结果**
