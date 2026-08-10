# VibeCollab

VibeCollab 是一套纯文件、Git 原生的 AI 团队协作协议。它把项目目标、当前任务、AI 工作记录和验收证据放进项目仓库，通过 PR/Merge 让不同成员和不同 AI 获得同一份上下文。

不需要服务器、数据库、账号、常驻进程，也不强制使用某一种 AI。

## 30 秒安装

要求 Node.js 20+、Git，并确认目标仓库是 Private。进入目标仓库后运行：

```powershell
npx --yes github:redmaplewww/vibecollab setup --private
```

首次在 Codex 中打开项目时，审查并信任项目 Hook 一次。以后正常使用 Codex 即可：不需要手动 `start`、`stop`，也不需要配置环境变量。成员身份自动读取当前仓库的：

```powershell
git config user.name
```

安装后把生成文件通过普通 PR 合入主分支，其他成员 `git pull` 后即可共享同一套规则与进度。

> `--private` 会保存原始用户提交和 AI 最终响应，只能用于团队私有仓库。公共仓库请去掉 `--private`，此时不会安装会话采集 Hook。

## 日常怎么用

成员只做三件事：

1. 开工前拉取已合并的最新主分支。
2. 让 AI 读取 `AGENTS.md`、`.ai-team/PROJECT.md` 和 `.ai-team/TASK.md`，只继续 `Next step`。
3. 在同一个 PR 中提交代码与更新后的 `.ai-team/TASK.md`。

推荐给任意 AI 的指令：

> 读取 `AGENTS.md`、`.ai-team/PROJECT.md` 和 `.ai-team/TASK.md`，先复述目标、验收、不变量、已完成、待办和下一步；只实现当前任务范围；完成后更新 TASK.md 并报告真实验证结果。

同一任务同一时刻保持一个写入者。A 完成一个安全检查点并合并后，B 拉取主分支继续；如果未完成代码不能进入主分支，两人顺序使用同一个 Draft PR 分支。

## 自动记录什么

Private 模式下，仓库内的 Codex Hook 自动生成：

```text
.ai-team/sessions/YYYY-MM/<session-id>.md
```

每个 Session 独立一个文件，避免多人追加同一个日志产生冲突。内容包括：

- 原始用户提交；
- AI 最终响应，作为工作内容摘要；
- Session 墙钟耗时；
- Git 变更文件和增删行；
- Token 数值、来源、覆盖状态和解析器版本。

Token 优先使用 Hook 事件直接提供的字段。Hook 未提供时，只从它给出的 `transcript_path` 中提取 Codex `token_count.total_token_usage` 数值；不会复制 transcript 的消息、思维链或工具输出。该 transcript 格式不是官方稳定接口，所以解析失败时明确显示 `unavailable`，不会估算。需要长期稳定的精确计量时，应接入 Codex OpenTelemetry `turn.token_usage`。参见 [Codex Hooks](https://learn.chatgpt.com/docs/hooks.md) 与 [Observability and telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry)。

系统不会采集系统/开发者提示、隐藏思维链、原始工具输出、源码副本或逐键键盘行为。Session 文件是最低优先级历史证据，不能覆盖 PROJECT、TASK、代码、测试或当前用户请求。

## 看进度

统一诊断：

```powershell
npx --yes github:redmaplewww/vibecollab doctor
```

统一报表：

```powershell
npx --yes github:redmaplewww/vibecollab report --base origin/main
```

不访问网络的仓库内命令：

```powershell
node .ai-team/check.mjs --base origin/main
node .ai-team/session.mjs report
```

报表同时展示：

- 功能进度：`TASK.md` 验收场景完成数；
- 代码进度：相对主分支的提交、文件和增删行；
- 协作进度：Owner、Next owner、Next step；
- AI 工作记录：成员 Session 数、墙钟耗时和 Token 覆盖。

这些指标用于协调、审查和容量规划，不应作为个人绩效分数。

## 安装内容

```text
AGENTS.md
.ai-team/
├─ PROJECT.md
├─ TASK.md
├─ SKILL.md
├─ check.mjs
├─ session.mjs
├─ session-policy.json        # 仅 --private
└─ sessions/                  # 仅 --private
.codex/hooks.json             # 仅 --private
.github/
├─ PULL_REQUEST_TEMPLATE/repo-task-sync.md
└─ workflows/repo-task-sync.yml
```

安装器不会覆盖已有文件；已有 `AGENTS.md` 时只追加一个带标记的入口。若检测到会覆盖已有协作事实，安装会停止并列出冲突文件。

建议在 GitHub 保护主分支：只允许 PR 合并、至少一人审批，并把 `repo-task-sync` 设为 required check。

## 本仓库开发

```powershell
npm test
npm run verify
```

VibeCollab 自身使用 `.project-to-act` 治理，但它不会被安装到业务仓库。可分发 Skill 位于 `skills/repo-task-sync/`。
