import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const TASKS_ROOT = ".ai-team/tasks";
export const LEGACY_TASK_PATH = ".ai-team/TASK.md";
export const CURRENT_TASK_PATH = ".ai-team/.runtime/current-task";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function taskField(markdown, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp("^- " + escaped + ": `([^`]+)`$", "m"))?.[1]?.trim() ?? null;
}

export function taskSection(markdown, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |$)`, "m"))?.[1]?.trim() ?? "";
}

export function normalizeTaskId(value) {
  const id = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(id)) {
    throw new Error(`Invalid task ID: ${value || "<empty>"}`);
  }
  return id;
}

export function taskSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "task";
}

export function taskTemplate({ id, title, owner = "unassigned" }) {
  return `# Task ${id}

- ID: \`${id}\`
- Title: \`${title}\`
- Revision: \`0\`
- Status: \`planning\`
- Owner: \`${owner}\`
- Next owner: \`unassigned\`

## Goal

Describe one concrete, observable outcome.

## Acceptance scenarios

- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.

## Invariants

- Keep behaviors that this task must not break.

## Decisions

- Record implementation decisions that the next developer must preserve.

## Completed

- Nothing completed yet.

## Pending

- Define the task contract before implementation.

## Next step

Complete this task contract, confirm one owner, and open its implementation PR.

## Verification

- [ ] Replace with the repository's required check commands and results.

## Handoff note

- From: \`unassigned\`
- To: \`unassigned\`
- Summary: No handoff has occurred.
`;
}

function readTaskAt(root, absolutePath, kind = "directory") {
  const markdown = readFileSync(absolutePath, "utf8").replaceAll("\r\n", "\n");
  const id = taskField(markdown, "ID");
  return {
    id,
    title: taskField(markdown, "Title"),
    revision: Number(taskField(markdown, "Revision") ?? 0),
    status: taskField(markdown, "Status"),
    owner: taskField(markdown, "Owner"),
    nextOwner: taskField(markdown, "Next owner"),
    kind,
    absolutePath,
    path: relative(root, absolutePath).replaceAll("\\", "/"),
    markdown,
  };
}

export function listTasks(root = process.cwd(), { includeLegacy = true } = {}) {
  const absoluteRoot = resolve(root);
  const tasksRoot = resolve(absoluteRoot, TASKS_ROOT);
  const tasks = [];
  if (existsSync(tasksRoot)) {
    for (const entry of readdirSync(tasksRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = resolve(tasksRoot, entry.name, "TASK.md");
      if (existsSync(path)) tasks.push(readTaskAt(absoluteRoot, path));
    }
  }
  const legacy = resolve(absoluteRoot, LEGACY_TASK_PATH);
  if (includeLegacy && existsSync(legacy)) tasks.push(readTaskAt(absoluteRoot, legacy, "legacy"));
  return tasks.sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function requestedFromBranch(branch, tasks) {
  if (!branch) return null;
  const normalizedBranch = branch.toLowerCase();
  const matches = tasks.filter((task) => {
    if (!task.id) return false;
    const escaped = task.id.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[/_-])${escaped}(?:$|[/_-])`).test(normalizedBranch);
  });
  return matches.length === 1 ? matches[0].id : null;
}

function taskIdsFromChangedFiles(changedFiles, tasks) {
  const normalized = new Set((changedFiles || []).map((path) => path.replaceAll("\\", "/")));
  return tasks.filter((task) => normalized.has(task.path)).map((task) => task.id).filter(Boolean);
}

export function resolveTask({
  root = process.cwd(),
  taskId = null,
  branch = null,
  changedFiles = [],
  allowSingle = true,
  includeLegacy = true,
} = {}) {
  const absoluteRoot = resolve(root);
  const tasks = listTasks(absoluteRoot, { includeLegacy });
  const selectedPath = resolve(absoluteRoot, CURRENT_TASK_PATH);
  const locallySelected = existsSync(selectedPath) ? readFileSync(selectedPath, "utf8").trim() : null;
  const changedIds = [...new Set(taskIdsFromChangedFiles(changedFiles, tasks))];
  const requested =
    taskId ||
    process.env.VIBECOLLAB_TASK_ID ||
    locallySelected ||
    requestedFromBranch(branch || git(absoluteRoot, ["branch", "--show-current"]), tasks) ||
    (changedIds.length === 1 ? changedIds[0] : null) ||
    (allowSingle && tasks.length === 1 ? tasks[0].id : null);

  if (!requested) {
    return {
      task: null,
      tasks,
      error:
        tasks.length === 0
          ? `No tasks found under ${TASKS_ROOT}`
          : "Task is ambiguous; pass --task <ID>, use a task/<ID>-<slug> branch, or run vibecollab task use <ID>",
    };
  }
  let normalized;
  try {
    normalized = normalizeTaskId(requested);
  } catch (error) {
    return { task: null, tasks, error: error.message };
  }
  const matches = tasks.filter((task) => task.id && task.id.toUpperCase() === normalized);
  if (matches.length !== 1) {
    return {
      task: null,
      tasks,
      error: matches.length ? `Task ID is duplicated: ${normalized}` : `Task not found: ${normalized}`,
    };
  }
  return { task: matches[0], tasks, error: null };
}

export function createTask({ root = process.cwd(), id, title, owner = "unassigned" }) {
  const absoluteRoot = resolve(root);
  const normalizedId = normalizeTaskId(id);
  const existing = listTasks(absoluteRoot).find(
    (task) => task.id && task.id.toUpperCase() === normalizedId,
  );
  if (existing) throw new Error(`Task already exists: ${normalizedId} (${existing.path})`);
  const directory = `${normalizedId}-${taskSlug(title)}`;
  const path = resolve(absoluteRoot, TASKS_ROOT, directory, "TASK.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, taskTemplate({ id: normalizedId, title, owner }), "utf8");
  return {
    id: normalizedId,
    title,
    owner,
    path: relative(absoluteRoot, path).replaceAll("\\", "/"),
  };
}

export function selectTask({ root = process.cwd(), id }) {
  const absoluteRoot = resolve(root);
  const resolved = resolveTask({ root: absoluteRoot, taskId: id, allowSingle: false });
  if (!resolved.task) throw new Error(resolved.error);
  const path = resolve(absoluteRoot, CURRENT_TASK_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${resolved.task.id}\n`, "utf8");
  return { id: resolved.task.id, path: resolved.task.path, selection: CURRENT_TASK_PATH };
}

export function migrateLegacyTask({ root = process.cwd(), dryRun = false } = {}) {
  const absoluteRoot = resolve(root);
  const legacyPath = resolve(absoluteRoot, LEGACY_TASK_PATH);
  if (!existsSync(legacyPath)) throw new Error(`Legacy task not found: ${LEGACY_TASK_PATH}`);
  const legacy = readTaskAt(absoluteRoot, legacyPath, "legacy");
  const id = normalizeTaskId(legacy.id);
  const title = legacy.title || id;
  const destination = resolve(absoluteRoot, TASKS_ROOT, `${id}-${taskSlug(title)}`, "TASK.md");
  if (existsSync(destination)) {
    throw new Error(`Migration target already exists: ${relative(absoluteRoot, destination).replaceAll("\\", "/")}`);
  }
  const result = {
    dryRun,
    from: LEGACY_TASK_PATH,
    to: relative(absoluteRoot, destination).replaceAll("\\", "/"),
    id,
  };
  if (!dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(legacyPath, destination);
  }
  return result;
}

export function isTaskFile(path) {
  const normalized = String(path || "").replaceAll("\\", "/");
  return normalized === LEGACY_TASK_PATH || /^\.ai-team\/tasks\/[^/]+\/TASK\.md$/.test(normalized);
}
