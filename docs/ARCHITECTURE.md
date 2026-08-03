# VibeCollab 架构说明

## 1. 设计目标

VibeCollab 首先解决两个人使用不同 AI 顺序开发同一个 Task 时的连续性问题。它不共享无限增长的 AI 对话，而是把代码锚点、功能进度、实现决策和下一步固化到仓库，让接手者从相同事实继续。

## 2. 分层事实源

1. `.project-to-act/PROJECT_*.md`：项目目标、功能、进度、版本和验收结论。
2. `.project-to-act/tasks/<ID>/`：单任务目标、范围、Intent、Context、状态、事件和证据。
3. 架构文档、ADR、接口 Schema 和数据库 Schema：技术契约。
4. 代码与自动化测试：实际行为。
5. PR：实现差异、验证证据和评审记录。
6. AI 对话与个人笔记：临时上下文，不是事实源。

## 3. 运行组件

| 组件       | 位置                                    | 职责                                          |
| ---------- | --------------------------------------- | --------------------------------------------- |
| 项目注册表 | `src/lib/project-registry.ts`           | 解析 allowlist，禁止 URL 传入任意文件路径     |
| 访问边界   | `src/lib/access.ts`                     | 本地开发豁免、生产令牌、Cookie 与 Bearer 检查 |
| 聚合器     | `src/lib/collaboration-monitor.ts`      | 从 Project-to-Act 和只读 Git 构建确定性读模型 |
| 交接动作器 | `src/lib/handoff-action.ts`             | 仅以结构化参数调用版本化 CLI，不执行源码      |
| 契约       | `src/lib/collaboration-contracts.ts`    | 用 Zod 验证 API 与 UI 之间的数据              |
| 控制台     | `src/components/project-dashboard.tsx`  | 展示功能、任务、风险、代码进度和会话覆盖      |
| 通用 Skill | `skills/project-to-act-collaboration/`  | 安装协议、任务状态机、上下文哈希和会话接口    |
| 可选插件   | `plugins/project-to-act-collaboration/` | Codex 薄适配，不保存第二套业务规则            |

## 4. 数据流

```mermaid
sequenceDiagram
  participant A as 开发者 A + AI
  participant P as Project-to-Act CLI
  participant R as 业务 Git 仓库
  participant B as 开发者 B + AI

  A->>P: 创建 Task、声明 Intent
  P->>R: 写入版本化任务事实
  P->>R: 计算 Context Hash
  A->>R: 在任务分支修改并提交代码
  A->>P: handoff publish
  P->>R: 推送 HANDOFF + task/session facts
  B->>P: handoff accept
  P->>R: fetch + fast-forward + 四项一致性校验
  P-->>B: 唯一写入权 + AI resume prompt
```

## 5. 一致性机制

- 目标一致：所有执行端读取同一 `TASK.json`。
- 范围一致：`INTENT.json` 声明准备修改的路径、符号、公共契约和迁移。
- 上下文一致：`CONTEXT.json` 保存权威输入的 SHA-256；输入变化后任务标记 stale。
- 接力隔离：一个任务一个分支，任一时刻只有一个 `currentActor` 和活动会话。
- 接管一致：代码 SHA 可达、Task revision 相同、Context hash 相同、验证状态通过。
- 并发隔离：不同任务并行时各用独立 worktree 和 PR；同一任务不并行写入。
- 契约串行：公共 Schema、迁移、认证和状态机先由唯一负责人合并。
- 结果一致：相同验收场景、契约测试、CI 和人工评审裁决所有实现。

## 6. 安全模型

- 项目根目录只能来自本机配置 allowlist。
- 只读取约定的 JSON/Markdown 事实和 Git 元数据。
- 不执行被观察仓库源码、脚本或任意用户命令，不加载源码模块。
- 交接动作只允许 fetch、fast-forward、提交任务事实和非强制 push；禁止 reset、force-push 和分叉合并。
- API 不返回源码正文、提示、凭据或私有用户数据。
- 生产环境必须配置管理员令牌。
- 不可用数据显式降级，不将失败或未知值伪装为零。

## 7. 可扩展方向

- GitHub App 或只读 GitHub API 项目源。
- 组织、成员与项目级 RBAC。
- 跨机器 heartbeat 和耐久事件聚合服务。
- PR、required checks、CODEOWNERS 与 merge queue 投影。
- 多仓库依赖图和公共契约变更队列。
