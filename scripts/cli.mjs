#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installRepositoryFiles } from "./install.mjs";
import { validateRepository } from "./check.mjs";
import { createTask, listTasks, migrateLegacyTask, selectTask } from "./task-store.mjs";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function parseArgs(argv) {
  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
  let cursor = command === "help" && (!argv[0] || argv[0].startsWith("-")) ? 0 : 1;
  let action = null;
  let positional = [];
  if (command === "task" || command === "migrate") {
    action = argv[cursor] && !argv[cursor].startsWith("-") ? argv[cursor++] : null;
  }
  const options = {
    command,
    action,
    target: process.cwd(),
    dryRun: false,
    json: false,
    base: null,
    taskId: null,
    allTasks: false,
    upgrade: false,
    title: null,
    owner: null,
  };
  for (; cursor < argv.length; cursor += 1) {
    const value = argv[cursor];
    if (value === "--target" || value === "--root") options.target = resolve(argv[++cursor]);
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--json") options.json = true;
    else if (value === "--base") options.base = argv[++cursor];
    else if (value === "--task") options.taskId = argv[++cursor];
    else if (value === "--all") options.allTasks = true;
    else if (value === "--upgrade") options.upgrade = true;
    else if (value === "--title") options.title = argv[++cursor];
    else if (value === "--owner") options.owner = argv[++cursor];
    else if (value === "--help" || value === "-h") options.command = "help";
    else if (value === "--version" || value === "-v") options.command = "version";
    else if (!value.startsWith("-")) positional.push(value);
    else throw new Error(`Unknown argument: ${value}`);
  }
  options.positional = positional;
  return options;
}

function repositoryRoot(target) {
  const root = git(resolve(target), ["rev-parse", "--show-toplevel"]);
  if (!root) throw new Error(`VibeCollab must run inside a Git repository: ${resolve(target)}`);
  return resolve(root);
}

function identity(root) {
  return git(root, ["config", "user.name"]) || git(root, ["config", "user.email"]);
}

function packageVersion() {
  const path = resolve(fileURLToPath(new URL("..", import.meta.url)), "package.json");
  return JSON.parse(readFileSync(path, "utf8")).version;
}

function setup(options) {
  const root = repositoryRoot(options.target);
  const installation = installRepositoryFiles({
    target: root,
    dryRun: options.dryRun,
    upgrade: options.upgrade,
  });
  const validation = options.dryRun ? null : validateRepository({ root, allTasks: true });
  const actor = identity(root);
  return {
    ok: options.dryRun || Boolean(validation?.valid),
    command: "setup",
    root,
    version: packageVersion(),
    actor: actor || "unavailable",
    installation,
    validation,
    nextActions: [
      ...(actor ? [] : ["Set this repository's Git identity: git config user.name \"Your Name\""]),
      "Edit the generated TASK-000 or create a task with: vibecollab task create <ID> --title <title>",
      "Commit the generated collaboration files and share them through your normal pull request",
    ],
  };
}

function doctor(options) {
  const root = repositoryRoot(options.target);
  const validation = validateRepository({ root, base: options.base, taskId: options.taskId, allTasks: true });
  const actor = identity(root);
  return {
    ok: validation.valid && Boolean(actor),
    command: "doctor",
    root,
    actor: actor || "unavailable",
    checks: {
      gitRepository: true,
      gitIdentity: Boolean(actor),
      collaborationFiles: validation.valid,
      tasks: validation.tasks.length > 0,
    },
    validation,
    actions: [
      ...(actor ? [] : ["Run: git config user.name \"Your Name\""]),
      ...validation.warnings,
      ...(!validation.valid ? validation.errors : []),
    ],
  };
}

function report(options) {
  const root = repositoryRoot(options.target);
  const validation = validateRepository({
    root,
    base: options.base,
    taskId: options.taskId,
    allTasks: options.allTasks,
  });
  return {
    ok: validation.valid,
    command: "report",
    root,
    task: validation.task,
    tasks: validation.tasks,
    git: validation.git,
    warnings: validation.warnings,
    errors: validation.errors,
  };
}

function taskCommand(options) {
  const root = repositoryRoot(options.target);
  if (options.action === "create") {
    const id = options.positional[0];
    if (!id || !options.title) throw new Error("Usage: vibecollab task create <ID> --title <title> [--owner <owner>]");
    const result = createTask({
      root,
      id,
      title: options.title,
      owner: options.owner || identity(root) || "unassigned",
    });
    return { ok: true, command: "task-create", root, task: result };
  }
  if (options.action === "use") {
    const id = options.positional[0];
    if (!id) throw new Error("Usage: vibecollab task use <ID>");
    return { ok: true, command: "task-use", root, task: selectTask({ root, id }) };
  }
  if (options.action === "list") {
    return { ok: true, command: "task-list", root, tasks: listTasks(root).map(({ markdown, absolutePath, ...task }) => task) };
  }
  throw new Error("Usage: vibecollab task <create|use|list> ...");
}

function migrate(options) {
  if (options.action !== "multi-task") throw new Error("Usage: vibecollab migrate multi-task [--dry-run]");
  const root = repositoryRoot(options.target);
  return {
    ok: true,
    command: "migrate-multi-task",
    root,
    migration: migrateLegacyTask({ root, dryRun: options.dryRun }),
  };
}

function printHuman(result) {
  if (result.command === "setup") {
    process.stdout.write(
      [
        `VibeCollab ${result.version} is ready in ${result.root}`,
        `Actor: ${result.actor}`,
        `Created ${result.installation.created.length}; appended ${result.installation.appended.length}; updated ${result.installation.updated.length}; retired ${result.installation.removed.length}; unchanged ${result.installation.unchanged.length}`,
        ...result.nextActions.map((action, index) => `${index + 1}. ${action}`),
      ].join("\n") + "\n",
    );
    return;
  }
  if (result.command === "doctor") {
    const checks = Object.entries(result.checks).map(([name, passed]) => `${passed ? "[ok]" : "[!]"} ${name}`);
    process.stdout.write(
      [`VibeCollab doctor: ${result.ok ? "ready" : "needs attention"}`, `Repository: ${result.root}`, `Actor: ${result.actor}`, ...checks, ...result.actions.map((action) => `- ${action}`)].join("\n") + "\n",
    );
    return;
  }
  if (result.command === "task-list") {
    process.stdout.write(`${result.tasks.map((task) => `${task.id}  ${task.status}  ${task.owner}  ${task.path}`).join("\n")}\n`);
    return;
  }
  if (result.command === "task-create" || result.command === "task-use") {
    process.stdout.write(`Task ${result.task.id}: ${result.task.path}\n`);
    return;
  }
  if (result.command === "migrate-multi-task") {
    process.stdout.write(`${result.migration.dryRun ? "Would migrate" : "Migrated"} ${result.migration.from} -> ${result.migration.to}\n`);
    return;
  }
  const taskLines = result.task
    ? [
        `Task ${result.task.id}: ${result.task.title}`,
        `Function progress: ${result.task.acceptance.completed}/${result.task.acceptance.total}${result.task.acceptance.percent === null ? "" : ` (${result.task.acceptance.percent}%)`}`,
      ]
    : [`Tasks: ${result.tasks.length}; use --task <ID> or --all`];
  process.stdout.write(
    [
      ...taskLines,
      result.git.available
        ? `Code progress: ${result.git.commits} commits, ${result.git.changedFiles} files, +${result.git.additions}/-${result.git.deletions}`
        : "Code progress: add --base <branch-or-sha> for a Git comparison",
      "Identity and access: GitHub repository permissions",
      `Result: ${result.ok ? "valid" : "blocked"}`,
      ...result.warnings.map((warning) => `- Warning: ${warning}`),
      ...result.errors.map((error) => `- ${error}`),
    ].join("\n") + "\n",
  );
}

function help() {
  return [
    "VibeCollab — file-only collaboration for AI coding teams",
    "",
    "Usage:",
    "  vibecollab setup [--upgrade]",
    "  vibecollab task create <ID> --title <title> [--owner <owner>]",
    "  vibecollab task use <ID>",
    "  vibecollab task list",
    "  vibecollab doctor [--task <ID>]",
    "  vibecollab report [--task <ID>|--all] [--base main]",
    "  vibecollab migrate multi-task --dry-run",
    "",
    "Options: --target <path> --json --dry-run --upgrade --base <ref> --task <ID> --all",
  ].join("\n");
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    process.stdout.write(`${help()}\n`);
    return { ok: true, command: "help" };
  }
  if (options.command === "version") {
    process.stdout.write(`${packageVersion()}\n`);
    return { ok: true, command: "version" };
  }
  const result =
    options.command === "setup"
      ? setup(options)
      : options.command === "doctor"
        ? doctor(options)
        : options.command === "report"
          ? report(options)
          : options.command === "task"
            ? taskCommand(options)
            : options.command === "migrate"
              ? migrate(options)
              : null;
  if (!result) throw new Error(`Unknown command: ${options.command}\n\n${help()}`);
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printHuman(result);
  if (!result.ok) process.exitCode = 1;
  return result;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
