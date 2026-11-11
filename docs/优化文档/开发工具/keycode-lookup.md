# 按键 KeyCode 查询（keycode-lookup）

> 分类：开发工具｜模式：B 变体（交互捕获区＋速查表单列，无表单无 ResultBox）｜组件：`src/tools/developer/components/KeycodeLookup.vue`（全文 142 行）｜引擎：无独立引擎（组件内 24 行静态速查表 :44-68）｜注册：`src/tools/developer/registry.ts:415`
> 对标标杆：keycode.info（Toptal 托管版，Wes Bos 经典、"按键即显示"交互源头）＋ keyjs.dev（全字段＋逐值复制，均经 WebSearch 核实）

## 七维评分：66 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | 三元组＋修饰键/长按/按下松开态（:86-94）＋24 行速查表＋筛选；但筛选只查 key/code 两列不查 kc 列（:109）——按"13"查不到 Enter，"数字→按键"反向查询整个缺席；无 e.which/e.location/getModifierState（CapsLock 态不可见），表无标点键行 |
| 可用性 | 20 | 14 | 14 | 单列紧凑，捕获区即首控件、三元组 24px 大字一眼可读（:138）；速查表虽吃 `.table-wrap` 520px 上限（`base.css:362-367`，共性-根因 2）但 24 行填不满，无实际压迫 |
| 实用价值 | 15 | 11 | 11 | 排查旧代码 keyCode 分支与键盘事件教学的真实刚需，站内唯一无重复；使用频率中低 |
| 交互便捷性 | 15 | 12 | 12 | 进页自动聚焦（:38-40）、按键零操作即出结果——品类灵魂交互在位；但三个结果值均无复制钮，取值要手动框选 |
| UI 美观性 | 10 | 8 | 8 | 三块 tile＋修饰键 chip 与全站设计语言一致（:135-141）；速查表三列工整 |
| 灵魂度 | 20 | 12 | 12 | 空格显示"(空格)"（:86）、keyCode 瓦片直接标"已废弃"＋底部教育文案推荐 event.key/code（:88,119）——废弃标准的教育两处都做了；拦 '/' 防 Firefox quick-find 的意图很懂行但实现是坏的（见扣分 1） |
| **加权总分** | 100 | | **66** | |
| 附加：大文件性能 | 10 | 9 | — | 纯事件驱动，零常驻开销 |
| 附加：移动端 | 10 | 4 | — | 无硬件键盘则整页失效：div tabindex 聚焦不会唤起软键盘，也无"需物理键盘"提示 |

## 结论与优先级

**交互优化** · P1

判据：无可用性硬伤、"按键即显示"骨架已是品类正统交互；扣分集中在"值不可复制＋数字反查缺席＋两处疑似 Bug"，均属单点改造。

## 扣分点明细

1. 【功能-疑似 Bug】速查表筛选漏掉 keyCode 列：过滤条件仅 `c.key/c.code`（`KeycodeLookup.vue:109`）不含 `c.kc`，输入"13"查不到 Enter——工具名叫"KeyCode 查询"却不认数字（注册步骤还承诺"速查表可搜索"，registry.ts:415），交用户确认是否修复
2. 【功能-疑似 Bug】Firefox quick-find 防护失效：PREVENT 集合塞的是 code 值 `Slash/Quote`（:21），但判断用的是 `PREVENT.has(e.key)`（:24）——这两键的 key 是 `'/` 与 `"`，永远匹配不上，Firefox 下按 `/` 仍会弹快速查找；同集合内 Tab/方向键/空格按 key 判断则正常，混用两种语义
3. 【功能】无反向查询：keycode.info 类站支持输入数字反查按键，本工具只有"按键→码"单向
4. 【交互】三元组零复制：event.key/code/keyCode 瓦片（:86-88）无复制钮——对照站内 ResultBox 成熟复制交互（`ResultBox.vue:49-62`），属自家体验倒挂
5. 【功能】事件字段不全：无 e.which（legacy 等价物）、e.location（区分左右 Shift/小键盘）、getModifierState('CapsLock')——keyjs.dev 首屏即列全字段
6. 【灵魂】修饰键只报按下布尔（:91），CapsLock/NumLock 态不可见；窗口失焦后"按下"chip 无 blur 复位（onKey :23-36 无 blur 处理）
7. 【灵魂-轻】捕获区聚焦后 Tab 被 preventDefault（:21）永远出不去，只能鼠标点外部逃走——捕获是目的，但无"点击外部释放焦点"提示，键盘可达性死角
8. 【功能-轻】速查表仅 24 行且无标点键（`;` `[` `'` 反引号）与 IME/dead key 说明，对照 keycode.info 全键表覆盖不足

## 行业对标与差距

- **keycode.info（现 Toptal 托管）**：巨字显示＋全键码表＋**事件流列表**（每次按键一行 key/code/keyCode/which 可滚动回看）。差距：本工具只保留最后一次按键，连续测快捷键序列无处回看。
- **keyjs.dev**：首屏列 key/code/which/keyCode/location 全字段＋逐值一键复制。差距：字段完整度与"取值一步到位"。
- 借鉴优先级：**筛选并入 kc 列（一行改动）> 值复制 > 事件流回看 > location/CapsLock 字段 > 数字反查**。

## 可拓展性

- 短期（1 周）：筛选条件并入 c.kc；三元组加复制钮；捕获区聚焦时提示"点击外部释放焦点"；blur 复位按键态
- 中期（1 月）：事件流列表（最近 20 次按下/松开可回看可复制）；补 which/location/getModifierState 三字段；速查表补标点键行
- 远期：数字反查模式 Tab；虚拟键盘高亮图（按键亮起）；与快捷键相关工具组"键盘开发工具族"互链

## 优化处方（验收标准）

1. **筛选并入 keyCode 列**：过滤条件追加 `c.kc.includes(filter)`。→ **验收：输入"13"首行命中 Enter；输入"37"命中 ← 左**
2. **修复 Slash/Quote 防护**：PREVENT 统一按 e.code 判断（Tab→'Tab'、空格→'Space' 等）。→ **验收：Firefox 下捕获区聚焦按 `/` 不再弹出快速查找**
3. **三元组加复制**：每个瓦片右上角复制 mini 钮（1.5s 对勾反馈）。→ **验收：按 A 后点 event.code 复制，剪贴板为 `KeyA`**
4. **事件流回看**：捕获区下方"最近按键"列表（倒序 20 条，含按下/松开与修饰键）。→ **验收：连按 3 键出 3 行记录，含各自修饰键组合**
5. **CapsLock 态＋失焦复位**：用 `e.getModifierState('CapsLock')` 加徽章；window blur 时复位按键态。→ **验收：开 CapsLock 后按任意键修饰键区出现高亮徽章；按 Win 弹出开始菜单返回后"按下"chip 不再残留**
