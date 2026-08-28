# VibeCollab engineering rules

VibeCollab distributes a file-only, tool-neutral repository collaboration protocol. The shipped workflow must not require a web service, database, account, telemetry collector, or a specific AI coding product.

## Product boundary

- `templates/repository/` contains files installed into a target repository.
- `skills/repo-task-sync/` is the canonical reusable Skill.
- `scripts/install.mjs` installs without overwriting user files.
- `scripts/cli.mjs` is the one-command `setup`, `doctor`, and `report` entry point.
- `scripts/check.mjs` validates the protocol using only Node.js built-ins and Git.
- `.project-to-act/` governs VibeCollab itself and is not part of the installed target package.

## Invariants

- Different tasks may run in parallel; one active task has one writer at a time.
- Code and the corresponding `.ai-team/tasks/<ID>-<slug>/TASK.md` land in the same PR and merge commit.
- AI chat and memory are not shared facts. An explicitly enabled private-repository session journal may preserve user submissions and final AI work summaries as low-priority trace evidence only.
- If the current task cannot be resolved explicitly, from the branch, or from the changed task file, fail closed instead of choosing another developer's task.
- Do not store credentials, private source copies, system/developer prompts, chain-of-thought, raw tool output, keyboard activity, personal data, or performance scores.
- Git/CI evidence decides acceptance; AI self-report does not.
- Installation must preserve all pre-existing repository content.

## Verification

Run `npm run verify`. Report exact commands, exit status, skipped checks, and limitations.
