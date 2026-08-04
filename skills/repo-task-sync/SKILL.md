---
name: repo-task-sync
description: Coordinate sequential development of one repository task across people and different AI coding tools using only versioned project files, pull requests, Git merges, and CI. Use when initializing shared AI context, continuing another developer's task, preparing a handoff, checking that code and functional progress stay synchronized, or recovering work without prior chat history.
---

# Repo Task Sync

Treat the repository as the shared memory and the merged commit as the handoff snapshot. Do not require Codex or any other specific AI product.

## Start or resume work

1. Pull the latest target branch with fast-forward only.
2. Read `AGENTS.md`, `.ai-team/PROJECT.md`, and `.ai-team/TASK.md`.
3. Inspect the current branch and diff.
4. Summarize the task goal, acceptance scenarios, invariants, completed work, pending work, decisions, verification requirements, and next step.
5. Stop and report a conflict if the files disagree or the requested work exceeds the task scope.
6. Implement only the declared next step and preserve recorded decisions.

## Keep context synchronized

Update `.ai-team/TASK.md` in the same pull request as the code. Keep acceptance checkboxes, completed work, pending work, decisions, next step, owners, and real verification results current. Do not record chat transcripts, raw prompts, model reasoning, credentials, or private data.

Use these states:

- `planning`: define the task before coding.
- `active`: the named owner is the only writer.
- `handoff`: the current owner finished a safe checkpoint and named the next owner.
- `blocked`: progress requires an external decision or dependency.
- `done`: every acceptance scenario and required verification item is complete.

## Hand off

1. Finish a merge-safe checkpoint; use a feature flag or the same Draft PR branch when incomplete code cannot safely enter the target branch.
2. Set `Status` to `handoff` and name `Next owner`.
3. Record observable completed work, decisions, pending work, the exact next step, and verification evidence.
4. Run project checks and `node .ai-team/check.mjs --base <target-branch>`.
5. Commit code and `.ai-team/TASK.md` together, then open or update the pull request.
6. Let review and required checks decide whether to merge.

## Accept a handoff

1. Pull the merged target branch into a clean clone.
2. Confirm that `.ai-team/TASK.md` names the expected next owner and that the repository check passes.
3. Create a new branch, set yourself as `Owner`, change `Status` to `active`, and continue from `Next step`.
4. Do not redesign recorded decisions silently; propose a task-file change in the same pull request when a decision must change.

## Report progress

Run `node .ai-team/check.mjs --base <target-branch>`. Report functional progress from acceptance checkboxes and code progress from Git commits, changed files, additions, and deletions. Use these values for coordination and review coverage, never as individual performance scores.
