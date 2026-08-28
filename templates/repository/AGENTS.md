<!-- repo-task-sync:start -->
## Shared AI development context

Before changing code, read `.ai-team/PROJECT.md`, `.ai-team/SKILL.md`, and the current `.ai-team/tasks/<ID>-<slug>/TASK.md`. Resolve the task from an explicit ID, the task branch, or the changed task file; never guess between multiple tasks. Summarize the goal, acceptance scenarios, invariants, completed work, pending work, decisions, and next step before implementation.

Different tasks may run in parallel on independent branches and pull requests. Keep one writer for each active task. Put code changes and that task's TASK.md progress update in the same pull request. Treat the merged Git commit as the only handoff snapshot; chat history and AI memory are not project facts. GitHub accounts and repository permissions are the only identity and access-control boundary; Task Owner is workflow metadata, not authentication.

Members work through ordinary GitHub branches and pull requests and do not need to run a VibeCollab service or command. GitHub Actions runs the repository checks and publishes the functional/code progress summary. Report actual evidence and any specification deviation.
<!-- repo-task-sync:end -->
