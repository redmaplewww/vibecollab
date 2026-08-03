# 工具无关的文件化协作协议

## Source hierarchy

1. Project route and acceptance: `.project-to-act/PROJECT_*.md`.
2. Shared contracts and decisions: `.project-to-act/contracts/` and ADRs.
3. Task truth: `.project-to-act/tasks/<ID>/TASK.json`.
4. Declared write scope: task `INTENT.json`.
5. Code, schemas, tests and migrations: actual behavior.
6. Checkpoints, evidence and pull requests: execution history.
7. Tool-neutral session telemetry: executor activity and attributable work facts.
8. Chat, personal notes and model memory: temporary context only.

GitHub Issues may mirror a task, but must carry `taskId` and link back to the task directory. Do not edit two full task specifications independently.

## Task files

- `TASK.json`: goal, scope, invariants, references, dependencies and acceptance.
- `INTENT.json`: paths, symbols, contracts and migrations this task intends to write.
- `CONTEXT.json`: generated input paths, hashes, base commit and combined context hash.
- `STATUS.json`: revisioned task state and last durable checkpoint.
- `HANDOFF.json`: current machine-verifiable sequential handoff snapshot.
- `HANDOFF.md`: generated human-readable continuation notes and AI resume instruction.
- `events/*.json`: append-only milestone records.
- `evidence/*.json`: reproducible verification evidence.

Project-wide collaboration files:

- `.project-to-act/skill/`: vendored universal Skill and references.
- `.project-to-act/telemetry/sessions/`: durable work-session facts shared by all executors.
- `.project-to-act/runtime/`: ignored last-heartbeat and transient lock state.
- `.project-to-act/projections/`: rebuildable progress and workload aggregates.

Do not copy source files or full prompts into these files. Reference paths and hashes.

## States

Use `draft`, `ready`, `in_progress`, `blocked`, `review`, `done`, or `cancelled`. Active conflict checks include `ready`, `in_progress`, `blocked`, and `review`. A stale expected revision rejects a transition or checkpoint.

## Sequential handoff

Two people continuing one Task share the same task directory and task branch. They do not create a second Task. At most one `activeSessionId` and `currentActor` may exist.

Publishing requires committed code, a fresh context and a passed verification attestation. The snapshot binds `branch`, `codeSha`, `taskRevision` and `contextHash`; it records completed work, pending work, decisions and `nextAction`. Publishing stops the current session and releases `currentActor`.

Accepting may fetch and fast-forward the same branch, but must never force, reset or merge divergent history. It verifies that the code anchor is in local history, the Task revision and Context hash match, verification passed, and no writer is active. Only then may it start the receiving actor's session. `events/` remains the append-only audit trail.

## Conflict semantics

Fail when two active tasks overlap on any of:

- a declared path or path prefix;
- the same named symbol;
- the same writable contract;
- database migration sequence ownership.

Broad path globs intentionally produce conservative conflicts. Split stable contracts first, narrow the path intent, or serialize the tasks. Do not silence a real conflict with ownership metadata.

## Context freshness

`CONTEXT.json` binds a task to Git `baseSha` and SHA-256 hashes of its declared inputs. Any input change makes the snapshot stale. Re-read the changed source, reconcile the task/intent, rebuild the snapshot, and repeat conflict checks.

For cross-platform stability, valid UTF-8 text is normalized from CRLF or CR to LF before hashing and counting bytes. Binary and non-UTF-8 inputs remain byte-exact. A line-ending-only checkout change is not semantic drift; a text-content change still fails closed.

## Durable versus transient state

Commit task contracts, snapshots, decisions, evidence and handoffs. Keep second-by-second heartbeats, UI presence, raw telemetry and short leases in an ignored runtime or coordination service. A service may accelerate coordination but may not become a second durable truth source.

Local CAS locks live under `.project-to-act/runtime/locks/`. The ignored location prevents the lock implementation from making an otherwise clean worktree appear dirty when a session captures its Git baseline.
