# Docker Run 转 Compose（docker-run-to-compose）

> 分类：开发工具｜模式：A（textDef，TextTool 双栏，方向 select＋自动转换）｜引擎：`src/lib/devExt.ts` parseDockerRun（:95-209）＋ dockerRunToCompose（:252-260）＋ dockerComposeToRun（:263-307）｜注册：`src/tools/developer/registry.ts:268`
> 对标标杆：composerize.com（对标库收录）＋ composerize（GitHub 开源项目）

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 双向转换✓；端口/卷/环境（映射与列表双形式）/labels/env_file/networks/设备/restart/entrypoint/healthcheck 全解析（devExt.ts:147-167），组合短参 -it 自动展开（:114-118），40+ 个带值 flag 白名单＋暂不支持清单带警告（:76-85）；**反向 compose→run 生成 docker 不存在的 `--depends-on` flag（:298-299，疑似缺陷）**，--mount 仅警告不映射 |
| 可用性 | 20 | 11 | 11 | TextTool 双 textarea 各钉 180px（`base.css:164-168`，共性-根因 2），compose v3 输出 30+ 行即内滚；警告以 YAML 注释混入输出（devExt.ts:255-258）诚实但需在 180px 窗内滚到头部才看全；错误仅 toast 无行内提示 |
| 实用价值 | 15 | 12 | 12 | 老服务器 docker run 迁移 compose 是容器运维真实高频；双向覆盖"迁移+回滚"两场景，比单向 composerize 多一档实用面 |
| 交互便捷性 | 15 | 11 | 11 | 无 number 选项故 watch 自动转换（`TextTool.vue:47-48`）即贴即出✓；ResultBox 复制/下载缺席（textDef 只有"复制结果"），无 docker-compose.yml 文件拖入、无 YAML 语法高亮 |
| UI 美观性 | 10 | 7 | 7 | 双 180px mono 窗工整但憋屈；方向选项条与互换/清空图标并存（TextTool.vue:116-119），层级尚清晰 |
| 灵魂度 | 20 | 9 | 9 | 警告逐条写成 `# 注意：` 注释跟输出走（devExt.ts:255-258）、--rm 等不适用参数解释为什么不映射（:172）是懂我细节；但"互换"按钮不联动方向 select——swap 后 compose 文本被当作 docker run 再解析，必报"没有找到镜像名"（`TextTool.vue:56-58` 只换 input） |
| **加权总分** | 100 | | **62** | |
| 附加：大文件性能 | 10 | 9 | — | 逐 token 解析毫秒级；多服务 compose 亦无压力 |
| 附加：移动端 | 10 | 6 | — | ≤760px 单列后双窗各 180px，YAML 长行横向滚动明显（M-06 家族） |

## 结论与优先级

**交互优化** · P1（--depends-on 生成无效命令按疑似功能缺陷登记，建议优先修）

判据：解析广度与警告透明度是本工具的强项；扣分集中在 TextTool 壳的 180px 双窗与互换陷阱，属交互层单点改造。

## 扣分点明细

1. 【功能-疑似缺陷】compose→run 生成 docker 不存在的 `--depends-on`：docker run 无此 flag（depends_on 是 compose 编排语义，run 时代不存在），生成的命令会被 docker 直接拒绝"unknown flag"（`devExt.ts:297-299`）——输出应转为注释或省略并警告
2. 【可用性】输出/输入窗各钉 180px：真实 compose 文件普遍 40-80 行，转换结果在窗内滚 3+ 屏（`base.css:164-168`，共性-根因 2；TextTool 家族通病在本工具因 YAML 行长而更痛）
3. 【交互】互换陷阱：swap 只把输出搬进输入（`TextTool.vue:56-58`），方向 select 仍停在 toCompose——用户把 compose 粘回输入测反向时必须记得手动切方向，切错即报错且报错文案（"没有找到镜像名：docker run 后第一个位置参数应为镜像"，devExt.ts:205）不提示"你可能选错了方向"
4. 【功能】--mount 仅警告不映射：`--mount type=bind,src=...,dst=...` 是 docker 文档推荐的现代写法（:79 在忽略清单），composerize 会转为 volumes 长语法——迁移脚本用 --mount 即半残
5. 【功能】无顶层 sections 意识：生成的 compose 只有 `services.app`（devExt.ts:254），volumes/named network 的顶层声明不生成，`docker compose up` 会因未定义网络告警；反向解析也只吃 services 段（:266-267）
6. 【交互】错误仅 toast：YAML 解析失败（yamlParse 是极简解析器，:264-265）只弹一条 message，坏行无定位无行内 notice——复杂 compose 贴进来报错时不知道改哪行
7. 【灵魂】无服务名推断：镜像名 nginx → 服务名固定 `app`（devExt.ts:254），composerize 用镜像名当服务名，diff 老配置时更亲切
8. 【交互】无文件拖入与下载：docker-compose.yml 要开文件复制内容，产物无 `.yml` 下载钮（textDef 仅复制）
9. 【灵魂】无示例空态：placeholder 仅一句提示（registry.ts:274），无"一键填入典型 docker run 命令"——首次使用者对着空输入框不知道工具能吃下多复杂的命令

## 行业对标与差距

- **composerize.com**：--mount→volumes 长语法、服务名取镜像名、多 flag 全覆盖、转换结果一键复制＋语法高亮。差距：**flag 映射完整度代差**（--mount 转换是纯文本解析，零架构障碍）。
- 借鉴优先级：**修 --depends-on（缺陷）> --mount→volumes > 服务名取镜像名 > 错误行内定位 > .yml 下载**。

## 可拓展性

- 短期（1 周）：--depends-on 输出转 `# depends_on 依赖编排语义，docker run 无对应参数` 注释；互换时自动切方向 select；错误文案遇 compose 文本误入 run 方向时提示"请切到 compose → docker run"
- 中期（1 月）：--mount 解析 type/src/dst 三元组转 volumes；顶层 volumes/networks 段生成与解析；输出窗 ResultBox 化（获得复制/下载/弹高）
- 远期：多服务模板（web+db+redis 一键生成 skeleton）；与站内 yaml-to-json 互链（YAML 校验入口）；compose 版本选择（v2/v3 deploy 段）

## 优化处方（验收标准）

1. **修 --depends-on**：compose→run 不再输出 `--depends-on`，改为行尾注释。→ **验收：粘贴含 `depends_on: [db]` 的 compose，输出命令不含 `--depends-on` 且有 `# depends_on: db 需编排层保证启动顺序` 注释**
2. **互换自动切方向**：swap 时若方向为 toCompose 则切 toRun 反之亦然。→ **验收：转换出 compose 后点互换，输入变为 compose 文本、方向切至 compose → run，0.5s 内输出还原出等价 docker run**
3. **--mount 映射**：解析 `--mount type=bind,src=/a,dst=/b` 为 volumes 长语法。→ **验收：输出含 `- /a:/b`，警告清单不再出现 --mount**
4. **错误行内化＋方向纠错**：TextTool 错误改行内 notice；检测到输入含 `services:` 且方向为 toCompose 时提示切方向。→ **验收：compose 文本贴在 run 方向下，出现"检测到 compose 文件，请切换方向"提示而非镜像报错**
5. **输出窗弹性高度（同 json-formatter.md 处方 1 机制）**：→ **验收：1366×768 下 60 行 compose 输出同屏可见 ≥28 行**
