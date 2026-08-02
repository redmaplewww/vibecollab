# VibeCollab

VibeCollab 是一个独立的团队 Vibe Coding 协作控制面。它不替团队成员和 AI 写业务决策，而是让所有执行端读取同一套仓库事实，并用任务契约、上下文哈希、修改意图、Git 隔离和验收证据约束实现结果。

> 仓库是共享大脑，任务规格是工作指令，Git 是并发控制，CI 是最终裁判。

VibeCollab 不嵌入被观察的业务应用。每个业务仓库只安装可移植的 `.project-to-act` 协议文件；独立控制台通过 allowlist 以只读方式构建功能、任务、会话、风险和 Git 进度视图。

## 当前版本

- 版本：`0.1.0`
- 状态：本地可用，尚未发布远程包
- 默认地址：`http://127.0.0.1:3210`
- 运行时：Node.js 20+、Git
- 技术栈：Next.js 16、React 19、TypeScript、Zod
- 数据来源：本地 Git 仓库中的 `.project-to-act` 与只读 Git 元数据

## 核心能力

- 注册并观察多个本地代码仓库。
- 统一展示功能状态、任务契约、负责人、AI 执行端和工作会话。
- 检测活动任务的路径、符号、公共契约和迁移意图冲突。
- 检测任务上下文相对权威文件是否已经漂移。
- 展示 Git 分支、worktree、当前修改和近期提交。
- 区分 verified、tracked、tool-reported 和 unavailable 指标，不伪造未知数据。
- 提供工具无关 Skill、零依赖 CLI、GitHub Issue/PR 模板和 CI 门禁。
- 提供可选 Codex 插件，但不要求团队统一使用 Codex。

## 系统边界

```mermaid
flowchart LR
  H["人员与任意 AI 工具"] --> T["Task Contract + Intent"]
  T --> R["业务仓库 .project-to-act"]
  R --> G["Git / Worktree / CI"]
  R --> V["VibeCollab 只读控制面"]
  G --> V
  V --> D["功能、任务、会话、风险、代码进度"]
```

VibeCollab 不执行被观察仓库的源码，不修改其 Git 状态，不自动合并 PR，也不部署生产环境。完整架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 快速启动

### 1. 安装依赖

```powershell
git clone <repository-or-bundle> VibeCollab
Set-Location VibeCollab
npm ci
```

### 2. 配置本地项目

复制默认注册表。`vibecollab.config.local.json` 已被 Git 忽略，不会把本机路径提交到仓库。

```powershell
Copy-Item vibecollab.config.json vibecollab.config.local.json
```

编辑为：

```json
{
  "schemaVersion": 1,
  "projects": [
    {
      "id": "my-app",
      "name": "My App",
      "root": "D:/code/my-app"
    }
  ]
}
```

约束：

- `id` 只能使用小写字母、数字和连字符。
- `root` 可以是绝对路径，也可以相对配置文件目录。
- 项目根目录必须存在并包含 `.project-to-act`。
- 网页与 API 只能读取注册表中的项目 ID，不能通过 URL 读取任意路径。

### 3. 启动开发服务

```powershell
npm run dev
```

打开 `http://127.0.0.1:3210`。本地开发环境在没有管理员令牌时允许访问。

### 4. 生产运行

生产环境必须设置非空管理员令牌，否则页面与 API 失败关闭。

```powershell
$env:VIBECOLLAB_ADMIN_TOKEN = "<long-random-secret>"
npm run build
npm run start
```

浏览器通过 `/login` 建立 HttpOnly、SameSite=Strict 会话；只读 API 也支持：

```text
Authorization: Bearer <VIBECOLLAB_ADMIN_TOKEN>
```

不要把令牌写入仓库、Issue、PR、日志或交接包。

## 把协议安装进业务仓库

从 VibeCollab 根目录运行：

```powershell
node skills/project-to-act-collaboration/scripts/pta.mjs init `
  --project-root D:\code\my-app `
  --github
```

目标仓库只会收到：

- `.project-to-act/`：任务、上下文、意图、事件、证据、会话与 vendored CLI/Skill。
- `AGENTS.md` 中带标记的通用协作规则。
- `.github` 下的 Task、PR 和 Project-to-Act CI 模板。
- `.gitignore` 中的本机 runtime 忽略规则。

目标仓库不会收到 VibeCollab 的 `src/`、控制台、认证或产品依赖。升级受管协议文件时显式增加 `--upgrade`，账本与任务事实不会被覆盖。

## 团队任务工作流

```powershell
# 创建任务
npm run pta -- task create APP-101 --title "Add health check" --owner alice

# 编辑 TASK.json 和 INTENT.json 后构建确定性上下文
npm run pta -- context build APP-101

# 使用 STATUS.json 中的 revision 做 CAS 状态转换
npm run pta -- task transition APP-101 --state in_progress --expected-revision 1

# 人工、Cursor、Claude Code、Codex、Copilot 等使用同一会话协议
npm run pta -- session start APP-101 --actor alice --executor cursor --expected-revision 2

# 交接或完成前记录 checkpoint、停止会话并验证
npm run pta -- checkpoint APP-101 --summary "API complete" --expected-revision 3
npm run pta -- session stop <SESSION-ID> --summary "Tests passed" --expected-revision 4
npm run pta -- validate --ci
```

给任何 AI 的推荐指令：

> 读取 `AGENTS.md` 和 `.project-to-act/tasks/<ID>/`，验证上下文与修改意图，先探索当前实现并给出计划；只实现任务范围，保持列出的不变量；运行任务指定检查；报告改动、验证证据、遗留风险和规格偏差。

同一任务同时只有一个写入负责人。公共 Schema、迁移、认证、权限、支付/积分和状态机必须先确定唯一契约负责人；消费者等待契约合并后再并行。

## 进度与工作量口径

- 功能进度来自 `PROJECT_FEATURES.md` 的完成条件和证据，不从代码行数推算。
- 任务进度来自 `STATUS.json` 的状态机。
- AI 同步状态来自 `CONTEXT.json` 和 `INTENT.json`。
- 代码进度展示 Git 事实：分支、worktree、staged、unstaged、untracked 和提交。
- 会话时长是经过时间，不等于专注工时。
- 文件数、增删行和 token 是覆盖范围，不是价值或个人绩效。
- 缺失数据保持 `null` 或 unavailable，不显示为零。

## HTTP 边界

| 路径                          | 方法 | 说明                             |
| ----------------------------- | ---- | -------------------------------- |
| `/`                           | GET  | 已注册项目列表                   |
| `/projects/<id>`              | GET  | 单仓库协作控制台                 |
| `/api/projects/<id>/overview` | GET  | 版本化只读概览；未知项目返回 404 |
| `/api/session`                | POST | 管理员令牌登录并设置会话 Cookie  |
| `/login`                      | GET  | 登录页面                         |

项目存在但未初始化或当前不可读取时，概览 API 返回 503，并明确报告 unavailable，而不是读取其他路径或猜测数据。

## 常用命令

| 命令                       | 用途                                       |
| -------------------------- | ------------------------------------------ |
| `npm run dev`              | 在 3210 启动开发服务                       |
| `npm run build`            | 生产构建                                   |
| `npm run start`            | 在 3210 启动生产服务                       |
| `npm run test`             | 运行单元测试                               |
| `npm run lint`             | ESLint                                     |
| `npm run typecheck`        | TypeScript 检查                            |
| `npm run adapters:check`   | 检查可选插件与权威 Skill 是否漂移          |
| `npm run verify`           | 格式、lint、类型、测试和生产构建完整门禁   |
| `npm run pta -- <command>` | 管理 VibeCollab 自身的 Project-to-Act 事实 |
| `npm run handoff:build`    | 生成源码 ZIP、Git Bundle、清单和校验值     |

## 交接与恢复

正式交接说明见 [docs/HANDOFF.md](docs/HANDOFF.md)。生成交接包前必须提交全部预期变更并保持工作区干净：

```powershell
npm run verify
npm run handoff:build
```

默认输出到 `artifacts/VibeCollab-v0.1.0-handoff/`，其中包含：

- `VibeCollab-v0.1.0-source.zip`：当前 Git HEAD 的源码快照。
- `VibeCollab-v0.1.0.bundle`：可克隆的完整 Git Bundle。
- `README-HANDOFF.md`：独立交接说明副本。
- `PACKAGE-MANIFEST.json`：版本、提交、分支、文件大小和哈希。
- `SHA256SUMS.txt`：工件完整性校验。

## 仓库结构

```text
VibeCollab/
├─ src/app/                         独立页面与只读 HTTP 边界
├─ src/components/                  协作控制台组件
├─ src/lib/                         注册表、认证、契约与只读聚合
├─ skills/project-to-act-collaboration/
│  └─ ...                           权威、工具无关 Skill 与 CLI
├─ plugins/project-to-act-collaboration/
│  └─ ...                           可选 Codex 薄适配器
├─ .project-to-act/                 VibeCollab 自身的项目与任务事实
├─ docs/                            架构与正式交接文档
├─ scripts/                         适配器同步与交接打包脚本
├─ vibecollab.config.json           可提交的示例注册表
└─ vibecollab.config.local.json     本机注册表，不提交
```

## 安全约束

- 被观察仓库始终视为不可信输入。
- 不执行、导入或动态加载被观察仓库源码。
- 不返回源码正文、完整提示、思维链、令牌、邮箱或私有账户数据。
- Git 命令只允许读取 status、worktree 和 log。
- 生产环境无管理员令牌时失败关闭。
- 交接包只从已提交 Git HEAD 生成，因此不会包含本机未跟踪配置与密钥。

## 已知限制

- v0.1.0 只注册本机仓库路径，没有 GitHub 远程仓库拉取服务。
- runtime heartbeat 是本机临时投影；跨机器只同步耐久 session 事实。
- 没有 SaaS 多租户、组织权限、审计数据库或计费。
- 尚未配置独立 GitHub remote 和 GitHub Release 流程。
- 尚未声明开源许可证；公开分发前必须由项目所有者选择并添加 LICENSE。
