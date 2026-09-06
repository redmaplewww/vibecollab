# 项目验收

> 执行测试、交付或声明完成前必须读取本文件。没有新鲜证据时不得写成通过。
> 不粘贴密钥、完整个人信息、原始顾客对话或未脱敏工具输出。

## 当前验收结论

- 结论：v0.6.0 main 聚合推送修复本地验收通过；修复后的真实 GitHub Actions 尚待发布复验
- 验收范围：多 Task、同 Task 接力、GitHub 身份/权限边界、Task 功能进度、Commit 作者贡献、只读 Actions Job Summary、旧采集运行时退役和可安装分发包
- 最后检查：2026-09-03，11 项 Node 测试、分发检查、严格 PR 与聚合 push 回归夹具
- 遗留问题：修复后的真实 GitHub push Actions Summary 需发布后复验；GitHub 原生证据不包含未提交修改或真实专注工时

## 验收标准

| 标准 ID | 标准                         | 状态 | 验证方法                                           | 证据 ID |
| ------- | ---------------------------- | ---- | -------------------------------------------------- | ------- |
| A-001   | 项目目标达到可验证结果       | 通过 | 独立 3210 服务读取 AgentLoop 实际数据              | E-001   |
| A-002   | 范围内功能满足完成条件       | 通过 | 对照 `PROJECT_FEATURES.md` 与浏览器实测            | E-001   |
| A-003   | 项目约定的测试全部通过       | 通过 | `npm run verify`、Skill/适配器/安装夹具检查        | E-001   |
| A-004   | 阻塞与重大遗留问题已处理     | 通过 | AgentLoop 误嵌入代码已撤回且工作区干净             | E-001   |
| A-005   | 交接包可验证并可在空目录恢复 | 通过 | Bundle verify/clone、ZIP 边界、`npm ci` 与完整门禁 | E-002   |
| A-006   | 两人可顺序接力同一个 Task    | 通过 | 双 clone publish/push、拒绝错误接收者、accept/pull | E-003   |
| A-007   | 纯文件即可同步代码与 AI 上下文 | 通过 | 空仓库安装、反例门禁、PR merge 后 Bob 独立恢复     | E-004   |
| A-008   | 公共 GitHub 仓库可直接使用     | 通过 | 匿名 HTTP、Public visibility、远程 main 与 Actions | E-005   |
| A-009   | Private Session 可安全共享       | 通过 | 默认关闭、双 Actor Hook、独立 MD、公开策略反例与统计 | E-007   |
| A-010   | 一条命令启用并无感记录           | 通过 | setup/doctor/report、分发 bin、自动身份、Token 降级反例 | E-008   |
| A-011   | 多人可维护不同 Task 并行开发     | 通过 | 双并行 clone、任务目录、Revision/CI/Session 归属、迁移和升级测试 | E-010 |
| A-012   | GitHub 原生无感功能与代码进度     | 本地通过 | 单 Task PR 拒绝、多 Task 聚合 push、Task 验收、只读 Workflow 与分发测试 | E-012 |

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
| E-010   | 2026-08-28 | `npm.cmd run verify`；双人不同 Task 并行 clone；迁移、升级、Session 和 Revision 反例 | 0 | 核心文件 SHA-256 见证据 JSON | 13 项测试和分发检查通过；不同 Task 无共享 TASK 冲突，同 Task 接力保持有效 | `.project-to-act/tasks/VC-009/evidence/E-VC-009-001.json` | 多任务目录、CLI、校验、Session 或迁移变化前 |
| E-011   | 2026-08-29 | `npm run verify`；两名提交作者同 Task 接力；只读 Actions/报告/升级退役与分发检查 | 0 | 核心文件 SHA-256 见证据 JSON | 9 项测试和分发检查通过；成员日常零额外命令，功能与代码进度可从 GitHub 原生证据重建 | `.project-to-act/tasks/VC-011/evidence/E-VC-011-001.json` | Task、报告器、工作流、安装器或 Skill 变化前 |
| E-012   | 2026-09-03 | 定向 Node 测试；`npm run verify`；真实 GitHub 反例 Run 33753907580 | 0（最终） | 核心文件 SHA-256 见证据 JSON | PR 多 Task 仍失败；main 聚合多 Task 通过；代码无 Task 仍失败；11 项测试和分发检查通过 | `.project-to-act/tasks/VC-011/evidence/E-VC-011-002.json` | checker、reporter、workflow 或聚合语义变化前 |

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
| G-008   | 2026-08-29 | v0.6.0 GitHub 原生收敛 | 多 Task、同 Task 接力、只读 Actions Summary、零成员命令和运行时退役 | 通过 | E-011 | 真实 GitHub PR/push Summary 待发布后验证 |
| G-009   | 2026-09-03 | v0.6.0 聚合推送修复 | PR 严格门禁、main 聚合报告、分发一致性与 macOS 安装入口 | 本地通过 | E-012 | 修复后的真实 GitHub Actions 待发布复验 |

## 验收记录

按时间倒序追加：日期、检查范围、证据 ID、结果、遗留问题和结论。失败、跳过与过期证据也必须如实记录。

- 2026-09-03：真实 GitHub Run 33753907580 复现一次 push 包含两个合法 Task 时的误拦截；实现 CI 内部 `--aggregate` 后，普通多 Task PR 仍失败，聚合范围通过，代码无 Task 仍失败。首次定向测试因既有 macOS `/var` 路径别名问题出现 2 项失败，修复 checker/reporter 命令入口后定向测试 11/11、`npm run verify` 与分发检查全部通过；证据 E-012。远程修复版 Actions 尚未运行。
- 2026-08-29：VC-011 本地验收通过；9 项自动化测试覆盖维护者安装、成员零额外命令、两名 Commit 作者同 Task 接力、不同 Task 隔离、Task 功能验收、Git 贡献汇总、只读 Workflow、旧采集运行时退役和分发一致性；证据 E-011。真实 GitHub PR/push Actions Summary 待发布后验证。
- 2026-08-28：VC-009 本地验收通过；13 项自动化测试覆盖新安装、多任务 CLI、Revision、代码/Task 同 PR、Alice/Bob 不同 Task 并行合并、同 Task 接力、旧版迁移、受控升级、Session 锚点和隐私反例；分发检查通过，证据 E-010。真实 GitHub protected branch 试运行仍待发布前执行。
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
