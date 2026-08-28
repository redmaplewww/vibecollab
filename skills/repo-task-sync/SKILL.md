---
name: repo-task-sync
description: Coordinate parallel repository development across people and AI tools using GitHub identity, one versioned task directory per work item, pull requests, CI, and sequential handoffs without a separate service or account system.
---

# Repo Task Sync

Treat the GitHub repository as shared memory and a merged commit as the handoff snapshot. Different tasks may run in parallel; the same task has one writer at a time. Do not require Codex or another specific AI product.

## Resolve the current task

1. Pull the latest target branch with fast-forward only.
2. Read `AGENTS.md`, `.ai-team/PROJECT.md`, and this Skill.
3. Resolve one task from an explicit ID, a stable ID in the branch name, the only changed Task file, or the only Task in the repository, in that order.
4. If more than one task remains possible, stop and request the ID. Never guess another developer's task.
5. Read `.ai-team/tasks/<ID>-<slug>/TASK.md`, inspect the branch and diff, then summarize goal, acceptance, invariants, decisions, completed work, pending work, verification and next step.

AI chat, local memory and work logs are not project facts. Do not create a shared mutable current-task file.

## Work and handoff

- Use one task branch and one normal pull request per independently verifiable outcome.
- Keep code and exactly one corresponding Task file in the same normal PR.
- Increment `Revision` whenever durable task facts or progress change.
- Use `planning`, `active`, `handoff`, `blocked`, or `done` as the Task state.
- `active`, `handoff`, `blocked`, and `done` require an assigned `Owner`.
- `done` requires every acceptance and verification checkbox to be complete.
- Public schemas, migrations, authentication, payment, authorization and state machines keep one contract owner.

For a same-task handoff, the current owner records a merge-safe checkpoint, decisions, pending work, exact next step and `Next owner`, then merges code and Task together. The next owner pulls the merged target before continuing. Do not create a second Task merely because the owner changes.

## GitHub-native progress

GitHub accounts and repository permissions are the only identity and authorization boundary. Task `Owner` is workflow metadata and cannot grant access.

Members use their normal Git workflow; they do not run a VibeCollab service or command. The installed GitHub Action automatically:

- validates task structure and code-to-task association;
- reports functional progress from acceptance and verification checkboxes;
- reports committed code volume from the PR or push comparison;
- groups commits, files and line changes by Git commit author;
- publishes the result in GitHub Actions Job Summary.

The report is derived and rebuildable. It cannot see uncommitted work or focused hours. Never use line counts as individual performance scores.

## Safety

Do not record credentials, private source copies, system/developer prompts, chain-of-thought, raw tool output, keyboard activity, personal data, AI transcripts or usage telemetry. Let Task acceptance, tests and CI decide observable behavior.

Maintainers may run `node .ai-team/check.mjs --all` or `node .ai-team/github-report.mjs --base <ref>` for diagnosis, but these commands are not part of a member's daily workflow.
