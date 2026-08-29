# 项目验收

> 执行测试、交付或声明完成前必须读取本文件。没有新鲜证据时不得写成通过。
> 不粘贴密钥、完整个人信息、原始顾客对话或未脱敏工具输出。

## 当前验收结论

- 结论：macOS 符号链接下的自调用守卫失配已修复；`check.mjs`/`session.mjs` 与 `cli.mjs` 修复保持一致，测试 13/13 全过
- 验收范围：一条命令 Private setup、自动 Git 身份、doctor/report、无需手动 Session 生命周期、Hook/Transcript Token 来源、秘密文本隔离、未知格式失败关闭、可安装分发包与符号链接路径调用
- 最后检查：2026-08-29，`npm run verify` 13 项测试与分发检查通过；既有 3 项 macOS 临时路径测试失败全部转绿（证据 E-011）
- 遗留问题：尚未在真实 Codex Private GitHub 仓库触发完整生命周期；transcript Token 解析是版本化降级路径，长期稳定精确计量仍应使用 OpenTelemetry

## 验收标准

| 标准 ID | 标准                         | 状态 | 验证方法                                           | 证据 ID |
| ------- | ---------------------------- | ---- | -------------------------------------------------- | ------- |
| A-001   | 项目目标达到可验证结果       | 通过 | 独立 3210 服务读取 AgentLoop 实际数据              | E-001   |
| A-002   | 范围内功能满足完成条件       | 通过 | 对照 `PROJECT_FEATURES.md` 与浏览器实测            | E-001   |
| A-003   | 项目约定的测试全部通过       | 通过 | `npm run verify`、Skill/适配器/安装夹具检查        | E-011   |
| A-004   | 阻塞与重大遗留问题已处理     | 通过 | AgentLoop 误嵌入代码已撤回且工作区干净             | E-001   |
| A-005   | 交接包可验证并可在空目录恢复 | 通过 | Bundle verify/clone、ZIP 边界、`npm ci` 与完整门禁 | E-002   |
| A-006   | 两人可顺序接力同一个 Task    | 通过 | 双 clone publish/push、拒绝错误接收者、accept/pull | E-003   |
| A-007   | 纯文件即可同步代码与 AI 上下文 | 通过 | 空仓库安装、反例门禁、PR merge 后 Bob 独立恢复     | E-004   |
| A-008   | 公共 GitHub 仓库可直接使用     | 通过 | 匿名 HTTP、Public visibility、远程 main 与 Actions | E-005   |
| A-009   | Private Session 可安全共享       | 通过 | 默认关闭、双 Actor Hook、独立 MD、公开策略反例与统计 | E-007   |
| A-010   | 一条命令启用并无感记录           | 本地通过 | setup/doctor/report、分发 bin、自动身份、Token 降级反例 | E-010   |

## 证据索引

| 证据 ID | 时间       | 方法或命令                                                                          | 退出状态 | 版本或文件哈希                                  | 结果摘要                                                             | 证据位置                                                  | 有效期                             |
| ------- | ---------- | ----------------------------------------------------------------------------------- | -------- | ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| E-001   | 2026-08-02 | `npm run verify`；Skill/adapter 校验；空仓库安装；浏览器读取 AgentLoop；`npm audit` | 0        | 任务 Context Hash 见 VC-001                     | 4 单测、类型、lint、构建、0 漏洞；薄安装无平台源码；真实仓库监控可见 | `.project-to-act/tasks/VC-001/evidence/E-VC-001-001.json` | 协议、依赖或监控实现变化前         |
| E-002   | 2026-08-02 | `handoff:build`；bundle verify/clone；ZIP allow/deny；恢复后 `npm ci` 与 `verify`   | 0        | 恢复验证提交 `91aadeb`；最终哈希见包内 manifest | 141 个 ZIP 项边界通过、LF 通过、4 测试与生产构建通过                 | `.project-to-act/tasks/VC-002/evidence/E-VC-002-001.json` | README、依赖、打包脚本或版本变化前 |
| E-003   | 2026-08-03 | `npm run verify`；仓库/Skill/adapter 校验；真实 A/B 双 clone；浏览器检查            | 0        | Context `31d222c…d9a4ee`；文件哈希见证据        | 5 测试、构建、发布、错误接收者拒绝、快进接管和唯一写入者通过         | `.project-to-act/tasks/VC-003/evidence/E-VC-003-001.json` | Handoff 协议、CLI 或接力 UI 变化前 |
| E-004   | 2026-08-04 | `npm run verify`；Skill/治理校验；代码-only 反例；Alice/Bob 双 clone merge          | 0        | 实现提交 `bb2193f`；核心文件哈希见证据          | 6 测试、无依赖安装、冲突保护、功能/Git 进度和跨 clone 恢复通过       | `.project-to-act/tasks/VC-004/evidence/E-VC-004-001.json` | 模板、安装器、校验器或 Skill 变化前 |
| E-005   | 2026-08-05 | 凭据扫描；`gh repo view`；匿名 HTTP；`git ls-remote`；GitHub Actions                 | 0        | 发布内容提交 `1a39e78`                         | Public、匿名 200、main 一致、元数据与首次 Verify workflow 通过       | `.project-to-act/tasks/VC-005/evidence/E-VC-005-001.json` | 可见性、README、remote 或 CI 变化前 |
| E-006   | 2026-08-05 | 官方 action release；`npm run verify`；GitHub Actions v7 workflow                   | 0        | 发布提交 `f908261`                              | 根工作流和安装模板使用 checkout/setup-node v7，公共 Verify 通过      | `.project-to-act/tasks/VC-006/evidence/E-VC-006-001.json` | Actions 版本或工作流变化前          |
| E-007   | 2026-08-10 | `npm.cmd run verify`；Skill 校验；Windows Hook 与公开策略反例                       | 0        | 核心文件 SHA-256 见证据 JSON                    | 8 测试、分发、双 Session、子目录 Hook、Token 覆盖和失败关闭通过      | `.project-to-act/tasks/VC-007/evidence/E-VC-007-001.json` | Session 协议、Hook、安装器或 Skill 变化前 |
| E-008   | 2026-08-10 | `npm.cmd run verify`；tarball/bin 安装；Skill/治理校验；Token 秘密文本反例           | 0        | 核心文件 SHA-256 见证据 JSON                    | 10 测试、分发、setup/doctor/report、数值 Token 降级和失败关闭通过    | `.project-to-act/tasks/VC-008/evidence/E-VC-008-001.json` | CLI、Session 解析器、安装器或 Skill 变化前 |
| E-009   | 2026-08-10 | 直接快进推送 main；GitHub Actions Verify run 31364978558                            | 0        | 发布代码 `995d586`                              | Linux Runner 10 项测试与分发检查通过；公共 main 已包含 v0.5.0       | `.project-to-act/tasks/VC-008/evidence/E-VC-008-002.json` | main、工作流、测试或分发入口变化前 |
| E-010   | 2026-08-23 | `npm pack --dry-run --json`；tarball `vibecollab setup --private --json`；Session validate；`node scripts/check-distribution.mjs`；`npm run verify` | 0；0；0；0；1 | 基线 `2c8b90d`；install `93518ac…`；template `c740db8…` | npm 包含普通模板并正确安装为 `.ai-team/.gitignore`；Private setup/validate 与独立分发检查通过；完整验证 9/12，后续分发步骤因前置失败跳过 | 本文件及本地命令输出 | 安装器、Private 模板、Session 或测试变化前 |
| E-011   | 2026-08-29 | `npm run verify`；符号链接路径回归测试（负例回退守卫验证）；`node scripts/check-distribution.mjs` | 0；0（预期 1）；0 | 基线 main `6331ebc`；本 PR 修复 | check/session 自调用守卫改用 `realpathSync` 后 13 项测试与分发检查全过；3 项既有 macOS 临时路径失败转绿；回归测试在旧守卫上以 `Unexpected end of JSON input` 失败、新守卫通过 | `.project-to-act/PROJECT_ACCEPTANCE.md` 与本地命令输出 | 安装器、Session、校验器或测试变化前 |

## Gate 记录

| Gate ID | 日期       | Gate            | 对象                                          | 结果 | 证据 ID | 豁免与确认人                                  |
| ------- | ---------- | --------------- | --------------------------------------------- | ---- | ------- | --------------------------------------------- |
| G-001   | 2026-08-02 | v0.1.0 独立化   | 平台边界、Skill 分发、监控与安全              | 通过 | E-001   | GitHub remote 与移动真机后续验证              |
| G-002   | 2026-08-02 | v0.1.0 交接     | 源码、Git 历史、文档、校验与恢复              | 通过 | E-002   | GitHub Release 和 LICENSE 后续处理            |
| G-003   | 2026-08-03 | v0.2.0 顺序接力 | CLI、Git 门禁、API、Skill、Web 与真实双 clone | 通过 | E-003   | 独立 GitHub remote 上的真实团队试运行后续处理 |
| G-004   | 2026-08-04 | v0.3.0 纯文件同步 | 模板、安装/校验、Skill、PR 门禁与双 clone       | 通过 | E-004   | 真实 GitHub protected branch 试运行待完成     |
| G-005   | 2026-08-05 | v0.3.0 公共发布   | Public 可见性、README、远程 main、元数据与 CI   | 通过 | E-005   | LICENSE 与 branch protection 由所有者后续设置 |
| G-006   | 2026-08-10 | v0.4.0 私有 Session | 默认关闭、Private 门禁、Hooks、Markdown、统计与反例 | 通过 | E-007 | 真实 Private GitHub/Codex 生命周期待发布后验证 |
| G-007   | 2026-08-10 | v0.5.0 无感安装 | CLI 分发、Private setup、自动身份、统计、Token 降级与反例 | 通过 | E-008 | 真实 Private GitHub/Codex 生命周期待发布后验证 |

## 验收记录

按时间倒序追加：日期、检查范围、证据 ID、结果、遗留问题和结论。失败、跳过与过期证据也必须如实记录。

- 2026-08-29：修复自调用守卫在 macOS 符号链接路径下的静默失配。`check.mjs`/`session.mjs` 采用与 `cli.mjs` `2c8b90d` 一致的 `realpathSync`，新增经符号链接路径调用的平台无关回归测试（已实测在旧守卫上以 `Unexpected end of JSON input` 失败）。`npm run verify` 13/13 测试与分发检查通过，3 项既有 macOS 临时路径测试失败全部转绿；证据 E-011。真实 Codex Private GitHub 生命周期验证仍待后续。
- 2026-08-23：Private setup npm 分发缺失的最小修复本地验收通过；真实 tarball 安装生成 `.ai-team/.gitignore` 且 Session validate 有效，独立分发检查通过。`npm run verify` 仍有 3 项既有 macOS 临时路径测试失败，并因此跳过串联的分发步骤；远程使用需包含本修复提交；证据 E-010。
- 2026-08-10：v0.5.0 直接发布完成；Draft PR #1 按所有者要求关闭，初次 PR CI 暴露 Linux 错误执行 Windows Hook 测试命令，定向修复后直接快进推送 main，GitHub Actions run 31364978558 成功；证据 E-009。
- 2026-08-10：VC-008 本地验收通过；打包后的 CLI 可独立安装并报告 0.5.0，Private 临时 Git 仓库一条 setup 命令后 doctor/report 有效，Git 身份自动识别；Hook 无直接 Token 时只读取 transcript 的累计数值，秘密消息不进入 Markdown，未知格式保持 unavailable；证据 E-008。
- 2026-08-10：VC-007 本地验收通过；默认安装不启用采集，Private 安装的 Windows Hook 可从子目录写入两名 Actor 的独立 Markdown，用户原文、AI 最终响应、墙钟、Git 和 Token 覆盖统计符合协议，Public 策略被拒绝；证据 E-007。真实 Codex Token 字段仍依赖官方事件可用性。
- 2026-08-05：VC-006 验收通过；官方 Actions v7 已同步到根工作流与安装模板，公共 main CI 成功且不再使用弃用的 v4 runtime；证据 E-006。
- 2026-08-05：VC-005 公共发布验收通过；仓库匿名可访问、默认分支 main、发布 SHA 一致且首次 GitHub Actions 成功；证据 E-005。
- 2026-08-04：VC-004 本地验收通过；校验器拒绝代码-only PR，Alice 的代码与 TASK 同 PR 合并后 Bob 仅从 main 恢复目标、决策和下一步；证据 E-004。
- 2026-08-04：VC-004 已启动，纯文件协议尚未验收；旧 v0.2.0 证据不覆盖新路线。
- 2026-08-03：VC-003 本地验收通过；Alice 发布并推送，Charlie 被目标门禁拒绝，Bob 快进接收并成为唯一写入者；Web 主流程收敛为发布/接收，复杂监控降为二级详情；证据 E-003。
- 2026-08-02：VC-002 交接验收通过；首次恢复暴露 Windows CRLF 问题，修正后 Bundle、ZIP、`npm ci`、完整门禁和生产构建通过；证据 E-002；交接工件精确哈希由包内 manifest 提供。
- 2026-08-02：VC-001 本地验收通过；VibeCollab 已独立运行，AgentLoop 只作为安装协议的被观察仓库；证据 E-001；无已知阻塞。
