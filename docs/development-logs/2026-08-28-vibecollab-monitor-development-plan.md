# VibeCollab Monitor 开发方案归档

- 日期：2026-08-28
- 类型：开发方案归档
- 状态：已取消，不实施
- 适用版本：VibeCollab v0.5.0 之后的候选路线
- 目标团队：约 10–30 人、多个 GitHub 私有仓库

> 2026-08-29 决策：该路线被 GitHub 原生无感模式取代。Monitor、Bearer Token、connect、Outbox、数据库、Docker 看板、Session/Token 与本地活动采集均不进入产品交付；本文仅作为历史决策记录，不是实施说明。

## 背景

现有 VibeCollab Core 使用项目文件、Git、PR 和 CI 同步功能事实与 AI 上下文，不依赖服务器。Private 模式可以通过仓库内 Hook 记录用户提交、AI 最终响应、Session 墙钟时间、Git 变更和可用 Token。

团队希望在保留这套文件化协作协议的同时，增加近实时查看成员开发进度、功能实装、代码改动、AI 使用和估算工时的能力。

## 总体结论

VibeCollab 保持两个可独立运行的组成部分：

1. **VibeCollab Core**：项目文件、Skill、Hook、Git/PR 协作协议。没有服务端也可以完整使用。
2. **VibeCollab Monitor**：可选的事件采集、GitHub 同步、状态投影、团队看板和告警控制面。

仓库文件和 GitHub 仍是权威事实源；Monitor 数据库只是可以重建的查询投影，不成为第二套项目账本。

## 数据流

```text
开发者 / AI
  -> VibeCollab 本地适配器
  -> 脱敏 Work Event
  -> 本地 Outbox
  -> Monitor 采集 API

GitHub 仓库 / PR / Review / CI
  -> GitHub App Webhook
  -> Monitor 事件账本

事件账本
  -> 状态投影器
  -> PostgreSQL 查询投影
  -> 团队、项目、任务、个人和告警页面
```

## 第一版功能范围

### 包含

- Codex Hook 工作事件上报。
- Git 工作区未推送状态快照。
- 离线 Outbox 和自动补发。
- GitHub Push、PR、Review 和 CI 同步。
- 团队、项目、任务、个人四类看板。
- 功能验收项、代码进度、会话、Token 和估算活跃时间统计。
- 上下文陈旧、多人写入同一任务、CI 失败、长期等待评审等告警。
- 私有部署和按组织、仓库、角色的数据访问控制。

### 不包含

- 逐键键盘记录、屏幕录制、剪贴板采集。
- 系统提示词、开发者提示词、思维链和原始工具输出采集。
- 源码正文和完整 diff 的默认上传。
- 自动合并、自动部署或生产环境写入。
- 基于 Token、代码行数或在线时长的个人绩效评分。
- 第一版中的商业计费、企业 SSO 和复杂 SaaS 多租户能力。

## Work Event v1

所有本地 Hook 和 GitHub Webhook 转换为统一、幂等、只追加的事件。核心字段包括：

```json
{
  "schemaVersion": 1,
  "eventId": "evt_01J...",
  "source": "codex-hook",
  "eventType": "turn.completed",
  "occurredAt": "2026-08-28T10:21:33Z",
  "actorId": "github:zhangsan",
  "repository": "team/example-agent",
  "taskId": "AGENT-021",
  "sessionId": "session_01J...",
  "branch": "task/agent-021-memory",
  "headSha": "abc123",
  "baseSha": "def456",
  "taskRevision": 8,
  "dirty": true,
  "changedFiles": 6,
  "additions": 214,
  "deletions": 47,
  "acceptanceCompleted": 3,
  "acceptanceTotal": 5,
  "inputTokens": 4200,
  "outputTokens": 1800,
  "totalTokens": 6000,
  "activeSecondsDelta": 182
}
```

事件至少一次投递，通过 `eventId` 去重；允许离线、重试、乱序和本地时钟偏差。Monitor 离线不得阻塞 AI 工作、Git commit 或 push。

## 功能进度判定

功能进度不能从 Token、工时或代码行数推断。每项验收条件应有稳定 ID，例如：

```markdown
- [x] AC-001 Agent 可以保存用户记忆
- [x] AC-002 新会话可以读取历史记忆
- [ ] AC-003 用户可以删除指定记忆
```

Monitor 分开显示：

- 验收进度；
- 本地实现状态；
- 已推送状态；
- PR 状态；
- CI 状态；
- 合并状态。

只有验收项更新、对应测试通过、CI 通过且 PR 已合并到目标分支后，才能标记为“已实装”。AI 自述不能直接改变功能完成状态。

## 代码进度

本地适配器在 AI 工作节点采集分支、HEAD、基线、未提交文件、文件路径和增删行元数据，不上传源码正文。GitHub App 提供 Commit、Push、PR、Review、CI 和 Merge 权威结果。

本地 Git 数据是可覆盖的“状态快照”；Commit、PR 和 Merge 是持久结果。最终贡献统计以合并结果为准，避免重复累计同一份 diff。

## 时间与 Token

时间分为：

- Session 自然跨度；
- AI 实际运行时间；
- 估算活跃时间；
- 人工补录时间。

估算活跃时间使用空闲截断：

```text
active_delta = min(current_event - previous_event, 10 分钟)
```

这些数值分别展示，不合并为“精确工时”。Token 优先读取正式 Hook 字段，缺失时沿用现有数字解析降级路径，无法取得时标记 `unavailable`，不进行估算。

## 推荐技术栈

- Next.js + TypeScript：控制面和 API。
- PostgreSQL：事件账本和查询投影。
- Drizzle：数据库 Schema 和迁移。
- Zod：外部事件契约。
- GitHub App：仓库元数据和 Webhook。
- 30 秒轮询或 Server-Sent Events：看板刷新。
- Docker Compose：私有团队部署。

十人规模的第一版不需要 Redis、Kafka 或独立消息队列。

## 安装体验

管理员部署 Monitor 并安装 GitHub App。开发者只需一次连接：

```powershell
npx --yes github:redmaplewww/vibecollab setup --private
npx vibecollab connect --monitor https://monitor.example.com
npx vibecollab doctor
```

授权凭据进入操作系统安全存储，不写入仓库。此后沿用原有 pull、开发、TASK 更新、commit、push 和 PR 流程。

## 候选开发任务

- VC-009：Monitor 路线和产品边界。
- VC-010：Work Event v1 Schema。
- VC-011：本地 Exporter 与离线 Outbox。
- VC-012：设备连接与凭据管理。
- VC-013：Monitor 数据库和事件接收。
- VC-014：GitHub App 和 Webhook。
- VC-015：任务与验收项状态投影。
- VC-016：工时和 Token 计算。
- VC-017：团队总览。
- VC-018：项目、任务和个人详情页。
- VC-019：告警和 GitHub 对账。
- VC-020：权限、隐私和数据保留。
- VC-021：Docker 部署与安装文档。
- VC-022：十人团队模拟验收。

## 实施顺序

1. 冻结产品边界、事件协议和隐私协议。
2. 完成本地 Exporter、Outbox 和连接流程。
3. 完成服务端事件接收、数据库和状态投影。
4. 接入 GitHub App、Webhook 和周期对账。
5. 构建团队、项目、任务和个人看板。
6. 增加工时、Token、功能归因和告警。
7. 完成 Docker 私有部署和十人团队试运行。

## 关键验收

- 未部署 Monitor 时 VibeCollab Core 继续完整可用。
- Monitor 离线不阻塞本地开发。
- Hook 和 GitHub 事件通常在 60 秒内显示。
- 重复、乱序和离线补发不造成重复统计。
- 已实装功能可以追踪到 Task、验收项、PR、commit、CI 和贡献者。
- 公共仓库不能启用原始对话采集。
- 不采集按键、思维链、系统提示、原始工具输出或源码正文。
- 统计用于协调、审查和容量规划，不自动生成个人绩效分数。

## 未决前置问题

当前 v0.5.0 目标仓库只有一个 `.ai-team/TASK.md`，仅支持同一 Task 的单写入者顺序接力。多人并行开发不同任务需要先完成任务目录化协议，才能正确构建 Monitor 的任务投影。详细审计见 `docs/design/MULTI_TASK_COLLABORATION_AUDIT.md`。
