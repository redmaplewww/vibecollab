# VibeCollab

VibeCollab 是一套 GitHub 原生的 AI 团队协作文件。它不部署服务、不创建账号、不发放第二套令牌，也不要求成员启动 `npx` 或后台进程。

唯一主线是：

> GitHub 账号负责身份与权限，Task 文件负责功能事实，Commit/PR 负责代码交接，Actions/CI 负责验证和进度摘要。

不同 Task 可以并行；同一个 Task 同一时刻只有一个写入负责人。代码和对应 Task 文件必须在同一个 PR 中更新。任何人或 AI 拉取最新仓库后，都能从项目文件恢复相同目标、决策、进度和下一步，不依赖上一段对话。

## 团队成员如何使用

仓库接入后，普通成员不需要安装 VibeCollab，也不需要执行 VibeCollab 命令。日常流程就是原有 GitHub 流程：

1. `git pull` 获取最新项目和 Task。
2. 为分配给自己的 Task 创建分支，例如 `task/AGENT-021-memory`。
3. 让任意 AI 读取 `AGENTS.md`、`.ai-team/PROJECT.md`、`.ai-team/SKILL.md` 和该 Task。
4. 修改代码，同时更新同一个 `.ai-team/tasks/<ID>-<slug>/TASK.md`。
5. Commit、Push、打开 PR。
6. 在 PR Checks 和 Actions Job Summary 查看功能进度、代码改动和校验结果。

给任意 AI 的固定指令：

> 读取 `AGENTS.md`、`.ai-team/PROJECT.md`、`.ai-team/SKILL.md` 和 Task `<ID>`；先复述目标、验收、不变量、决策、已完成、待办和下一步；只实现该 Task 范围；完成后更新同一个 Task 文件并以测试和 CI 结果作为证据。

## 进度在哪里看

每次 PR、推送到 `main` 或手动运行 Actions 时，`repo-task-sync` 会自动生成 GitHub Job Summary：

- 功能进度：Task 状态、负责人、验收项完成数、验证项完成数。
- 代码进度：相对基线的 Commit、涉及文件、增删行。
- 贡献记录：按 Git Commit 作者汇总提交数、文件数和增删行。
- 一致性门禁：代码变化是否同步更新唯一 Task、Task Revision 是否递增、`done` 是否真的完成验收和验证。

这些数据都来自已提交的仓库事实，可随时重建。GitHub 无法知道未提交的本地修改和真实专注工时；增删行也不等于工作质量，因此报告不会把它们包装成绩效分数。

## 用户隔离

- 身份：GitHub 账号与 Commit 作者。
- 权限：GitHub Organization、Repository role、branch protection 和 CODEOWNERS。
- 隔离：每个 Task 一个分支/PR；同一 Task 一个写入负责人。
- `Owner` 只是协作元数据，不能授予仓库权限。
- VibeCollab 不维护第二套用户表、密码、令牌或设备注册。

## 并行与接力

两个独立功能分别建立两个 Task：

```text
.ai-team/tasks/
├─ AGENT-021-agent-memory/TASK.md
└─ AGENT-022-tool-routing/TASK.md
```

两个人可以在不同分支并行修改。公共 Schema、迁移、认证、权限和状态机仍应只有一个契约负责人，消费者等待契约 PR 合并。

同一个 Task 换人时不创建新 Task。A 在 Task 中增加 `Revision`，写明已完成、决策、待办、下一步和 `Next owner`，随代码提交；PR 合并后 B 拉取 `main`，接管 `Owner` 并继续。

## 仓库维护者一次接入

只有维护者首次接入或升级时需要运行一次安装器：

```powershell
npx --yes github:redmaplewww/vibecollab setup
```

检查生成文件后，通过一个普通 PR 合入。此后所有成员只需 `git pull`，无需重复安装。升级同理：

```powershell
npx --yes github:redmaplewww/vibecollab setup --upgrade
```

安装内容：

```text
AGENTS.md
.ai-team/
├─ PROJECT.md
├─ tasks/<ID>-<slug>/TASK.md
├─ SKILL.md
├─ task-store.mjs
├─ check.mjs
└─ github-report.mjs
.github/
├─ PULL_REQUEST_TEMPLATE/repo-task-sync.md
└─ workflows/repo-task-sync.yml
```

安装器不会静默覆盖项目文件；升级只更新 VibeCollab 管理的运行文件，不覆盖 PROJECT 或 Task。

## GitHub 推荐设置

- 保护 `main`，禁止直接推送。
- 要求 `repo-task-sync` 和项目测试通过。
- 至少一名非作者审批；关键目录使用 CODEOWNERS。
- 新提交后旧审批失效，所有评审对话必须解决。
- 使用 squash merge，保持一个 Task 对应一个可回滚主干提交。

## 本仓库开发

```powershell
npm run verify
```

VibeCollab 自身使用 `.project-to-act` 治理，但该账本不会安装到业务仓库。
