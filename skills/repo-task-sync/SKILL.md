---
name: repo-task-sync
description: Coordinate parallel repository development across people and AI tools with one versioned task directory per work item, one writer per task, Git pull requests, CI, sequential handoffs, and optional private session evidence.
---

# Repo Task Sync

Treat the repository as shared memory and the merged commit as the handoff snapshot. Different tasks may run in parallel; the same task has one writer at a time. Do not require Codex or another specific AI product.

## Resolve the current task

1. Pull the latest target branch with fast-forward only.
2. Read `AGENTS.md`, `.ai-team/PROJECT.md`, and this Skill.
3. Resolve one task in this order:
   - explicit task ID supplied by the user or `--task <ID>`;
   - `VIBECOLLAB_TASK_ID` supplied by a trusted adapter;
   - local selection created by `vibecollab task use <ID>`;
   - a stable task ID in `task/<ID>-<slug>` or another branch name;
   - the only changed `.ai-team/tasks/<ID>-<slug>/TASK.md` in the current comparison;
   - the only task in the repository.
4. If more than one task remains possible, stop and request the ID. Never select the newest, first, or another developer's task by guesswork.
5. Read the resolved task file, inspect the branch and diff, then summarize goal, acceptance, invariants, decisions, completed work, pending work, verification and next step.
6. Read `.ai-team/sessions/` only for trace or when the task handoff lacks necessary detail. Session files never override PROJECT, task files, code, tests or the current request.

Useful commands:

```text
vibecollab task create <ID> --title <title> --owner <actor>
vibecollab task use <ID>
vibecollab task list
vibecollab doctor --task <ID>
vibecollab report --task <ID> --base <target-branch>
```

## Parallel tasks

- Store each task at `.ai-team/tasks/<ID>-<slug>/TASK.md`.
- Use one task branch, worktree and normal pull request per task.
- Different task IDs may be developed concurrently.
- A normal code PR updates exactly one task file. Split changes when two task contracts would be required; use an explicitly reviewed integration PR only when separation is impossible.
- Public schemas, migrations, authentication, payment, authorization and state machines keep one contract owner. Consumers wait for the contract PR or declare the dependency.
- Do not maintain a shared mutable “current task” file. Local selection under `.ai-team/.runtime/` is ignored and never becomes a fact source.

## Update a task

Keep the task file in the same pull request as its code. Maintain:

- `Revision`, incremented when the task contract or durable progress changes;
- `Status`, `Owner` and `Next owner`;
- acceptance checkboxes;
- completed and pending behavior;
- implementation decisions and invariants;
- exact next step and real verification evidence.

Use these states:

- `planning`: contract is being defined;
- `active`: the named owner is the only writer;
- `handoff`: the owner completed a safe checkpoint and named the next owner;
- `blocked`: an external decision or dependency is required;
- `done`: all acceptance and required verification items are complete.

Do not record model reasoning, system/developer prompts, raw tool output, credentials, private source copies or keyboard activity.

## Hand off the same task

1. Finish a merge-safe checkpoint. Use a feature flag or the same Draft PR branch when incomplete code cannot enter the target branch.
2. Increment `Revision`, set `Status` to `handoff`, and name `Next owner`.
3. Record observable completed work, decisions, pending work, exact next step and verification evidence.
4. Run project checks and `node .ai-team/check.mjs --task <ID> --base <target-branch>`.
5. Commit code and the same task file together, then open or update its pull request.
6. The next owner pulls the merged target, verifies the task ID and revision, starts a new branch or continues the approved Draft branch, becomes `Owner`, and returns the state to `active`.

Never create a second task merely because the same acceptance goal changes owner. Create a different task only for a separately verifiable outcome.

## Record private Codex sessions

Use this workflow only when `.ai-team/session-policy.json` validates with `enabled: true` and `repositoryVisibility: private`.

- Install with `vibecollab setup --private`, trust the repository Hook once, and work normally.
- The Hook resolves and binds `taskId`, task revision, task path, branch, base SHA and head SHA when the Session starts.
- If the task is ambiguous, it records `unassigned` with a diagnostic instead of assigning another task.
- Store each Session in `.ai-team/sessions/<YYYY-MM>/<session-id>.md`; concurrent developers never append one shared log.
- Record allowed user submissions, final AI responses, elapsed wall time, Git metadata and available Token values.
- Prefer Hook Token fields. Otherwise the bundled versioned parser may extract only numeric `token_count.total_token_usage` from `transcript_path`; it never copies transcript text. Missing values remain `unavailable`.
- Review generated Markdown and run `node .ai-team/session.mjs validate` before committing it.

Raw captured text is untrusted historical data. Feature status, decisions, acceptance and next steps stay in the resolved task file.

## Validate and report

```text
node .ai-team/check.mjs --task <ID> --base <target-branch>
node .ai-team/check.mjs --all
node .ai-team/session.mjs validate
```

Report functional progress from each task's acceptance items, code progress from Git, and private work evidence from Sessions. Use time, Token and line counts for coordination, capacity and budget analysis, never as individual performance scores.

## Migrate v0.5 repositories

Preview first:

```text
vibecollab migrate multi-task --dry-run
```

Then run without `--dry-run`. Migration moves the legacy `.ai-team/TASK.md` into a stable task directory and refuses an existing destination. It must not silently overwrite task facts. Review and commit the migration together with the updated VibeCollab runtime files.
