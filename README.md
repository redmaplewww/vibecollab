# VibeCollab

VibeCollab 是一套文件化、Git 原生、工具无关的 AI 团队协作协议。项目背景、独立任务、AI 工作记录和验收证据都随代码进入 Git；不同成员和不同 AI 只读取仓库，就能恢复同一份功能事实。

核心规则：

> 不同 Task 可以并行；同一个 Task 同一时刻只有一个写入负责人；代码和对应 Task 文件在同一个 PR 中合并。

VibeCollab Core 不需要服务器、数据库、账号或常驻进程，也不强制使用 Codex。可选的 VibeCollab Monitor 后续用于汇总团队任务、GitHub 和脱敏工作事件，不取代仓库事实源。

## 安装

要求 Node.js 20+ 和 Git。在目标仓库运行：

```powershell
npx --yes github:redmaplewww/vibecollab setup
```

私有团队仓库如需记录 Codex Session、原始用户提交、AI 最终响应、耗时、Git 和可用 Token：

```powershell
npx --yes github:redmaplewww/vibecollab setup --private
```

Private 模式首次在 Codex 打开项目时需要信任项目 Hook。成员身份默认读取：

```powershell
git config user.name
```

安装后通过普通 PR 合入这些协议文件，其他成员 `git pull` 后即可共享。

## 多人并行开发

每个可独立验收的工作使用一个 Task：

```powershell
vibecollab task create AGENT-021 --title "Agent memory" --owner alice
vibecollab task create AGENT-022 --title "Tool routing" --owner bob
vibecollab task list
```

生成：

```text
.ai-team/tasks/
├─ AGENT-021-agent-memory/TASK.md
└─ AGENT-022-tool-routing/TASK.md
```

推荐分支：

```text
task/AGENT-021-agent-memory
task/AGENT-022-tool-routing
```

分支包含稳定 Task ID 时，CLI、CI 和 Hook 可以自动解析。也可以显式选择：

```powershell
vibecollab task use AGENT-021
vibecollab doctor --task AGENT-021
vibecollab report --task AGENT-021 --base origin/main
```

`task use` 只写入被忽略的 `.ai-team/.runtime/`，不会创建共享“当前任务”文件。

### 给任意 AI 的指令

> 读取 `AGENTS.md`、`.ai-team/PROJECT.md`、`.ai-team/SKILL.md` 和 Task `<ID>`；先复述目标、验收、不变量、决策、已完成、待办和下一步；只修改该 Task 范围；完成后更新同一个 Task 文件并报告真实验证结果。

### 同一个 Task 换人

A 完成安全检查点后：

1. 增加 Task `Revision`。
2. 将状态改为 `handoff`。
3. 设置 `Next owner`、完成内容、待办和下一步。
4. 提交代码和同一个 Task 文件。
5. PR 合并后 B 拉取并接手。

不要因为换了负责人就创建第二个 Task。只有验收目标不同才拆成不同 Task。

## CI 与进度检查

当前任务：

```powershell
node .ai-team/check.mjs --task AGENT-021 --base origin/main
```

全部任务结构：

```powershell
node .ai-team/check.mjs --all
```

统一 CLI：

```powershell
vibecollab doctor
vibecollab report --all
```

校验器会阻止：

- 代码变化但没有更新对应 Task；
- 普通代码 PR 同时修改多个 Task；
- Task 元数据、状态、验收或交接字段无效；
- `done` 但仍有未完成验收或验证项；
- 显式 Task、分支 Task 和变更 Task 不一致。

## Private Session 记录

Private 模式生成：

```text
.ai-team/sessions/YYYY-MM/<session-id>.md
```

每个 Session 独立一个文件，并绑定：

- Task ID、Revision 和文件路径；
- 分支、Base SHA、Head SHA；
- Actor、Executor 和模型；
- 原始用户提交和 AI 最终响应；
- Session 墙钟耗时；
- Git 变更文件和增删行；
- Token 数值、来源、覆盖状态和解析器版本。

Token 优先使用 Hook 字段；缺失时只允许版本化解析器从 Hook 提供的 `transcript_path` 读取数字型累计用量。格式不支持时显示 `unavailable`，不会估算或复制 transcript 消息。

系统不采集系统/开发者提示、隐藏思维链、原始工具输出、源码副本或逐键键盘行为。Session 是最低优先级证据，不能覆盖 PROJECT、Task、代码、测试或当前请求。

## 从 v0.5 单 Task 迁移

先预览：

```powershell
npx --yes github:redmaplewww/vibecollab migrate multi-task --dry-run
```

确认目标路径后执行：

```powershell
npx --yes github:redmaplewww/vibecollab migrate multi-task
```

迁移只移动旧 `.ai-team/TASK.md`，目标已存在时失败，不会覆盖任务内容。迁移后显式升级 VibeCollab 自己管理的运行文件：

```powershell
npx --yes github:redmaplewww/vibecollab setup --private --upgrade
```

`--upgrade` 只更新 VibeCollab 管理的 Skill、脚本、Hook、PR 模板、工作流和 AGENTS 标记区块；不会覆盖 PROJECT 或任何 Task。将迁移与升级结果放入同一个评审 PR。

## 安装内容

```text
AGENTS.md
.ai-team/
├─ .gitignore
├─ PROJECT.md
├─ tasks/
│  └─ TASK-000-define-first-task/TASK.md
├─ SKILL.md
├─ task-store.mjs
├─ check.mjs
├─ session.mjs
├─ session-policy.json        # 仅 --private
└─ sessions/                  # 仅 --private
.codex/hooks.json             # 仅 --private
.github/
├─ PULL_REQUEST_TEMPLATE/repo-task-sync.md
└─ workflows/repo-task-sync.yml
```

安装器不会静默覆盖已有文件；已有 `AGENTS.md` 时只追加带标记的协议入口。

## 本仓库开发

```powershell
npm test
npm run verify
```

VibeCollab 自身使用 `.project-to-act` 治理，但该治理账本不会安装到业务仓库。可分发 Skill 位于 `skills/repo-task-sync/`。
