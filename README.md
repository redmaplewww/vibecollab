# VibeCollab

VibeCollab 是一个纯文件的团队 AI 编程协作协议。它不需要服务器、数据库、账号、专属 AI 或常驻进程。

File-only context synchronization for human and AI coding teams through Git pull requests.

> 代码与任务状态进入同一个 PR；merge 后的 Git commit，就是下一位开发者和 AI 的完整共享快照。

## 安装到现有仓库

要求 Node.js 20+ 和 Git：

```powershell
git clone https://github.com/redmaplewww/vibecollab.git
node .\vibecollab\scripts\install.mjs --target D:\code\your-project
```

安装器不会覆盖已有文件；已有 `AGENTS.md` 时只追加一个带标记的协作入口。目标仓库会得到：

```text
AGENTS.md
.ai-team/
├─ PROJECT.md       # 长期目标、架构边界和不变量
├─ TASK.md          # 当前任务、进度、决策和交接
├─ SKILL.md         # 任意 AI 都能执行的通用流程
├─ check.mjs        # 零依赖结构、进度和 PR 一致性检查
└─ session.mjs      # 默认不采集；私有 Session 的可选记录器
.github/
├─ PULL_REQUEST_TEMPLATE/repo-task-sync.md
└─ workflows/repo-task-sync.yml
```

首次安装后，负责人填写目标仓库中的 `.ai-team/PROJECT.md` 与 `.ai-team/TASK.md`，然后把这些文件作为一个 PR 合入 `main`。

在 GitHub 的 `Settings → Branches` 中保护 `main`：要求通过 PR 合并、至少一人审批，并把 `repo-task-sync` 设为 required status check。这样任何“代码已改但共享任务状态未更新”的 PR 都无法合并。

## 两个人如何接力同一个任务

### A 开发并交接

1. 从最新 `main` 创建分支。
2. 把下面这句话交给任意 AI：

   > 读取 `AGENTS.md`、`.ai-team/PROJECT.md`、`.ai-team/TASK.md`；先总结目标、验收、不变量、已完成、待办和既有决策，再只实现 `TASK.md` 的下一步。

3. 修改代码时同步更新 `.ai-team/TASK.md`：勾选验收项，记录完成项、决策、待办、验证结果和下一步。
4. 代码与 `TASK.md` 放进同一个 PR。CI 通过、人工评审后 merge。

```powershell
git pull --ff-only origin main
git switch -c task/agent-001
# 修改代码和 .ai-team/TASK.md
node .ai-team/check.mjs --base origin/main
git add .
git commit -m "feat: implement agent foundation"
git push -u origin task/agent-001
```

### B 同步并继续

B 不需要 A 的聊天记录、Memory 或上下文导出。只拉取已 merge 的提交：

```powershell
git switch main
git pull --ff-only origin main
git switch -c task/agent-001-next
node .ai-team/check.mjs
```

然后把同一条 AI 指令交给 Codex、Cursor、Claude Code、Copilot 或其他工具。AI 先复述仓库中的共享事实；复述不一致时先修正文档，不开始写代码。

## 如何看功能进度和代码进度

运行：

```powershell
node .ai-team/check.mjs --base origin/main
```

输出包含：

- 当前任务状态、Owner、下一位 Owner。
- 验收场景完成数和百分比。
- 相对 `origin/main` 的提交数、变更文件与增删行。
- “改了代码但没更新 `TASK.md`”等阻断错误。

GitHub 上直接使用三个视图：

- 功能进度：`.ai-team/TASK.md` 的验收清单、完成项与待办。
- 代码进度：PR 的 Files changed、Commits 和 Checks。
- 交接状态：`TASK.md` 的 `Status`、`Owner`、`Next owner` 与 `Next step`。

不要用代码行数、commit 数或 AI token 评价个人绩效；它们只描述变更规模，不代表价值。

## 私有团队仓库：共享 Codex Session 摘要

只有确认目标仓库是 Private 时才启用：

```powershell
node .\vibecollab\scripts\install.mjs --target D:\code\your-private-project --private-sessions
```

该选项额外安装：

```text
.ai-team/
├─ session-policy.json      # 明确声明 private、verbatim 和排除项
├─ .gitignore               # 忽略仅本机使用的 .runtime/
└─ sessions/YYYY-MM/*.md    # 每个 Codex Session 一个可合并文件
.codex/hooks.json           # Codex 生命周期薄适配器
```

首次打开仓库时，Codex 会要求审查并信任项目 Hook。Hook 只接收官方生命周期事件，不解析 `~/.codex/sessions` 内部文件：

- `SessionStart` 建立本机会话草稿并记录基线 commit。
- `UserPromptSubmit` 保存该轮用户原始提交。
- `Stop` 保存最终 AI 响应作为工作内容总结，并立即更新可提交 Markdown。
- `SessionEnd` 标记会话结束并计算墙钟耗时。

记录者默认取 `git config user.name`；需要稳定团队 ID 时，在每位成员本机设置 `VIBECOLLAB_ACTOR`，不要把个人令牌或邮箱写入策略文件。

Session Markdown 是最低优先级历史证据。功能是否实装仍以 `.ai-team/TASK.md` 验收项、代码、测试和 CI 为准。文件不保存系统/开发者提示、隐藏思维链、原始工具输出、私有源码副本或键盘行为。

查看会话统计：

```powershell
node .ai-team/session.mjs report
node .ai-team/session.mjs validate
node .ai-team/check.mjs --base origin/main --json
```

统计包含 Session 数、参与人、墙钟耗时、Git 变化和 Token 覆盖率。当前 Codex Hook 未提供 Token 时显示 `unavailable`，不会估算成一个看似精确的数字。

## 必须遵守的四条规则

1. 同一任务同一时刻只有一个写入者。
2. 代码和 `.ai-team/TASK.md` 必须在同一个 PR 中更新。
3. B 只从已 merge 的 `main` 接力；未完成代码不能进 `main` 时，双方轮流使用同一个 Draft PR 分支。
4. AI 对话不是事实源；影响实现的决定必须写进 `PROJECT.md` 或 `TASK.md`。

## 本仓库开发

```powershell
npm test
npm run verify
```

本仓库内部的 `.project-to-act` 只用于维护 VibeCollab 自身，不会安装进业务仓库。协议的可分发 Skill 位于 `skills/repo-task-sync/`，模板位于 `templates/repository/`。
