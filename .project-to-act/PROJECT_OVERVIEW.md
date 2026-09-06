# 项目总览

> 每次新工作会话默认只读取本文件。首次维护时补充真实信息；路线变化后立即同步。
> 本目录不得记录密钥、令牌、完整个人信息或未脱敏工具输出。

## 基本信息

- 项目名称：VibeCollab
- 项目 ID：VC
- 项目负责人：项目维护者
- 风险等级：T3（多仓库、多人和多 AI 协作控制面）
- 当前阶段：v0.6.0 GitHub 原生无感协作收敛
- 当前状态：v0.6.0 已修复 main 聚合推送误用单 Task PR 门禁的问题；本地回归与分发验证通过，待真实 Actions 复验
- 最后更新：2026-09-03

## 项目目标

- 建立独立于业务应用且无需运行服务的团队 Vibe Coding 协作协议包。
- 让不同人员和不同 AI 通过同一任务契约、上下文、修改意图和验收证据保持实现一致。
- 让多人通过不同 Task、分支和 PR 并行开发；同一个 Task 换人时仍按单写入者顺序接力。
- 让 GitHub PR 同时承载代码变更、功能进度和 AI 接力上下文。
- 让 GitHub 账号、仓库权限、Commit、PR 和 Actions 成为唯一身份与进度表面，不建立第二套账号或服务。

## 范围

### 包含

- 可复制的 `AGENTS.md`、`.ai-team` Markdown 文件和零依赖校验脚本。
- 工具无关 Skill、GitHub PR 模板和 required check 工作流。
- 通过 Git commit/PR/merge 原子同步代码、功能进度和上下文。
- 不同 Task 的目录化并行协作、任务选择和旧单 Task 显式迁移。
- GitHub Actions 自动读取任务文件与 Commit，生成原生检查和功能/代码进度摘要。

### 非目标

- 不生成业务代码，不执行被观察源码，不自动合并或部署。
- 不建设独立 Monitor、Web 控制台、数据库、Bearer Token、设备连接、Outbox 或集中式遥测。
- 不采集 Session、AI 对话、Token、系统/开发者提示、隐藏思维链、原始工具输出、私有源码副本或键盘逐键行为。

## 技术路线与关键约束

- Markdown + Node.js 内置模块 + Git/GitHub；状态事实与代码保存在同一提交。
- `AGENTS.md` 是任何 AI 的固定入口；PROJECT 与按 ID 分离的任务目录分别保存稳定背景和各任务进度。
- Skill 只定义通用流程，不要求任何专属 AI 工具或插件。
- GitHub Actions Summary 是可从 Task 与 Git 历史重建的派生视图，不成为第二事实源。

## 数据与安全边界

- 数据分类：项目背景、任务事实和 Git 元数据。
- 敏感信息处理：不保存系统/开发者提示、思维链、原始工具输出、私有源码副本、凭据、AI 对话、Token 或键盘行为。

## 当前焦点

- 下一里程碑：将 v0.6.0 发布到公共 GitHub main，并验证真实 PR/push Actions Summary。
- 当前工作重点：`--aggregate` 仅由 main push 工作流使用，普通 PR 继续执行单 Task 门禁；本地 11 项测试通过，等待真实 Actions 复验。
- 主要阻塞：无已知阻塞

## 按需读取索引

| 当前任务                   | 追加读取                                |
| -------------------------- | --------------------------------------- |
| 规划、实施、阻塞处理       | `PROJECT_PROGRESS.md`                   |
| 新增、修改、删除功能       | `PROJECT_FEATURES.md`；实施时同时读进度 |
| 版本号、发布、升级、兼容性 | `PROJECT_VERSIONS.md`                   |
| 测试、交付、完成声明       | `PROJECT_ACCEPTANCE.md`                 |
| 跨领域路线变更或一致性审计 | 全部文件                                |

## 路线变更记录

按时间倒序追加：决定 ID、日期、决定、原因、影响、证据 ID、确认来源和复审条件。

- DEC-008，2026-08-29：取消独立 Monitor、Bearer Token、connect/checkpoint、Outbox、Docker 服务和独立看板，产品收敛为 GitHub 原生无感模式。GitHub 账号与仓库权限负责用户隔离；任务文件负责功能进度；Commit/PR/Actions 负责代码和验收证据；成员日常不运行 VibeCollab 命令。原因：用户认为独立服务和 npx 工作流过度复杂，并明确要求忽略其他路线；影响：F-009/VC-010 取消，v0.6.0 改为 GitHub Native Progress；复审条件：只有 GitHub 原生能力明确无法满足且用户重新批准独立服务时才恢复评估。

- DEC-007，2026-08-28：VibeCollab 从全仓库单一 TASK 扩展为“不同 Task 可并行、同一 Task 单写入者顺序接力”，并在纯文件 Core 之外增加可选 Monitor；先冻结多任务协议，再开发事件采集、GitHub 投影和团队看板。原因：用户确认多人并行开发应维护不同 Task，并批准与已归档 Monitor 方案一同开发；影响：v0.6.0 将引入任务目录和显式迁移，Monitor 不成为新的事实源；证据待 VC-009、VC-010 验收后补充；复审条件：多任务或 Monitor 破坏无服务 Core、隐私边界或 Git 原子同步。

- DEC-006，2026-08-10：Private 模式收敛为 `vibecollab setup --private` 一条安装命令、一次 Hook 信任和之后零手动 start/stop；成员身份自动读取仓库 Git 配置。Token 优先使用 Hook 字段，缺失时只解析 Hook 提供的 transcript 路径中的数值型累计用量，并记录解析器版本；任何格式变化都失败关闭为 unavailable。原因：用户要求安装部署更简单且仍采集 Token；影响：v0.5.0 增加无依赖 CLI、doctor/report、分发 bin 和 transcript 数值降级解析；证据 E-008；确认来源：用户要求开始实现并尽可能无感操作。

- DEC-005，2026-08-10：在不改变纯文件核心的前提下，为显式声明 Private 的团队仓库恢复可选 Session 账本；原始用户提交与最终 AI 响应只作为最低优先级追溯证据，Codex Hook 是薄适配器，Token 不可用时不得估算。原因：用户要求所有 Codex 成员通过 Git 共享每组工作的原始提交、工作总结、耗时和 Token；影响：v0.4.0 增加 `--private-sessions`、`.ai-team/session.mjs`、策略文件、独立 Session Markdown 和项目级 Hooks；确认来源：用户明确批准继续开发。
- DEC-004，2026-08-04：VibeCollab 改为纯项目文件与 PR/Merge 同步；Git commit 直接作为代码与上下文的原子快照，Web 控制台、Session、遥测和手工四锚点退出核心产品。原因：用户确认同一 Task 不会同时有两人写入，并要求最简单地嵌入现有 GitHub 工作流；影响：v0.3.0 为破坏性简化，目标仓库只需 `AGENTS.md`、`.ai-team`、PR 模板与 CI 校验；确认来源：用户批准实施。
- DEC-003，2026-08-03：VibeCollab 主流程改为同一 Task 的顺序接力；A 发布，B 校验代码 SHA、Task revision、Context hash 与验证状态后接管，工作量与多任务监控降为二级视图。原因：用户明确表示不需要复杂并行拆任务；影响：新增受限 Git 交接动作，仍禁止执行源码、强推、重置、自动合并和部署；确认来源：用户批准实现。
- DEC-002，2026-08-02：正式交接必须同时提供源码 ZIP、完整 Git Bundle、README/HANDOFF、manifest、SHA-256 和空目录恢复证据。原因：压缩成功不能证明接手后可构建；影响：新增跨平台 LF 规则与可复现打包命令；证据 E-002；确认来源：用户要求完整交接包。
- DEC-001，2026-08-02：VibeCollab 作为独立项目运行；业务仓库只保留可移植 Project-to-Act 接入文件。原因：避免平台实现与业务认证、导航、依赖和部署生命周期耦合。影响：AgentLoop 变为接入示例；证据 E-001；确认来源：用户明确纠正架构边界。
