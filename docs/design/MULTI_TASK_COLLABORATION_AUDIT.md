# 多任务并行协作模型审计

- 日期：2026-08-28
- 审计对象：VibeCollab v0.5.0 本地源码
- 结论：当前版本是“单个当前 Task + 同一 Task 顺序接力”，不支持“多人各自维护不同 Task 的并行开发”
- 状态：审计完成，改造尚未实施

## 正确的协作模型

需要区分两个场景：

1. **同一 Task 接力**：A 和 B 处理同一个验收目标，任一时刻只有一个写入者；A 合并安全检查点后由 B 继续。
2. **不同 Task 并行**：A、B、C 各自维护独立 Task 文件、分支、PR 和会话；每个 Task 仍只有一个当前写入者。

因此团队级不变量应是：

> 一人当前可以负责一个或多个明确 Task；每个活跃 Task 只有一个写入负责人；不同 Task 可以并行；同一 Task 只能顺序接力。

## 当前实现证据

### 安装模型

安装器只安装一个 `.ai-team/TASK.md`。目标仓库没有 `.ai-team/tasks/<TASK-ID>/TASK.md` 或任务索引。

### 校验模型

`scripts/check.mjs`：

- 将 `.ai-team/TASK.md` 声明为必需文件；
- 只读取这一个文件的 ID、状态、Owner 和验收项；
- 只要代码变化，就要求同一 PR 修改这一个 `.ai-team/TASK.md`。

因此两个不同 Task 的并行 PR 都会修改同一个文件，容易发生冲突，并且无法分别计算验收进度。

### Session 模型

`scripts/session.mjs` 只从 `.ai-team/TASK.md` 读取任务 ID 和标题。并行分支虽然会生成独立 Session 文件，但任务归属依赖每个分支对同一 TASK 文件的覆盖，合并时仍会产生冲突和错误归属风险。

### 文档和 PR 模型

README、仓库 AGENTS 模板、Skill 和 PR 模板都要求读取或更新固定的 `.ai-team/TASK.md`。产品历史也明确记录了“同一 Task 顺序接力”路线。

## 影响

- 多人不能在同一主分支基线下可靠地并行维护不同功能任务。
- 不同任务的验收项、Owner、决策和 Next step 被迫共享一个文件。
- 并行 PR 容易在 TASK 文件上产生无意义冲突。
- Session、Token、工时和功能归因只能关联到单个当前任务。
- Monitor 无法构建准确的团队任务列表和每人实时进度。

## 建议目标结构

```text
.ai-team/
├─ PROJECT.md
├─ TASKS.md                       # 轻量任务索引，只记录 ID、状态、Owner、路径
├─ tasks/
│  ├─ AGENT-021-memory/
│  │  └─ TASK.md
│  └─ AGENT-022-tools/
│     └─ TASK.md
├─ sessions/
│  └─ YYYY-MM/<session-id>.md
├─ SKILL.md
├─ check.mjs
└─ session.mjs
```

任务文件路径应稳定，不因负责人或状态改变而重命名。建议任务 ID 作为主键，slug 只用于可读性。

## 任务选择

AI 和 CLI 不应再假定唯一当前任务。按以下顺序解析任务：

1. 显式参数：`--task AGENT-021`。
2. 环境或 Hook 事件中的任务 ID。
3. 当前分支命名中的任务 ID，例如 `task/AGENT-021-memory`。
4. 当前分支相对主分支只修改了一个任务文件时自动识别。
5. 仍不能唯一确定时停止并要求选择，不猜测。

建议命令：

```powershell
vibecollab task create AGENT-021 --title "Agent memory"
vibecollab task use AGENT-021
vibecollab doctor --task AGENT-021
vibecollab report --all
```

`task use` 只在本地运行目录记录选择，文件应放在 `.ai-team/.runtime/` 并加入 `.gitignore`，不能形成新的共享事实源。

## CI 校验变化

PR 校验器应根据变更集确定关联 Task：

1. 非协作文件发生变化时，PR 必须关联至少一个任务文件。
2. 默认一个 PR 对应一个 Task。
3. PR 修改的任务文件必须与 PR 模板中的 Task ID、分支 Task ID 一致。
4. Task 状态、Owner、验收项和验证项分别校验。
5. 多任务 PR 默认拒绝；只有显式的集成 PR 类型可以豁免。
6. 不再要求每个业务 PR 修改共享 `TASKS.md`；任务索引应由可合并的独立条目或 CI 投影生成，避免制造热点文件。

## 并发控制

- 不同 Task：允许不同负责人在独立分支、worktree 和 PR 中并行。
- 同一 Task：只允许一个当前 Owner；换人必须进入 `handoff` 并命名 Next owner。
- 公共 Schema、数据库迁移、认证、支付和状态机：仍需单一接口负责人或先合并契约 PR。
- 两个 Task 修改同一公共契约时，不靠 TASK 文件解决冲突；应通过依赖、契约 Task、CODEOWNERS 和 CI 管理。

## Session 与监控归属

每个 Session 继续保持独立文件，但必须记录：

- `taskId`
- `taskRevision`
- `branch`
- `baseSha`
- `headSha`
- `actorId`

Session Hook 无法唯一识别 Task 时应记录 `unassigned` 并发出诊断，不能把事件错误归入最近或默认任务。

## 向后兼容

建议提供一次显式迁移：

```powershell
vibecollab migrate multi-task
```

迁移行为：

1. 读取旧 `.ai-team/TASK.md` 的 ID 和标题。
2. 预览目标路径。
3. 移动到 `.ai-team/tasks/<ID>-<slug>/TASK.md`。
4. 创建任务索引或索引投影配置。
5. 更新 AGENTS 入口、PR 模板和 CI。
6. 保留迁移 manifest，支持审计和手动回退。

安装器不得静默迁移或覆盖现有 TASK。

## 推荐实施顺序

1. 定义 Multi-task Protocol v1 和任务选择算法。
2. 将模板从单文件改为任务目录，并增加任务 CLI。
3. 重构校验器为按 PR 关联任务校验。
4. 重构 Session 任务归属。
5. 更新 Skill、README、AGENTS 和 PR 模板。
6. 增加旧版迁移命令。
7. 使用 Alice/Bob/Charlie 三个 clone 验证两个并行 Task 和一个顺序接力 Task。
8. 完成后再把 Monitor 建立在多任务投影之上。

## 必要验收场景

- Alice 和 Bob 从同一主分支分别创建 Task A、Task B，可以同时开发并分别合并，不修改同一任务文件。
- Alice 和 Charlie 同时尝试写 Task A 时，协议能发现 Owner 冲突或陈旧 revision。
- Bob 的 Session、Token、工时和 Git 变化只能归属 Task B。
- Task A 合并不会改变 Task B 的验收项、Owner 和 Next step。
- 代码变化但没有关联任务文件时 CI 失败。
- 一个普通 PR 同时关联两个任务时 CI 失败。
- 旧单 TASK 仓库迁移后仍保留原任务内容和 Git 可追溯性。

## 审计判断

用户提出的判断是正确的：多人并行开发时应维护不同 Task；只有多人轮流完成同一验收目标时才维护同一 Task。当前 v0.5.0 只实现了后一种情况，需要先完成多任务目录化改造，再开发团队级实时 Monitor。
