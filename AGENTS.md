# VibeCollab engineering rules

VibeCollab distributes a file-only, tool-neutral repository collaboration protocol. The shipped workflow must not require a web service, database, account, telemetry collector, or a specific AI coding product.

## Product boundary

- `templates/repository/` contains files installed into a target repository.
- `skills/repo-task-sync/` is the canonical reusable Skill.
- `scripts/install.mjs` installs without overwriting user files.
- `scripts/check.mjs` validates the protocol using only Node.js built-ins and Git.
- `.project-to-act/` governs VibeCollab itself and is not part of the installed target package.

## Invariants

- One active task has one writer at a time.
- Code and `.ai-team/TASK.md` land in the same PR and merge commit.
- AI chat, memory, prompts, and chain-of-thought are not shared facts.
- Do not store credentials, private source copies, personal data, or performance scores.
- Git/CI evidence decides acceptance; AI self-report does not.
- Installation must preserve all pre-existing repository content.

## Verification

Run `npm run verify`. Report exact commands, exit status, skipped checks, and limitations.
