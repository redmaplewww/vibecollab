#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSessionReport, validateSessionConfiguration } from "./session.mjs";
import {
  isTaskFile,
  listTasks,
  resolveTask,
  taskField,
  taskSection,
} from "./task-store.mjs";

const REQUIRED_FILES = [
  "AGENTS.md",
  ".ai-team/PROJECT.md",
  ".ai-team/tasks",
  ".ai-team/SKILL.md",
  ".ai-team/task-store.mjs",
  ".ai-team/session.mjs",
];

const REQUIRED_SECTIONS = [
  "Goal",
  "Acceptance scenarios",
  "Invariants",
  "Decisions",
  "Completed",
  "Pending",
  "Next step",
  "Verification",
  "Handoff note",
];

const VALID_STATES = new Set(["planning", "active", "handoff", "blocked", "done"]);

function parseArgs(argv) {
  const options = { root: process.cwd(), base: null, json: false, taskId: null, allTasks: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.root = resolve(argv[++index]);
    else if (value === "--base") options.base = argv[++index];
    else if (value === "--task") options.taskId = argv[++index];
    else if (value === "--all") options.allTasks = true;
    else if (value === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function isCollaborationFile(path) {
  const normalized = path.replaceAll("\\", "/");
  return (
    normalized === "AGENTS.md" ||
    normalized.startsWith(".ai-team/") ||
    normalized.startsWith(".github/PULL_REQUEST_TEMPLATE/") ||
    normalized === ".github/workflows/repo-task-sync.yml"
  );
}

function taskSummary(task, errors) {
  const markdown = task.markdown;
  const label = task.path;
  const metadata = {
    id: taskField(markdown, "ID"),
    title: taskField(markdown, "Title"),
    revision: Number(taskField(markdown, "Revision") ?? 0),
    status: taskField(markdown, "Status"),
    owner: taskField(markdown, "Owner"),
    nextOwner: taskField(markdown, "Next owner"),
    path: task.path,
    legacy: task.kind === "legacy",
  };

  for (const [name, value] of Object.entries(metadata)) {
    if (["path", "legacy", "revision"].includes(name)) continue;
    if (!value) errors.push(`${label} is missing metadata: ${name}`);
  }
  if (!Number.isInteger(metadata.revision) || metadata.revision < 0) {
    errors.push(`${label} has invalid Revision`);
  }
  if (metadata.status && !VALID_STATES.has(metadata.status)) {
    errors.push(`${label} has invalid Status: ${metadata.status}`);
  }
  for (const title of REQUIRED_SECTIONS) {
    if (!taskSection(markdown, title)) errors.push(`${label} section is missing or empty: ${title}`);
  }
  if (["active", "handoff", "blocked", "done"].includes(metadata.status) && metadata.owner === "unassigned") {
    errors.push(`${label} Status ${metadata.status} requires an assigned Owner`);
  }
  if (metadata.status === "handoff" && (!metadata.nextOwner || metadata.nextOwner === "unassigned")) {
    errors.push(`${label} Status handoff requires an assigned Next owner`);
  }

  const acceptance = taskSection(markdown, "Acceptance scenarios");
  const acceptanceItems = acceptance.match(/^- \[[ xX]\] .+$/gm) ?? [];
  const accepted = acceptanceItems.filter((item) => /^- \[[xX]\]/.test(item)).length;
  const verification = taskSection(markdown, "Verification");
  const verificationItems = verification.match(/^- \[[ xX]\] .+$/gm) ?? [];
  const verified = verificationItems.filter((item) => /^- \[[xX]\]/.test(item)).length;
  if (acceptanceItems.length === 0) errors.push(`${label} requires at least one acceptance checkbox`);
  if (metadata.status === "done" && accepted !== acceptanceItems.length) {
    errors.push(`${label} Status done requires every acceptance scenario to be checked`);
  }
  if (metadata.status === "done" && (verificationItems.length === 0 || verified !== verificationItems.length)) {
    errors.push(`${label} Status done requires every verification item to be checked`);
  }

  return {
    ...metadata,
    acceptance: {
      completed: accepted,
      total: acceptanceItems.length,
      percent: acceptanceItems.length ? Math.round((accepted / acceptanceItems.length) * 100) : null,
    },
    verification: { completed: verified, total: verificationItems.length },
  };
}

function gitProgress(root, base, errors) {
  const progress = {
    available: false,
    base,
    commits: null,
    changedFiles: null,
    additions: null,
    deletions: null,
    files: [],
  };
  if (!base) return progress;

  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", base, "HEAD"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  const changed = git(root, ["diff", "--name-only", base, "--"]);
  if (ancestor.status !== 0 || changed === null) {
    errors.push(`Git base is unavailable or not an ancestor: ${base}`);
    return progress;
  }

  const trackedFiles = changed ? changed.split(/\r?\n/).filter(Boolean) : [];
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]);
  const untrackedFiles = untracked ? untracked.split(/\r?\n/).filter(Boolean) : [];
  const files = [...new Set([...trackedFiles, ...untrackedFiles])].sort();
  const numstat = git(root, ["diff", "--numstat", base, "--"]) ?? "";
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const [added, deleted] = line.split("\t");
    if (/^\d+$/.test(added)) additions += Number(added);
    if (/^\d+$/.test(deleted)) deletions += Number(deleted);
  }
  progress.available = true;
  progress.commits = Number(git(root, ["rev-list", "--count", `${base}..HEAD`]) ?? 0);
  progress.changedFiles = files.length;
  progress.additions = additions;
  progress.deletions = deletions;
  progress.files = files;
  return progress;
}

export function validateRepository({
  root = process.cwd(),
  base = null,
  taskId = null,
  allTasks = false,
} = {}) {
  const absoluteRoot = resolve(root);
  const errors = [];
  const warnings = [];
  for (const path of REQUIRED_FILES) {
    if (!existsSync(resolve(absoluteRoot, path))) errors.push(`Missing required file: ${path}`);
  }

  const agentsPath = resolve(absoluteRoot, "AGENTS.md");
  const agents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
  if (agents && !agents.includes("<!-- repo-task-sync:start -->")) {
    errors.push("AGENTS.md does not contain the repo-task-sync entry marker");
  }

  const progress = gitProgress(absoluteRoot, base, errors);
  const taskFiles = listTasks(absoluteRoot);
  if (taskFiles.length === 0) errors.push("No task files found under .ai-team/tasks/");
  const ids = new Set();
  for (const task of taskFiles) {
    if (!task.id) continue;
    const normalized = task.id.toUpperCase();
    if (ids.has(normalized)) errors.push(`Task ID is duplicated: ${task.id}`);
    ids.add(normalized);
    if (task.kind === "legacy") warnings.push("Legacy .ai-team/TASK.md detected; run vibecollab migrate multi-task --dry-run");
  }
  const tasks = taskFiles.map((task) => taskSummary(task, errors));

  const changedTaskPaths = progress.files.filter(isTaskFile);
  const nonCollaborationFiles = progress.files.filter((path) => !isCollaborationFile(path));
  if (nonCollaborationFiles.length > 0 && changedTaskPaths.length === 0) {
    errors.push("Code or product files changed without updating the corresponding .ai-team/tasks/<ID>/TASK.md in the same PR");
  }
  if (nonCollaborationFiles.length > 0 && changedTaskPaths.length > 1) {
    errors.push("A normal code PR must update exactly one Task; split multi-task changes or use a separately reviewed integration PR");
  }
  if (base) {
    for (const path of changedTaskPaths) {
      const current = tasks.find((task) => task.path === path);
      const previousMarkdown = git(absoluteRoot, ["show", `${base}:${path}`]);
      if (!current || previousMarkdown === null) continue;
      const previousRevision = Number(taskField(previousMarkdown, "Revision") ?? 0);
      if (current.revision <= previousRevision) {
        errors.push(`${path} changed without increasing Revision above ${previousRevision}`);
      }
    }
  }

  const branch = git(absoluteRoot, ["branch", "--show-current"]);
  const resolved = resolveTask({
    root: absoluteRoot,
    taskId,
    branch,
    changedFiles: progress.files,
    allowSingle: true,
  });
  const needsSelectedTask = !allTasks || nonCollaborationFiles.length > 0 || Boolean(taskId);
  if (!resolved.task && needsSelectedTask) errors.push(resolved.error);
  const selected = resolved.task
    ? tasks.find((task) => task.path === resolved.task.path) ?? null
    : null;
  if (selected && changedTaskPaths.length === 1 && selected.path !== changedTaskPaths[0]) {
    errors.push(`Selected task ${selected.id} does not match changed task file ${changedTaskPaths[0]}`);
  }

  const sessionValidation = validateSessionConfiguration({ root: absoluteRoot });
  errors.push(...sessionValidation.errors);
  const sessions = buildSessionReport({ root: absoluteRoot });

  return {
    valid: errors.length === 0,
    task: selected,
    tasks,
    git: progress,
    sessions,
    warnings,
    errors,
  };
}

function printHuman(result) {
  const taskLines = result.task
    ? [
        `Task: ${result.task.id} — ${result.task.title}`,
        `State: ${result.task.status}; owner: ${result.task.owner}; next: ${result.task.nextOwner}`,
        `Functional progress: ${result.task.acceptance.completed}/${result.task.acceptance.total}${
          result.task.acceptance.percent === null ? "" : ` (${result.task.acceptance.percent}%)`
        }`,
      ]
    : [`Tasks: ${result.tasks.length}; no single task selected`];
  process.stdout.write(
    [
      ...taskLines,
      result.git.available
        ? `Code progress from ${result.git.base}: ${result.git.commits} commits, ${result.git.changedFiles} files, +${result.git.additions}/-${result.git.deletions}`
        : "Code progress: provide --base <target-branch-or-sha> to compare Git changes",
      result.sessions.enabled
        ? `Private sessions: ${result.sessions.totals.sessions}; closed: ${result.sessions.totals.closed}; token coverage: ${result.sessions.totals.tokenCoverage.reported}/${result.sessions.totals.tokenCoverage.total}`
        : "Private sessions: disabled",
      ...result.warnings.map((warning) => `Warning: ${warning}`),
      result.valid ? "Result: valid" : `Result: blocked\n- ${result.errors.join("\n- ")}`,
    ].join("\n") + "\n",
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = validateRepository(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printHuman(result);
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
