# VibeCollab engineering rules

VibeCollab is a standalone, repository-native collaboration control plane. It must never depend on an observed product repository's application code, authentication system, database or UI components.

## Boundaries

- `src/lib/`: read-only contracts, repository registry, authentication and Git/project aggregation.
- `src/app/`: standalone web UI and HTTP boundaries.
- `skills/project-to-act-collaboration/`: canonical vendor-neutral Skill and CLI.
- `plugins/`: optional tool adapters generated from the canonical Skill; never the primary implementation.
- An observed repository is untrusted input. Resolve it only through the allowlisted registry and never execute its source.

## Safety

- Never return source contents, prompts, chain-of-thought, credentials, emails or private account data.
- Monitoring APIs are read-only except the authenticated handoff action boundary. That boundary may only invoke the versioned VibeCollab CLI with structured arguments.
- Handoff Git mutations are limited to fetch, fast-forward merge, committing task/session facts, and non-force push of the current task branch. Never reset, force-push, merge divergent history, or execute observed source.
- `null` means unavailable; do not replace unknown metrics with zero.
- Workload metrics describe coverage and capacity, never individual performance.
- Production access fails closed unless `VIBECOLLAB_ADMIN_TOKEN` is configured.

## Verification

Run `npm run verify`. Report commands, exit states, skipped checks and limitations.

<!-- project-to-act-collaboration:start -->

## 通用开发协作协议

- 项目级事实保存在 `.project-to-act/PROJECT_*.md`，任务级唯一事实保存在 `.project-to-act/tasks/<ID>/`；GitHub Issue 只做镜像和讨论入口。
- 所有人和 AI 工具读取 `.project-to-act/skill/SKILL.md`；Codex、Cursor、Claude Code、Copilot 等配置只做薄适配，不得维护独立流程。
- 开始任务前读取 `TASK.json`，完成 `INTENT.json`，构建上下文，再通过带 revision 的状态转换开始工作。
- 实际工作使用 `session start/heartbeat/stop` 记录统一的 actor、executor 和隐私受控工作量事件；不保存完整提示、思维链或键盘行为。
- 一个任务一个分支；同一任务任一时刻只有一个写入者。换人继续时使用 `handoff publish/accept`，以代码 SHA、Task revision、Context hash 和验证状态完成接力。
- 公共契约、数据库迁移、认证、支付/积分和状态机必须只有一个写入负责人；不同任务并行时才使用独立 worktree。
- AI 对话和 Memory 不是事实源。决策、范围变化、验证证据和交接必须写回仓库。
- 提交或交接前运行 `node .project-to-act/bin/pta.mjs validate --ci`，不得绕过陈旧上下文、意图冲突或 CI 门禁。

<!-- project-to-act-collaboration:end -->
