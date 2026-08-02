# 工作会话与工作量监控

## 目标

用同一份版本化事件描述人工和不同 AI 工具的执行过程。监控面读取项目文件或 CLI 导出，不直接依赖供应商会话 API。

## 数据分层

- 耐久事实：`.project-to-act/telemetry/sessions/*.json`，提交到 Git。
- 任务事件：`.project-to-act/tasks/<ID>/events/*.json`，保存开始、结束、checkpoint、冲突和状态变化。
- 实时状态：`.project-to-act/runtime/sessions/*.json`，加入 `.gitignore`，只保存最后心跳。
- 聚合投影：`.project-to-act/projections/workload.json`，可重建，不是事实源。

## 会话字段

每个会话至少包含：

- `sessionId`、`taskId`、`actorId`；
- `executor` 和可选版本，例如 `human`、`cursor`、`claude-code`、`codex`、`copilot`；
- `startedAt`、`endedAt`、`elapsedSeconds`；
- 开始/结束 commit，以及 Git 指标是否可用；
- 结果摘要和完成状态；
- 可选的工具自报 token、成本、测试数，且必须标记 `source: tool-reported`。

不保存提示全文、模型思维链、源码内容、屏幕录制、键盘事件、密钥或用户隐私数据。

## 指标解释

可信层级：

1. `verified`：由 Git、文件哈希、测试退出状态计算。
2. `tracked`：由 CLI 会话开始、心跳和结束时间计算。
3. `tool-reported`：由执行工具主动提供，可能缺失或口径不同。
4. `unavailable`：脏基线、缺少 Git 或工具未上报；不得估算填充。

会话耗时表示从 start 到 stop 的经过时间，不等于专注工作时间。代码增删行表示变更规模，不代表价值。token 和成本只用于容量及预算，不用于人员排名。

聚合投影中的 `toolReported.reportedSessions` 按字段给出覆盖会话数；某字段从未上报时，其聚合值必须是 `null`，不能用 `0` 冒充已知值。平台展示均值或总量时必须同时展示该覆盖数。

## 平台接入

平台可以轮询 `pta monitor export`，或监听文件系统后读取投影。需要跨机器实时在线状态时，可把 heartbeat 同步到服务端缓存，但服务端必须使用 `sessionId` 幂等，并把最终 stop/checkpoint 回写仓库。
