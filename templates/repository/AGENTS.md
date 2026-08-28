<!-- repo-task-sync:start -->
## Shared AI development context

Before changing code, read `.ai-team/PROJECT.md`, `.ai-team/SKILL.md`, and the current `.ai-team/tasks/<ID>-<slug>/TASK.md`. Resolve the task from an explicit ID, the task branch, or the changed task file; never guess between multiple tasks. Summarize the goal, acceptance scenarios, invariants, completed work, pending work, decisions, and next step before implementation.

Different tasks may run in parallel on independent branches and pull requests. Keep one writer for each active task. Put code changes and that task's TASK.md progress update in the same pull request. Treat the merged Git commit as the only handoff snapshot; chat history and AI memory are not project facts. If `.ai-team/session-policy.json` explicitly enables private sessions, treat `.ai-team/sessions/` as low-priority trace evidence only and never let it override PROJECT, task files, code, tests, or the current request.

Run the checks listed in the current task file plus `node .ai-team/check.mjs --task <ID> --base <main-base>`. When private sessions are enabled, also run `node .ai-team/session.mjs validate` and review generated session Markdown before commit. Report actual evidence and any specification deviation.
<!-- repo-task-sync:end -->
